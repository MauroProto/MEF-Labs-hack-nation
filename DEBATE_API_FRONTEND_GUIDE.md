# Debate System API - Frontend Integration Guide

**Status**: Backend Complete ✅ | Frontend TODO
**Date**: 2025-11-08
**Backend Server**: http://localhost:4000

---

## Overview

The debate system backend is fully implemented with 3 services, 1 controller, and 3 API endpoints. This guide provides everything the frontend team needs to integrate the debate functionality.

---

## Backend Architecture

### Services

1. **Posture Generator** (`backend/src/services/postureGenerator.ts`)
   - Generates 3 debate postures from research analysis
   - Uses GPT-4 to create distinct perspectives

2. **Debate Orchestrator** (`backend/src/services/debateOrchestrator.ts`)
   - Conducts 4-round structured debates
   - Round 1: Exposition (each debater presents)
   - Rounds 2-4: Cross-examination (2 questioners per target)
   - Saves full transcript with Prisma transactions

3. **Judge Service** (`backend/src/services/judgeService.ts`)
   - Evaluates debate transcripts
   - Scores on 4 criteria (Evidence Quality, Logical Coherence, Topic Coverage, Response Quality)
   - Provides weighted scores and detailed reasoning

---

## API Endpoints

### Base URL
```
http://localhost:4000/api/debate
```

---

### 1. Start Debate

**Endpoint**: `POST /api/debate/start`

**Description**: Initiates a new debate session. The debate runs asynchronously in the background.

**Request Body**:
```typescript
{
  researchAnalysis: string;  // Required: Output from researcher agent
  paperId?: string;          // Optional: Reference to paper
  debaterIds?: string[];     // Optional: Custom agent IDs [default: debater-1, debater-2, debater-3]
}
```

**Response** (200 OK):
```typescript
{
  sessionId: string;         // Use this to track debate progress
  status: "debating";
  postures: Posture[];       // 3 generated debate positions
  message: string;           // Instructions to use WebSocket or GET endpoint
}
```

**Response Types**:
```typescript
interface Posture {
  id: string;
  sessionId: string;
  debaterId: string;                    // "debater-1", "debater-2", "debater-3"
  perspectiveTemplate: string;          // "Critical Analyst", "Methodological Advocate", etc.
  topics: string[];                     // 3-5 topics to cover
  initialPosition: string;              // 2-3 sentence stance
  guidingQuestions: string[];           // 3-4 questions to explore
  createdAt: Date;
}
```

**Error Responses**:
- `400 Bad Request`: Missing `researchAnalysis`
- `500 Internal Server Error`: Debate initialization failed

**Example Request**:
```typescript
const response = await fetch('http://localhost:4000/api/debate/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    researchAnalysis: "This paper investigates...",
    paperId: "paper-abc123"
  })
});

const { sessionId, postures } = await response.json();
```

---

### 2. Get Debate Session

**Endpoint**: `GET /api/debate/:sessionId`

**Description**: Fetch current state and results of a debate session.

**Path Parameters**:
- `sessionId` (string): Debate session ID from start response

**Response** (200 OK):
```typescript
{
  id: string;
  status: "initializing" | "debating" | "evaluating" | "completed" | "error";
  currentRound: number | null;          // 1-4 during debate, null when complete
  postures: Posture[];
  transcript: DebateTranscript | null;  // Available when status = "completed"
  verdict: JudgeVerdict | null;         // Available when status = "completed"
  createdAt: Date;
  updatedAt: Date;
}
```

**Response Types**:
```typescript
interface DebateTranscript {
  id: string;
  sessionId: string;
  postures: Posture[];  // Snapshot at debate time
  rounds: DebateRound[];
  metadata: {
    startTime: Date;
    endTime?: Date;
    totalExchanges: number;
    participantIds: string[];
    partialDebate?: boolean;      // True if debate failed mid-way
    failureRound?: number;
    errorMessage?: string;
  };
}

interface DebateRound {
  roundNumber: 1 | 2 | 3 | 4;
  roundType: "exposition" | "cross_examination";
  targetPosture?: string;           // Posture ID being examined (rounds 2-4)
  exchanges: DebateExchange[];
  startTime: Date;
  endTime?: Date;
}

interface DebateExchange {
  id: string;
  from: string;                     // Debater agent ID
  to?: string;                      // Target debater (for questions)
  type: "exposition" | "question" | "answer";
  content: string;                  // The actual text
  topics: string[];                 // Which topics this addresses
  timestamp: Date;
}

interface JudgeVerdict {
  id: string;
  sessionId: string;
  judgeId: string;                  // "judge-gpt4"
  criteria: Record<string, string>; // { "Evidence Quality": "description", ... }
  scores: Record<string, Record<string, number>>;  // { "debater-1": { "Evidence Quality": 85, ... }, ... }
  reasoning: string;                // Detailed evaluation text
  confidence: number;               // 0-1
  verdict: string;                  // Summary verdict
  timestamp: Date;
}
```

