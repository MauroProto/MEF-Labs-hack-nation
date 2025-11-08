/**
 * Canvas Controller
 *
 * Handles Canvas CRUD operations
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

// Validation schemas
const CreateCanvasSchema = z.object({
  name: z.string().min(1).max(255),
  userId: z.string().optional(),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
});

const UpdateCanvasSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
});

/**
 * Get all canvases (with optional filtering by userId)
 */
export async function getAllCanvases(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    const canvases = await prisma.canvas.findMany({
      where: userId ? { userId: String(userId) } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            papers: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: canvases,
      count: canvases.length,
    });
  } catch (error) {
    console.error('[Canvas] Error getting canvases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch canvases',
    });
  }
}

/**
 * Get a single canvas by ID
 */
export async function getCanvasById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        papers: {
          select: {
            id: true,
            title: true,
            authors: true,
            createdAt: true,
          },
        },
      },
    });

    if (!canvas) {
      return res.status(404).json({
        success: false,
        error: 'Canvas not found',
      });
    }

    res.json({
      success: true,
      data: canvas,
    });
  } catch (error) {
    console.error('[Canvas] Error getting canvas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch canvas',
    });
  }
}

/**
 * Create a new canvas
 */
export async function createCanvas(req: Request, res: Response) {
  try {
    const validated = CreateCanvasSchema.parse(req.body);

    const canvas = await prisma.canvas.create({
      data: {
        name: validated.name,
        userId: validated.userId || null,
        nodes: validated.nodes,
        edges: validated.edges,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: canvas,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('[Canvas] Error creating canvas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create canvas',
    });
  }
}

/**
 * Update a canvas
 */
export async function updateCanvas(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const validated = UpdateCanvasSchema.parse(req.body);

    // Check if canvas exists
    const existing = await prisma.canvas.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Canvas not found',
      });
    }

    const canvas = await prisma.canvas.update({
      where: { id },
      data: validated,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: canvas,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('[Canvas] Error updating canvas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update canvas',
    });
  }
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if canvas exists
    const existing = await prisma.canvas.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Canvas not found',
      });
    }

    await prisma.canvas.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Canvas deleted successfully',
    });
  } catch (error) {
    console.error('[Canvas] Error deleting canvas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete canvas',
    });
  }
}
