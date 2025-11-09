# Multi-Agent System (MAS) Debate System

This document describes the Multi-Agent System for conducting structured debates on research papers.

## Architecture

The system implements a multi-agent debate topology with the following agents:

### Agents

1. **FurtherQuestionsGenerator** - Proposes 8-12 insightful questions from a research paper
2. **PostureGenerator** - For a chosen question, produces N postures + a complete topic set
3. **DebaterAgent** (N instances) - Each takes one posture and argues across all topics
   - Has access to `lookupPaper` tool (RAG over the paper)
   - Has access to `webSearch` tool (external sources)
4. **JudgeAgent** - Scores each debater by topic on explicit criteria
5. **ReporterAgent** - Compiles a structured report using Judge results + key quotes

### Coordinator

The `DebateCoordinator` is a lightweight orchestrator (state machine) that:
1. Seeds with the paper
2. Calls FurtherQuestionsGenerator → UI lets user pick a question & N postures
3. Calls PostureGenerator → topics + postures
4. Spawns N Debaters (parallel)
5. Calls Judge → structured verdict
6. Calls Reporter → final report JSON + markdown

## API Endpoints

All endpoints are under `/api/mas-debate`:

### 1. Generate Questions

**POST** `/api/mas-debate/questions`

Generate insightful questions from a paper.

**Request Body:**
```json
{
  "paperId": "string"
}
```

**Response:**
```json
{
  "questions": [
    "Under what conditions does the proposed method outperform baselines?",
    "To what extent are the findings transferable to other domains?",
    ...
  ]
}
```

### 2. Generate Postures and Topics

**POST** `/api/mas-debate/postures`

Generate debate postures and topics for a specific question.

**Request Body:**
```json
{
  "paperId": "string",
  "question": "string",
  "numPostures": 3  // optional, defaults to 3
}
```

**Response:**
```json
{
  "postures": [
    "Strong Support - Method is groundbreaking",
    "Cautious Optimism - Promising but limited",
    "Critical Skepticism - Significant flaws exist"
  ],
  "topics": [
    "Methodological Rigor",
    "Empirical Evidence Quality",
    "Generalizability",
    "Theoretical Contribution",
    "Practical Implications"
  ]
}
```

### 3. Run Debate

**POST** `/api/mas-debate/run`

Run a complete debate with a specific question.

**Request Body:**
```json
{
  "paperId": "string",
  "question": "string",
  "numPostures": 3  // optional, defaults to 3
}
```

**Response:** Full `DebateReport` object (see Data Contracts below)

**SSE Support:** Set `Accept: text/event-stream` header to receive progress updates:
- `progress` events with stage information
- `complete` event with final report
- `error` event if something fails

### 4. Run Complete Flow

**POST** `/api/mas-debate/run-complete`

Run complete debate flow including question generation.

**Request Body:**
```json
{
  "paperId": "string",
  "questionIndex": 0,  // optional, defaults to 0 (first question)
  "numPostures": 3     // optional, defaults to 3
}
```

**Response:** Full `DebateReport` object

**SSE Support:** Same as `/run` endpoint

## Data Contracts

### Paper
```typescript
type Paper = {
  id: string;
  title: string;
  text: string;
};
```

### DebateSession
```typescript
type DebateSession = {
  paperId: string;
  question: string;
  topics: string[];
  postures: string[];
};
```

### Tool Results
```typescript
type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type LookupHit = {
  chunkId: string;
  text: string;
  score: number;
};
```

### DebaterArgument
```typescript
type DebaterArgument = {
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
```

### Judge Rubric & Verdict
```typescript
type Rubric = Array<{
  id: "correctness" | "evidence" | "coverage" | "clarity" | "novelty";
  weight: number; // sum to 1.0
  description: string;
}>;

type JudgeVerdict = {
  perDebater: Array<{
    posture: string;
    perTopic: Array<{
      topic: string;
      scores: Record<RubricCriterion["id"], number>; // 0..1
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
```

### DebateReport
```typescript
type DebateReport = {
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
```

## Default Rubric

The system uses the following default rubric for judging:

- **Correctness (35%)** - Factual alignment with paper and reputable sources
- **Evidence (25%)** - Quality & sufficiency of citations
- **Coverage (15%)** - Addressed all required aspects of the topic
- **Clarity (15%)** - Precise, unambiguous writing
- **Novelty (10%)** - Non-obvious, valuable angle

## Usage Example

### Using the API directly

```bash
# 1. Generate questions
curl -X POST http://localhost:4000/api/mas-debate/questions \
  -H "Content-Type: application/json" \
  -d '{"paperId": "paper-123"}'

# 2. Run complete debate
curl -X POST http://localhost:4000/api/mas-debate/run \
  -H "Content-Type: application/json" \
  -d '{
    "paperId": "paper-123",
    "question": "Under what conditions does the proposed method outperform baselines?",
    "numPostures": 3
  }'

# 3. Run with SSE for progress updates
curl -X POST http://localhost:4000/api/mas-debate/run \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "paperId": "paper-123",
    "question": "Under what conditions does the proposed method outperform baselines?",
    "numPostures": 3
  }'
```

### Using the Coordinator programmatically

```typescript
import { DebateCoordinator } from './services/debate/DebateCoordinator';
import { Paper } from './types/debate.types';

const coordinator = new DebateCoordinator();

const paper: Paper = {
  id: 'paper-123',
  title: 'My Research Paper',
  text: '...',
};

// Generate questions
const questions = await coordinator.generateQuestions(paper);
console.log('Questions:', questions);

// Run complete debate
const report = await coordinator.runCompleteDebate(
  paper,
  questions[0],
  3, // number of postures
  (stage, data) => {
    console.log(`Progress: ${stage}`, data);
  }
);

console.log('Final Report:', report);
```

## Environment Variables

Make sure to set the following environment variable:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Implementation Details

### Agent Communication

All agents extend `BaseDebateAgent` which provides:
- OpenAI client initialization
- JSON response extraction
- Tool calling support

### Tool Implementation

The `DebaterAgent` has two tools:

1. **lookupPaper** - Simple text search over paper chunks
   - Splits paper into ~500 character chunks with 100 character overlap
   - Scores chunks based on query term frequency
   - Returns top 5 most relevant chunks

2. **webSearch** - Mock implementation (returns placeholder results)
   - In production, this would call a real search API (Google, Bing, Tavily, etc.)

### Parallel Execution

Debaters run in parallel using `Promise.all()` for efficiency.

### Error Handling

- All agents throw descriptive errors
- API endpoints catch and format errors appropriately
- SSE endpoints send error events

## Future Enhancements

1. **Real Web Search** - Integrate with Tavily, Google Custom Search, or Bing API
2. **Vector Search** - Use embeddings for semantic paper search instead of keyword matching
3. **Persistent Storage** - Save debate sessions and reports to database
4. **WebSocket Support** - Real-time updates during debate execution
5. **Custom Rubrics** - Allow users to define custom judging criteria
6. **Multi-Paper Debates** - Support debates across multiple papers
7. **Agent Memory** - Allow agents to reference previous debates
8. **Human-in-the-Loop** - Allow users to interject during debates

