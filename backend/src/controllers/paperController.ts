/**
 * Paper Controller
 * Handles paper upload, retrieval, and management for canvas
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validation schemas
const CreatePaperSchema = z.object({
  canvasId: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string()),
  abstract: z.string().nullish(), // Accept string, null, or undefined
  fullText: z.string().min(1),
  citations: z.any().optional(),
  metadata: z.any().optional(), // DOI, year, source, fileUrl, etc.
});

const UpdatePaperSchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  fullText: z.string().optional(),
  citations: z.any().optional(),
  metadata: z.any().optional(),
});

/**
 * Get all papers for a canvas
 */
export async function getPapersByCanvas(req: Request, res: Response): Promise<void> {
  try {
    const { canvasId } = req.params;

    const papers = await prisma.paper.findMany({
      where: { canvasId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: papers,
      count: papers.length,
    });
  } catch (error) {
    console.error('[PaperController] Get papers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve papers',
    });
  }
}

/**
 * Get a single paper by ID
 */
export async function getPaperById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        canvas: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: 'Paper not found',
      });
    }

    res.json({
      success: true,
      data: paper,
    });
  } catch (error) {
    console.error('[PaperController] Get paper error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve paper',
    });
  }
}

/**
 * Upload/Create a new paper
 */
export async function createPaper(req: Request, res: Response): Promise<void> {
  try {
    const validated = CreatePaperSchema.parse(req.body);

    // Verify canvas exists
    const canvas = await prisma.canvas.findUnique({
      where: { id: validated.canvasId },
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        error: 'Canvas not found',
      });
    }

    const paper = await prisma.paper.create({
      data: {
        canvasId: validated.canvasId,
        title: validated.title,
        authors: validated.authors,
        abstract: validated.abstract,
        fullText: validated.fullText,
        citations: validated.citations,
        metadata: validated.metadata,
      },
    });

    res.status(201).json({
      success: true,
      data: paper,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[PaperController] Validation error:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('[PaperController] Create paper error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create paper',
    });
  }
}

/**
 * Update a paper
 */
export async function updatePaper(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = UpdatePaperSchema.parse(req.body);

    // Check if paper exists
    const exists = await prisma.paper.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Paper not found',
      });
    }

    const paper = await prisma.paper.update({
      where: { id },
      data: validated,
    });

    res.json({
      success: true,
      data: paper,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('[PaperController] Update paper error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update paper',
    });
  }
}

/**
 * Delete a paper
 */
export async function deletePaper(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Check if paper exists
    const exists = await prisma.paper.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Paper not found',
      });
    }

    await prisma.paper.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Paper deleted successfully',
    });
  } catch (error) {
    console.error('[PaperController] Delete paper error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete paper',
    });
  }
}