**Error Responses**:
- `404 Not Found`: Session ID not found
- `500 Internal Server Error`: Database error

**Example Request**:
```typescript
const session = await fetch(`http://localhost:4000/api/debate/${sessionId}`)
  .then(res => res.json());

if (session.status === 'completed') {
  console.log('Debate finished!');
  console.log('Transcript:', session.transcript);
  console.log('Verdict:', session.verdict);
}
```

---

### 3. List Debate Sessions

**Endpoint**: `GET /api/debate`

**Description**: List all debate sessions with pagination and filtering.

**Query Parameters**:
- `status` (optional): Filter by status ("initializing", "debating", "evaluating", "completed", "error")
- `limit` (optional, default: 20): Number of sessions to return
- `offset` (optional, default: 0): Skip N sessions

**Response** (200 OK):
```typescript
{
  sessions: DebateSessionSummary[];
  total: number;
  limit: number;
  offset: number;
}
```

**Response Types**:
```typescript
interface DebateSessionSummary {
  id: string;
  status: string;
  currentRound: number | null;
  postures: Posture[];
  createdAt: Date;
  updatedAt: Date;
  _count: {
    postures: number;
  };
}
```

**Example Request**:
```typescript
// Get all completed debates
const { sessions } = await fetch('http://localhost:4000/api/debate?status=completed&limit=10')
  .then(res => res.json());

// Get recent debates
const { sessions } = await fetch('http://localhost:4000/api/debate?limit=5')
  .then(res => res.json());
```

---

## WebSocket Events

The backend emits real-time events via Socket.io on `http://localhost:4000`.

### Event Types

```typescript
// Debate lifecycle events
'debate:initialized'        // Session created, postures being generated
'debate:postures_generated' // Postures ready, debate starting
'debate:round_end'          // Round completed
'debate:exchange'           // New exchange (question/answer/exposition)
'debate:completed'          // Debate finished, verdict available
'debate:error'              // Debate failed
```

### Event Payloads

```typescript
// debate:initialized
{
  sessionId: string;
}

// debate:postures_generated
{
  sessionId: string;
  postures: Posture[];
}

// debate:round_end
{
  sessionId: string;
  roundNumber: number;
  exchangeCount: number;
}

// debate:exchange
{
  id: string;
  from: string;
  to?: string;
  type: "exposition" | "question" | "answer";
  content: string;
  topics: string[];
  timestamp: Date;
}

// debate:completed
{
  sessionId: string;
  verdict: JudgeVerdict;
}

// debate:error
{
  sessionId: string;
  error: string;
}
```

### Frontend Socket.io Integration

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

