import { Router } from 'express';
import { AuthController } from '@/api/controllers/AuthController';
import { authenticateToken, validateRefreshToken } from '@/api/middleware/auth';
import { validate } from '@/utils/validation';
import { userSchemas } from '@/utils/validation';

const router = Router();
const authController = new AuthController();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(userSchemas.register), authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(userSchemas.login), authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(userSchemas.refreshToken), validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public
 */
router.post('/logout', validate(userSchemas.refreshToken), authController.logout);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', authenticateToken, authController.logoutAll);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateToken, validate(userSchemas.changePassword), authController.changePassword);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticateToken, authController.getCurrentUser);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token validity
 * @access  Private
 */
router.get('/verify', authenticateToken, authController.verifyToken);

export default router;