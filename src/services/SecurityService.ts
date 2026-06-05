import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { monitoringService } from './MonitoringService';

export interface SecurityAuditEvent {
  userId?: string;
  event: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface EncryptionValidationResult {
  isValid: boolean;
  algorithm: string;
  keyLength: number;
  errors: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class SecurityService {
  private auditEvents: SecurityAuditEvent[] = [];
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private suspiciousIPs = new Set<string>();
  private failedLoginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

  // Security audit logging
  public auditSecurityEvent(
    event: string,
    severity: SecurityAuditEvent['severity'],
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ) {
    const auditEvent: SecurityAuditEvent = {
      userId,
      event,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      severity,
      metadata
    };

    this.auditEvents.push(auditEvent);

    // Track in monitoring service
    monitoringService.trackUserEvent(userId || 'anonymous', 'security_event', {
      event,
      severity,
      ipAddress,
      ...metadata
    });

    // Log critical events immediately
    if (severity === 'critical') {
      console.error(`[SECURITY CRITICAL] ${event}`, {
        userId,
        ipAddress,
        userAgent,
        metadata
      });
    }

    // Check for suspicious patterns
    this.detectSuspiciousActivity(auditEvent);
  }

  // Data encryption validation
  public validateEncryption(encryptedData: string, algorithm: string = 'aes-256-gcm'): EncryptionValidationResult {
    const errors: string[] = [];
    let isValid = true;

    try {
      // Check if data appears to be encrypted (not plaintext)
      if (this.isLikelyPlaintext(encryptedData)) {
        errors.push('Data appears to be unencrypted plaintext');
        isValid = false;
      }

      // Validate algorithm
      const supportedAlgorithms = ['aes-256-gcm', 'aes-256-cbc', 'aes-192-gcm'];
      if (!supportedAlgorithms.includes(algorithm)) {
        errors.push(`Unsupported encryption algorithm: ${algorithm}`);
        isValid = false;
      }

      // Check minimum length for encrypted data
      if (encryptedData.length < 32) {
        errors.push('Encrypted data appears too short to be properly encrypted');
        isValid = false;
      }

      // Validate base64 encoding if expected
      if (!this.isValidBase64(encryptedData)) {
        errors.push('Encrypted data is not valid base64 encoding');
        isValid = false;
      }

    } catch (error) {
      errors.push(`Encryption validation failed: ${(error as Error).message}`);
      isValid = false;
    }

    return {
      isValid,
      algorithm,
      keyLength: algorithm.includes('256') ? 256 : algorithm.includes('192') ? 192 : 128,
      errors
    };
  }

  // Rate limiting middleware
  public createRateLimiter(config: RateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getRateLimitKey(req);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Clean up old entries
      const current = this.rateLimitStore.get(key);
      if (!current || current.resetTime < windowStart) {
        this.rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
        return next();
      }

      // Check if limit exceeded
      if (current.count >= config.maxRequests) {
        this.auditSecurityEvent(
          'rate_limit_exceeded',
          'medium',
          req.user?.id,
          req.ip,
          req.get('User-Agent'),
          { endpoint: req.path, method: req.method }
        );

        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        });
      }

      // Increment counter
      current.count++;
      next();
    };
  }

  // Failed login attempt tracking
  public trackFailedLogin(identifier: string, ipAddress?: string) {
    const current = this.failedLoginAttempts.get(identifier) || { count: 0, lastAttempt: new Date() };
    current.count++;
    current.lastAttempt = new Date();
    
    this.failedLoginAttempts.set(identifier, current);

    // Audit the failed attempt
    this.auditSecurityEvent(
      'failed_login_attempt',
      current.count > 5 ? 'high' : 'medium',
      undefined,
      ipAddress,
      undefined,
      { identifier, attemptCount: current.count }
    );

    // Mark IP as suspicious after multiple failures
    if (current.count > 10 && ipAddress) {
      this.suspiciousIPs.add(ipAddress);
      this.auditSecurityEvent(
        'ip_marked_suspicious',
        'high',
        undefined,
        ipAddress,
        undefined,
        { reason: 'multiple_failed_logins', attemptCount: current.count }
      );
    }

    return current.count;
  }

  // Clear failed login attempts on successful login
  public clearFailedLoginAttempts(identifier: string) {
    this.failedLoginAttempts.delete(identifier);
  }

  // Check if IP is suspicious
  public isSuspiciousIP(ipAddress: string): boolean {
    return this.suspiciousIPs.has(ipAddress);
  }

  // Security headers middleware
  public securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      
      next();
    };
  }
 
  // Get security audit events
  public getAuditEvents(timeRange?: { start: Date; end: Date }, severity?: SecurityAuditEvent['severity']) {
    let events = this.auditEvents;

    if (timeRange) {
      events = events.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    if (severity) {
      events = events.filter(e => e.severity === severity);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get security statistics
  public getSecurityStats(timeRange?: { start: Date; end: Date }) {
    const events = this.getAuditEvents(timeRange);
    
    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByType = events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const suspiciousIPCount = this.suspiciousIPs.size;
    const activeFailedLogins = Array.from(this.failedLoginAttempts.entries())
      .filter(([_, data]) => Date.now() - data.lastAttempt.getTime() < 24 * 60 * 60 * 1000)
      .length;

    return {
      totalEvents: events.length,
      eventsBySeverity,
      eventsByType,
      suspiciousIPCount,
      activeFailedLogins,
      recentCriticalEvents: events.filter(e => e.severity === 'critical').slice(0, 10)
    };
  }

  // Private helper methods
  private isLikelyPlaintext(data: string): boolean {
    // Check for common plaintext patterns
    const plaintextPatterns = [
      /^[a-zA-Z0-9\s@._-]+$/, // Common email/username patterns
      /password/i,
      /secret/i,
      /token/i,
      /key/i
    ];

    return plaintextPatterns.some(pattern => pattern.test(data));
  }

  private isValidBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
      return false;
    }
  }

  private getRateLimitKey(req: Request): string {
    // Use user ID if authenticated, otherwise IP address
    return req.user?.id || req.ip || 'unknown';
  }

  private detectSuspiciousActivity(event: SecurityAuditEvent) {
    // Pattern detection for suspicious activities
    const recentEvents = this.auditEvents.filter(e => 
      Date.now() - e.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    // Multiple failed logins from same IP
    if (event.event === 'failed_login_attempt' && event.ipAddress) {
      const recentFailures = recentEvents.filter(e => 
        e.event === 'failed_login_attempt' && e.ipAddress === event.ipAddress
      );
      
      if (recentFailures.length > 5) {
        this.auditSecurityEvent(
          'suspicious_login_pattern',
          'high',
          undefined,
          event.ipAddress,
          event.userAgent,
          { recentFailures: recentFailures.length }
        );
      }
    }

    // Rapid API requests from same source
    if (event.ipAddress) {
      const recentRequests = recentEvents.filter(e => e.ipAddress === event.ipAddress);
      if (recentRequests.length > 100) {
        this.auditSecurityEvent(
          'suspicious_request_volume',
          'medium',
          event.userId,
          event.ipAddress,
          event.userAgent,
          { requestCount: recentRequests.length }
        );
      }
    }
  }

  // Cleanup old audit events
  public cleanupOldAuditEvents(retentionDays: number = 90) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    this.auditEvents = this.auditEvents.filter(e => e.timestamp > cutoffDate);
    
    // Clean up old failed login attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [key, data] of this.failedLoginAttempts.entries()) {
      if (data.lastAttempt < oneDayAgo) {
        this.failedLoginAttempts.delete(key);
      }
    }
  }
}

export const securityService = new SecurityService();