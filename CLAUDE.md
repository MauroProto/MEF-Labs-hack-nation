# Claude Context Guide for Research Agent Canvas

**Last Updated**: November 9, 2025
**Current Branch**: `ui` (synchronized with main)
**Project Status**: ✅ Core features fully operational | Debate system complete | Canvas UI polished

This document helps developers provide optimal context to Claude for better code generation and assistance.
**Always use context7 MCP when working with different libraries and frameworks.**

---

## Project Overview

**What we're building**: A visual, AI-powered research platform for collaborative scientific paper analysis with a sophisticated multi-agent debate system.

**Core Innovation**:
- Multi-perspective AI debate system that analyzes papers from 3 different viewpoints
- Visual canvas-based workflow with React Flow
- Custom EventEmitter-based agent communication (MCP-like architecture)
- Client-side PDF parsing with intelligent text extraction

**What Actually Works** (as of Nov 2025):
- ✅ PDF upload and parsing (pdfjs-dist)
- ✅ AI chat with paper context (OpenAI gpt-4o-mini)
- ✅ Multi-Agent Debate System (NEW - 6 specialized agents)
- ✅ Web research with streaming (OpenAI o1-mini)
- ✅ React Flow canvas with 15 node types
- ✅ Paper context propagation between nodes
- ✅ Real-time debate progress via SSE
- ✅ Database schema (PostgreSQL + Prisma)
- ⚠️ Agent nodes UI (backend ready, UI not invoking)
- ⚠️ Canvas auto-save (schema ready, not wired)
- ❌ Visualization nodes (stubs only)
- ❌ User authentication

**Tech Stack**:
- **Frontend**: Next.js 16 (Turbopack), React 19, TypeScript, @xyflow/react, Zustand, Tailwind CSS
- **Backend**: Node.js 20+, Express, PostgreSQL, Prisma, Socket.io
- **AI**: OpenAI SDK (gpt-4o-mini, o1-mini), Tavily search API
- **Real-time**: Socket.io (WebSocket), SSE for streaming

---

## Critical Architecture Decisions

### ✅ What We Chose

1. **Custom EventEmitter** (NOT BullMQ/Redis)
   - Zero external dependencies for events
   - Perfect for single-process agent coordination
   - Simpler debugging and development
   - Location: `backend/src/services/agentEventBus.ts`

2. **Custom Agent Orchestration** (NOT LangGraph/CrewAI)
   - Full control over agent communication protocol
   - React Flow canvas graph = actual execution graph concept
   - OpenAI function calling for tool interfaces
   - Location: `backend/src/services/agentOrchestrator.ts`

3. **PostgreSQL Only** (no Redis)
   - Single Docker container setup
   - Simpler development environment
   - All caching in-memory (LRU, 5min TTL)

4. **Client-Side PDF Parsing** (pdfjs-dist)
   - No backend processing needed
   - Faster user experience
   - Reduced server load

5. **Zustand for State Management**
   - Lightweight, no boilerplate
   - Perfect for React 19
   - Three main stores: agents, papers, canvas

### ❌ What We're NOT Using

- ❌ Redis (no caching infrastructure needed yet)
- ❌ BullMQ/Bull (using EventEmitter instead)
- ❌ LangGraph/LangChain (custom implementation)
- ❌ CrewAI/AutoGen (custom debate agents)
- ❌ Server-side PDF parsing (client-side with pdfjs)

**Why this matters**: Claude might suggest these tools. Remind it of our architecture decisions!

---

## Essential Files to Reference

When asking Claude for help, always include relevant files from this list:

### 🎯 Core Architecture Files (READ THESE FIRST)

1. **[COMPREHENSIVE_ANALYSIS.md](./COMPREHENSIVE_ANALYSIS.md)** (15,000+ words)
   - Complete project analysis as of Nov 2025
   - All components documented
   - Implementation status per feature
   - Technology stack details
   - Critical gaps identified

   **When to reference**: Understanding current state, planning new features

2. **[ACTION_PLAN.md](./ACTION_PLAN.md)** (2000+ lines)
   - Complete implementation roadmap
   - Phase-by-phase tasks
   - Technology decisions explained
   - Database schema
   - Original agent communication architecture

   **When to reference**: Understanding original vision, architecture decisions

3. **[MAS_DEBATE_SYSTEM.md](./MAS_DEBATE_SYSTEM.md)**
   - Multi-Agent System debate framework
   - Debate flow and agents explained
   - Integration guide

   **When to reference**: Working on debate features

