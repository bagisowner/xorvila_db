import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  getOAuthStatus,
  listSessions,
  revokeSession,
  revokeAllSessions,
} from '../../controllers/auth.controller.js';
import { authenticateUser } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware.js';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticateUser, me);

router.get('/sessions', authenticateUser, listSessions);
router.delete('/sessions', authenticateUser, revokeAllSessions);
router.delete('/sessions/:id', authenticateUser, revokeSession);

router.post('/password/forgot', authRateLimiter, forgotPassword);
router.post('/password/reset', authRateLimiter, resetPassword);

router.get('/oauth/config', getOAuthStatus);

export default router;
