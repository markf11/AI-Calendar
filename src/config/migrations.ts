import { Database } from './database';
import fs from 'fs';
import path from 'path';

export interface Migration {
  id: string;
  filename: string;
  sql: string;
  appliedAt?: Date;
}

export class MigrationRunner {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await this.db.query(sql);
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db.query('SELECT id FROM migrations ORDER BY applied_at');
    return result.rows.map((row: any) => row.id);
  }

  async getMigrationFiles(): Promise<Migration[]> {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const id = filename.replace('.sql', '');
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      return { id, filename, sql };
    });
  }

  async runMigrations(): Promise<void> {
    await this.createMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      migration => !appliedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);

    for (const migration of pendingMigrations) {
      console.log(`Applying migration: ${migration.filename}`);
      
      try {
        // Run migration in a transaction
        await this.db.query('BEGIN');
        await this.db.query(migration.sql);
        await this.db.query(
          'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
          [migration.id, migration.filename]
        );
        await this.db.query('COMMIT');
        
        console.log(`✓ Applied migration: ${migration.filename}`);
      } catch (error) {
        await this.db.query('ROLLBACK');
        console.error(`✗ Failed to apply migration: ${migration.filename}`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    // Note: This is a basic implementation. In production, you'd want
    // to have rollback scripts for each migration
    console.warn('Rollback functionality not implemented. Manual rollback required.');
    
    await this.db.query(
      'DELETE FROM migrations WHERE id = $1',
      [migrationId]
    );
    
    console.log(`Migration ${migrationId} marked as rolled back`);
  }
}