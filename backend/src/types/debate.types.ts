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
    cites: {
      paper?: LookupHit[];
      web?: WebSearchResult[];
    };
  }>;
  overallPosition: string;
};

// Judge Types
export type RubricCriterion = {
  id: "correctness" | "evidence" | "coverage" | "clarity" | "novelty";
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
};

// Reporter Output
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
    id: "correctness",
    weight: 0.35,
    description: "Factual alignment with paper and reputable sources",
  },
  {
    id: "evidence",
    weight: 0.25,
    description: "Quality & sufficiency of citations",
  },
  {
    id: "coverage",
    weight: 0.15,
    description: "Addressed all required aspects of the topic",
  },
  {
    id: "clarity",
    weight: 0.15,
    description: "Precise, unambiguous writing",
  },
  {
    id: "novelty",
    weight: 0.10,
    description: "Non-obvious, valuable angle",
  },
];

