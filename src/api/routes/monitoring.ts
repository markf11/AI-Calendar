import { Router } from 'express';
import { MonitoringController } from '../controllers/MonitoringController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const monitoringController = new MonitoringController();

// Public health check endpoint
router.get('/health', monitoringController.getHealthStatus);

// Protected monitoring endpoints (require authentication)
router.use(authenticateToken);

// Performance metrics
router.get('/performance', monitoringController.getPerformanceMetrics);

// Error statistics
router.get('/errors', monitoringController.getErrorStats);

// User analytics
router.get('/analytics/users', monitoringController.getUserAnalytics);
router.get('/analytics/features', monitoringController.getFeatureAdoption);
router.get('/analytics/scheduling', monitoringController.getSchedulingPerformance);
router.get('/analytics/engagement', monitoringController.getUserEngagement);

export default router;