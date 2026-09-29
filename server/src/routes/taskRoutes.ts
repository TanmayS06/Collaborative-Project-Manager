import { Router } from 'express';
import {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  addComment,
  searchTasks,
} from '../controllers/taskController';
import {
  uploadAttachment,
  deleteAttachment,
} from '../controllers/attachmentController';
import { authenticateToken } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

router.use(authenticateToken);

// Search Tasks across workspace
router.get('/search', searchTasks);

router.post('/', createTask);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/comments', addComment);

// Task Attachments
router.post('/:id/attachments', uploadMiddleware.single('file'), uploadAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;
