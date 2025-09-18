import { Router } from 'express';
import chatRoutes from './chat';
import { healthCheck } from '@/utils/middleware';

const router = Router();

// Health check route
router.get('/health', healthCheck);

// API routes
router.use('/chat', chatRoutes);

export default router;
