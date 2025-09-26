import { Router } from 'express';
import { SyncController } from '@/api/controllers/SyncController';
import { authenticateToken } from '@/api/middleware/auth';

const router = Router();
const syncController = new SyncController();

// All sync routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/sync/offline
 * @desc Sync offline changes when client comes back online
 * @access Private
 */
router.post('/offline', syncController.syncOfflineChanges);

/**
 * @route GET /api/sync/cache
 * @desc Get offline cache data for mobile clients
 * @access Private
 */
router.get('/cache', syncController.getOfflineCache);

/**
 * @route GET /api/sync/status
 * @desc Get sync status for the user
 * @access Private
 */
router.get('/status', syncController.getSyncStatus);

/**
 * @route POST /api/sync/resolve-conflict
 * @desc Resolve sync conflicts
 * @access Private
 */
router.post('/resolve-conflict', syncController.resolveConflict);

/**
 * @route POST /api/sync/force-full
 * @desc Force full sync for troubleshooting
 * @access Private
 */
router.post('/force-full', syncController.forceFullSync);

/**
 * @route POST /api/sync/trigger
 * @desc Trigger manual sync for specific data
 * @access Private
 */
router.post('/trigger', syncController.triggerSync);

export default router;