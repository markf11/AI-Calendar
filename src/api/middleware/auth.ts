import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/AuthService';
import { AuthUtils } from '@/utils/auth';
import { UserAuthData } from '@/models/User';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: UserAuthData;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: UserAuthData;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'MISSING_TOKEN'
        }
      });
      return;
    }

    const authService = new AuthService();
    const user = await authService.verifyAccessToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    res.status(401).json({
      error: {
        message: errorMessage,
        code: 'INVALID_TOKEN'
      }
    });
  }
};

/**
 * Middleware to optionally authenticate JWT tokens (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (token) {
      const authService = new AuthService();
      const user = await authService.verifyAccessToken(token);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    next();
  }
};

/**
 * Middleware to check if user is authenticated (use after authenticateToken)
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }
    });
    return;
  }
  
  next();
};

/**
 * Middleware to validate refresh token
 */
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: {
          message: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN'
        }
      });
      return;
    }

    // Verify the refresh token format
    AuthUtils.verifyRefreshToken(refreshToken);
    
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid refresh token';
    
    res.status(401).json({
      error: {
        message: errorMessage,
        code: 'INVALID_REFRESH_TOKEN'
      }
    });
  }
};

/**
 * Middleware to extract user ID from authenticated request
 */
export const extractUserId = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.id) {
    res.status(401).json({
      error: {
        message: 'User ID not found in token',
        code: 'INVALID_USER_TOKEN'
      }
    });
    return;
  }
  
  next();
};

/**
 * Middleware to check if the authenticated user matches the requested user ID
 */
export const checkUserOwnership = (paramName: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const requestedUserId = req.params[paramName];
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        }
      });
      return;
    }

    if (requestedUserId !== authenticatedUserId) {
      res.status(403).json({
        error: {
          message: 'Access denied: You can only access your own resources',
          code: 'ACCESS_DENIED'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Error handler for authentication errors
 */
export const handleAuthError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      }
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      }
    });
    return;
  }

  if (error.name === 'NotBeforeError') {
    res.status(401).json({
      error: {
        message: 'Token not active',
        code: 'TOKEN_NOT_ACTIVE'
      }
    });
    return;
  }

  // Pass other errors to the next error handler
  next(error);
};