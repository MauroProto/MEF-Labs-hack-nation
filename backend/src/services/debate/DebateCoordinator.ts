import { FurtherQuestionsGenerator } from "./FurtherQuestionsGenerator";
import { PostureGenerator } from "./PostureGenerator";
import { DebaterAgent } from "./DebaterAgent";
import { JudgeAgent } from "./JudgeAgent";
import { ReporterAgent } from "./ReporterAgent";
import { QuestionerAgent } from "./QuestionerAgent";
import { ResponseAgent } from "./ResponseAgent";
import {
  Paper,
  DebateSession,
  DebaterArgument,
  JudgeVerdict,
  DebateReport,
  DEFAULT_RUBRIC,
  Rubric,
  DebateExchange,
  DebateRound,
  QuestionDebateResult,
  EnhancedDebateReport,
} from "../../types/debate.types";

export interface DebateCoordinatorConfig {
  rubric?: Rubric;
}

export class DebateCoordinator {
  private furtherQuestionsGenerator: FurtherQuestionsGenerator;
  private postureGenerator: PostureGenerator;
  private judgeAgent: JudgeAgent;
  private reporterAgent: ReporterAgent;
  private rubric: Rubric;

  constructor(config: DebateCoordinatorConfig = {}) {
    this.furtherQuestionsGenerator = new FurtherQuestionsGenerator();
    this.postureGenerator = new PostureGenerator();
    this.judgeAgent = new JudgeAgent();
    this.reporterAgent = new ReporterAgent();
    this.rubric = config.rubric || DEFAULT_RUBRIC;
  }

  /**
   * Step 1: Generate further questions from the paper
   */
  async generateQuestions(paper: Paper): Promise<string[]> {
    const response = await this.furtherQuestionsGenerator.generate({ paper });
    return response.questions;
  }

  /**
   * Step 2: Generate postures and topics for a selected question
   */
  async generatePosturesAndTopics(
    paper: Paper,
    question: string,
    numPostures: number = 3
  ): Promise<{ postures: string[]; topics: string[] }> {
    const response = await this.postureGenerator.generate({
      question,
      paper,
      numPostures,
    });
    return {
      postures: response.postures,
      topics: response.topics,
    };
  }

  /**
   * Step 3: Run the debate with N debaters (parallel)
   * Emits per-debater progress events when onProgress callback is provided
   */
  async runDebate(
    paper: Paper,
    question: string,
    topics: string[],
    postures: string[],
    onProgress?: (stage: string, data?: any) => void
  ): Promise<DebaterArgument[]> {
    // Create debater agents and run them in parallel with progress tracking
    const debatePromises = postures.map(async (posture, index) => {
      const debater = new DebaterAgent();

      // Emit debater started event
      onProgress?.("debater_started", {
        debaterIndex: index,
        posture,
        total: postures.length
      });

      try {
        // Create streaming callback for this debater
        const onStream = onProgress
          ? (delta: string) => {
              onProgress("debater_stream_delta", {
                debaterIndex: index,
                posture,
                delta,
              });
            }
          : undefined;

        const argument = await debater.debate({
          posture,
          question,
          topics,
          paper,
        }, onStream);

        // Emit debater completed event with the argument
        onProgress?.("debater_complete", {
          debaterIndex: index,
          posture,
          argument,
          total: postures.length
        });

        return argument;
      } catch (error) {
        // Emit debater error event
        onProgress?.("debater_error", {
          debaterIndex: index,
          posture,
          error: error instanceof Error ? error.message : String(error),
          total: postures.length
        });
        throw error;
      }
    });

    const debaterArguments = await Promise.all(debatePromises);
    return debaterArguments;
  }

  /**
   * Step 4: Judge the debate
   */
  async judgeDebate(
    question: string,
    topics: string[],
    debaterArguments: DebaterArgument[]
  ): Promise<JudgeVerdict> {
    const verdict = await this.judgeAgent.judge({
      question,
      topics,
      arguments: debaterArguments,
      rubric: this.rubric,
    });
    return verdict;
  }

  /**
   * Step 5: Generate final report
   */
  async generateReport(
    question: string,
    topics: string[],
    postures: string[],
    debaterArguments: DebaterArgument[],
    verdict: JudgeVerdict
  ): Promise<DebateReport> {
    const report = await this.reporterAgent.generateReport({
      question,
      topics,
      postures,
      arguments: debaterArguments,
      verdict,
    });
    return report;
  }

