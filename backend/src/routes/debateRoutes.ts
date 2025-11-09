/**
 * Debate Routes
 */

import { Router } from 'express';
import {
  startDebate,
  getDebateSession,
  listDebateSessions,
} from '../controllers/debateController';

const router = Router();

// POST /api/debate/start - Start a new debate
router.post('/start', startDebate);

// GET /api/debate/:sessionId - Get debate session details
router.get('/:sessionId', getDebateSession);

// GET /api/debate - List all debate sessions
router.get('/', listDebateSessions);

export default router;