4. **[HACKATHON_PAPER_CANVAS_BLUEPRINT.md](./HACKATHON_PAPER_CANVAS_BLUEPRINT.md)** (32k+ tokens)
   - Original hackathon requirements
   - Feature specifications
   - User stories
   - Success criteria

   **When to reference**: Understanding feature requirements, UI/UX decisions

### 📁 Type Definitions (ALWAYS INCLUDE FOR BACKEND WORK)

5. **[backend/src/types/agent.types.ts](./backend/src/types/agent.types.ts)**
   - ALL TypeScript types for agent system
   - JSON-RPC 2.0 message formats
   - Zod schemas for validation
   - Error codes and custom error classes

   **When to reference**: ANY backend work involving agents, events, or communication

6. **[backend/src/types/debate.types.ts](./backend/src/types/debate.types.ts)**
   - Debate system types
   - Posture, verdict, report interfaces
   - Progress tracking types

   **When to reference**: Debate system modifications

### 🔧 Core Services (INCLUDE WHEN MODIFYING)

7. **[backend/src/services/agentEventBus.ts](./backend/src/services/agentEventBus.ts)** (251 lines)
   - Event system implementation
   - Type-safe event emission
   - Singleton `agentBus` instance
   - Event history tracking

   **When to reference**: Adding new event types, debugging event flow

8. **[backend/src/services/agentOrchestrator.ts](./backend/src/services/agentOrchestrator.ts)** (369 lines)
   - Agent invocation coordination
   - Circular dependency detection
   - Timeout management
   - Result caching (LRU, 100 entries, 5min TTL)
   - Singleton `orchestrator` instance

   **When to reference**: Modifying invocation logic, adding orchestration features

9. **[backend/src/services/debate/DebateCoordinator.ts](./backend/src/services/debate/DebateCoordinator.ts)** (261 lines)
   - **CRITICAL** - Orchestrates entire debate workflow
   - Question → Posture → Debate → Judge → Report
   - Progress callbacks for SSE streaming
   - Paper lookup integration

   **When to reference**: Modifying debate flow, adding debate features

10. **[backend/src/lib/rateLimiter.ts](./backend/src/lib/rateLimiter.ts)**
    - Token bucket rate limiting
    - Per-agent, per-canvas, and global limits
    - `AgentRateLimiters` class with presets

    **When to reference**: Adjusting rate limits, debugging throttling issues

### 🗄️ Database

11. **[backend/prisma/schema.prisma](./backend/prisma/schema.prisma)**
    - 14 database models (8 core + 6 debate)
    - Relationships between entities
    - Indexes for performance
    - Models: User, Canvas, Paper, Agent, AgentMessage, AgentInvocation, AgentCapability, WebSearchResult
    - Debate: DebateSession, Posture, DebateTranscript, DebateRound, DebateExchange, JudgeVerdict

    **When to reference**: Adding database features, queries, migrations

### 🎨 Frontend Key Files

12. **[frontend/components/canvas/EnhancedCanvas.tsx](./frontend/components/canvas/EnhancedCanvas.tsx)** (315 lines)
    - Main React Flow canvas implementation
    - Node creation, drag-drop, paper context propagation
    - 15 node types registered
    - Keyboard shortcuts, minimap, controls

13. **[frontend/components/nodes/PaperUploadNode.tsx](./frontend/components/nodes/PaperUploadNode.tsx)** (283 lines)
    - PDF upload and parsing
    - pdfjs-dist integration
    - Text extraction (up to 12 pages)
    - Auto-creates paper-chat nodes

14. **[frontend/components/nodes/MasDebateNode.tsx](./frontend/components/nodes/MasDebateNode.tsx)** (352 lines)
    - Multi-agent debate UI
    - Question generation → debate execution
    - Progress tracking with SSE
    - History sidebar

15. **[frontend/lib/stores/paperContextStore.ts](./frontend/lib/stores/paperContextStore.ts)** (176 lines)
    - Paper-to-node connection management
    - Context propagation logic
    - Upload progress tracking

16. **[frontend/lib/hooks/useMasDebate.ts](./frontend/lib/hooks/useMasDebate.ts)** (369 lines)
    - Debate state management
    - SSE integration for progress updates
    - History tracking

### ⚙️ Configuration

17. **[package.json](./package.json)** (root) + workspace package.jsons
    - Monorepo structure (Turborepo)
    - Dependencies and versions
    - Scripts

18. **[turbo.json](./turbo.json)**
    - Turborepo pipeline configuration

