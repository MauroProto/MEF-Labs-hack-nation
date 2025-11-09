/**
 * Debate API Client
 *
 * Client for interacting with the debate system backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Posture {
  id: string;
  sessionId: string;
  debaterId: string;
  perspectiveTemplate: string;
  topics: string[];
  initialPosition: string;
  guidingQuestions: string[];
  createdAt: string;
}

export interface DebateExchange {
  id: string;
  roundId: string;
  from: string;
  to?: string;
  type: 'exposition' | 'question' | 'answer';
  content: string;
  topics: string[];
  timestamp: string;
}

export interface DebateRound {
  id: string;
  transcriptId: string;
  roundNumber: 1 | 2 | 3 | 4;
  roundType: 'exposition' | 'cross_examination';
  targetPosture?: string;
  startTime: string;
  endTime?: string;
  exchanges: DebateExchange[];
}

export interface DebateTranscript {
  id: string;
  sessionId: string;
  posturesData: Posture[];
  metadata: {
    startTime: string;
    endTime?: string;
    totalExchanges: number;
    participantIds: string[];
  };
  rounds: DebateRound[];
}

export interface JudgeVerdict {
  id: string;
  sessionId: string;
  judgeId: string;
  criteria: Record<string, any>;
  scores: Record<string, number>;
  reasoning: string;
  confidence: number;
  verdict: string;
  timestamp: string;
}

export interface DebateSession {
  id: string;
  paperId?: string;
  researchAnalysis: string;
  status: 'initializing' | 'debating' | 'evaluating' | 'completed' | 'error';
  currentRound?: number;
  postures: Posture[];
  transcript?: DebateTranscript;
  verdict?: JudgeVerdict;
  finalReport?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartDebateRequest {
  researchAnalysis: string;
  paperId?: string;
  debaterIds?: string[];
}

export interface StartDebateResponse {
  sessionId: string;
  status: string;
  postures: Posture[];
  message: string;
}

/**
 * Start a new debate session
 */
export async function startDebate(
  request: StartDebateRequest
): Promise<StartDebateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/debate/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start debate');
  }

  return response.json();
}

/**
 * Get debate session by ID
 */
export async function getDebateSession(sessionId: string): Promise<DebateSession> {
  const response = await fetch(`${API_BASE_URL}/api/debate/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch debate session');
  }

  return response.json();
}

/**
 * List all debate sessions
 */
export async function listDebateSessions(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  sessions: DebateSession[];
  total: number;
  limit: number;
  offset: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/debate?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list debate sessions');
  }

  return response.json();
}
