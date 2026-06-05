import { Request, Response } from 'express';
import { securityService } from '../../services/SecurityService';
import { BackupService } from '../../services/BackupService';
import { Pool } from 'pg';

export class SecurityController {
  private backupService: BackupService;

  constructor(dbPool: Pool) {
    this.backupService = new BackupService(dbPool);
  }

  // Get security audit events
  public async getAuditEvents(req: Request, res: Response) {
    try {
      const { startDate, endDate, severity } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const events = securityService.getAuditEvents(
        timeRange,
        severity as any
      );

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get audit events' });
    }
  }

  // Get security statistics
  public async getSecurityStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const stats = securityService.getSecurityStats(timeRange);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get security statistics' });
    }
  }

  // Validate data encryption
  public async validateEncryption(req: Request, res: Response) {
    try {
      const { data, algorithm } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'Data is required' });
      }

      const result = securityService.validateEncryption(data, algorithm);
      return res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate encryption' });
      return;
    }
  }

  // Create database backup
  public async createBackup(req: Request, res: Response) {
    try {
      const { type = 'full', sinceTimestamp } = req.body;
      
      let backup;
      if (type === 'incremental' && sinceTimestamp) {
        backup = await this.backupService.createIncrementalBackup(new Date(sinceTimestamp));
      } else {
        backup = await this.backupService.createFullBackup();
      }

      res.json(backup);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create backup' });
    }
  }

  // List available backups
  public async listBackups(req: Request, res: Response) {
    try {
      const backups = this.backupService.getBackupList();
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list backups' });
    }
  }

  // Verify backup integrity
  public async verifyBackup(req: Request, res: Response) {
    try {
      const { backupId } = req.params;
      const isValid = await this.backupService.verifyBackup(backupId);
      
      res.json({ backupId, isValid });
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify backup' });
    }
  }

  // Restore from backup
  public async restoreBackup(req: Request, res: Response) {
    try {
      const { backupId, tablesToRestore, dryRun } = req.body;
      
      const success = await this.backupService.restoreFromBackup({
        backupId,
        tablesToRestore,
        dryRun
      });

      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to restore backup' });
    }
  }
}