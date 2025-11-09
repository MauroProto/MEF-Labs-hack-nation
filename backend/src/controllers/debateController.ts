/**
 * Debate Controller
 *
 * HTTP endpoints for debate system
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generatePostures } from '../services/postureGenerator';
import { DebateOrchestrator } from '../services/debateOrchestrator';
import { evaluateDebate } from '../services/judgeService';
import { agentBus } from '../services/agentEventBus';

/**
 * POST /api/debate/start
 *
 * Start a new debate session
 *
 * Body:
 * - researchAnalysis: string
 * - paperId?: string
 * - debaterIds?: string[]
 */
export async function startDebate(req: Request, res: Response) {
  try {
    const { researchAnalysis, paperId, debaterIds } = req.body;

    if (!researchAnalysis) {
      return res.status(400).json({
        error: 'researchAnalysis is required',
      });
    }

    // 1. Create debate session
    const session = await prisma.debateSession.create({
      data: {
        paperId,
        researchAnalysis,
        status: 'initializing',
      },
    });

    // Emit initialization event
    agentBus.emit('agent:broadcast', {
      type: 'debate:initialized',
      payload: { sessionId: session.id },
      timestamp: new Date(),
    });

    // 2. Generate postures
    const postures = await generatePostures(
      session.id,
      researchAnalysis,
      debaterIds
    );

    // Save postures to database
    await prisma.posture.createMany({
      data: postures.map((p) => ({
        id: p.id,
        sessionId: p.sessionId,
        debaterId: p.debaterId,
        perspectiveTemplate: p.perspectiveTemplate,
        topics: p.topics as any,
        initialPosition: p.initialPosition,
        guidingQuestions: p.guidingQuestions as any,
      })),
    });

    // Update session status
    await prisma.debateSession.update({
      where: { id: session.id },
      data: { status: 'debating' },
    });

    // Emit postures generated event
    agentBus.emit('agent:broadcast', {
      type: 'debate:postures_generated',
      payload: { sessionId: session.id, postures },
      timestamp: new Date(),
    });

    // 3. Conduct debate in background (don't await)
    conductDebateAsync(session.id, postures);

    // Return session immediately
    return res.json({
      sessionId: session.id,
      status: 'debating',
      postures,
      message: 'Debate started. Use WebSocket or GET /api/debate/:sessionId to track progress.',
    });
  } catch (error) {
    console.error('Start debate error:', error);
    return res.status(500).json({
      error: 'Failed to start debate',
      details: (error as Error).message,
    });
  }
}

/**
 * GET /api/debate/:sessionId
 *
 * Get debate session status and results
 */
export async function getDebateSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    const session = await prisma.debateSession.findUnique({
      where: { id: sessionId },
      include: {
        postures: true,
        transcript: {
          include: {
            rounds: {
              include: {
                exchanges: {
                  orderBy: { timestamp: 'asc' },
                },
              },
              orderBy: { roundNumber: 'asc' },
            },
          },
        },
        verdict: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Debate session not found' });
    }

    return res.json({
      id: session.id,
      status: session.status,
      currentRound: session.currentRound,
      postures: session.postures,
      transcript: session.transcript,
      verdict: session.verdict,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('Get debate session error:', error);
    return res.status(500).json({
      error: 'Failed to fetch debate session',
      details: (error as Error).message,
    });
  }
}

/**
 * GET /api/debate
 *
 * List all debate sessions
 */
export async function listDebateSessions(req: Request, res: Response) {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    const where = status ? { status: status as string } : {};

    const sessions = await prisma.debateSession.findMany({
      where,
      include: {
        postures: true,
        _count: {
          select: {
            postures: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.debateSession.count({ where });

    return res.json({
      sessions,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('List debate sessions error:', error);
    return res.status(500).json({
      error: 'Failed to list debate sessions',
      details: (error as Error).message,
    });
  }
}

/**
 * Conduct debate asynchronously
 */
async function conductDebateAsync(sessionId: string, postures: any[]) {
  try {
    // 1. Run debate
    const orchestrator = new DebateOrchestrator(sessionId, postures);
    const transcript = await orchestrator.conductDebate();

    console.log(`[Debate] Session ${sessionId} completed with ${transcript.rounds.length} rounds`);

    // 2. Evaluate debate
    const verdict = await evaluateDebate(sessionId, transcript);

    // 3. Save verdict
    await prisma.judgeVerdict.create({
      data: {
        id: verdict.id,
        sessionId: verdict.sessionId,
        judgeId: verdict.judgeId,
        criteria: verdict.criteria as any,
        scores: verdict.scores as any,
        reasoning: verdict.reasoning,
        confidence: verdict.confidence,
        verdict: verdict.verdict,
      },
    });

    // 4. Update session status
    await prisma.debateSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    // Emit completion event
    agentBus.emit('agent:broadcast', {
      type: 'debate:completed',
      payload: { sessionId, verdict },
      timestamp: new Date(),
    });

    console.log(`[Debate] Session ${sessionId} completed successfully`);
  } catch (error) {
    console.error(`[Debate] Session ${sessionId} failed:`, error);

    // Update session status to error
    await prisma.debateSession.update({
      where: { id: sessionId },
      data: { status: 'error' },
    });

    // Emit error event
    agentBus.emit('agent:broadcast', {
      type: 'debate:error',
      payload: {
        sessionId,
        error: (error as Error).message,
      },
      timestamp: new Date(),
    });
  }
}