  /**
   * Complete end-to-end debate flow
   */
  async runCompleteDebate(
    paper: Paper,
    question: string,
    numPostures: number = 3,
    onProgress?: (stage: string, data?: any) => void
  ): Promise<DebateReport> {
    try {
      // Step 1: Generate postures and topics
      onProgress?.("Generating postures and topics...");
      const { postures, topics } = await this.generatePosturesAndTopics(
        paper,
        question,
        numPostures
      );
      onProgress?.("postures_generated", { postures, topics });

      // Step 2: Run debate
      onProgress?.("Running debate with " + numPostures + " debaters...");
      const debaterArguments = await this.runDebate(paper, question, topics, postures, onProgress);
      onProgress?.("debate_complete", { arguments: debaterArguments });

      // Step 3: Judge debate
      onProgress?.("Judging arguments...");
      const verdict = await this.judgeDebate(question, topics, debaterArguments);
      onProgress?.("judging_complete", { verdict });

      // Step 4: Generate report
      onProgress?.("Generating final report...");
      const report = await this.generateReport(
        question,
        topics,
        postures,
        debaterArguments,
        verdict
      );
      onProgress?.("report_complete", { report });

      return report;
    } catch (error) {
      console.error("Error in debate flow:", error);
      throw error;
    }
  }

  /**
   * Run complete flow starting from paper (including question generation)
   */
  async runCompleteDebateWithQuestionGeneration(
    paper: Paper,
    questionIndex: number = 0,
    numPostures: number = 3,
    onProgress?: (stage: string, data?: any) => void
  ): Promise<DebateReport> {
    try {
      // Step 0: Generate questions
      onProgress?.("Generating questions from paper...");
      const questions = await this.generateQuestions(paper);
      onProgress?.("questions_generated", { questions });

      // Select question
      const selectedQuestion = questions[questionIndex] || questions[0];
      if (!selectedQuestion) {
        throw new Error("No questions generated");
      }

      onProgress?.("question_selected", { question: selectedQuestion });

      // Run complete debate with selected question
      return await this.runCompleteDebate(
        paper,
        selectedQuestion,
        numPostures,
        onProgress
      );
    } catch (error) {
      console.error("Error in complete debate flow:", error);
      throw error;
    }
  }

  /**
   * ============================================================
   * ENHANCED DEBATE METHODS - Multi-Question + Rounds Support
   * ============================================================
   */

  /**
   * Run debate rounds with cross-examination between debaters
   *
   * Flow:
   * 1. Each debater gets initial arguments
   * 2. For N rounds:
   *    - Each debater asks a question to another debater
   *    - That debater responds
   *    - Continue rotation
   */
  async runDebateRounds(
    paper: Paper,
    question: string,
    postures: string[],
    initialArguments: DebaterArgument[],
    numRounds: number = 2,
    onProgress?: (stage: string, data?: any) => void
  ): Promise<DebateRound[]> {
    const rounds: DebateRound[] = [];
    const questionerAgent = new QuestionerAgent();
    const responseAgent = new ResponseAgent();

    for (let roundNum = 1; roundNum <= numRounds; roundNum++) {
      onProgress?.("round_started", { roundNumber: roundNum, totalRounds: numRounds });

      const exchanges: DebateExchange[] = [];

      // Create rotation: each debater questions the next one
      for (let i = 0; i < postures.length; i++) {
        const questionerIndex = i;
        const responderIndex = (i + 1) % postures.length;

        const questionerPosture = postures[questionerIndex];
        const responderPosture = postures[responderIndex];
        const responderArgument = initialArguments[responderIndex];

        // Generate question
        onProgress?.("exchange_question", {
          roundNumber: roundNum,
          fromDebater: questionerPosture,
          toDebater: responderPosture,
        });

        const onQuestionStream = onProgress
          ? (delta: string) => {
              onProgress("question_stream_delta", {
                roundNumber: roundNum,
                fromDebater: questionerPosture,
                toDebater: responderPosture,
                delta,
              });
            }
          : undefined;

        const { question: crossQuestion } = await questionerAgent.generateQuestion({
          questionerPosture,
          targetPosture: responderPosture,
          targetArgument: responderArgument,
          mainQuestion: question,
        }, onQuestionStream);

        // Generate response
        onProgress?.("exchange_response", {
          roundNumber: roundNum,
          fromDebater: responderPosture,
          question: crossQuestion,
        });

        const onResponseStream = onProgress
          ? (delta: string) => {
              onProgress("response_stream_delta", {
                roundNumber: roundNum,
                fromDebater: responderPosture,
                toDebater: questionerPosture,
                delta,
              });
            }
          : undefined;

        const { response } = await responseAgent.generateResponse({
          responderPosture,
          responderArgument,
          questionerPosture,
          question: crossQuestion,
          mainQuestion: question,
          paper,
        }, onResponseStream);

        const exchange: DebateExchange = {
          fromDebater: questionerPosture,
          toDebater: responderPosture,
          question: crossQuestion,
          response,
          timestamp: Date.now(),
        };

        exchanges.push(exchange);
      }

      rounds.push({
        roundNumber: roundNum,
        exchanges,
      });

      onProgress?.("round_complete", { roundNumber: roundNum, exchanges });
    }

    return rounds;
  }

