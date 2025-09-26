import { Pool } from 'pg';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { monitoringService } from './MonitoringService';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  tables: string[];
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface RestoreOptions {
  backupId: string;
  targetTimestamp?: Date;
  tablesToRestore?: string[];
  dryRun?: boolean;
}

class BackupService {
  private backupDirectory: string;
  private backupMetadata: BackupMetadata[] = [];
  private dbPool: Pool;

  constructor(dbPool: Pool, backupDirectory: string = './backups') {
    this.dbPool = dbPool;
    this.backupDirectory = backupDirectory;
    
    // Ensure backup directory exists
    if (!existsSync(this.backupDirectory)) {
      mkdirSync(this.backupDirectory, { recursive: true });
    }
  }

  // Create full database backup
  public async createFullBackup(): Promise<BackupMetadata> {
    const tracker = monitoringService.trackPerformance('database_backup_full');
    const backupId = `full_${Date.now()}`;
    const timestamp = new Date();
    
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'full',
      size: 0,
      checksum: '',
      tables: [],
      status: 'in_progress'
    };

    try {
      // Get list of all tables
      const tablesResult = await this.dbPool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      
      const tables = tablesResult.rows.map(row => row.tablename);
      metadata.tables = tables;

      // Create backup file path
      const backupPath = join(this.backupDirectory, `${backupId}.sql.gz`);
      
      // Generate SQL dump
      const dumpCommand = `pg_dump ${process.env.DATABASE_URL} --no-owner --no-privileges`;
      const { spawn } = require('child_process');
      
      const dumpProcess = spawn('sh', ['-c', dumpCommand]);
      const gzipStream = createGzip();
      const writeStream = createWriteStream(backupPath);

      // Pipeline: pg_dump -> gzip -> file
      await pipeline(dumpProcess.stdout, gzipStream, writeStream);

      // Calculate file size and checksum
      const fs = require('fs');
      const stats = fs.statSync(backupPath);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.status = 'completed';

      this.backupMetadata.push(metadata);
      tracker.end();

      monitoringService.trackUserEvent('system', 'backup_created', {
        type: 'full',
        size: metadata.size,
        tables: tables.length
      });

      return metadata;

    } catch (error) {
      tracker.end();
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      
      monitoringService.trackError(error as Error, 'database_backup_full', 'critical');
      throw error;
    }
  }

  // Create incremental backup (changes since last backup)
  public async createIncrementalBackup(sinceTimestamp: Date): Promise<BackupMetadata> {
    const tracker = monitoringService.trackPerformance('database_backup_incremental');
    const backupId = `incremental_${Date.now()}`;
    const timestamp = new Date();
    
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'incremental',
      size: 0,
      checksum: '',
      tables: [],
      status: 'in_progress'
    };

    try {
      // Tables that track changes with updated_at
      const trackableTables = ['users', 'tasks', 'projects', 'calendar_events', 'booking_links'];
      metadata.tables = trackableTables;

      const backupPath = join(this.backupDirectory, `${backupId}.sql.gz`);
      const writeStream = createWriteStream(backupPath);
      const gzipStream = createGzip();

      let sqlContent = '';

      // Export changed records from each table
      for (const table of trackableTables) {
        const result = await this.dbPool.query(`
          SELECT * FROM ${table} 
          WHERE updated_at > $1
        `, [sinceTimestamp]);

        if (result.rows.length > 0) {
          // Generate INSERT statements
          const columns = Object.keys(result.rows[0]);
          const insertStatements = result.rows.map(row => {
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              if (value instanceof Date) return `'${value.toISOString()}'`;
              return value.toString();
            }).join(', ');
            
            return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')};`;
          });

          sqlContent += `-- Table: ${table}\n${insertStatements.join('\n')}\n\n`;
        }
      }

      // Write compressed backup
      gzipStream.write(sqlContent);
      gzipStream.end();
      await pipeline(gzipStream, writeStream);

      // Calculate metadata
      const fs = require('fs');
      const stats = fs.statSync(backupPath);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.status = 'completed';

      this.backupMetadata.push(metadata);
      tracker.end();

      return metadata;

    } catch (error) {
      tracker.end();
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      
      monitoringService.trackError(error as Error, 'database_backup_incremental', 'high');
      throw error;
    }
  }

  // Restore from backup
  public async restoreFromBackup(options: RestoreOptions): Promise<boolean> {
    const tracker = monitoringService.trackPerformance('database_restore');
    
    try {
      const backup = this.backupMetadata.find(b => b.id === options.backupId);
      if (!backup) {
        throw new Error(`Backup ${options.backupId} not found`);
      }

      const backupPath = join(this.backupDirectory, `${backup.id}.sql.gz`);
      if (!existsSync(backupPath)) {
        throw new Error(`Backup file ${backupPath} not found`);
      }

      // Verify backup integrity
      const currentChecksum = await this.calculateChecksum(backupPath);
      if (currentChecksum !== backup.checksum) {
        throw new Error('Backup file integrity check failed');
      }

      if (options.dryRun) {
        console.log(`Dry run: Would restore backup ${options.backupId}`);
        return true;
      }

      // Create database transaction for restore
      const client = await this.dbPool.connect();
      
      try {
        await client.query('BEGIN');

        // If specific tables requested, only restore those
        if (options.tablesToRestore && options.tablesToRestore.length > 0) {
          // This would require parsing the SQL file and filtering
          // For now, we'll restore everything and log a warning
          console.warn('Partial table restore not yet implemented, restoring full backup');
        }

        // Read and execute backup
        const fs = require('fs');
        const readStream = createReadStream(backupPath);
        const gunzipStream = createGunzip();
        
        let sqlContent = '';
        gunzipStream.on('data', (chunk) => {
          sqlContent += chunk.toString();
        });

        await pipeline(readStream, gunzipStream);

        // Execute SQL statements
        await client.query(sqlContent);
        await client.query('COMMIT');

        tracker.end();
        
        monitoringService.trackUserEvent('system', 'backup_restored', {
          backupId: options.backupId,
          type: backup.type
        });

        return true;

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      tracker.end();
      monitoringService.trackError(error as Error, 'database_restore', 'critical');
      throw error;
    }
  }
}  // L
ist available backups
  public getBackupList(): BackupMetadata[] {
    return this.backupMetadata.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Delete old backups based on retention policy
  public async cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const backupsToDelete = this.backupMetadata.filter(b => b.timestamp < cutoffDate);
    
    let deletedCount = 0;
    const fs = require('fs');

    for (const backup of backupsToDelete) {
      try {
        const backupPath = join(this.backupDirectory, `${backup.id}.sql.gz`);
        if (existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        
        // Remove from metadata
        const index = this.backupMetadata.indexOf(backup);
        if (index > -1) {
          this.backupMetadata.splice(index, 1);
        }
        
        deletedCount++;
      } catch (error) {
        monitoringService.trackError(error as Error, 'backup_cleanup', 'medium');
      }
    }

    return deletedCount;
  }

  // Verify backup integrity
  public async verifyBackup(backupId: string): Promise<boolean> {
    const backup = this.backupMetadata.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const backupPath = join(this.backupDirectory, `${backup.id}.sql.gz`);
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file ${backupPath} not found`);
    }

    const currentChecksum = await this.calculateChecksum(backupPath);
    return currentChecksum === backup.checksum;
  }

  // Schedule automatic backups
  public scheduleAutomaticBackups() {
    // Full backup daily at 2 AM
    const scheduleFullBackup = () => {
      const now = new Date();
      const tomorrow2AM = new Date(now);
      tomorrow2AM.setDate(tomorrow2AM.getDate() + 1);
      tomorrow2AM.setHours(2, 0, 0, 0);
      
      const msUntil2AM = tomorrow2AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await this.createFullBackup();
          console.log('Scheduled full backup completed');
        } catch (error) {
          console.error('Scheduled full backup failed:', error);
        }
        
        // Schedule next backup
        scheduleFullBackup();
      }, msUntil2AM);
    };

    // Incremental backup every 4 hours
    const scheduleIncrementalBackup = () => {
      setTimeout(async () => {
        try {
          const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
          await this.createIncrementalBackup(fourHoursAgo);
          console.log('Scheduled incremental backup completed');
        } catch (error) {
          console.error('Scheduled incremental backup failed:', error);
        }
        
        // Schedule next incremental backup
        scheduleIncrementalBackup();
      }, 4 * 60 * 60 * 1000); // 4 hours
    };

    scheduleFullBackup();
    scheduleIncrementalBackup();
  }

  // Private helper methods
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const fs = require('fs');
    
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

export { BackupService };