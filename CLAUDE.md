# Claude Context Guide for Research Agent Canvas

This document helps developers on this project provide optimal context to Claude for better code generation and assistance.
Always use context7 MCP when working with different libraries and frameworks.

---

## Project Overview

**What we're building**: A visual, multi-agent AI system for collaborative scientific paper analysis where agents can discover, call, and use each other as tools (MCP-like architecture).

**Core innovation**: Agents communicate through a custom EventEmitter-based protocol (not Redis/BullMQ, not LangGraph) for maximum control and simplicity.

**Tech Stack**:
- **Frontend**: Next.js 16, React 19, TypeScript, shadcn/ui, @xyflow/react (canvas)
- **Backend**: Node.js, Express, TypeScript, PostgreSQL, Prisma
- **Agent System**: Custom EventEmitter + OpenAI function calling
- **Real-time**: Socket.io (no Redis needed)

---

## Critical Architecture Decisions

### ✅ What We Chose

1. **Custom EventEmitter** (NOT BullMQ/Redis)
   - Zero dependencies, in-process events
   - Perfect for single-process agent coordination
   - Simpler to debug and understand

2. **Custom Agent Orchestration** (NOT LangGraph/CrewAI)
   - Full control over MCP-like protocol
   - React Flow canvas graph = actual execution graph
   - OpenAI function calling for tool interface

3. **PostgreSQL Only** (no Redis)
   - Single Docker container
   - Simpler setup, faster development

4. **shadcn/ui** (for components)
   - Tailwind CSS 4.0 compatible
   - Beautiful, accessible, customizable

### ❌ What We're NOT Using

- ❌ Redis (no caching infrastructure needed)
- ❌ BullMQ/Bull (using EventEmitter instead)
- ❌ LangGraph/LangChain (custom implementation)
- ❌ CrewAI/AutoGen (custom agents)

**Why this matters**: Claude might suggest these tools. Remind it of our architecture decisions!

---

## Essential Files to Reference

When asking Claude for help, always include relevant files from this list:

### 🎯 Core Architecture Files (READ THESE FIRST)

1. **[ACTION_PLAN.md](./ACTION_PLAN.md)** (2000+ lines)
   - Complete implementation roadmap
   - Phase-by-phase tasks
   - Technology decisions explained
   - Database schema
   - Agent communication architecture

DEBATE_SYSTEM_SUMMARY.md has the overview of the architecture and rational for the core functionality of the debate between the agents.

   **When to reference**: Starting any new feature, understanding overall architecture

2. **[HACKATHON_PAPER_CANVAS_BLUEPRINT.md](./HACKATHON_PAPER_CANVAS_BLUEPRINT.md)** (32k+ tokens)
   - Original hackathon requirements
   - Feature specifications
   - User stories
   - Success criteria

   **When to reference**: Understanding feature requirements, UI/UX decisions

### 📁 Type Definitions (ALWAYS INCLUDE FOR BACKEND WORK)

3. **[backend/src/types/agent.types.ts](./backend/src/types/agent.types.ts)**
   - ALL TypeScript types for agent system
   - JSON-RPC 2.0 message formats
   - Zod schemas for validation
   - Error codes and custom error classes

   **When to reference**: ANY backend work involving agents, events, or communication

### 🔧 Core Services (INCLUDE WHEN MODIFYING)

4. **[backend/src/services/agentEventBus.ts](./backend/src/services/agentEventBus.ts)**
   - Event system implementation
   - Type-safe event emission
   - Singleton `agentBus` instance

   **When to reference**: Adding new event types, debugging event flow

5. **[backend/src/services/agentOrchestrator.ts](./backend/src/services/agentOrchestrator.ts)**
   - Agent invocation coordination
   - Circular dependency detection
   - Timeout management
   - Result caching
   - Singleton `orchestrator` instance

   **When to reference**: Modifying invocation logic, adding features to orchestration

6. **[backend/src/lib/rateLimiter.ts](./backend/src/lib/rateLimiter.ts)**
   - Token bucket rate limiting
   - Per-agent, per-canvas, and global limits
   - `AgentRateLimiters` class with presets

   **When to reference**: Adjusting rate limits, debugging throttling issues

