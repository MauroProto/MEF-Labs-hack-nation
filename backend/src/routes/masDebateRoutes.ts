import { Router, type IRouter } from "express";
import {
  generateQuestions,
  generatePosturesAndTopics,
  runDebate,
  runCompleteDebateFlow,
} from "../controllers/masDebateController";

const router: IRouter = Router();

/**
 * POST /api/mas-debate/questions
 * Generate questions from a paper
 * Body: { paperId: string }
 */
router.post("/questions", generateQuestions);

/**
 * POST /api/mas-debate/postures
 * Generate postures and topics for a question
 * Body: { paperId: string, question: string, numPostures?: number }
 */
router.post("/postures", generatePosturesAndTopics);

/**
 * POST /api/mas-debate/run
 * Run a complete debate with a specific question
 * Body: { paperId: string, question: string, numPostures?: number }
 * Supports SSE for progress updates (set Accept: text/event-stream)
 */
router.post("/run", runDebate);

/**
 * POST /api/mas-debate/run-complete
 * Run complete debate flow including question generation
 * Body: { paperId: string, questionIndex?: number, numPostures?: number }
 * Supports SSE for progress updates (set Accept: text/event-stream)
 */
router.post("/run-complete", runCompleteDebateFlow);

export default router;

