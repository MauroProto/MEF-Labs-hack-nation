/**
 * Paper Routes
 * API endpoints for paper upload and management
 */

import { Router } from 'express';
import {
  getPapersByCanvas,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
} from '../controllers/paperController';

const router = Router();

// GET /api/papers/canvas/:canvasId - Get all papers for a canvas
router.get('/canvas/:canvasId', getPapersByCanvas);

// GET /api/papers/:id - Get a paper by ID
router.get('/:id', getPaperById);

// POST /api/papers - Upload/Create a new paper
router.post('/', createPaper);

// PUT /api/papers/:id - Update a paper
router.put('/:id', updatePaper);

// DELETE /api/papers/:id - Delete a paper
router.delete('/:id', deletePaper);

export default router;
