/**
 * Debate Orchestrator Service
 *
 * Conducts structured 4-round debates between agents
 */

import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { agentBus } from './agentEventBus';
import { orchestrator } from './agentOrchestrator';
import {
  Posture,
  DebateExchange,
  DebateRound,
  DebateTranscript,
  AgentError,
  ErrorCode,
  AgentInvocationParams,
  AgentInvocationResult,
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
      const prompt = `You are presenting the following debate posture:

**Perspective**: ${posture.perspectiveTemplate}
**Position**: ${posture.initialPosition}
**Topics to Cover**: ${posture.topics.join(', ')}
**Guiding Questions**: ${posture.guidingQuestions.join('; ')}

Present your posture in a clear, structured way. Address your assigned topics and explore your guiding questions. Be comprehensive but concise (500-800 words).`;

      try {
        const result = await this.invokeWithRetry({
          from: 'debate-orchestrator',
          to: posture.debaterId,
          tool: 'present_exposition',
          args: { prompt, posture },
          timeout: 45000,
        });

        const exchange: DebateExchange = {
          id: nanoid(),
          from: posture.debaterId,
          to: undefined,
          type: 'exposition',
          content: result.data.presentation || result.data,
          topics: posture.topics,
          timestamp: new Date(),
        };

        exchanges.push(exchange);

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
    const otherDebaters = this.debaters.filter(
      (d) => d !== targetPosture.debaterId
    );

    // Each other debater asks up to 2 questions
    const allQuestions: Array<{
      from: string;
      questions: string[];
    }> = [];

    for (const questioner of otherDebaters) {
      const questionPrompt = `Based on the following posture presentation, generate 2 probing questions:

**Posture**: ${targetPosture.perspectiveTemplate}
**Position**: ${targetPosture.initialPosition}
**Topics**: ${targetPosture.topics.join(', ')}

Generate exactly 2 questions that:
1. Challenge assumptions or probe deeper
2. Address specific topics or claims
3. Are respectful but intellectually rigorous

Return as JSON: { "questions": ["Q1", "Q2"] }`;

      try {
        const result = await this.invokeWithRetry({
          from: 'debate-orchestrator',
          to: questioner,
          tool: 'generate_questions',
          args: { prompt: questionPrompt },
          timeout: 30000,
        });

        const questions =
          result.data.questions || [result.data.question1, result.data.question2].filter(Boolean);

        allQuestions.push({ from: questioner, questions });

        // Add question exchanges
        for (const question of questions.slice(0, 2)) {
          const exchange: DebateExchange = {
            id: nanoid(),
            from: questioner,
            to: targetPosture.debaterId,
            type: 'question',
            content: question,
            topics: targetPosture.topics,
            timestamp: new Date(),
          };
          exchanges.push(exchange);
        }
      } catch (error) {
        console.error(`Question generation failed for ${questioner}:`, error);
        // Continue with other questioners
      }
    }

    // Target debater answers all questions
    const allQuestionsText = allQuestions
      .flatMap(({ from, questions }) =>
        questions.map((q, i) => `**From ${from} (Q${i + 1})**: ${q}`)
      )
      .join('\n\n');

    if (allQuestionsText) {
      const answerPrompt = `Answer the following questions about your posture:

${allQuestionsText}

Provide clear, substantive answers that address each question. Be direct and evidence-based.`;

      try {
        const result = await this.invokeWithRetry({
          from: 'debate-orchestrator',
          to: targetPosture.debaterId,
          tool: 'answer_questions',
          args: { prompt: answerPrompt, questions: allQuestionsText },
          timeout: 60000,
        });

        const exchange: DebateExchange = {
          id: nanoid(),
          from: targetPosture.debaterId,
          to: undefined,
          type: 'answer',
          content: result.data.answers || result.data,
          topics: targetPosture.topics,
          timestamp: new Date(),
        };

        exchanges.push(exchange);
      } catch (error) {
        console.error(
          `Answer generation failed for ${targetPosture.debaterId}:`,
          error
        );
        throw error;
      }
    }

    return exchanges;
  }

  /**
   * Retry logic for transient failures
   */
  private async invokeWithRetry(
    params: AgentInvocationParams,
    maxRetries: number = 2
  ): Promise<AgentInvocationResult> {
    let lastError: Error | AgentError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await orchestrator.invoke(params);
      } catch (error: any) {
        lastError = error;

        // Only retry on rate limits or timeouts
        if (error.code === ErrorCode.RateLimitExceeded) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (error.code === ErrorCode.Timeout && attempt < maxRetries) {
          continue; // Retry timeouts
        }

        throw error; // Don't retry other errors
      }
    }

    throw lastError!;
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
