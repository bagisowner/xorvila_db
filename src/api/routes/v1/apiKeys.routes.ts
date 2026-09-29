import { Router } from 'express';
import {
  listApiKeys,
  getApiKey,
  createApiKeyHandler,
  revokeApiKeyHandler,
  deleteApiKeyHandler,
} from '../../controllers/apiKeys.controller.js';
import { authenticateUser, requireScope } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', requireScope('api-keys:read'), listApiKeys);
router.post('/', requireScope('api-keys:write'), createApiKeyHandler);
router.get('/:id', requireScope('api-keys:read'), getApiKey);
router.delete('/:id', requireScope('api-keys:write'), deleteApiKeyHandler);
router.post('/:id/revoke', requireScope('api-keys:write'), revokeApiKeyHandler);

export default router;