### 🗄️ Database

7. **[backend/prisma/schema.prisma](./backend/prisma/schema.prisma)**
   - 8 database models
   - Relationships between entities
   - Indexes for performance

   **When to reference**: Adding database features, queries, migrations

### ⚙️ Configuration

8. **[package.json](./package.json)** (root) + workspace package.jsons
   - Monorepo structure
   - Dependencies and versions
   - Scripts

   **When to reference**: Adding dependencies, understanding project structure

9. **[turbo.json](./turbo.json)**
   - Turborepo pipeline configuration

   **When to reference**: Modifying build process

10. **[frontend/next.config.js](./frontend/next.config.js)**
    - Next.js 16 / Turbopack configuration

    **When to reference**: Frontend build issues, adding webpack/turbopack config

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

## Giving Claude Context

### 🎯 For New Features

**Template**:
```
I'm implementing [FEATURE] for the Research Agent Canvas project.

Context files:
- ACTION_PLAN.md (Phase X, Task Y)
- backend/src/types/agent.types.ts (for type definitions)
- [any other relevant files]

Architecture: We use custom EventEmitter (not Redis), TypeScript strict mode.

Task: [describe what you need]

Please follow our patterns: [mention specific pattern if relevant]
```

**Example**:
```
I'm implementing the AgentRegistry service (Phase 2.1, Developer 1).

Context files:
- ACTION_PLAN.md (Phase 2, Developer 1 tasks)
- backend/src/types/agent.types.ts
- backend/src/services/agentEventBus.ts

Architecture: In-memory Map<nodeId, Agent>, integrates with agentBus singleton.

Task: Create AgentRegistry service with registration, deregistration, and discovery API.

Please follow our patterns: Use AgentError for errors, emit events via agentBus, strict TypeScript.
```

### 🐛 For Debugging

**Template**:
```
I'm debugging [ISSUE] in [FILE/COMPONENT].

Symptoms: [describe the issue]

Relevant files:
- [file where issue occurs]
- [related files]

What I've tried: [steps taken]

Please help diagnose and fix, maintaining our architecture decisions.
```

### 🔄 For Refactoring

**Always mention**:
- What you're refactoring
- Why (performance, readability, etc.)
- What should NOT change (API, types, etc.)
- Files that depend on this code

### ➕ For Adding Dependencies

**Check first**:
1. Is it in ACTION_PLAN.md tech stack?
2. Does it conflict with our "no Redis" decision?
3. Can we achieve it with existing tools?

**If adding**:
```
I want to add [PACKAGE] for [REASON].

Our tech stack: [reference ACTION_PLAN.md]

Question: Is there a simpler way using our existing stack (EventEmitter, PostgreSQL, Socket.io)?

If not, how should I integrate it with our current architecture?
```

---

## Common Pitfalls to Avoid

### ❌ Don't Suggest These

1. **Redis/BullMQ** - We use EventEmitter
2. **LangGraph/LangChain** - We use custom orchestration
3. **CrewAI/AutoGen** - We use custom agents
4. **SQLite** - We use PostgreSQL
5. **Webpack config in Next.js 16** - We use Turbopack

**How to prevent**: Start prompts with architecture context!

### ❌ Don't Break These Patterns

1. **Singleton instances** - `agentBus` and `orchestrator` are singletons
2. **Type imports** - Always import types from `agent.types.ts`
3. **Error handling** - Use `AgentError` class, not generic `Error`
4. **Event naming** - Follow `agent:*` convention

### ⚠️ Watch Out For

1. **Type safety** - Never use `any`, use type guards
2. **Rate limits** - Always check via `AgentRateLimiters`
3. **Circular deps** - Orchestrator handles this, don't bypass it
4. **Event listeners** - Clean up listeners to prevent memory leaks

---

## File Dependencies Map

When modifying a file, check what depends on it:

```
agent.types.ts
  ↓
  ├── agentEventBus.ts
  ├── agentOrchestrator.ts
  ├── rateLimiter.ts
  └── [all future agent files]

agentEventBus.ts (singleton)
  ↓
  └── agentOrchestrator.ts
      ↓
      └── [agent implementations]
          ↓
          └── API routes
              ↓
              └── Frontend

prisma/schema.prisma
  ↓
  ├── @prisma/client (auto-generated)
  └── database queries
```

**Rule**: If you modify a file higher in the tree, test everything below it!

---

## Testing & Verification

### After Creating a Service

```bash
# 1. Type check
cd backend
pnpm type-check

# 2. Build
pnpm build

# 3. Run dev server
pnpm dev

# 4. Check for runtime errors
```

### After Modifying Types

```bash
# 1. Regenerate Prisma if schema changed
pnpm prisma:generate

# 2. Type check entire workspace
pnpm type-check

# 3. Look for type errors in imports
```

### After Adding Dependencies

```bash
# 1. Install
pnpm install

# 2. Verify package.json updated correctly
# 3. Check turbo.json if build tool
# 4. Update CLAUDE.md if architectural
```

---

## Quick Reference Commands

```bash
# Development
pnpm dev                    # Run both frontend & backend
cd frontend && pnpm dev     # Frontend only
cd backend && pnpm dev      # Backend only

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

## Agent Types Reference

### Original 6 Agent Types (Phase 6)

1. **researcher** - Deep analysis, extracts claims/evidence
2. **critic** - Validates claims, identifies weaknesses
3. **synthesizer** - Merges analyses, resolves conflicts
4. **question_generator** - Generates research questions
5. **citation_tracker** - Verifies citations, builds graphs
6. **web_research** - Searches academic databases

### Debate System Agents (Phase 10 - NEW)

7. **posture_generator** - Creates 3 debate positions with topics and questions
8. **debater** - Argues a specific posture, asks/answers questions
9. **judge** - Evaluates debate transcripts using configurable criteria
10. **report_generator** - Creates final user-facing reports

Each exposes tools via OpenAI function calling format.

**Total: 10 agent types**

---

## Version Notes

- **Node.js**: >=20.0.0
- **pnpm**: 9.15.0 (required, DO NOT use npm/yarn)
- **Next.js**: 16.0.1 (uses Turbopack by default)
- **React**: 19.2.0
- **PostgreSQL**: 16 (Alpine Docker image)
- **TypeScript**: 5.9.3 (strict mode)
- **Prisma**: 6.16.0+ (Rust-free version)

---

## Important Links

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Socket.io Docs](https://socket.io/docs/v4/)
- [Zod Docs](https://zod.dev)
- [shadcn/ui](https://ui.shadcn.com)

---

## Contact & Questions

**For architecture questions**: Reference ACTION_PLAN.md "Technology Decision Rationale" section

**For feature specs**: Reference HACKATHON_PAPER_CANVAS_BLUEPRINT.md

**For database schema**: Reference backend/prisma/schema.prisma

**For type definitions**: Reference backend/src/types/agent.types.ts

---

## Example Prompts for Common Tasks

### Creating a New Agent Type

```
I'm creating a new agent type "[NAME]" for the Research Agent Canvas.

Context:
- ACTION_PLAN.md (Phase 6: Agent System)
- backend/src/types/agent.types.ts (AgentType, ToolSchema)
- backend/src/services/agentEventBus.ts (for events)
- backend/src/services/agentOrchestrator.ts (for invocation)

The agent should:
1. [Capability 1]
2. [Capability 2]

Please create:
1. Agent implementation extending BaseAgent
2. Tool schemas in OpenAI function calling format
3. Integration with agentBus and orchestrator

Follow our patterns: TypeScript strict, AgentError for errors, emit lifecycle events.
```

### Creating a Frontend Component

```
I'm creating [COMPONENT] for the React Flow canvas.

Context:
- ACTION_PLAN.md (Phase 3: Canvas System)
- frontend/components/nodes/BaseNode.tsx (if it exists)
- @xyflow/react 12.8.5 patterns

Requirements:
- [Requirement 1]
- [Requirement 2]

