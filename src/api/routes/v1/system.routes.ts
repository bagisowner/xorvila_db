import { Router } from 'express';
import {
  getSystemStatus,
  getSystemConfig,
  updateSystemConfig,
} from '../../controllers/system.controller.js';
import { authenticateUser, requireRole, requireScope } from '../../middleware/auth.middleware.js';

const router = Router();

// Public / operational status check (accessible publicly and by system:read)
router.get('/status', getSystemStatus);

// Protected admin configuration routes
router.get('/config', authenticateUser, requireRole(['admin']), requireScope('settings:read'), getSystemConfig);
router.patch('/config', authenticateUser, requireRole(['admin']), requireScope('settings:write'), updateSystemConfig);

export default router;
