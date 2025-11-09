import { FurtherQuestionsGenerator } from "./FurtherQuestionsGenerator";
import { PostureGenerator } from "./PostureGenerator";
import { DebaterAgent } from "./DebaterAgent";
import { JudgeAgent } from "./JudgeAgent";
import { ReporterAgent } from "./ReporterAgent";
import { FactCheckerAgent, FactCheckSummary } from "./FactCheckerAgent";
import {
  Paper,
  DebateSession,
  DebaterArgument,
  JudgeVerdict,
  DebateReport,
  DEFAULT_RUBRIC,
  Rubric,
} from "../../types/debate.types";

export interface DebateCoordinatorConfig {
  rubric?: Rubric;
}

export class DebateCoordinator {
  private furtherQuestionsGenerator: FurtherQuestionsGenerator;
  private postureGenerator: PostureGenerator;
  private judgeAgent: JudgeAgent;
  private reporterAgent: ReporterAgent;
  private factCheckerAgent: FactCheckerAgent;
  private rubric: Rubric;

  constructor(config: DebateCoordinatorConfig = {}) {
    this.furtherQuestionsGenerator = new FurtherQuestionsGenerator();
    this.postureGenerator = new PostureGenerator();
    this.judgeAgent = new JudgeAgent();
    this.reporterAgent = new ReporterAgent();
    this.factCheckerAgent = new FactCheckerAgent();
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
        const argument = await debater.debate({
          posture,
          question,
          topics,
          paper,
        });

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
   * Step 4: Fact-check the arguments
   */
  async factCheckArguments(
    debaterArguments: DebaterArgument[]
  ): Promise<FactCheckSummary> {
    const factCheck = await this.factCheckerAgent.checkFacts({
      arguments: debaterArguments,
    });
    return factCheck;
  }

  /**
   * Step 5: Judge the debate (with fact-check results)
   */
  async judgeDebate(
    question: string,
    topics: string[],
    debaterArguments: DebaterArgument[],
    factCheck?: FactCheckSummary
  ): Promise<JudgeVerdict> {
    const verdict = await this.judgeAgent.judge({
      question,
      topics,
      arguments: debaterArguments,
      rubric: this.rubric,
      factCheck,
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

      // Step 3: Fact-check arguments
      onProgress?.("Fact-checking arguments...");
      const factCheck = await this.factCheckArguments(debaterArguments);
      onProgress?.("factcheck_complete", { factCheck });

      // Step 4: Judge debate (with fact-check results)
      onProgress?.("Judging arguments...");
      const verdict = await this.judgeDebate(question, topics, debaterArguments, factCheck);
      onProgress?.("judging_complete", { verdict });

      // Step 5: Generate report
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
}