  /**
   * Run enhanced debate for a single question with rounds
   */
  async runEnhancedDebateForQuestion(
    paper: Paper,
    question: string,
    numPostures: number = 3,
    numRounds: number = 2,
    onProgress?: (stage: string, data?: any) => void
  ): Promise<QuestionDebateResult> {
    try {
      // Step 1: Generate postures and topics
      onProgress?.("Generating postures and topics...");
      const { postures, topics } = await this.generatePosturesAndTopics(
        paper,
        question,
        numPostures
      );
      onProgress?.("postures_generated", { postures, topics });

      // Step 2: Initial arguments from debaters
      onProgress?.("Running initial debate arguments...");
      const initialArguments = await this.runDebate(paper, question, topics, postures, onProgress);
      onProgress?.("initial_arguments_complete", { arguments: initialArguments });

      // Step 3: Debate rounds with cross-examination
      onProgress?.("Starting debate rounds...");
      const rounds = await this.runDebateRounds(
        paper,
        question,
        postures,
        initialArguments,
        numRounds,
        onProgress
      );
      onProgress?.("rounds_complete", { rounds });

      // Step 4: Judge the full debate (initial + rounds)
      onProgress?.("Judging full debate...");
      const verdict = await this.judgeDebate(question, topics, initialArguments);
      onProgress?.("judging_complete", { verdict });

      return {
        question,
        postures,
        topics,
        initialArguments,
        rounds,
        verdict,
      };
    } catch (error) {
      console.error("Error in enhanced debate for question:", error);
      throw error;
    }
  }

  /**
   * Run enhanced debate with multiple questions
   */
  async runEnhancedDebate(
    paper: Paper,
    questions: string[],
    numPostures: number = 3,
    numRounds: number = 2,
    onProgress?: (stage: string, data?: any) => void
  ): Promise<EnhancedDebateReport> {
    try {
      const debateResults: QuestionDebateResult[] = [];

      // Run debate for each question
      for (let qIndex = 0; qIndex < questions.length; qIndex++) {
        const question = questions[qIndex];

        onProgress?.("question_debate_started", {
          questionIndex: qIndex,
          totalQuestions: questions.length,
          question,
        });

        const result = await this.runEnhancedDebateForQuestion(
          paper,
          question,
          numPostures,
          numRounds,
          onProgress
        );

        debateResults.push(result);

        onProgress?.("question_debate_complete", {
          questionIndex: qIndex,
          result,
        });
      }

      // Generate consolidated report
      onProgress?.("Generating consolidated report...");
      const enhancedReport = await this.generateEnhancedReport(
        questions,
        debateResults
      );
      onProgress?.("enhanced_report_complete", { report: enhancedReport });

      return enhancedReport;
    } catch (error) {
      console.error("Error in enhanced debate:", error);
      throw error;
    }
  }

