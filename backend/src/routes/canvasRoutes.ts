/**
 * Canvas Routes
 *
 * RESTful API routes for Canvas CRUD operations
 */

import { Router } from 'express';
import {
  getAllCanvases,
  getCanvasById,
  createCanvas,
  updateCanvas,
  deleteCanvas,
} from '../controllers/canvasController';

const router = Router();

// GET /api/canvas - Get all canvases (with optional userId filter)
router.get('/', getAllCanvases);

// GET /api/canvas/:id - Get a single canvas by ID
router.get('/:id', getCanvasById);

// POST /api/canvas - Create a new canvas
router.post('/', createCanvas);

// PUT /api/canvas/:id - Update a canvas
router.put('/:id', updateCanvas);

// DELETE /api/canvas/:id - Delete a canvas
router.delete('/:id', deleteCanvas);

export default router;
