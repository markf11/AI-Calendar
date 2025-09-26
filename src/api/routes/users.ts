import { Router } from 'express';
import { UserController } from '@/api/controllers/UserController';
import { authenticateToken } from '@/api/middleware/auth';
import { validate } from '@/utils/validation';
import { userSchemas } from '@/utils/validation';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', validate(userSchemas.updateUser), userController.updateProfile);

/**
 * @route   POST /api/users/onboarding
 * @desc    Complete user onboarding
 * @access  Private
 */
router.post('/onboarding', validate(userSchemas.onboarding), userController.completeOnboarding);

/**
 * @route   PUT /api/users/working-hours
 * @desc    Update working hours
 * @access  Private
 */
router.put('/working-hours', userController.updateWorkingHours);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', userController.updatePreferences);

/**
 * @route   GET /api/users/preferences/encrypted
 * @desc    Get encrypted preferences for secure client-side storage
 * @access  Private
 */
router.get('/preferences/encrypted', userController.getEncryptedPreferences);

/**
 * @route   PUT /api/users/preferences/encrypted
 * @desc    Update preferences from encrypted data
 * @access  Private
 */
router.put('/preferences/encrypted', userController.updateFromEncryptedPreferences);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', userController.deleteAccount);

export default router;