19. **[frontend/next.config.js](./frontend/next.config.js)**
    - Next.js 16 / Turbopack configuration

---

## Node Types Reference

### Current Implementation Status

| Node Type | Category | Fully Working? | Description |
|-----------|----------|----------------|-------------|
| **paper-upload** | Input | ✅ Yes | PDF upload, text extraction, paper storage |
| **note** | Input | ✅ Yes | Simple text note taking |
| **paper-chat** | Research | ✅ Yes | AI chat with paper context (gpt-4o-mini) |
| **web-research** | Research | ✅ Yes | Deep web research with streaming (o1-mini) |
| **debate** | Research | ✅ Yes | Multi-agent debate system (6 agents) |
| **researcher-agent** | Agent | ⚠️ UI Only | Deep analysis agent (backend ready) |
| **critic-agent** | Agent | ⚠️ UI Only | Validation agent (backend ready) |
| **synthesizer-agent** | Agent | ⚠️ UI Only | Conflict resolution agent (backend ready) |
| **question-generator** | Agent | ⚠️ UI Only | Research questions (backend ready) |
| **citation-tracker** | Agent | ⚠️ UI Only | Citation verification (backend ready) |
| **citation-graph** | Visualization | ❌ Stub | Network visualization (BaseNode only) |
| **summary** | Visualization | ❌ Stub | Paper summary (BaseNode only) |
| **methodology** | Visualization | ❌ Stub | Methodology extraction (BaseNode only) |
| **results-visualization** | Visualization | ❌ Stub | Results charts (BaseNode only) |
| **insight-report** | Visualization | ❌ Stub | Insight report (BaseNode only) |

**Total**: 15 node types (5 fully working, 5 UI-only agents, 5 stubs)

---

## Debate System (FULLY IMPLEMENTED)

### Architecture

The Multi-Agent System (MAS) Debate is the crown jewel of this project. Here's how it works:

```
📄 Paper Upload
  ↓
🤔 Generate Research Questions (FurtherQuestionsGenerator)
  ↓
❓ User Selects Question
  ↓
🎭 Generate 3 Postures + Shared Topics (PostureGenerator)
  │   - Posture 1: Critical Skeptic
  │   - Posture 2: Supportive Advocate
  │   - Posture 3: Balanced Synthesizer
  │   - Topics: Extracted from paper (e.g., "Methodology", "Results")
  ↓
💬 Parallel Debate (DebaterAgent × 3)
  │   - All 3 debaters discuss SAME topics
  │   - Each from DIFFERENT perspective
  │   - Cite paper + web sources
  │   - Respond to counterpoints
  ↓
✅ Fact Checking (FactCheckerAgent)
  │   - Verify claims
  │   - Cross-reference with paper
  ↓
⚖️ Judge Evaluation (JudgeAgent)
  │   - Score each debater per topic
  │   - 5 criteria: value, cohesiveness, relevance, clarity, engagement
  │   - Weighted scoring
  ↓
📊 Final Report (ReporterAgent)
  │   - Synthesize all arguments
  │   - Rank postures by score
  │   - Extract validated insights
  │   - Markdown report
  ↓
📖 MasDebateViewer Display
    - Tab per topic
    - Debater arguments side-by-side
    - Judge scores visible
    - History sidebar
```

### Debate Agents

1. **FurtherQuestionsGenerator** (`backend/src/services/debate/FurtherQuestionsGenerator.ts`)
   - Generates 3-5 research questions from paper
   - Extracts key topics
   - Prioritizes questions

2. **PostureGenerator** (`backend/src/services/debate/PostureGenerator.ts`)
   - Creates 3 debate postures (perspectives)
   - Identifies shared topics from paper
   - Generates guiding questions per topic

3. **DebaterAgent** (`backend/src/services/debate/DebaterAgent.ts`) × 3
   - Argues ONE posture across ALL topics
   - Tools: `lookupPaper`, `webSearch`
   - Cites sources with evidence
   - Responds to counterpoints

4. **FactCheckerAgent** (`backend/src/services/debate/FactCheckerAgent.ts`)
   - Verifies claims made in debate
   - Cross-references with paper content
   - Confidence scores per claim

5. **JudgeAgent** (`backend/src/services/debate/JudgeAgent.ts`)
   - Evaluates all arguments
   - Configurable rubric (5 criteria)
   - Per-topic + overall scores

6. **ReporterAgent** (`backend/src/services/debate/ReporterAgent.ts`)
   - Synthesizes debate into markdown report
   - Ranks postures by score
   - Highlights validated insights