Use shadcn/ui components where appropriate, follow our color scheme from ACTION_PLAN.md.
```

### Adding an API Endpoint

```
I'm adding a new API endpoint for [FEATURE].

Context:
- backend/src/types/agent.types.ts (for types)
- backend/src/index.ts (Express app)
- Existing routes in backend/src/routes/

Endpoint: [METHOD] [PATH]
Purpose: [DESCRIPTION]

Please create:
1. Route handler in routes/
2. Controller in controllers/
3. Integration with agentBus/orchestrator if needed

Follow our patterns: Zod validation, proper error handling with AgentError.
```

---

## Summary

**Always provide Claude with**:
1. ✅ Relevant files from "Essential Files" section
2. ✅ Architecture context (EventEmitter, not Redis, etc.)
3. ✅ Phase/task reference from ACTION_PLAN.md
4. ✅ Type definitions from agent.types.ts (for backend)

**Never let Claude suggest**:
1. ❌ Redis/BullMQ (we use EventEmitter)
2. ❌ LangGraph/CrewAI (we use custom)
3. ❌ Breaking our type safety patterns
4. ❌ Using `any` types

**Key to success**: Give Claude the right context files upfront!

---

**Last Updated**: January 2025 - Main Branch
**Status**: ✅ Phase 2-6 Complete | Backend Agent System Fully Implemented | Frontend Canvas & Paper Chat Working
**Running**: Both frontend (localhost:3000) and backend (localhost:4000) operational

---

## 🚀 Implemented Features (Main Branch)

### Backend Implementation (100% Complete)

#### 1. **Agent System** (`backend/src/lib/agents/`)
All 5 core agents are fully implemented and operational:

**`baseAgent.ts`** - Abstract base class for all agents
- OpenAI integration with function calling
- Tool registration system using Zod schemas
- Message history management
- Streaming support ready
- Error handling with custom `AgentError`
- Lifecycle event emission via `agentBus`

**`researcherAgent.ts`** - Deep analysis agent
- Tools: `analyze_paper`, `extract_methodology`, `extract_claims`, `find_gaps`
- Fetches papers from Prisma database
- Returns structured analysis with confidence scores
- Identifies methodology strengths/limitations
- Extracts claims with supporting evidence
- Identifies research gaps and future directions

**`criticAgent.ts`** - Critical analysis agent
- Tools: `validate_claim`, `critique_methodology`, `identify_biases`, `suggest_improvements`
- Validates claims against evidence
- Assesses methodological rigor (internal/external validity)
- Detects selection bias, confirmation bias, publication bias
- Provides severity-rated critiques (critical, major, minor, suggestion)
- Suggests actionable improvements

**`synthesizerAgent.ts`** - Synthesis and integration agent
- Tools: `merge_analyses`, `resolve_conflicts`, `generate_insights`, `build_consensus`
- Combines multiple agent outputs
- Resolves contradictions through deeper analysis
- Generates emergent insights from combined data
- Builds consensus while preserving important disagreements

**`citationTrackerAgent.ts`** - Citation verification agent
- Tools: `verify_citation`, `find_related_papers`, `build_citation_graph`, `assess_impact`
- Verifies citation accuracy (formatting, DOI, metadata)
- Discovers related papers (cites, cited_by, similar)
- Builds citation network graphs with metrics
- Assesses research impact (traditional + altmetrics)

**`questionGeneratorAgent.ts`** - Research question generator
- Tools: `generate_questions`, `identify_unknowns`, `suggest_experiments`
- Generates prioritized research questions (clarification, extension, application)
- Identifies knowledge gaps (mechanism, boundary conditions, individual differences)
- Suggests follow-up experiments with feasibility assessments

#### 2. **Agent Infrastructure** (`backend/src/services/`)

**`agentRegistry.ts`** - Singleton agent registry
- In-memory `Map<nodeId, AgentMetadata>`
- Agent registration/deregistration with database persistence
- Type indexing: `Map<AgentType, Set<nodeId>>`
- Capability discovery (find agents by tool/category)
- Statistics and search functionality
- Auto-loads agents from database on startup

**`agentOrchestrator.ts`** - Coordination layer
- LRU result cache (100 entries, 5min TTL)
- Circular dependency detection (max depth: 5)
- Timeout management (default: 30s)
- Retry logic with exponential backoff (max: 3 retries)
- Rate limit integration
- Active invocation tracking
- Singleton instance `orchestrator`

**`agentEventBus.ts`** - Event system
- EventEmitter-based (zero external dependencies)
- Type-safe event emissions
- Event types: `agent:invoke`, `agent:response`, `agent:registered`, `agent:status`, `agent:error`, `agent:broadcast`
- Event history (max 1000 events)
- Metrics collection per event type
- Correlation ID generation (nanoid)
- Singleton instance `agentBus`

**`agentCapability.ts`** - Tool discovery service
- Returns tools in OpenAI function calling format
- Zod schema to JSON schema conversion
- Tool categorization and search

#### 3. **Rate Limiting** (`backend/src/lib/rateLimiter.ts`)
- Token bucket algorithm
- Three limit levels:
  - Per-agent: 10 invocations/minute
  - Per-canvas: 50 invocations/minute
  - Global: 100 invocations/minute
- `AgentRateLimiters` class with check/consume methods

#### 4. **Database Schema** (`backend/prisma/schema.prisma`)
**8 Main Models**:
- `User` - User accounts
- `Canvas` - Canvas state (nodes, edges as JSON)
- `Paper` - Uploaded papers (title, authors, abstract, fullText, citations, metadata)
- `Agent` - Agent registry (nodeId, agentType, capabilities, status)
- `AgentMessage` - Agent communications (fromAgent, toAgent, content, reasoning, confidence)
- `AgentInvocation` - Tool call tracking (invoker, target, toolName, parameters, result, status, duration)
- `AgentCapability` - Normalized tool schemas
- `WebSearchResult` - Search result cache with TTL

**Debate System Models** (Phase 10):
- `DebateSession`, `Posture`, `DebateTranscript`, `DebateRound`, `DebateExchange`, `JudgeVerdict`

#### 5. **API Routes** (`backend/src/routes/`)
- `/api/canvas` - Canvas CRUD operations ([canvasRoutes.ts](./backend/src/routes/canvasRoutes.ts))
- `/api/papers` - Paper upload/retrieval ([paperRoutes.ts](./backend/src/routes/paperRoutes.ts))
- `/api/agents` - Agent registry management ([agentRoutes.ts](./backend/src/routes/agentRoutes.ts))
- `/api/capabilities` - Tool discovery ([capabilityRoutes.ts](./backend/src/routes/capabilityRoutes.ts))

#### 6. **WebSocket Server** (`backend/src/lib/websocket.ts`)
- Socket.io server with room support
- Canvas-based rooms (`join_canvas`, `leave_canvas`)
- Event broadcasting within rooms
- Connection tracking and statistics
- Graceful shutdown handling

#### 7. **Express Server** (`backend/src/index.ts`)
- CORS enabled (http://localhost:3001)
- JSON/URL-encoded body parsing
- Morgan logging (dev mode)
- Custom error handling for `AgentError` and Zod validation
- Health check endpoint: `/health`
- Runs on port 4000

---

### Frontend Implementation (100% Complete)

#### 1. **Paper Context System** (`frontend/lib/stores/paperContextStore.ts`)
Zustand store managing paper-to-node connections:
- `Map<string, Paper>` - All uploaded papers
- `Map<nodeId, paperId>` - Node-to-paper connections
- Actions: `addPaper`, `connectNodeToPaper`, `getPaperForNode`, `getContextForNode`
- Upload progress tracking
- Selected paper state

#### 2. **Agent Store** (`frontend/lib/stores/agentStore.ts`)
Zustand store for agent state:
- `Map<nodeId, AgentMetadata>` - Agent registry
- `Map<nodeId, AgentStatus>` - Status tracking
- `Map<invocationId, AgentInvocation>` - Active invocations
- `AgentMessage[]` - Message history
- Actions: registration, status updates, capability queries, invocation tracking

#### 3. **Canvas Store** (`frontend/lib/stores/canvasStore.ts`)
Zustand store for canvas state:
- Node/edge management (add, update, remove)
- Viewport state
- Canvas name and ID
- Node locking (`Set<nodeId>`)
- Autosave trigger (no implementation yet)
- Load/save canvas data

#### 4. **WebSocket Hook** (`frontend/lib/hooks/useWebSocket.ts`)
React hook for Socket.io connection:
- Auto-connect on mount
- Connection state tracking
- Canvas room joining
- Event emission/listening
- Reconnection logic
- Cleanup on unmount

#### 5. **Custom Node Components** (`frontend/components/nodes/`)

**`PaperUploadNode.tsx`** - PDF upload and parsing
- Client-side PDF text extraction using pdfjs-dist 4.8.69
- Extracts up to 12 pages of text
- Creates `Paper` object with metadata (title, authors, abstract parsed from text)
- Adds to `paperContextStore`
- Connects node to paper automatically
- Visual upload status (uploading, processing, ready)

**`PaperChatNode.tsx`** - AI chat with paper context
- Message history with role-based styling
- Markdown rendering (ReactMarkdown + remark-gfm)
- Sends paper context to `/api/chat`
- Falls back to hardcoded responses if API fails
- Scrollable message container
- Input with send button

**`ResearcherAgentNode.tsx`** - Researcher agent UI
**`CriticAgentNode.tsx`** - Critic agent UI
**`SynthesizerAgentNode.tsx`** - Synthesizer agent UI
**`CitationTrackerNode.tsx`** - Citation tracker UI
**`QuestionGeneratorNode.tsx`** - Question generator UI
**`NoteNode.tsx`** - Simple text note node
**`BaseNode.tsx`** - Shared base node component
**`NodeWrapper.tsx`** - Common node wrapper with header/footer

#### 6. **Canvas Component** (`frontend/components/canvas/EnhancedCanvas.tsx`)
React Flow canvas with:
- 14 node types (from [nodeTypes.ts](./frontend/lib/nodeTypes.ts))
- Drag & drop from toolbar
- Custom edge styling
- Automatic paper context propagation (when paper-upload connects to chat, chat gets the paper)
- Background grid
- Mini-map
- Controls (zoom, fit view)
- Toolbar with node palette
- Simple controls panel

**Node Categories** (from [nodeTypes.ts](./frontend/lib/nodeTypes.ts)):
- **Input**: `paper-upload`, `note`
- **Research**: `paper-chat`, `web-research`
- **Agent**: `researcher-agent`, `critic-agent`, `synthesizer-agent`, `question-generator`, `citation-tracker`
- **Visualization**: `citation-graph`, `summary`, `methodology`, `results-visualization`, `insight-report`

#### 7. **Chat API Route** (`frontend/app/api/chat/route.ts`)
Next.js API route handler:
- OpenAI integration (gpt-4o-mini)
- Paper context injection (title, authors, abstract, first 3000 chars of fullText)
- System prompt with paper details
- Conversation history support
- Markdown formatting instruction
- Error handling with detailed messages

#### 8. **Main Application** (`frontend/app/page.tsx`)
- React Flow provider wrapper
- WebSocket provider (context)
- Full-screen canvas
- No authentication yet

---

## 📁 Complete Project Structure

```
MEF-Labs-hack-nation/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── agentController.ts
│   │   │   ├── canvasController.ts
│   │   │   ├── chatController.ts
│   │   │   └── paperController.ts
│   │   ├── lib/
│   │   │   ├── agents/
│   │   │   │   ├── baseAgent.ts ✅
│   │   │   │   ├── researcherAgent.ts ✅
│   │   │   │   ├── criticAgent.ts ✅
│   │   │   │   ├── synthesizerAgent.ts ✅
│   │   │   │   ├── citationTrackerAgent.ts ✅
│   │   │   │   ├── questionGeneratorAgent.ts ✅
│   │   │   │   └── index.ts
│   │   │   ├── prisma.ts
│   │   │   ├── rateLimiter.ts ✅
│   │   │   └── websocket.ts ✅
│   │   ├── routes/
│   │   │   ├── agentRoutes.ts ✅
│   │   │   ├── canvasRoutes.ts ✅
│   │   │   ├── chatRoutes.ts
│   │   │   ├── paperRoutes.ts ✅
│   │   │   └── capabilityRoutes.ts ✅
│   │   ├── services/
│   │   │   ├── agentEventBus.ts ✅
│   │   │   ├── agentOrchestrator.ts ✅
│   │   │   ├── agentRegistry.ts ✅
│   │   │   └── agentCapability.ts ✅
│   │   ├── types/
│   │   │   └── agent.types.ts ✅
│   │   └── index.ts ✅
│   ├── prisma/
│   │   └── schema.prisma ✅
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts ✅
│   │   ├── debug/
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx ✅
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx
│   │   │   ├── EnhancedCanvas.tsx ✅
│   │   │   ├── EnhancedToolbar.tsx
│   │   │   ├── SimpleCanvas.tsx
│   │   │   ├── SimpleControls.tsx
│   │   │   └── SimpleToolbar.tsx
│   │   ├── nodes/
│   │   │   ├── BaseNode.tsx ✅
│   │   │   ├── CitationTrackerNode.tsx ✅
│   │   │   ├── CriticAgentNode.tsx ✅
│   │   │   ├── NodeWrapper.tsx ✅
│   │   │   ├── NoteNode.tsx ✅
│   │   │   ├── PaperChatNode.tsx ✅
│   │   │   ├── PaperUploadNode.tsx ✅
│   │   │   ├── QuestionGeneratorNode.tsx ✅
│   │   │   ├── ResearcherAgentNode.tsx ✅
│   │   │   └── SynthesizerAgentNode.tsx ✅
│   │   ├── providers/
│   │   │   ├── ReactFlowProvider.tsx
│   │   │   └── WebSocketProvider.tsx ✅
│   │   ├── debug/
│   │   │   └── AgentDebugPanel.tsx
│   │   └── ui/ (shadcn/ui components)
│   ├── lib/
│   │   ├── hooks/
│   │   │   ├── useAgentEvents.ts
│   │   │   ├── useAgentStatus.ts
│   │   │   ├── useWebSocket.ts ✅
│   │   │   └── index.ts
│   │   ├── stores/
│   │   │   ├── agentStore.ts ✅
│   │   │   ├── canvasStore.ts ✅
│   │   │   └── paperContextStore.ts ✅
│   │   ├── nodeComponents.ts
│   │   ├── nodeTypes.ts ✅
│   │   └── utils.ts
│   └── package.json
├── docker-compose.yml
├── package.json
├── turbo.json
├── ACTION_PLAN.md
├── HACKATHON_PAPER_CANVAS_BLUEPRINT.md
├── DEBATE_SYSTEM_SUMMARY.md
└── CLAUDE.md ✅ (this file)
```

---

## 🔧 Key Technical Implementations

### PDF Text Extraction (Client-Side)
```typescript
// PaperUploadNode.tsx:67-83
const arrayBuffer = await file.arrayBuffer();
const pdfjs: any = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
const pdf = await loadingTask.promise;

