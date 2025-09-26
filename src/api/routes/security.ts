import { Router } from 'express';
import { SecurityController } from '../controllers/SecurityController';
import { authenticateToken } from '../middleware/auth';
import { Pool } from 'pg';

// This would be injected in a real application
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const router = Router();
const securityController = new SecurityController(dbPool);

// All security endpoints require authentication
router.use(authenticateToken);

// Security audit endpoints
router.get('/audit/events', securityController.getAuditEvents);
router.get('/audit/stats', securityController.getSecurityStats);

// Encryption validation
router.post('/validate-encryption', securityController.validateEncryption);

// Backup and recovery endpoints
router.post('/backup', securityController.createBackup);
router.get('/backups', securityController.listBackups);
router.get('/backup/:backupId/verify', securityController.verifyBackup);
router.post('/restore', securityController.restoreBackup);

export default router;