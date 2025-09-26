import { Router } from 'express';
import { ProjectController } from '@/api/controllers/ProjectController';
import { authenticateToken } from '@/api/middleware/auth';
import { validate, validateQuery } from '@/utils/validation';
import { projectSchemas } from '@/utils/validation';
import Joi from 'joi';

const router = Router();
const projectController = new ProjectController();

// Project query filters schema
const projectFiltersSchema = Joi.object({
  withTaskCounts: Joi.boolean().optional(),
  summaryOnly: Joi.boolean().optional(),
  withTasks: Joi.boolean().optional(),
  force: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(50).optional()
});

// Apply authentication to all routes
router.use(authenticateToken);

// Project CRUD routes
router.post('/', validate(projectSchemas.createProject), projectController.createProject);
router.get('/', validateQuery(projectFiltersSchema), projectController.getProjects);
router.get('/statistics', projectController.getProjectStatistics);
router.get('/by-status', projectController.getProjectsByStatus);
router.get('/most-active', validateQuery(projectFiltersSchema), projectController.getMostActiveProjects);
router.get('/recently-updated', validateQuery(projectFiltersSchema), projectController.getRecentlyUpdatedProjects);
router.get('/:id', validateQuery(projectFiltersSchema), projectController.getProject);
router.put('/:id', validate(projectSchemas.updateProject), projectController.updateProject);
router.delete('/:id', validateQuery(projectFiltersSchema), projectController.deleteProject);

// Project progress routes
router.get('/:id/progress', projectController.getProjectProgress);

// Project analytics and progress visualization
const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});
router.get('/:id/analytics', validateQuery(analyticsQuerySchema), projectController.getProjectProgressAnalytics);
router.get('/overview/progress', projectController.getAllProjectsProgressOverview);

export default router;