const maxPages = Math.min(pdf.numPages, 12);
let extractedText = '';
for (let p = 1; p <= maxPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  extractedText += content.items.map((it: any) => it.str).join(' ') + '\n';
}
```

### Paper Context Injection
```typescript
// frontend/app/api/chat/route.ts:26-40
const systemMessage = {
  role: 'system' as const,
  content: paperContext
    ? `You are a helpful research assistant analyzing the following paper:
Title: ${paperContext.title}
Authors: ${paperContext.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}
Full text excerpt:
${paperContext.fullText?.substring(0, 3000) || ''}
Please answer questions about this paper accurately and helpfully.`
    : 'You are a helpful research assistant.',
};
```

### Agent Tool Registration
```typescript
// backend/src/lib/agents/researcherAgent.ts:61-66
protected registerTools(): void {
  this.registerTool(this.createAnalyzePaperTool());
  this.registerTool(this.createExtractMethodologyTool());
  this.registerTool(this.createExtractClaimsTool());
  this.registerTool(this.createFindGapsTool());
}
```

### Orchestrator Invocation
```typescript
// backend/src/services/agentOrchestrator.ts:62-143
public async invoke(params: AgentInvocationParams): Promise<AgentInvocationResult> {
  // 1. Check circular dependencies
  this.checkCircularDependency(params.from, params.to, context);

  // 2. Check rate limits
  const rateLimitCheck = AgentRateLimiters.checkInvocation(params.to, canvasId);

  // 3. Check cache
  const cached = this.resultCache.get(cacheKey);

  // 4. Emit invocation event
  agentBus.invoke(request);

  // 5. Wait for response with timeout
  const result = await this.waitForResponse(requestId, timeout);

  return result;
}
```

---

## 🎨 UI/UX Features

### Node Types and Colors
- **Input nodes** (Blue #3B82F6): Paper upload, notes
- **Research nodes** (Green #10B981): Paper chat, web research
- **Agent nodes** (Purple #8B5CF6): All 5 agent types
- **Visualization nodes** (Orange #F59E0B): Graphs, summaries, reports

### Paper Chat Interface
- Markdown-rendered messages
- User/assistant role distinction
- Scrollable history
- Context indicator (shows connected paper title)
- Fallback responses for API errors

### Canvas Interactions
- Drag nodes from toolbar
- Connect nodes with edges
- Automatic paper context propagation (paper-upload → connected nodes)
- Delete nodes/edges (Delete key)
- Pan and zoom
- Fit view control

---

## 🚦 Current State

### ✅ Fully Working
1. Backend server with WebSocket (localhost:4000)
2. Frontend Next.js app (localhost:3000)
3. PDF upload and text extraction
4. Paper chat with AI context
5. All 5 agents implemented (tools ready to be called)
6. Agent registry and orchestration
7. Event bus and rate limiting
8. Prisma database schema
9. React Flow canvas with 14 node types
10. Zustand state management

### ⚠️ Partially Implemented
1. **Agent node UIs** - Nodes exist but don't actively invoke agents yet
2. **WebSocket real-time updates** - Infrastructure ready but not fully utilized
3. **Database persistence** - Schema ready, controllers exist, but frontend doesn't save canvases yet

### ❌ Not Yet Implemented
1. **Debate system** (Phase 10) - Schema exists but no implementation
2. **Web research agent** - Type defined but no implementation
3. **Visualization nodes** - Components don't render actual visualizations yet
4. **User authentication** - No auth system
5. **Canvas autosave** - Trigger exists but no implementation
6. **Agent-to-agent communication in UI** - Backend supports it, UI doesn't trigger it

---

## 🔄 Next Steps / Remaining Work

### High Priority
1. **Implement agent invocation from UI nodes**
   - Wire up agent node buttons to call backend `/api/agents/{nodeId}/invoke`
   - Display agent responses in node UI
   - Show loading states during agent execution

2. **Canvas persistence**
   - Save canvas state to database on changes
   - Load canvas from database on page load
   - Implement autosave every 5 seconds

3. **Real-time agent status updates via WebSocket**
   - Broadcast agent status changes to all clients in canvas room
   - Update node appearance based on agent status (idle/working/error)
   - Display invocation progress

### Medium Priority
4. **Implement web research agent**
   - Integration with academic search APIs (Semantic Scholar, Crossref, etc.)
   - Tavily search fallback

5. **Visualization node implementations**
   - Citation graph rendering (D3.js or similar)
   - Results charts (Chart.js)
   - Summary display

6. **User authentication**
   - Clerk or NextAuth.js integration
   - User-specific canvases
   - Permissions

### Low Priority
7. **Debate system** (Phase 10)
   - Posture generator agent
   - Debater agent
   - Judge agent
   - Debate transcript UI

8. **Performance optimizations**
   - Agent response caching
   - Database indexing
   - Frontend code splitting

---
