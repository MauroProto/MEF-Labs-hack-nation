import { Router } from 'express';
import { chatWithPaper } from '../controllers/chatController';

const router = Router();

router.post('/', chatWithPaper);

export default router;

