/**
 * Debate Orchestrator Service
 *
 * Conducts structured 4-round debates between agents
 */

import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { agentBus } from './agentEventBus';
import {
  generateExposition,
  generateQuestion,
  generateAnswer,
} from './debaterAgent';
import {
  Posture,
  DebateExchange,
  DebateRound,
  DebateTranscript,
  AgentError,
  ErrorCode,
} from '../types/agent.types';

export class DebateOrchestrator {
  private sessionId: string;
  private postures: Posture[];
  private debaters: string[]; // Agent nodeIds
  private currentRound: number = 0;
  private exchanges: DebateExchange[] = [];
  private startTime: Date;

  constructor(sessionId: string, postures: Posture[]) {
    this.sessionId = sessionId;
    this.postures = postures;
    this.debaters = postures.map((p) => p.debaterId);
    this.startTime = new Date();
  }

  /**
   * Main method: Conduct full 4-round debate
   * Wrapped in Prisma transaction for atomicity
   */
  async conductDebate(): Promise<DebateTranscript> {
    try {
      const transcript = await prisma.$transaction(
        async (tx) => {
          // Create transcript record
          const transcriptRecord = await tx.debateTranscript.create({
            data: {
              sessionId: this.sessionId,
              posturesData: this.postures as any,
              metadata: {
                startTime: this.startTime,
                participantIds: this.debaters,
              },
            },
          });

          // Run all 4 rounds
          for (let i = 1; i <= 4; i++) {
            this.currentRound = i;
            await this.runRound(i, transcriptRecord.id, tx);
          }

          // Update session status
          await tx.debateSession.update({
            where: { id: this.sessionId },
            data: {
              status: 'evaluating',
              currentRound: 4,
            },
          });

          // Update metadata with end time
          await tx.debateTranscript.update({
            where: { id: transcriptRecord.id },
            data: {
              metadata: {
                startTime: this.startTime,
                endTime: new Date(),
                totalExchanges: this.exchanges.length,
                participantIds: this.debaters,
              },
            },
          });

          return transcriptRecord;
        },
        {
          timeout: 120000, // 2 minutes for full debate
          isolationLevel: 'Serializable', // Prevent race conditions
        }
      );

      // Build return object
      const fullTranscript: DebateTranscript = {
        id: transcript.id,
        sessionId: this.sessionId,
        postures: this.postures,
        rounds: await this.buildRounds(transcript.id),
        metadata: transcript.metadata as any,
      };

      return fullTranscript;
    } catch (error) {
      await this.handleDebateFailure(error as Error);
      throw error;
    }
  }

