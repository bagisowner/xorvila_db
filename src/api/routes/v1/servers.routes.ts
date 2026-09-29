import { Router } from 'express';
import {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
} from '../../controllers/servers.controller.js';
import { authenticateUser, requireScope } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', requireScope('servers:read'), listServers);
router.get('/:id', requireScope('servers:read'), getServer);
router.post('/', requireScope('servers:write'), createServer);
router.patch('/:id', requireScope('servers:write'), updateServer);
router.delete('/:id', requireScope('servers:write'), deleteServer);

export default router;
