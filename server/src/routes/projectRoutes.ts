import { Router } from 'express';
import { createProject, getProjectById } from '../controllers/projectController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', createProject);
router.get('/:id', getProjectById);

export default router;