  /**
   * Run a single round (exposition or cross-examination)
   */
  private async runRound(
    roundNum: number,
    transcriptId: string,
    tx: any
  ): Promise<void> {
    const roundType = roundNum === 1 ? 'exposition' : 'cross_examination';
    const targetPostureId =
      roundNum > 1 ? this.postures[roundNum - 2].id : undefined;

    const roundRecord = await tx.debateRound.create({
      data: {
        transcriptId,
        roundNumber: roundNum,
        roundType,
        targetPostureId,
        startTime: new Date(),
      },
    });

    // Conduct the round
    const exchanges =
      roundNum === 1
        ? await this.expositionRound()
        : await this.crossExaminationRound(roundNum - 2);

    // Save all exchanges
    if (exchanges.length > 0) {
      await tx.debateExchange.createMany({
        data: exchanges.map((ex) => ({
          roundId: roundRecord.id,
          from: ex.from,
          to: ex.to,
          type: ex.type,
          content: ex.content,
          topics: ex.topics as any,
          timestamp: ex.timestamp,
        })),
      });
    }

    // Update round end time
    await tx.debateRound.update({
      where: { id: roundRecord.id },
      data: { endTime: new Date() },
    });

    // Store exchanges for later use
    this.exchanges.push(...exchanges);

    // Emit WebSocket event
    agentBus.emit('agent:broadcast', {
      type: 'debate:round_end',
      payload: {
        sessionId: this.sessionId,
        roundNumber: roundNum,
        exchangeCount: exchanges.length,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Round 1: Each debater presents their posture
   */
  private async expositionRound(): Promise<DebateExchange[]> {
    const exchanges: DebateExchange[] = [];

    for (const posture of this.postures) {
      console.log(`[DebateOrchestrator] Generating exposition for ${posture.debaterId}...`);

      try {
        // Get research analysis from session
        const session = await prisma.debateSession.findUnique({
          where: { id: this.sessionId },
          select: { researchAnalysis: true },
        });

        // Generate exposition using debaterAgent
        const content = await generateExposition({
          posture,
          researchAnalysis: session?.researchAnalysis || '',
          debateHistory: [],
        });

        const exchange: DebateExchange = {
          id: nanoid(),
          from: posture.debaterId,
          to: undefined,
          type: 'exposition',
          content,
          topics: posture.topics,
          timestamp: new Date(),
        };

        exchanges.push(exchange);
        console.log(`[DebateOrchestrator] ✓ Exposition generated for ${posture.debaterId}`);

        // Emit real-time event
        agentBus.emit('agent:broadcast', {
          type: 'debate:exchange',
          payload: exchange,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Exposition failed for ${posture.debaterId}:`, error);
        throw error;
      }
    }

    return exchanges;
  }

  /**
   * Rounds 2-4: Cross-examination of specific posture
   */
  private async crossExaminationRound(
    targetIndex: number
  ): Promise<DebateExchange[]> {
    const exchanges: DebateExchange[] = [];
    const targetPosture = this.postures[targetIndex];
    const otherPostures = this.postures.filter((p) => p.id !== targetPosture.id);

    // Get research analysis and debate history
    const session = await prisma.debateSession.findUnique({
      where: { id: this.sessionId },
      select: { researchAnalysis: true },
    });

    const debateHistory = this.exchanges.map((ex) => ({
      from: ex.from,
      to: ex.to,
      content: ex.content,
    }));

    console.log(`[DebateOrchestrator] Cross-examining ${targetPosture.debaterId}...`);

    // Each other debater asks 1 question
    for (const questionerPosture of otherPostures) {
      try {
        console.log(`[DebateOrchestrator]   ${questionerPosture.debaterId} asking question...`);

        const question = await generateQuestion(
          {
            posture: questionerPosture,
            researchAnalysis: session?.researchAnalysis || '',
            debateHistory,
          },
          targetPosture
        );

        const questionExchange: DebateExchange = {
          id: nanoid(),
          from: questionerPosture.debaterId,
          to: targetPosture.debaterId,
          type: 'question',
          content: question,
          topics: targetPosture.topics,
          timestamp: new Date(),
        };

        exchanges.push(questionExchange);
        console.log(`[DebateOrchestrator]   ✓ Question generated`);

        // Emit real-time event
        agentBus.emit('agent:broadcast', {
          type: 'debate:exchange',
          payload: questionExchange,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Question generation failed for ${questionerPosture.debaterId}:`, error);
        // Continue with other questioners
      }
    }

    // Target debater answers each question
    const questions = exchanges.filter((ex) => ex.type === 'question');
    for (const questionExchange of questions) {
      try {
        console.log(`[DebateOrchestrator]   ${targetPosture.debaterId} answering question...`);

        const answer = await generateAnswer(
          {
            posture: targetPosture,
            researchAnalysis: session?.researchAnalysis || '',
            debateHistory: [...debateHistory, ...exchanges.map((ex) => ({
              from: ex.from,
              to: ex.to,
              content: ex.content,
            }))],
          },
          questionExchange.content,
          questionExchange.from
        );

        const answerExchange: DebateExchange = {
          id: nanoid(),
          from: targetPosture.debaterId,
          to: questionExchange.from,
          type: 'answer',
          content: answer,
          topics: targetPosture.topics,
          timestamp: new Date(),
        };

        exchanges.push(answerExchange);
        console.log(`[DebateOrchestrator]   ✓ Answer generated`);

        // Emit real-time event
        agentBus.emit('agent:broadcast', {
          type: 'debate:exchange',
          payload: answerExchange,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Answer generation failed for ${targetPosture.debaterId}:`, error);
        throw error;
      }
    }

    return exchanges;
  }


  /**
   * Handle debate failure - save partial transcript
   */
  private async handleDebateFailure(error: Error): Promise<void> {
    console.error('Debate failed:', error);

    // Save partial transcript if any exchanges completed
    if (this.currentRound > 0 && this.exchanges.length > 0) {
      try {
        await prisma.debateSession.update({
          where: { id: this.sessionId },
          data: {
            status: 'error',
            transcript: {
              upsert: {
                create: {
                  posturesData: this.postures as any,
                  metadata: {
                    startTime: this.startTime,
                    endTime: new Date(),
                    totalExchanges: this.exchanges.length,
                    participantIds: this.debaters,
                    partialDebate: true,
                    failureRound: this.currentRound,
                    errorMessage: error.message,
                  },
                },
                update: {},
              },
            },
          },
        });
      } catch (saveError) {
        console.error('Failed to save partial transcript:', saveError);
      }
    }

    // Emit error event
    agentBus.emit('agent:error', {
      type: 'agent:error',
      payload: {
        nodeId: 'debate-orchestrator',
        error: new AgentError(
          ErrorCode.InternalError,
          `Debate failed at round ${this.currentRound}: ${error.message}`,
          { sessionId: this.sessionId, round: this.currentRound }
        ),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Build rounds array from database
   */
  private async buildRounds(transcriptId: string): Promise<DebateRound[]> {
    const rounds = await prisma.debateRound.findMany({
      where: { transcriptId },
      include: {
        exchanges: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });

    return rounds.map((r) => ({
      roundNumber: r.roundNumber as 1 | 2 | 3 | 4,
      roundType: r.roundType as 'exposition' | 'cross_examination',
      targetPosture: r.targetPostureId,
      exchanges: r.exchanges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to || undefined,
        type: e.type as 'exposition' | 'question' | 'answer',
        content: e.content,
        topics: e.topics as string[],
        timestamp: e.timestamp,
      })),
      startTime: r.startTime,
      endTime: r.endTime || undefined,
    }));
  }
}
