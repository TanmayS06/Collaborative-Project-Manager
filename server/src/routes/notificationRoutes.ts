import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController';

const router = Router();

router.use(authenticateToken);


router.get('/', getMyNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;
