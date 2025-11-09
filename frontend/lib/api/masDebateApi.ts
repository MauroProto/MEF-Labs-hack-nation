/**
 * MAS (Multi-Agent System) Debate API Client
 *
 * Improved debate system where all debaters argue the SAME topics
 * from DIFFERENT postures/perspectives (like a real debate).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================================================
// Type Definitions (matching backend/src/types/debate.types.ts)
// ============================================================================

export type Paper = {
  id: string;
  title: string;
  text: string;
};

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

export type RubricCriterion = {
  id: 'correctness' | 'evidence' | 'coverage' | 'clarity' | 'novelty';
  weight: number;
  description: string;
};

export type JudgeVerdict = {
  perDebater: Array<{
    posture: string;
    perTopic: Array<{
      topic: string;
      scores: Record<RubricCriterion['id'], number>;
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
    scoringTable: JudgeVerdict['perDebater'];
  };
  markdown: string;
};

// ============================================================================
// API Request/Response Types
// ============================================================================

export type GenerateQuestionsRequest = {
  paperId: string;
};

export type GenerateQuestionsResponse = {
  questions: string[];
};

export type GeneratePosturesRequest = {
  paperId: string;
  question: string;
  numPostures?: number;
};

export type GeneratePosturesResponse = {
  postures: string[];
  topics: string[];
};

export type RunDebateRequest = {
  paperId: string;
  question: string;
  numPostures?: number;
};

export type RunDebateResponse = DebateReport;

export type RunCompleteDebateRequest = {
  paperId: string;
  questionIndex?: number;
  numPostures?: number;
};

// ============================================================================
// SSE Progress Event Types
// ============================================================================

export type DebateProgressEvent =
  | { stage: 'Generating postures and topics...'; data?: any }
  | { stage: 'postures_generated'; data: { postures: string[]; topics: string[] } }
  | { stage: 'Running debate with N debaters...'; data?: any }
  | { stage: 'debate_complete'; data: { arguments: DebaterArgument[] } }
  | { stage: 'Judging arguments...'; data?: any }
  | { stage: 'judging_complete'; data: { verdict: JudgeVerdict } }
  | { stage: 'Generating final report...'; data?: any }
  | { stage: 'report_complete'; data: { report: DebateReport } }
  | { stage: 'Generating questions from paper...'; data?: any }
  | { stage: 'questions_generated'; data: { questions: string[] } }
  | { stage: 'question_selected'; data: { question: string } };

// ============================================================================
// API Functions
// ============================================================================

/**
 * Generate research questions from a paper
 */
export async function generateQuestions(
  request: GenerateQuestionsRequest
): Promise<GenerateQuestionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mas-debate/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Generate debate postures and topics for a specific question
 */
export async function generatePostures(
  request: GeneratePosturesRequest
): Promise<GeneratePosturesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mas-debate/postures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Run debate with SSE progress updates
 */
export async function runDebateWithSSE(
  request: RunDebateRequest,
  onProgress: (event: DebateProgressEvent) => void,
  onComplete: (report: DebateReport) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mas-debate/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: progress')) {
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onProgress(data as DebateProgressEvent);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
        if (line.startsWith('event: complete')) {
          continue;
        }
        if (line.startsWith('data: ') && buffer.includes('event: complete')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.report) {
              onComplete(data.report as DebateReport);
            }
          } catch (e) {
            console.error('Failed to parse completion data:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Run complete debate flow (question generation + debate) with SSE
 */
export async function runCompleteDebateWithSSE(
  request: RunCompleteDebateRequest,
  onProgress: (event: DebateProgressEvent) => void,
  onComplete: (report: DebateReport) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mas-debate/run-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.stage) {
              onProgress(data as DebateProgressEvent);
            }
            if (data.report) {
              onComplete(data.report as DebateReport);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