### API Endpoints

```bash
POST /api/mas-debate/questions
# Body: { paperId: string }
# Returns: { questions: string[] }

POST /api/mas-debate/postures
# Body: { paperId: string, question: string }
# Returns: { postures: string[], topics: string[] }

POST /api/mas-debate/run
# Body: { paperId: string, question: string, numPostures: number }
# Returns: SSE stream with progress updates
# Final: { verdict: JudgeVerdict, report: DebateReport }
```

### Integration Example

```typescript
// In MasDebateNode.tsx
import { useMasDebate } from '@/lib/hooks/useMasDebate';

const {
  status,
  questions,
  postures,
  topics,
  debaterProgress,
  verdict,
  report,
  fetchQuestions,
  runDebate
} = useMasDebate();

// Step 1: Generate questions
await fetchQuestions(paperId);

// Step 2-5: Run full debate
await runDebate(paperId, selectedQuestion, 3);

// Results available in:
// - debaterProgress (real-time updates)
// - verdict (judge scores)
// - report (final markdown)
```

---

## Paper Context System

### How Paper Context Propagation Works

1. **Upload**: User uploads PDF in `PaperUploadNode`
2. **Extract**: pdfjs-dist extracts text (up to 12 pages)
3. **Store**: Paper added to `usePaperContextStore` (Zustand)
4. **Connect**: User creates edge from paper-upload → other node
5. **Propagate**: Store's `connectNodeToPaper(nodeId, paperId)` called
6. **Use**: Target node calls `getPaperForNode(nodeId)` to get paper
7. **Inject**: Paper context injected into API calls

### Example Flow

```typescript
// In PaperChatNode.tsx
const getPaperForNode = usePaperContextStore((s) => s.getPaperForNode);
const paper = getPaperForNode(id); // Get connected paper

// Send to API with context
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [...],
    paperContext: paper ? {
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      fullText: paper.fullText?.substring(0, 5000)
    } : null
  })
});
```

### API Route Integration

```typescript
// In frontend/app/api/chat/route.ts
const { messages, paperContext } = await req.json();

const systemMessage = paperContext ? {
  role: 'system',
  content: `You are analyzing this paper:
Title: ${paperContext.title}
Authors: ${paperContext.authors.map(a => a.name).join(', ')}
Full text excerpt:
${paperContext.fullText?.substring(0, 3000)}

Answer questions accurately and helpfully.`
} : { role: 'system', content: 'You are a helpful research assistant.' };

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [systemMessage, ...messages],
  stream: true
});
```

---

## Code Patterns & Standards

### TypeScript Strictness

We use **strict TypeScript** everywhere:
- No `any` types (use `unknown` and type guards)
- All function parameters and returns explicitly typed
- Zod for runtime validation

```typescript
// ✅ Good
export function processAgent(metadata: AgentMetadata): AgentStatus {
  // ...
}

// ❌ Bad
export function processAgent(metadata: any): any {
  // ...
}
```

### Error Handling

Use the custom `AgentError` class from `agent.types.ts`:

```typescript
import { AgentError, ErrorCode } from '../types/agent.types';

throw new AgentError(
  ErrorCode.AgentNotFound,
  `Agent ${nodeId} not found in registry`,
  { nodeId, availableAgents: registry.listAgents() }
);
```

### Event Emission Pattern

Always use the singleton instances:

```typescript
import { agentBus } from '../services/agentEventBus';
import { orchestrator } from '../services/agentOrchestrator';

// Emit events
agentBus.invoke(request);
agentBus.statusChange(nodeId, 'working');

// Invoke agents
const result = await orchestrator.invoke({ from, to, tool, args });
```

### Zustand Store Pattern

```typescript
// Define store
export const usePaperContextStore = create<PaperContextState>()((set, get) => ({
  papers: new Map(),

  addPaper: (paper) => set((state) => {
    const newPapers = new Map(state.papers);
    newPapers.set(paper.id, paper);
    return { papers: newPapers };
  }),

  getPaperForNode: (nodeId) => {
    const paperId = get().paperConnections.get(nodeId);
    return paperId ? get().papers.get(paperId) : null;
  }
}));

// Use in component
const addPaper = usePaperContextStore((s) => s.addPaper);
const getPaperForNode = usePaperContextStore((s) => s.getPaperForNode);
```

### Async/Await (No Callbacks)

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
  const result = await api.get('/data');
  return result.data;
}