// Listen for debate events
socket.on('agent:broadcast', (event) => {
  if (event.type === 'debate:exchange') {
    console.log('New exchange:', event.payload);
    // Update UI with new message
  }

  if (event.type === 'debate:completed') {
    console.log('Debate complete!');
    // Fetch final results
  }
});
```

---

## Frontend Implementation Checklist

### Required Components

#### 1. Debate Start Button/Modal
- [ ] Input field for research analysis (from researcher agent output)
- [ ] Optional paper ID selection
- [ ] Start debate button
- [ ] Loading state during initialization

```typescript
async function startDebate(researchAnalysis: string) {
  const response = await fetch('http://localhost:4000/api/debate/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ researchAnalysis })
  });

  const { sessionId, postures } = await response.json();

  // Navigate to debate view or show in modal
  router.push(`/debate/${sessionId}`);
}
```

#### 2. Debate Session Page (`/debate/:sessionId`)
- [ ] Status indicator (initializing → debating → evaluating → completed)
- [ ] Current round display (1-4)
- [ ] Posture cards (3 cards showing perspectives, topics, questions)
- [ ] Debate timeline/transcript view
- [ ] Real-time exchange updates via WebSocket
- [ ] Verdict display when complete

```typescript
'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function DebatePage({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState(null);
  const [exchanges, setExchanges] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetch(`http://localhost:4000/api/debate/${sessionId}`)
      .then(res => res.json())
      .then(setSession);

    // WebSocket updates
    const socket = io('http://localhost:4000');

    socket.on('agent:broadcast', (event) => {
      if (event.payload.sessionId === sessionId) {
        if (event.type === 'debate:exchange') {
          setExchanges(prev => [...prev, event.payload]);
        }
        if (event.type === 'debate:completed') {
          // Refetch full session
          fetch(`http://localhost:4000/api/debate/${sessionId}`)
            .then(res => res.json())
            .then(setSession);
        }
      }
    });

    return () => socket.disconnect();
  }, [sessionId]);

  // Render UI...
}
```

#### 3. Posture Card Component
- [ ] Display perspective template
- [ ] List topics
- [ ] Show initial position
- [ ] Display guiding questions
- [ ] Highlight which debater

```typescript
function PostureCard({ posture }: { posture: Posture }) {
  return (
    <div className="border rounded p-4">
      <h3>{posture.perspectiveTemplate}</h3>
      <p className="text-sm text-gray-600">Debater: {posture.debaterId}</p>

      <div className="mt-2">
        <strong>Position:</strong>
        <p>{posture.initialPosition}</p>
      </div>

      <div className="mt-2">
        <strong>Topics:</strong>
        <ul className="list-disc ml-4">
          {posture.topics.map(t => <li key={t}>{t}</li>)}
        </ul>
      </div>

      <div className="mt-2">
        <strong>Questions:</strong>
        <ul className="list-disc ml-4">
          {posture.guidingQuestions.map(q => <li key={q}>{q}</li>)}
        </ul>
      </div>
    </div>
  );
}
```

#### 4. Debate Timeline Component
- [ ] Display all 4 rounds
- [ ] Show exchanges chronologically
- [ ] Differentiate exposition/question/answer
- [ ] Highlight current round during debate
- [ ] Show timestamps

```typescript
function DebateTimeline({ transcript }: { transcript: DebateTranscript }) {
  return (
    <div className="space-y-4">
      {transcript.rounds.map(round => (
        <div key={round.roundNumber} className="border-l-4 border-blue-500 pl-4">
          <h4>Round {round.roundNumber}: {round.roundType}</h4>

          {round.exchanges.map(exchange => (
            <div key={exchange.id} className={`mt-2 p-2 rounded ${
              exchange.type === 'exposition' ? 'bg-blue-50' :
              exchange.type === 'question' ? 'bg-yellow-50' :
              'bg-green-50'
            }`}>
              <div className="text-xs text-gray-500">
                {exchange.type.toUpperCase()} | From: {exchange.from} {exchange.to ? `→ ${exchange.to}` : ''}
              </div>
              <p className="mt-1">{exchange.content}</p>
              <div className="text-xs text-gray-400 mt-1">
                Topics: {exchange.topics.join(', ')}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### 5. Judge Verdict Component
- [ ] Display overall verdict
- [ ] Show scores per debater per criterion
- [ ] Display weighted total scores
- [ ] Show detailed reasoning
- [ ] Confidence indicator

```typescript
import { calculateWeightedScores } from '@/lib/debateUtils';

function VerdictDisplay({ verdict }: { verdict: JudgeVerdict }) {
  const weightedScores = calculateWeightedScores(verdict);

  return (
    <div className="border rounded p-6">
      <h2>Judge Verdict</h2>
      <p className="text-sm text-gray-600">Confidence: {(verdict.confidence * 100).toFixed(0)}%</p>

      <div className="mt-4">
        <h3>Weighted Scores</h3>
        {Object.entries(weightedScores).map(([debaterId, score]) => (
          <div key={debaterId} className="flex justify-between">
            <span>{debaterId}</span>
            <span className="font-bold">{score}/100</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3>Detailed Reasoning</h3>
        <p className="whitespace-pre-wrap">{verdict.reasoning}</p>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h3>Verdict</h3>
        <p>{verdict.verdict}</p>
      </div>
    </div>
  );
}
```

#### 6. Debate List Page (`/debates`)
- [ ] List all debates
- [ ] Filter by status
- [ ] Pagination controls
- [ ] Click to view details

```typescript
function DebatesList() {
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('all');

  useEffect(() => {
    const query = status !== 'all' ? `?status=${status}` : '';
    fetch(`http://localhost:4000/api/debate${query}`)
      .then(res => res.json())
      .then(data => setSessions(data.sessions));
  }, [status]);

  return (
    <div>
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">All</option>
        <option value="completed">Completed</option>
        <option value="debating">In Progress</option>
        <option value="error">Failed</option>
      </select>

      <div className="mt-4 space-y-2">
        {sessions.map(session => (
          <div key={session.id} className="border p-4 rounded">
            <Link href={`/debate/${session.id}`}>
              <h3>Debate {session.id.slice(0, 8)}</h3>
              <p>Status: {session.status}</p>
              <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Utility Functions

Create `lib/debateUtils.ts`:

```typescript
export interface EvaluationCriteria {
  name: string;
  weight: number; // 0-1
}

const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  { name: 'Evidence Quality', weight: 0.3 },
  { name: 'Logical Coherence', weight: 0.25 },
  { name: 'Topic Coverage', weight: 0.25 },
  { name: 'Response Quality', weight: 0.2 },
];

export function calculateWeightedScores(
  verdict: JudgeVerdict,
  criteria: EvaluationCriteria[] = DEFAULT_CRITERIA
): Record<string, number> {
  const weightedScores: Record<string, number> = {};

  for (const [debaterId, scores] of Object.entries(verdict.scores)) {
    let totalScore = 0;

    for (const criterion of criteria) {
      const score = scores[criterion.name] || 0;
      totalScore += score * criterion.weight;
    }

    weightedScores[debaterId] = Math.round(totalScore);
  }

  return weightedScores;
}

export function getWinner(verdict: JudgeVerdict): string {
  const scores = calculateWeightedScores(verdict);
  return Object.entries(scores).reduce((max, [id, score]) =>
    score > (scores[max] || 0) ? id : max
  , Object.keys(scores)[0]);
}
```

---

## Testing the API

### Manual Testing with curl

```bash
# Start a debate
curl -X POST http://localhost:4000/api/debate/start \
  -H "Content-Type: application/json" \
  -d '{"researchAnalysis":"This paper presents novel findings..."}'

# Get session status
curl http://localhost:4000/api/debate/{sessionId}

# List debates
curl http://localhost:4000/api/debate?limit=5
```

### Frontend Testing Checklist

- [ ] Debate starts successfully
- [ ] Postures display correctly
- [ ] Real-time exchanges appear in UI
- [ ] Round progression updates
- [ ] Verdict displays when complete
- [ ] Error states handled gracefully
- [ ] WebSocket reconnection works
- [ ] List view shows all debates
- [ ] Pagination works
- [ ] Filtering by status works

---

## Error Handling

### Common Errors

1. **Debate fails to start**
   - Check `researchAnalysis` is not empty
   - Verify OpenAI API key is set in backend `.env`
   - Check backend logs for errors

2. **WebSocket not receiving events**
   - Verify Socket.io client connected: `socket.connected`
   - Check browser console for connection errors
   - Ensure backend is running on port 4000

3. **Session not found (404)**
   - Verify sessionId is correct
   - Check if debate was deleted from database

4. **Debate status stuck on "debating"**
   - Check backend logs for errors
   - Debate may have failed - check for `status: 'error'`
   - Look for partial transcript in session data

---

## Performance Considerations

- **Debate Duration**: Full 4-round debate takes 3-5 minutes
- **API Polling**: If not using WebSockets, poll `GET /api/debate/:sessionId` every 5-10 seconds
- **Transcript Size**: ~15 exchanges, each 200-800 words = ~5-10KB JSON
- **Concurrent Debates**: Backend can handle multiple debates simultaneously

---

## Next Steps

1. **Immediate**: Implement basic debate start button and status display
2. **Phase 2**: Add real-time WebSocket updates
3. **Phase 3**: Build full transcript viewer with timeline
4. **Phase 4**: Add verdict visualization and analysis
5. **Phase 5**: Implement debate list and history

---

## Questions?

- Backend code: `backend/src/controllers/debateController.ts`
- Services: `backend/src/services/debate*.ts`
- Types: `backend/src/types/agent.types.ts` (lines 232-321)

**Backend is ready. Frontend team can start integration!** 🚀
