import { Router } from 'express';
import { listRoles, createRole, deleteRole } from '../../controllers/roles.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', listRoles);
router.post('/', requireRole(['admin']), createRole);
router.delete('/:id', requireRole(['admin']), deleteRole);

export default router;
