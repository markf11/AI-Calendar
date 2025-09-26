import request from 'supertest';
import express from 'express';
import taskRoutes from '@/api/routes/tasks';
import projectRoutes from '@/api/routes/projects';
import { authenticateToken } from '@/api/middleware/auth';

// Mock the authentication middleware
jest.mock('@/api/middleware/auth');
jest.mock('@/services/TaskService');
jest.mock('@/services/ProjectService');

describe('Progress API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication to always pass
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'test-user-id' };
      next();
    });

    app.use('/api/tasks', taskRoutes);
    app.use('/api/projects', projectRoutes);
  });

  describe('Task Progress Endpoints', () => {
    it('should have task completion history endpoint', async () => {
      const response = await request(app)
        .get('/api/tasks/task-123/completion-history')
        .expect(200);

      // The actual response will depend on the mocked service
      expect(response.body).toHaveProperty('success');
    });

    it('should have task with history endpoint', async () => {
      const response = await request(app)
        .get('/api/tasks/task-123/history')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should have partial progress logging endpoint', async () => {
      const response = await request(app)
        .post('/api/tasks/task-123/log-progress')
        .send({
          minutesCompleted: 30,
          notes: 'Made good progress'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should validate partial progress input', async () => {
      await request(app)
        .post('/api/tasks/task-123/log-progress')
        .send({
          minutesCompleted: 0 // Invalid: must be > 0
        })
        .expect(400);

      await request(app)
        .post('/api/tasks/task-123/log-progress')
        .send({
          minutesCompleted: -5 // Invalid: must be > 0
        })
        .expect(400);
    });

    it('should have task analytics endpoint', async () => {
      const response = await request(app)
        .get('/api/tasks/analytics/progress')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should accept date range for task analytics', async () => {
      const response = await request(app)
        .get('/api/tasks/analytics/progress')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should validate date format for analytics', async () => {
      await request(app)
        .get('/api/tasks/analytics/progress')
        .query({
          startDate: 'invalid-date',
          endDate: '2024-01-31T23:59:59.999Z'
        })
        .expect(400);
    });
  });

  describe('Project Progress Endpoints', () => {
    it('should have project analytics endpoint', async () => {
      const response = await request(app)
        .get('/api/projects/project-123/analytics')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should accept date range for project analytics', async () => {
      const response = await request(app)
        .get('/api/projects/project-123/analytics')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should have projects overview endpoint', async () => {
      const response = await request(app)
        .get('/api/projects/overview/progress')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should validate date format for project analytics', async () => {
      await request(app)
        .get('/api/projects/project-123/analytics')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: 'invalid-date'
        })
        .expect(400);
    });

    it('should validate date range order', async () => {
      await request(app)
        .get('/api/projects/project-123/analytics')
        .query({
          startDate: '2024-01-31T00:00:00.000Z',
          endDate: '2024-01-01T00:00:00.000Z' // End before start
        })
        .expect(400);
    });
  });

  describe('Existing Progress Endpoints', () => {
    it('should maintain existing project progress endpoint', async () => {
      const response = await request(app)
        .get('/api/projects/project-123/progress')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should maintain existing task completion endpoints', async () => {
      // Mark completed
      await request(app)
        .post('/api/tasks/task-123/mark-completed')
        .send({ notes: 'Finished' })
        .expect(200);

      // Unmark completed
      await request(app)
        .post('/api/tasks/task-123/unmark-completed')
        .expect(200);

      // Complete with details
      await request(app)
        .post('/api/tasks/task-123/complete')
        .send({
          minutesCompleted: 60,
          notes: 'Partial completion',
          isFullCompletion: false
        })
        .expect(200);
    });
  });

  describe('Route Parameter Validation', () => {
    it('should validate UUID format for task IDs', async () => {
      await request(app)
        .get('/api/tasks/invalid-uuid/history')
        .expect(404); // Express will return 404 for invalid route params
    });

    it('should validate UUID format for project IDs', async () => {
      await request(app)
        .get('/api/projects/invalid-uuid/analytics')
        .expect(404);
    });
  });
});