// Paper & Session Types
export type Paper = {
  id: string;
  title: string;
  text: string;
};

export type DebateSession = {
  paperId: string;
  question: string;
  topics: string[];
  postures: string[];
};

// Tool Result Types
export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type LookupHit = {
  chunkId: string;
  text: string;
  score: number;
};

// Debater Output
export type DebaterArgument = {
  posture: string;
  perTopic: Array<{
    topic: string;
    claim: string;
    reasoning: string;
    counterpoints: string[];
    citations: {
      paper?: LookupHit[];
      web?: WebSearchResult[];
    };
  }>;
  overallPosition: string;
};

// Judge Types
export type RubricCriterion = {
  id: "value" | "cohesiveness" | "relevance" | "clarity" | "engagement";
  weight: number;
  description: string;
};

export type Rubric = RubricCriterion[];

export type JudgeVerdict = {
  perDebater: Array<{
    posture: string;
    perTopic: Array<{
      topic: string;
      scores: Record<RubricCriterion["id"], number>;
      notes: string;
    }>;
    totals: {
      weighted: number;
      byCriterion: Record<string, number>;
    };
  }>;
  bestOverall: string;
  insights: string[];
  controversialPoints: string[];
};

// Enhanced Debate Types (Multi-Question + Rounds)
export type DebateExchange = {
  fromDebater: string;      // posture asking
  toDebater: string;        // posture responding
  question: string;         // question asked
  response: string;         // response given
  timestamp: number;        // when this happened
};

export type DebateRound = {
  roundNumber: number;
  exchanges: DebateExchange[];
};

export type QuestionDebateResult = {
  question: string;
  postures: string[];
  topics: string[];
  initialArguments: DebaterArgument[];
  rounds: DebateRound[];
  verdict: JudgeVerdict;
};

// Reporter Output (Original - Single Question)
export type DebateReport = {
  question: string;
  topics: string[];
  postures: string[];
  summary: string;
  rankedPostures: Array<{
    posture: string;
    score: number;
  }>;
  validatedInsights: string[];
  controversialPoints: string[];
  recommendedNextReads: WebSearchResult[];
  appendix: {
    perDebaterKeyClaims: Array<{
      posture: string;
      claims: Array<{
        topic: string;
        claim: string;
      }>;
    }>;
    scoringTable: JudgeVerdict["perDebater"];
  };
  markdown: string;
};

// Enhanced Report (Multiple Questions + Rounds)
export type EnhancedDebateReport = {
  questions: string[];
  debateResults: QuestionDebateResult[];
  overallSummary: string;
  consolidatedInsights: string[];
  consolidatedControversialPoints: string[];
  finalRanking: Array<{
    posture: string;
    averageScore: number;
  }>;
  markdown: string;
};

// Agent Request/Response Types
export type FurtherQuestionsRequest = {
  paper: Paper;
};

export type FurtherQuestionsResponse = {
  questions: string[];
};

export type PostureGeneratorRequest = {
  question: string;
  paper: Paper;
  numPostures: number;
};

export type PostureGeneratorResponse = {
  postures: string[];
  topics: string[];
};

export type DebaterRequest = {
  posture: string;
  question: string;
  topics: string[];
  paper: Paper;
};

export type JudgeRequest = {
  question: string;
  topics: string[];
  arguments: DebaterArgument[];
  rubric: Rubric;
  factCheck?: any; // FactCheckSummary from FactCheckerAgent
};

export type ReporterRequest = {
  question: string;
  topics: string[];
  postures: string[];
  arguments: DebaterArgument[];
  verdict: JudgeVerdict;
};

// Default Rubric
export const DEFAULT_RUBRIC: Rubric = [
  {
    id: "value",
    weight: 0.30,
    description: "Conceptual or argumentative richness; non-triviality",
  },
  {
    id: "cohesiveness",
    weight: 0.25,
    description: "Internal logic and compatibility across topics",
  },
  {
    id: "relevance",
    weight: 0.20,
    description: "Focused on the topic and question",
  },
  {
    id: "clarity",
    weight: 0.15,
    description: "Precision and readability of reasoning",
  },
  {
    id: "engagement",
    weight: 0.10,
    description: "Responds to counterpoints, anticipates critique",
  },
];