// ❌ Bad
function fetchData(callback: (data: Data) => void) {
  api.get('/data', callback);
}
```

---

## Quick Reference Commands

```bash
# Development
pnpm dev                    # Run both frontend & backend
cd frontend && pnpm dev     # Frontend only (localhost:3000)
cd backend && pnpm dev      # Backend only (localhost:4000)

# Database
docker-compose up -d        # Start PostgreSQL
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate         # Run migrations
pnpm prisma:studio          # Open Prisma Studio

# Code Quality
pnpm lint                   # Lint all workspaces
pnpm type-check            # Type check all
pnpm build                  # Build all

# Cleanup
pnpm clean                  # Clean build artifacts
docker-compose down -v      # Reset database (⚠️ destructive)
```

---

## Environment Variables

### Backend (.env)

```bash
# Required
DATABASE_URL=postgresql://canvas_user:canvas_password@localhost:5432/research_canvas
OPENAI_API_KEY=sk-proj-...  # Your OpenAI API key
PORT=4000
NODE_ENV=development

# Optional
TAVILY_API_KEY=tvly-...  # For web search in debates
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

### Frontend (.env.local)

```bash
# Optional - defaults to localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Critical Gaps & Opportunities

Based on COMPREHENSIVE_ANALYSIS.md Section 13:

### Critical Gaps

1. **Agent Invocation Gap** ⚠️ HIGH PRIORITY
   - Problem: Agent nodes (ResearcherAgent, CriticAgent, etc.) have UI but don't invoke backend
   - Backend: Fully implemented with event bus, orchestrator, registry
   - Frontend: Nodes render but no API calls
   - Fix: Add invoke buttons + API calls to agent node components

2. **Canvas Persistence Gap** ⚠️ MEDIUM PRIORITY
   - Problem: Canvas state never saved to database
   - Schema: Complete (Canvas model in Prisma)
   - Controllers: CRUD endpoints implemented
   - Frontend: canvasStore has `triggerAutosave()` stub
   - Fix: Wire up Zustand store changes → POST to `/api/canvas`

3. **Visualization Gap** ⚠️ LOW PRIORITY
   - Problem: Citation Graph, Results Visualization nodes are stubs
   - Current: Render as BaseNode with placeholder text
   - Dependencies: D3.js, Plotly already in package.json!
   - Fix: Implement actual chart/graph rendering

### Optimization Opportunities

1. **Real-time Updates** - WebSocket infrastructure ready but underutilized
2. **Rate Limit UI** - Token bucket working, could show status to user
3. **Agent Response Caching** - LRU cache working, could persist to Redis for multi-instance

---

## Version Notes

- **Node.js**: >=20.0.0
- **pnpm**: 9.15.0 (required, DO NOT use npm/yarn)
- **Next.js**: 16.0.1 (uses Turbopack by default)
- **React**: 19.2.0
- **PostgreSQL**: 16 (Alpine Docker image)
- **TypeScript**: 5.9.3 (strict mode)
- **Prisma**: 6.16.0+ (Rust-free version)
- **@xyflow/react**: 12.8.5
- **Zustand**: 5.0.8
- **OpenAI SDK**: 6.7.0

---

## Summary

**Always provide Claude with**:
1. ✅ COMPREHENSIVE_ANALYSIS.md for current state
2. ✅ Relevant files from "Essential Files" section
3. ✅ Architecture context (EventEmitter, not Redis, etc.)
4. ✅ Type definitions from agent.types.ts / debate.types.ts (for backend)

**Never let Claude suggest**:
1. ❌ Redis/BullMQ (we use EventEmitter)
2. ❌ LangGraph/CrewAI (we use custom)
3. ❌ Breaking our type safety patterns
4. ❌ Using `any` types

**Key to success**: Give Claude the right context files upfront!

---

**Current Status** (November 9, 2025):
- ✅ Debate System: 100% Complete
- ✅ Paper Chat: 100% Complete
- ✅ Web Research: 100% Complete
- ✅ Canvas UI: 100% Complete
- ⚠️ Agent Nodes: UI only (backend ready)
- ⚠️ Canvas Persistence: Schema ready (not wired)
- ❌ Visualization: Stubs only
- ❌ Authentication: Not implemented

**Next Priorities**:
1. Wire agent nodes to backend (high value, low effort)
2. Implement canvas auto-save (medium value, medium effort)
3. Add visualization nodes (low value, high effort)
4. User authentication (medium value, high effort)

---

**Branch Info**:
- **main**: Production-ready debate system, core features
- **ui**: Synchronized with main as of Nov 9, 2025
- All UI improvements merged to main
