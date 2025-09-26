import { Router } from 'express';
import { TaskController } from '@/api/controllers/TaskController';
import { authenticateToken } from '@/api/middleware/auth';
import { validate, validateQuery } from '@/utils/validation';
import { taskSchemas, querySchemas, commonSchemas } from '@/utils/validation';
import Joi from 'joi';

const router = Router();
const taskController = new TaskController();

// Task status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'scheduled', 'in_progress', 'completed', 'blocked').required()
});

// Mark completed schema
const markCompletedSchema = Joi.object({
  notes: Joi.string().max(500).optional()
});

// Task query filters schema
const taskFiltersSchema = Joi.object({
  status: Joi.alternatives().try(
    Joi.string().valid('pending', 'scheduled', 'in_progress', 'completed', 'blocked'),
    Joi.array().items(Joi.string().valid('pending', 'scheduled', 'in_progress', 'completed', 'blocked'))
  ).optional(),
  priority: Joi.alternatives().try(
    Joi.string().valid('low', 'medium', 'high', 'critical'),
    Joi.array().items(Joi.string().valid('low', 'medium', 'high', 'critical'))
  ).optional(),
  projectId: Joi.string().uuid().optional(),
  hasDeadline: Joi.boolean().optional(),
  isOverdue: Joi.boolean().optional(),
  withProject: Joi.boolean().optional()
});

// Apply authentication to all routes
router.use(authenticateToken);

// Task CRUD routes
router.post('/', validate(taskSchemas.createTask), taskController.createTask);
router.get('/', validateQuery(taskFiltersSchema), taskController.getTasks);
router.get('/summary', taskController.getTaskSummary);
router.get('/overdue', taskController.getOverdueTasks);
router.get('/pending', taskController.getPendingTasks);
router.get('/:id', taskController.getTask);
router.put('/:id', validate(taskSchemas.updateTask), taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Task completion routes
router.post('/:id/complete', validate(taskSchemas.taskCompletion), taskController.completeTask);
router.post('/:id/mark-completed', validate(markCompletedSchema), taskController.markCompleted);
router.post('/:id/unmark-completed', taskController.unmarkCompleted);

// Task progress and history routes
router.get('/:id/history', taskController.getTaskWithHistory);
router.get('/:id/completion-history', taskController.getCompletionHistory);

// Partial progress logging
const partialProgressSchema = Joi.object({
  minutesCompleted: Joi.number().integer().min(1).required(),
  notes: Joi.string().max(500).optional()
});
router.post('/:id/log-progress', validate(partialProgressSchema), taskController.logPartialProgress);

// Task analytics
const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});
router.get('/analytics/progress', validateQuery(analyticsQuerySchema), taskController.getProgressAnalytics);

// Task status update
router.patch('/:id/status', validate(updateStatusSchema), taskController.updateStatus);

// Task dependency routes
const dependencySchema = Joi.object({
  dependsOnTaskId: Joi.string().uuid().required()
});

router.post('/:id/dependencies', validate(dependencySchema), taskController.addDependency);
router.delete('/:id/dependencies', validate(dependencySchema), taskController.removeDependency);
router.get('/:id/dependencies', taskController.getDependencies);
router.get('/:id/dependents', taskController.getDependents);
router.get('/:id/dependency-status', taskController.getDependencyStatus);

export default router;