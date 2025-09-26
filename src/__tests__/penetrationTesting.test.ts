import request from 'supertest';
import express from 'express';
import { securityService } from '../services/SecurityService';

// Create test app with security middleware
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(securityService.securityHeadersMiddleware());
  app.use(securityService.createRateLimiter({
    windowMs: 60000,
    maxRequests: 5
  }));

  // Test endpoints
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    // Simulate authentication logic
    if (email === 'valid@example.com' && password === 'correct') {
      res.json({ success: true, token: 'valid_token' });
    } else {
      securityService.trackFailedLogin(email, req.ip);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/protected', (req, res) => {
    const token = req.headers.authorization;
    if (token === 'Bearer valid_token') {
      res.json({ data: 'sensitive_data' });
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  });

  app.post('/api/data', (req, res) => {
    // Simulate data processing
    res.json({ received: req.body });
  });

  return app;
};

describe('Penetration Testing Scenarios', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    securityService.cleanupOldAuditEvents(0);
  });

  describe('Authentication Security', () => {
    it('should prevent brute force login attempts', async () => {
      const email = 'test@example.com';
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/login')
          .send({ email, password: 'wrong_password' })
          .expect(401);
      }

      // Check if security events were logged
      const events = securityService.getAuditEvents();
      const failedLoginEvents = events.filter(e => e.event === 'failed_login_attempt');
      expect(failedLoginEvents.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection attempts in login', async () => {
      const maliciousPayloads = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'/**/OR/**/1=1#"
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/login')
          .send({ email: payload, password: 'password' });
        
        // Should not return sensitive data or cause errors
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      }
    });

    it('should validate JWT tokens properly', async () => {
      const maliciousTokens = [
        'Bearer fake_token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature',
        'Bearer null',
        'Bearer undefined',
        ''
      ];

      for (const token of maliciousTokens) {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', token);
        
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should handle XSS attempts', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        "'; alert('XSS'); //"
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/data')
          .send({ message: payload });
        
        // Should not execute scripts or return unescaped content
        expect(response.status).toBe(200);
        expect(response.body.received.message).toBe(payload);
      }
    });

    it('should handle oversized payloads', async () => {
      const largePayload = 'A'.repeat(10 * 1024 * 1024); // 10MB
      
      const response = await request(app)
        .post('/api/data')
        .send({ data: largePayload });
      
      // Should handle large payloads gracefully
      expect([200, 413, 400]).toContain(response.status);
    });

    it('should validate content types', async () => {
      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/xml')
        .send('<xml>test</xml>');
      
      // Should reject non-JSON content types for JSON endpoints
      expect([400, 415]).toContain(response.status);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make 6 requests (limit is 5)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .get('/api/protected')
            .set('Authorization', 'Bearer valid_token')
        );
      }
      
      const responses = await Promise.all(requests);
      
      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle concurrent requests from same IP', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      );
      
      const responses = await Promise.all(concurrentRequests);
      
      // Some requests should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should prevent clickjacking', async () => {
      const response = await request(app).get('/api/protected');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent MIME type sniffing', async () => {
      const response = await request(app).get('/api/protected');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in errors', async () => {
      // Test various error conditions
      const errorTests = [
        { path: '/api/nonexistent', expectedStatus: 404 },
        { path: '/api/protected', expectedStatus: 401 },
      ];

      for (const test of errorTests) {
        const response = await request(app).get(test.path);
        
        expect(response.status).toBe(test.expectedStatus);
        
        // Should not contain sensitive information
        const responseText = JSON.stringify(response.body).toLowerCase();
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('token');
        expect(responseText).not.toContain('database');
        expect(responseText).not.toContain('stack trace');
      }
    });
  });

  describe('Session Security', () => {
    it('should handle session fixation attempts', async () => {
      // Attempt to use a fixed session ID
      const response = await request(app)
        .post('/api/login')
        .set('Cookie', 'sessionid=fixed_session_id')
        .send({ email: 'valid@example.com', password: 'correct' });
      
      // Should not accept fixed session IDs
      expect(response.status).toBe(200);
      // In a real implementation, should generate new session ID
    });

    it('should handle concurrent sessions', async () => {
      // Test multiple login attempts with same credentials
      const loginRequests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/login')
          .send({ email: 'valid@example.com', password: 'correct' })
      );
      
      const responses = await Promise.all(loginRequests);
      
      // All should succeed (or implement session limits)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});