  /**
   * Generate consolidated report from multiple question debates
   */
  private async generateEnhancedReport(
    questions: string[],
    debateResults: QuestionDebateResult[]
  ): Promise<EnhancedDebateReport> {
    // Consolidate insights from all debates
    const allInsights: string[] = [];
    const allControversialPoints: string[] = [];
    const postureScores = new Map<string, number[]>();

    for (const result of debateResults) {
      allInsights.push(...result.verdict.insights);
      allControversialPoints.push(...result.verdict.controversialPoints);

      // Collect scores for each posture
      for (const debaterVerdict of result.verdict.perDebater) {
        const existingScores = postureScores.get(debaterVerdict.posture) || [];
        existingScores.push(debaterVerdict.totals.weighted);
        postureScores.set(debaterVerdict.posture, existingScores);
      }
    }

    // Calculate average scores per posture
    const finalRanking = Array.from(postureScores.entries())
      .map(([posture, scores]) => ({
        posture,
        averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    // Generate overall summary
    const overallSummary = this.generateOverallSummary(questions, debateResults, finalRanking);

    // Generate markdown
    const markdown = this.generateEnhancedMarkdown(
      questions,
      debateResults,
      overallSummary,
      finalRanking,
      allInsights,
      allControversialPoints
    );

    return {
      questions,
      debateResults,
      overallSummary,
      consolidatedInsights: [...new Set(allInsights)], // Remove duplicates
      consolidatedControversialPoints: [...new Set(allControversialPoints)],
      finalRanking,
      markdown,
    };
  }

  /**
   * Generate overall summary text
   */
  private generateOverallSummary(
    questions: string[],
    debateResults: QuestionDebateResult[],
    finalRanking: Array<{ posture: string; averageScore: number }>
  ): string {
    const bestPosture = finalRanking[0];
    return `This multi-question debate explored ${questions.length} key questions about the research paper. ` +
      `After ${debateResults.length} rounds of structured argumentation and cross-examination, ` +
      `the posture "${bestPosture.posture}" emerged as the strongest position with an average score of ` +
      `${(bestPosture.averageScore * 100).toFixed(1)}%. The debate revealed multiple perspectives and ` +
      `generated valuable insights through direct confrontation of arguments.`;
  }

  /**
   * Generate enhanced markdown with all debates
   */
  private generateEnhancedMarkdown(
    questions: string[],
    debateResults: QuestionDebateResult[],
    overallSummary: string,
    finalRanking: Array<{ posture: string; averageScore: number }>,
    insights: string[],
    controversialPoints: string[]
  ): string {
    let md = `# Enhanced Multi-Question Debate Report\n\n`;
    md += `## Overall Summary\n\n${overallSummary}\n\n`;

    md += `## Final Ranking (Across All Questions)\n\n`;
    finalRanking.forEach((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      md += `${medal} **${entry.posture}** - Score: ${(entry.averageScore * 100).toFixed(1)}%\n\n`;
    });

    md += `## Consolidated Insights\n\n`;
    insights.forEach((insight) => {
      md += `- ${insight}\n`;
    });
    md += `\n`;

    md += `## Controversial Points\n\n`;
    controversialPoints.forEach((point) => {
      md += `- ${point}\n`;
    });
    md += `\n`;

    md += `---\n\n`;

    // Details for each question
    debateResults.forEach((result, index) => {
      md += `## Question ${index + 1}: ${result.question}\n\n`;
      md += `### Postures\n\n`;
      result.postures.forEach((posture, i) => {
        md += `${i + 1}. ${posture}\n`;
      });
      md += `\n`;

      md += `### Topics Debated\n\n`;
      result.topics.forEach((topic) => {
        md += `- ${topic}\n`;
      });
      md += `\n`;

      // Add initial arguments
      md += `### Initial Arguments\n\n`;
      result.initialArguments.forEach((arg, argIdx) => {
        md += `#### ${result.postures[argIdx]}\n\n`;
        if (arg.perTopic && arg.perTopic.length > 0) {
          arg.perTopic.forEach((topic) => {
            md += `**${topic.topic}**\n\n`;
            if (topic.claim) {
              md += `*Claim:* ${topic.claim}\n\n`;
            }
            if (topic.reasoning) {
              md += `${topic.reasoning}\n\n`;
            }
          });
        }
        if (arg.overallPosition) {
          md += `*Overall Position:* ${arg.overallPosition}\n\n`;
        }
        md += `---\n\n`;
      });

      md += `### Debate Rounds\n\n`;
      result.rounds.forEach((round) => {
        md += `#### Round ${round.roundNumber}\n\n`;
        round.exchanges.forEach((exchange) => {
          md += `**${exchange.fromDebater}** asks **${exchange.toDebater}**:\n`;
          md += `> "${exchange.question}"\n\n`;
          md += `**${exchange.toDebater}** responds:\n`;
          md += `> ${exchange.response}\n\n`;
        });
      });

      md += `### Winner for this Question\n\n`;
      md += `**${result.verdict.bestOverall}**\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

