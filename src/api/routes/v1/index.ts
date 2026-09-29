import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import rolesRoutes from './roles.routes.js';
import serversRoutes from './servers.routes.js';
import systemRoutes from './system.routes.js';
import apiKeysRoutes from './apiKeys.routes.js';
import { getHealth, getReady } from '../../controllers/health.controller.js';

const router = Router();

// Health check endpoints
router.get('/health', getHealth);
router.get('/ready', getReady);

// Core API endpoints
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/servers', serversRoutes);
router.use('/system', systemRoutes);
router.use('/api-keys', apiKeysRoutes);

export default router;
