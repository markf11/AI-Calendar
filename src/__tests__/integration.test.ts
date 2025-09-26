import request from 'supertest';
import { createApp } from '@/api';

describe('API Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API is healthy');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should return validation error for invalid registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          name: '',
          password: 'weak'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Validation failed');
    });

    it('should return validation error for invalid login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email'
          // missing password
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Validation failed');
    });
  });

  describe('Protected Routes', () => {
    it('should require authentication for user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });
});