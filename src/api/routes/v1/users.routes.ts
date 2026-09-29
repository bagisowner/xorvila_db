import { Router } from 'express';
import {
  listUsers,
  getUser,
  updateUser,
  changeUserPassword,
  deleteUser,
} from '../../controllers/users.controller.js';
import { authenticateUser, requireRole, requireScope } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', requireScope('users:read'), listUsers);
router.get('/:id', requireScope('users:read'), getUser);
router.patch('/:id', requireScope('users:write'), updateUser);
router.patch('/:id/password', requireScope('users:write'), changeUserPassword);
router.delete('/:id', requireRole(['admin']), requireScope('users:write'), deleteUser);

export default router;
