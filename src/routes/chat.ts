import { Router } from 'express';
import { ChatController } from '@/controllers/chat';
import { chatValidation, sessionValidation, searchValidation } from '@/utils/validation';

const router = Router();
const chatController = new ChatController();

// Initialize controller
chatController.initialize().catch((error: Error) => {
  console.error('Failed to initialize chat controller:', error);
});

// Routes
router.post('/', chatValidation, chatController.chat.bind(chatController));
router.get(
  '/history/:session_id',
  sessionValidation,
  chatController.getHistory.bind(chatController)
);
router.post(
  '/clear/:session_id',
  sessionValidation,
  chatController.clearHistory.bind(chatController)
);
router.post('/search', searchValidation, chatController.searchDocuments.bind(chatController));
router.get('/stats', chatController.getStats.bind(chatController));

export default router;
