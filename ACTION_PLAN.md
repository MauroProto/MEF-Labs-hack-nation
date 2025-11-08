# Research Agent Canvas - Implementation Action Plan

## Project Overview

**Goal**: Build a visual, multi-agent AI system for collaborative scientific paper analysis where agents can discover, call, and use each other as tools (MCP-like architecture).

**Core Innovation**: Agents communicate through a standardized protocol, allowing them to:
- Discover other agents' capabilities
- Invoke other agents as tools
- Chain reasoning across multiple agents
- Collaborate to produce emergent insights

**Team**: 3 Full-Stack Developers working in parallel

---

## Technology Stack

> **Note**: Technology stack updated to latest versions (November 2025). **Architecture decision**: Using custom agent orchestration with EventEmitter (not LangGraph/CrewAI) for full control over MCP-like protocol. Key updates: React Flow → @xyflow/react 12.8.5, Tailwind CSS 4.0, Prisma 6.16.0 (Rust-free), Socket.io 4.8.1, Turborepo 2.6.0.

### Frontend
- **Framework**: Next.js 16.0.0 with App Router
- **UI Library**: React 19.2.0
- **Language**: TypeScript 5.9.3
- **Component Library**: shadcn/ui (with Radix UI primitives)
- **Canvas System**: @xyflow/react 12.8.5 (formerly React Flow 11)
- **State Management**: Zustand 5.0.8
- **Styling**: Tailwind CSS 4.0 (major rewrite - 5x faster builds)
- **Icons**: Lucide React 0.548.0
- **Visualization**: Plotly.js 3.1.2, D3 7.9.0
- **PDF Rendering**: react-pdf 9.1.1, pdfjs-dist 4.8.69
- **Markdown**: react-markdown 10.1.0, remark-gfm 4.0.1
- **Utilities**: nanoid 5.1.6, clsx 2.1.1, date-fns 4.1.0, class-variance-authority (for shadcn)

### Backend
- **Runtime**: Node.js >=20.0.0
- **Framework**: Express 4.21.2
- **Database**: PostgreSQL 16 (Docker), Prisma ORM 6.16.0 (Rust-free, 3.4x faster)
- **AI/LLM**: OpenAI 6.7.0 (GPT-4o-mini), AI SDK 5.0.78 (stable)
- **PDF Processing**: pdf-parse 1.1.1
- **Web Search**: Tavily 0.3.0
- **HTTP Client**: Axios 1.7.9
- **HTML Parsing**: Cheerio 1.0.0
- **Data Parsing**: papaparse 5.5.3

### Agent Communication Layer (Custom MCP-Like)
- **Event System**: Node.js EventEmitter (in-process, zero dependencies)
- **WebSocket**: Socket.io 4.8.1 (client & server) for real-time UI updates
- **Protocol**: JSON-RPC 2.0 style messaging
- **Schema Validation**: Zod 3.23.8
- **Rate Limiting**: express-rate-limit 7.1.5
- **Agent Registry**: In-memory Map (nodeId → Agent instance)
- **Orchestration**: Custom orchestrator with cycle detection & timeout management

### DevOps
- **Package Manager**: pnpm 9.15.0 (REQUIRED)
- **Monorepo**: Turborepo 2.6.0
- **Containers**: Docker 24+, Docker Compose 2+
- **CI/CD**: GitHub Actions
- **Environment**: dotenv 16.4.5

---

## Database Design (PostgreSQL)

### Schema Overview

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// User Model
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  canvases  Canvas[]

  @@index([email])
}

// Canvas Model - Stores research canvas state
model Canvas {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  name      String
  nodes     Json     // React Flow nodes array
  edges     Json     // React Flow edges array
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  papers    Paper[]

  @@index([userId])
  @@index([updatedAt])
}

// Paper Model - Stores uploaded research papers
model Paper {
  id          String   @id @default(cuid())
  canvasId    String
  canvas      Canvas   @relation(fields: [canvasId], references: [id], onDelete: Cascade)
  title       String
  authors     Json     // Array of author names
  abstract    String?  @db.Text
  fullText    String   @db.Text
  citations   Json?    // Array of citation objects
  metadata    Json?    // Additional metadata (DOI, year, etc.)
  createdAt   DateTime @default(now())

  @@index([canvasId])
  @@index([title])
}

// Agent Model - Registry of available agents and their capabilities
model Agent {
  id              String         @id @default(cuid())
  nodeId          String         @unique  // React Flow node ID
  agentType       String         // "researcher", "critic", "synthesizer", etc.
  name            String
  description     String         @db.Text
  systemPrompt    String         @db.Text
  capabilities    Json           // Array of tool schemas this agent exposes
  status          String         @default("idle")  // "idle", "working", "error"
  version         String         @default("1.0.0")
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  messages        AgentMessage[]
  invocations     AgentInvocation[] @relation("invoker")
  receivedCalls   AgentInvocation[] @relation("target")

  @@index([nodeId])
  @@index([agentType])
  @@index([status])
}

// AgentMessage Model - Stores agent communications
model AgentMessage {
  id            String   @id @default(cuid())
  fromAgentId   String
  fromAgent     Agent    @relation(fields: [fromAgentId], references: [id], onDelete: Cascade)
  toAgentId     String?  // Null for broadcast messages
  messageType   String   // "analysis", "question", "critique", "response", "tool_call"
  content       Json     // Structured message content
  reasoning     Json?    // Array of reasoning steps
  sources       Json?    // Array of source citations
  confidence    Float    @default(0.5)
  status        String   @default("published")  // "draft", "published", "validated", "disputed"
  parentId      String?  // For threaded conversations
  createdAt     DateTime @default(now())

  @@index([fromAgentId])
  @@index([toAgentId])
  @@index([messageType])
  @@index([createdAt])
}

// AgentInvocation Model - Tracks agent-to-agent tool calls
model AgentInvocation {
  id            String   @id @default(cuid())
  invokerAgentId String
  invokerAgent  Agent    @relation("invoker", fields: [invokerAgentId], references: [id], onDelete: Cascade)
  targetAgentId String
  targetAgent   Agent    @relation("target", fields: [targetAgentId], references: [id], onDelete: Cascade)
  toolName      String   // The specific tool/capability being called
  parameters    Json     // Input parameters for the tool
  result        Json?    // Tool execution result
  status        String   @default("pending")  // "pending", "running", "completed", "failed"
  error         String?  @db.Text
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  duration      Int?     // Milliseconds

  @@index([invokerAgentId])
  @@index([targetAgentId])
  @@index([status])
  @@index([startedAt])
}

// AgentCapability Model - Normalized tool schemas
model AgentCapability {
  id          String   @id @default(cuid())
  agentType   String   // Which type of agent provides this
  toolName    String   // Unique tool identifier
  description String   @db.Text
  inputSchema Json     // JSON Schema for parameters
  outputSchema Json    // JSON Schema for response
  examples    Json?    // Example usage
  category    String   // "analysis", "search", "validation", etc.
  version     String   @default("1.0.0")

  @@unique([agentType, toolName])
  @@index([category])
}

// WebSearchResult Model - Cache for web searches
model WebSearchResult {
  id        String   @id @default(cuid())
  query     String   @db.Text
  queryHash String   @unique  // Hash of query for deduplication
  results   Json     // Array of search results
  source    String   // "tavily", "google_scholar", etc.
  createdAt DateTime @default(now())
  expiresAt DateTime // TTL for cache invalidation

  @@index([queryHash])
  @@index([expiresAt])
}
```

### Key Relationships

1. **User → Canvas**: One-to-many (users can have multiple canvases)
2. **Canvas → Paper**: One-to-many (canvases contain multiple papers)
3. **Agent → AgentMessage**: One-to-many (agents produce multiple messages)
4. **Agent → AgentInvocation**: Many-to-many (agents can call each other)
5. **AgentCapability**: Standalone registry of tool schemas

---

## Agent Communication Architecture (MCP-Like)

### Overview

Agents communicate via a **Tool Invocation Protocol** similar to MCP (Model Context Protocol):
- Each agent exposes **capabilities** as callable tools
- Agents can **discover** other agents' tools
- Agents can **invoke** tools on other agents
- Results flow back through the system

### Architecture Components

#### 1. Agent Registry
**Purpose**: Central directory of all active agents and their capabilities

**Responsibilities**:
- Register agents when nodes are created
- Deregister agents when nodes are deleted
- Provide discovery API for agent tools
- Track agent status (idle, working, error)

**Implementation**:
- In-memory registry (Map<nodeId, AgentMetadata>)
- Redis cache for distributed systems
- Database persistence for recovery

#### 2. Tool Interface Protocol

**Schema Structure** (JSON Schema):
```typescript
{
  toolName: string         // e.g., "analyze_methodology"
  description: string      // Human-readable description
  category: string         // "analysis", "validation", "search", etc.
  inputSchema: {
    type: "object",
    properties: { ... },   // Zod-compatible schema
    required: [...]
  },
  outputSchema: {
    type: "object",
    properties: { ... }
  },
  examples: [
    { input: {...}, output: {...} }
  ]
}
```

**Standard Tool Response**:
```typescript
{
  success: boolean
  data?: any               // Tool result
  error?: string           // Error message if failed
  metadata: {
    agentId: string
    toolName: string
    duration: number       // ms
    confidence: number     // 0-1
    sources: Source[]      // Citations
  }
}
```

#### 3. Event Bus (EventEmitter)

**Event Types**:
- `agent:invoke` - Tool call requests between agents
- `agent:response` - Tool call results
- `agent:broadcast` - System-wide announcements
- `agent:registered` - New agent registered
- `agent:error` - Agent errors

**Event Payload Format** (JSON-RPC 2.0 style):
```typescript
// Event: agent:invoke
{
  jsonrpc: "2.0",
  method: "agent.invoke",
  params: {
    from: string,          // Invoker agent nodeId
    to: string,            // Target agent nodeId
    tool: string,          // Tool name (e.g., "validate_claim")
    args: object,          // Tool arguments
    context?: object,      // Shared context from canvas
    timeout?: number       // ms (default: 30000)
  },
  id: string               // Request ID for correlation (nanoid)
}

// Event: agent:response
{
  jsonrpc: "2.0",
  result?: {
    success: boolean,
    data: any,
    metadata: {
      confidence: number,
      sources: Source[],
      duration: number
    }
  },
  error?: {
    code: number,
    message: string
  },
  id: string               // Same ID as request
}
```

**Implementation**:
```typescript
import { EventEmitter } from 'events';

class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Support many agents
  }

  invoke(payload: InvokePayload): void {
    this.emit('agent:invoke', payload);
  }

  respond(payload: ResponsePayload): void {
    this.emit('agent:response', payload);
  }
}

export const agentBus = new AgentEventBus();
```

#### 4. Agent Orchestrator

**Responsibilities**:
- Route messages between agents
- Handle circular dependency prevention
- Implement timeout and retry logic
- Aggregate results from multiple agents
- Maintain conversation context

**Features**:
- **Dependency Graph**: Track agent call chains to prevent cycles
- **Context Propagation**: Pass relevant context through agent chains
- **Result Caching**: Cache tool results for identical inputs
- **Rate Limiting**: Prevent agent spam/infinite loops

#### 5. Real-Time Updates (Socket.io)

**Events**:
- `agent:registered` - New agent available
- `agent:invocation` - Agent calling another agent
- `agent:response` - Tool call completed
- `agent:status` - Agent status changed
- `agent:error` - Error occurred

**Client Integration**:
- Frontend subscribes to canvas-specific events
- Real-time visualization of agent communication
- Live streaming of agent reasoning

### Agent Tool Categories

#### Researcher Agent Tools
- `analyze_paper` - Deep analysis of paper content
- `extract_methodology` - Extract methodology section
- `extract_claims` - Identify key claims and evidence
- `find_gaps` - Identify research gaps

#### Critic Agent Tools
- `validate_claim` - Verify a specific claim
- `critique_methodology` - Assess methodology quality
- `identify_biases` - Find potential biases
- `suggest_improvements` - Recommend enhancements

#### Synthesizer Agent Tools
- `merge_analyses` - Combine multiple agent outputs
- `resolve_conflicts` - Handle contradictory findings
- `generate_insights` - Create emergent insights
- `build_consensus` - Form unified conclusions

#### Question Generator Agent Tools
- `generate_questions` - Create research questions
- `identify_unknowns` - Find unanswered questions
- `suggest_experiments` - Propose follow-up studies

#### Citation Tracker Agent Tools
- `verify_citation` - Validate citation accuracy
- `find_related_papers` - Discover related work
- `build_citation_graph` - Create citation network
- `assess_impact` - Evaluate paper impact

#### Web Research Agent Tools
- `search_academic` - Search academic databases
- `fetch_paper` - Retrieve paper by DOI/URL
- `compare_findings` - Compare with existing research

### Communication Patterns

#### 1. Direct Invocation
```
Researcher → Critic.validate_claim(claim) → Response
```

#### 2. Broadcast Request
```
Synthesizer → [All Agents].get_analysis() → Multiple Responses
```

#### 3. Chain Invocation
```
Researcher → Citation Tracker.verify_citation() → Web Research.fetch_paper() → Result
```

#### 4. Consensus Building
```
Question Generator → [Researcher, Critic, Synthesizer].vote_on_question() → Consensus
```

### Error Handling & Safety

#### Circular Dependency Prevention
- Maintain call stack in context
- Reject invocations that create cycles
- Maximum chain depth: 5 levels

#### Timeout Management
- Default timeout: 30 seconds per tool call
- Exponential backoff for retries
- Circuit breaker pattern for failing agents

#### Rate Limiting
- Max 10 tool calls per agent per minute
- Max 50 total invocations per canvas per minute
- Throttle broadcast messages

---

## Development Environment Setup

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: research-canvas-db
    environment:
      POSTGRES_USER: canvas_user
      POSTGRES_PASSWORD: canvas_password
      POSTGRES_DB: research_canvas
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U canvas_user"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Environment Variables

```bash
# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000

# .env (backend)
DATABASE_URL=postgresql://canvas_user:canvas_password@localhost:5432/research_canvas
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
PORT=4000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://localhost:3000
```

### Monorepo Structure

```
paper-canvas/
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI/CD pipeline
├── frontend/
│   ├── app/                        # Next.js 16 App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/                    # API routes (if needed)
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx          # Main canvas component
│   │   │   ├── Toolbar.tsx
│   │   │   ├── MiniMap.tsx
│   │   │   └── ConnectionLine.tsx
│   │   ├── nodes/
│   │   │   ├── BaseNode.tsx        # Reusable base
│   │   │   ├── PaperUploadNode.tsx
│   │   │   ├── PaperChatNode.tsx
│   │   │   ├── WebResearchNode.tsx
│   │   │   ├── CitationGraphNode.tsx
│   │   │   ├── SummaryNode.tsx
│   │   │   ├── MethodologyNode.tsx
│   │   │   ├── ResultsVisualizationNode.tsx
│   │   │   ├── NoteNode.tsx
│   │   │   ├── ResearcherAgentNode.tsx
│   │   │   ├── CriticAgentNode.tsx
│   │   │   ├── SynthesizerAgentNode.tsx
│   │   │   ├── QuestionGeneratorNode.tsx
│   │   │   └── CitationTrackerNode.tsx
│   │   └── ui/                     # Shared UI components
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── canvasStore.ts      # Zustand store
│   │   │   ├── agentStore.ts       # Agent registry
│   │   │   └── paperContextStore.ts
│   │   ├── hooks/
│   │   │   ├── useAgentCommunication.ts
│   │   │   ├── useNodeContext.ts
│   │   │   └── useWebSocket.ts
│   │   ├── api/
│   │   │   └── client.ts           # API client
│   │   └── utils/
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── index.ts                # Express app entry
│   │   ├── controllers/
│   │   │   ├── chatController.ts
│   │   │   ├── paperController.ts
│   │   │   ├── canvasController.ts
│   │   │   ├── researchController.ts
│   │   │   └── agentController.ts  # NEW - Agent communication
│   │   ├── routes/
│   │   │   ├── chatRoutes.ts
│   │   │   ├── paperRoutes.ts
│   │   │   ├── canvasRoutes.ts
│   │   │   ├── researchRoutes.ts
│   │   │   └── agentRoutes.ts      # NEW
│   │   ├── services/
│   │   │   ├── openaiService.ts
│   │   │   ├── pdfService.ts
│   │   │   ├── tavilyService.ts
│   │   │   ├── agentRegistry.ts    # NEW - Agent discovery
│   │   │   ├── agentOrchestrator.ts # NEW - Agent coordination
│   │   │   └── agentEventBus.ts    # NEW - EventEmitter-based event bus
│   │   ├── lib/
│   │   │   ├── agents/
│   │   │   │   ├── baseAgent.ts    # Abstract agent class
│   │   │   │   ├── researcherAgent.ts
│   │   │   │   ├── criticAgent.ts
│   │   │   │   ├── synthesizerAgent.ts
│   │   │   │   ├── questionGeneratorAgent.ts
│   │   │   │   └── citationTrackerAgent.ts
│   │   │   ├── tools/
│   │   │   │   ├── toolSchema.ts   # Tool interface definitions
│   │   │   │   └── toolValidator.ts
│   │   │   └── websocket.ts        # Socket.io setup
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimiter.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── package.json                     # Root package.json
├── pnpm-workspace.yaml
├── turbo.json                       # Turborepo config
├── .env.example
└── README.md
```

---

## Phase-by-Phase Implementation

### Phase 1: Infrastructure Setup

**Goal**: Set up development environment, database, CI/CD

**Duration**: Foundation work - critical path

#### Developer 1: Docker & Database
**Tasks**:
1. Create `docker-compose.yml` with PostgreSQL 16 only
2. Configure health checks and volume mounts
3. Write database initialization scripts
4. Create Prisma schema with all models (User, Canvas, Paper, Agent, AgentMessage, AgentInvocation, AgentCapability, WebSearchResult)
5. Set up Prisma migrations
6. Create seed script with sample data
7. Document database setup in README

**Technologies**:
- Docker, Docker Compose
- PostgreSQL 16
- Prisma 6.16.0
- Prisma Migrate

**Deliverables**:
- `docker-compose.yml`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/prisma/seed.ts`

#### Developer 2: Monorepo & CI/CD
**Tasks**:
1. Initialize pnpm workspace with `pnpm-workspace.yaml`
2. Configure Turborepo with `turbo.json` (build, dev, lint tasks)
3. Set up root `package.json` with scripts
4. Create frontend Next.js 16 app with TypeScript
5. Create backend Express app with TypeScript
6. Configure GitHub Actions CI pipeline:
   - Run on PR and main branch
   - Install dependencies with pnpm
   - Lint frontend and backend
   - Type check both workspaces
   - Run Prisma validation
   - Build both apps
7. Add pre-commit hooks (Husky + lint-staged)

**Technologies**:
- pnpm 9.15.0
- Turborepo 2.6.0
- GitHub Actions
- ESLint, Prettier
- Husky, lint-staged

**Deliverables**:
- `pnpm-workspace.yaml`
- `turbo.json`
- `package.json` (root)
- `.github/workflows/ci.yml`
- `.husky/` directory

#### Developer 3: Environment & Tooling
**Tasks**:
1. Create `.env.example` files for frontend and backend
2. Set up TypeScript configurations for both workspaces
3. Configure ESLint and Prettier
4. Set up Tailwind CSS 4.0 in frontend
5. **Initialize shadcn/ui**:
   - Run `npx shadcn@latest init`
   - Configure components.json (Tailwind CSS 4.0 compatible)
   - Install base components (Button, Card, Input, Select, Textarea)
   - Set up theming with CSS variables
6. Configure path aliases (@/ imports)
7. Create shared types package (optional)
8. Set up API client structure (axios instance with interceptors)
9. Create development documentation (README.md with setup instructions)

**Technologies**:
- TypeScript 5.9.3
- ESLint, Prettier
- Tailwind CSS 4.0
- shadcn/ui with Radix UI primitives
- class-variance-authority (CVA)
- Axios 1.7.9

**Deliverables**:
- `.env.example` files
- `tsconfig.json` files
- `.eslintrc.js`, `.prettierrc`
- `tailwind.config.js`
- `components.json` (shadcn config)
- `frontend/components/ui/*` (shadcn components)
- `README.md`
- `frontend/lib/api/client.ts`

**Integration Point**: All devs test that:
- Docker containers start successfully
- Database migrations run
- Frontend dev server starts
- Backend dev server starts
- CI pipeline passes

---

### Phase 2: Agent Communication Layer

**Goal**: Implement MCP-like agent communication infrastructure

**Duration**: Core infrastructure for agent system

#### Developer 1: Agent Registry & Discovery
**Tasks**:
1. Implement Agent Registry service:
   - In-memory Map<nodeId, Agent> of active agents
   - Agent registration/deregistration
   - Capability discovery API
   - Tool schema storage and validation
2. Create AgentCapability service:
   - CRUD operations for tool schemas
   - Tool validation with Zod
   - Tool versioning logic
   - Dynamic tool registration for OpenAI function calling
3. Implement agent lifecycle management:
   - Start/stop agents
   - Health checks
   - Status updates
   - Emit lifecycle events (registered, stopped, error)
4. Create API endpoints:
   - `POST /api/agents/register` - Register agent with capabilities
   - `DELETE /api/agents/:nodeId` - Deregister agent
   - `GET /api/agents` - List all active agents
   - `GET /api/agents/:nodeId/capabilities` - Get agent tools
   - `GET /api/capabilities` - List all available tools across all agents

**Technologies**:
- Node.js EventEmitter (built-in, zero dependencies)
- Zod 3.23.8 for schema validation
- Express for API routes
- Prisma Client (optional persistence to DB)

**Deliverables**:
- `backend/src/services/agentRegistry.ts`
- `backend/src/services/agentCapability.ts`
- `backend/src/controllers/agentController.ts`
- `backend/src/routes/agentRoutes.ts`

#### Developer 2: Event Bus & Orchestration
**Tasks**:
1. Implement AgentEventBus (extending EventEmitter):
   - Event types: `agent:invoke`, `agent:response`, `agent:broadcast`, `agent:error`
   - Type-safe event payloads with TypeScript
   - Event subscription/unsubscription management
2. Implement AgentOrchestrator service:
   - Route invocations between agents via event bus
   - Circular dependency detection (maintain call stack Map<nodeId, Set<nodeId>>)
   - Timeout management (30s default with AbortController)
   - Simple retry logic (max 3 retries with exponential backoff)
   - In-memory result caching (LRU cache, 100 entries max)
3. Create invocation handlers:
   - Process tool invocations (listen to `agent:invoke`)
   - Handle agent responses (listen to `agent:response`)
   - Broadcast system messages (emit `agent:broadcast`)
   - Error propagation (emit `agent:error`)
4. Implement rate limiting:
   - Per-agent rate limits (Map<nodeId, RateLimiter>: 10/min)
   - Canvas-wide limits (50 invocations/min)
   - Simple token bucket algorithm

**Technologies**:
- Node.js EventEmitter (extends EventEmitter class)
- express-rate-limit 7.1.5 for HTTP endpoints
- Custom in-memory rate limiter for agent calls
- LRU cache (lru-cache 10.2.0) for result caching

**Deliverables**:
- `backend/src/services/agentEventBus.ts`
- `backend/src/services/agentOrchestrator.ts`
- `backend/src/lib/rateLimiter.ts`
- `backend/src/lib/invocationHandler.ts`

#### Developer 3: WebSocket & Real-Time Updates
**Tasks**:
1. Set up Socket.io server and client:
   - Configure CORS
   - Set up room-based communication (per canvas)
   - Authentication middleware
2. Implement event emitters:
   - `agent:registered`
   - `agent:invocation`
   - `agent:response`
   - `agent:status`
   - `agent:error`
3. Create WebSocket hooks for frontend:
   - `useWebSocket` - Connection management
   - `useAgentEvents` - Subscribe to agent events
   - `useAgentStatus` - Track agent statuses
4. Create debug panel component for visualizing agent communication

**Technologies**:
- Socket.io 4.8.1 (client & server)
- React hooks

**Deliverables**:
- `backend/src/lib/websocket.ts`
- `frontend/lib/hooks/useWebSocket.ts`
- `frontend/lib/hooks/useAgentEvents.ts`
- `frontend/components/AgentDebugPanel.tsx`

**Integration Point**: All devs test that:
- Agents can register with in-memory registry
- Tool schemas are validated with Zod
- Events flow through EventEmitter (agent:invoke, agent:response)
- WebSocket events are received on frontend in real-time
- Rate limiting works (10/min per agent, 50/min per canvas)
- Circular dependency detection prevents infinite loops

---

### Phase 3: Core Canvas System

**Goal**: Implement visual canvas with React Flow

**Duration**: Foundation for node system

#### Developer 1: Canvas Core & State Management
**Tasks**:
1. Set up React Flow:
   - Configure ReactFlowProvider
   - Implement Background with dots (12px gap)
   - Add Controls (zoom +/-, fit view)
   - Add MiniMap
2. Create Zustand stores:
   - `canvasStore.ts`:
     - nodes: Node[]
     - edges: Edge[]
     - addNode, removeNode, updateNode
     - addEdge, removeEdge
     - Canvas persistence (localStorage)
     - Autosave logic (every 30s)
   - `agentStore.ts`:
     - registeredAgents: Map<nodeId, AgentMetadata>
     - agentStatuses: Map<nodeId, Status>
     - updateAgentStatus
     - getAgentCapabilities
   - `paperContextStore.ts`:
     - uploadedPapers: Map<paperId, Paper>
     - selectedPaper: Paper | null
     - paperConnections: Map<nodeId, paperId>
3. Implement autosave functionality with debounce

**Technologies**:
- @xyflow/react 12.8.5
- Zustand 5.0.8
- zustand/middleware/persist
- lodash.debounce 4.0.8

**Deliverables**:
- `frontend/components/canvas/Canvas.tsx`
- `frontend/lib/stores/canvasStore.ts`
- `frontend/lib/stores/agentStore.ts`
- `frontend/lib/stores/paperContextStore.ts`

#### Developer 2: Node System & Base Components
**Tasks**:
1. Create BaseNode component:
   - Color-coded header by node type
   - 4-directional handles (top, right, bottom, left)
   - NodeResizer integration
   - Lock/unlock button
   - Delete button
   - Selection ring styling
   - Hover effects
2. Implement node type registry:
   - Register all 13 node types
   - Type-specific styling
   - Icon mapping (Lucide React)
3. Create NodeWrapper component:
   - Handle common node logic
   - Context propagation
   - Error boundaries
4. Implement lock system:
   - Add `nopan` class when locked
   - Prevent canvas pan on text selection
   - Visual lock indicator

**Technologies**:
- React 19.2.0
- React Flow NodeResizer
- Lucide React 0.548.0
- clsx 2.1.1

**Deliverables**:
- `frontend/components/nodes/BaseNode.tsx`
- `frontend/components/nodes/NodeWrapper.tsx`
- `frontend/lib/nodeRegistry.ts`
- `frontend/lib/nodeTypes.ts` (TypeScript types)

#### Developer 3: Toolbar & Canvas Controls
**Tasks**:
1. Create Toolbar component:
   - Categorized node buttons:
     - Input: Paper Upload, Note
     - Research: Web Research, Paper Chat
     - Agents: Researcher, Critic, Synthesizer, Question Generator, Citation Tracker
     - Visualization: Citation Graph, Summary, Methodology, Results
   - Icon + label for each button
   - Add node on click (position at viewport center)
2. Implement Canvas controls:
   - Zoom in/out buttons
   - Fit view button
   - Lock all / Unlock all
   - Clear canvas (with confirmation)
   - Save canvas
   - Load canvas
3. Create ConnectionLine component:
   - Custom edge styling
   - Animated connections
   - Edge labels

**Technologies**:
- Lucide React icons
- React Flow Controls
- Tailwind CSS

**Deliverables**:
- `frontend/components/canvas/Toolbar.tsx`
- `frontend/components/canvas/CanvasControls.tsx`
- `frontend/components/canvas/ConnectionLine.tsx`

**Integration Point**: All devs test that:
- Canvas renders with background and controls
- Nodes can be added from toolbar
- Nodes can be dragged, resized, and deleted
- Edges can be created between nodes
- Lock system works
- State persists to localStorage

---

### Phase 4: Backend API Foundation

**Goal**: Create REST API endpoints for canvas operations

**Duration**: Core backend functionality

#### Developer 1: Express Server & Middleware
**Tasks**:
1. Set up Express server:
   - Configure CORS (allow frontend origin)
   - Body parser middleware
   - Error handler middleware
   - Request logger (Morgan)
2. Configure Prisma Client:
   - Initialize client
   - Connection pooling
   - Error handling
3. Create middleware:
   - `errorHandler.ts` - Centralized error handling
   - `validateRequest.ts` - Zod validation middleware
   - `rateLimiter.ts` - Rate limiting per IP
4. Set up health check endpoint:
   - `GET /health` - Check DB, Redis, API status

**Technologies**:
- Express 4.21.2
- Prisma Client
- Morgan 1.10.0
- Cors 2.8.5
- express-rate-limit 7.1.5

**Deliverables**:
- `backend/src/index.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/validateRequest.ts`
- `backend/src/middleware/rateLimiter.ts`

#### Developer 2: Canvas & Paper API
**Tasks**:
1. Implement Canvas endpoints:
   - `POST /api/canvas` - Create/save canvas
     - Validate nodes and edges JSON
     - Store in database
     - Return canvas ID
   - `GET /api/canvas/:id` - Load canvas
     - Fetch from database
     - Include related papers
   - `PUT /api/canvas/:id` - Update canvas
     - Atomic update of nodes/edges
   - `DELETE /api/canvas/:id` - Delete canvas
   - `POST /api/canvas/autosave` - Autosave state
     - Upsert operation
     - Return success status
2. Implement Paper endpoints:
   - `POST /api/paper/upload` - Upload PDF
     - Parse with pdf-parse
     - Extract title, authors, abstract
     - Extract citations with regex
     - Store fullText in database
     - Return paper object
   - `GET /api/paper/:id` - Get paper details
   - `DELETE /api/paper/:id` - Delete paper

**Technologies**:
- Express Router
- Prisma Client
- pdf-parse 1.1.1
- Zod for validation

**Deliverables**:
- `backend/src/controllers/canvasController.ts`
- `backend/src/controllers/paperController.ts`
- `backend/src/routes/canvasRoutes.ts`
- `backend/src/routes/paperRoutes.ts`
- `backend/src/services/pdfService.ts`

#### Developer 3: AI Chat & Research API
**Tasks**:
1. Implement Chat endpoints:
   - `POST /api/chat` - Stream AI responses
     - Use AI SDK `streamText`
     - Inject paper context from connected nodes
     - Support agent-specific system prompts
     - Return Server-Sent Events (SSE)
   - Handle context injection:
     - Fetch connected node outputs
     - Format as context for LLM
2. Implement Research endpoints:
   - `POST /api/research/search` - Web search
     - Use Tavily API
     - Filter academic domains
     - Return structured results
   - `POST /api/research/fetch` - Fetch paper by DOI
     - Integration with academic APIs
3. Create OpenAI service:
   - Configure API client
   - Streaming helpers
   - Token counting
   - Error handling

**Technologies**:
- OpenAI SDK 6.7.0
- AI SDK (Vercel) 5.0.78
- Tavily 0.3.0
- Axios 1.7.9

**Deliverables**:
- `backend/src/controllers/chatController.ts`
- `backend/src/controllers/researchController.ts`
- `backend/src/routes/chatRoutes.ts`
- `backend/src/routes/researchRoutes.ts`
- `backend/src/services/openaiService.ts`
- `backend/src/services/tavilyService.ts`

**Integration Point**: All devs test that:
- Canvas can be saved and loaded via API
- PDF upload works and extracts metadata
- Chat endpoint streams responses
- Web search returns academic results
- All endpoints handle errors gracefully

---

### Phase 5: Essential Nodes

**Goal**: Implement core node types for basic functionality

**Duration**: First set of user-facing features

#### Developer 1: Paper Upload & Note Nodes
**Tasks**:
1. Implement PaperUploadNode:
   - Drag & drop PDF upload
   - File validation (PDF only, max 10MB)
   - Upload progress indicator
   - Display uploaded paper metadata (title, authors)
   - Output paper context to connected nodes
   - Error handling for invalid PDFs
2. Implement NoteNode:
   - Rich text editor (simple textarea for MVP)
   - Auto-saving to canvas state
   - Markdown support (react-markdown)
   - Copy/paste functionality
   - Export note as text

**Technologies**:
- React Dropzone 14.2.3 (for drag & drop)
- react-markdown 10.1.0
- Lucide React icons

**Deliverables**:
- `frontend/components/nodes/PaperUploadNode.tsx`
- `frontend/components/nodes/NoteNode.tsx`

#### Developer 2: Paper Chat Node
**Tasks**:
1. Implement PaperChatNode:
   - Chat interface (message list + input)
   - Fetch paper context from connected nodes
   - Send messages to `/api/chat` endpoint
   - Stream AI responses in real-time (SSE)
   - Display message history
   - Loading states (typing indicator)
   - Error handling for API failures
   - Copy message button
   - Clear chat button
2. Create chat utilities:
   - SSE client helper
   - Message formatting
   - Context injection logic

**Technologies**:
- Server-Sent Events (fetch with ReadableStream)
- react-markdown for message display
- date-fns 4.1.0 for timestamps

**Deliverables**:
- `frontend/components/nodes/PaperChatNode.tsx`
- `frontend/lib/utils/sseClient.ts`
- `frontend/lib/utils/messageFormatter.ts`

#### Developer 3: Web Research Node
**Tasks**:
1. Implement WebResearchNode:
   - Search input field
   - Domain filter checkboxes (arXiv, Google Scholar, PubMed)
   - Search button with loading state
   - Display search results:
     - Title (clickable link)
     - Snippet
     - Source domain
     - Relevance score
   - "Add to context" button per result
   - Output selected results to connected nodes
   - Error handling for API failures

**Technologies**:
- Axios for API calls
- Lucide React icons

**Deliverables**:
- `frontend/components/nodes/WebResearchNode.tsx`
- `frontend/lib/api/researchApi.ts`

**Integration Point**: All devs test that:
- Papers can be uploaded and metadata displayed
- Notes can be created and edited
- Chat works with paper context
- Web search returns academic results
- Nodes output data to connected nodes

---

### Phase 6: Agent System with Tool Interfaces

**Goal**: Implement 6 specialized AI agents with callable tools

**Duration**: Core innovation - agent collaboration

#### Developer 1: Base Agent Class & Researcher Agent
**Tasks**:
1. Create BaseAgent abstract class:
   - Tool registration system
   - Tool schema definition helpers
   - Tool invocation method
   - Context management
   - Message history
   - Error handling
2. Implement ResearcherAgent:
   - System prompt (meticulous analyst persona)
   - Tools:
     - `analyze_paper` - Deep analysis with evidence extraction
     - `extract_methodology` - Extract methods section
     - `extract_claims` - Identify key claims
     - `find_gaps` - Identify research gaps
   - Each tool returns structured output with confidence and sources
3. Create ResearcherAgentNode (frontend):
   - Display agent status
   - Show active tool calls
   - Display analysis results
   - Real-time streaming
   - Tool invocation UI (call other agents)

**Technologies**:
- OpenAI SDK
- Zod for tool schemas
- AI SDK for streaming

**Deliverables**:
- `backend/src/lib/agents/baseAgent.ts`
- `backend/src/lib/agents/researcherAgent.ts`
- `frontend/components/nodes/ResearcherAgentNode.tsx`

#### Developer 2: Critic & Synthesizer Agents
**Tasks**:
1. Implement CriticAgent:
   - System prompt (skeptical reviewer persona)
   - Tools:
     - `validate_claim` - Verify specific claim with evidence
     - `critique_methodology` - Assess method quality
     - `identify_biases` - Find potential biases
     - `suggest_improvements` - Recommend enhancements
   - Output structured critiques with severity levels
2. Implement SynthesizerAgent:
   - System prompt (integrator persona)
   - Tools:
     - `merge_analyses` - Combine multiple agent outputs
     - `resolve_conflicts` - Handle contradictory findings
     - `generate_insights` - Create emergent insights
     - `build_consensus` - Form unified conclusions
   - Conflict resolution logic
   - Consensus algorithm
3. Create frontend nodes for both agents:
   - CriticAgentNode - Display critiques with severity colors
   - SynthesizerAgentNode - Display synthesis with confidence

**Technologies**:
- OpenAI SDK
- Lodash for data merging

**Deliverables**:
- `backend/src/lib/agents/criticAgent.ts`
- `backend/src/lib/agents/synthesizerAgent.ts`
- `frontend/components/nodes/CriticAgentNode.tsx`
- `frontend/components/nodes/SynthesizerAgentNode.tsx`

#### Developer 3: Question Generator & Citation Tracker Agents
**Tasks**:
1. Implement QuestionGeneratorAgent:
   - System prompt (curious explorer persona)
   - Tools:
     - `generate_questions` - Create research questions with priority
     - `identify_unknowns` - Find unanswered questions
     - `suggest_experiments` - Propose follow-up studies
   - Output questions with priority and suggested next agent
2. Implement CitationTrackerAgent:
   - System prompt (meticulous historian persona)
   - Tools:
     - `verify_citation` - Validate citation accuracy
     - `find_related_papers` - Discover related work
     - `build_citation_graph` - Create citation network
     - `assess_impact` - Evaluate paper impact
   - Integration with Tavily for citation validation
3. Create frontend nodes for both agents:
   - QuestionGeneratorNode - Display questions with priority badges
   - CitationTrackerNode - Display citation graph preview

**Technologies**:
- OpenAI SDK
- Tavily for academic search

**Deliverables**:
- `backend/src/lib/agents/questionGeneratorAgent.ts`
- `backend/src/lib/agents/citationTrackerAgent.ts`
- `frontend/components/nodes/QuestionGeneratorNode.tsx`
- `frontend/components/nodes/CitationTrackerNode.tsx`

**Integration Point**: All devs test that:
- All 6 agents register their tools
- Agents can be invoked from other agents
- Tool schemas validate correctly
- Agent responses include confidence and sources
- Frontend displays agent outputs correctly
- Agent-to-agent communication works via message queue

---

### Phase 7: Advanced Nodes

**Goal**: Implement visualization and analysis nodes

**Duration**: Enhanced functionality

#### Developer 1: Citation Graph Node
**Tasks**:
1. Implement CitationGraphNode:
   - Fetch citation data from connected nodes
   - Build graph data structure:
     - Nodes: papers
     - Edges: citations
     - Metadata: authors, year, citations count
   - Render with Plotly.js:
     - Network graph layout (force-directed)
     - Interactive nodes (click to view details)
     - Zoom and pan
     - Highlight paths
   - Dynamic import Plotly (`next/dynamic` with `ssr: false`)
   - Color-code by year or citation count
   - Export graph as PNG
2. Handle large graphs (100+ nodes):
   - Clustering algorithm
   - Level-of-detail rendering
   - Search and filter

**Technologies**:
- Plotly.js 3.1.2
- next/dynamic for SSR bypass
- D3 for data processing (optional)

**Deliverables**:
- `frontend/components/nodes/CitationGraphNode.tsx`
- `frontend/lib/utils/graphBuilder.ts`

#### Developer 2: Summary & Methodology Nodes
**Tasks**:
1. Implement SummaryNode:
   - Fetch paper content from connected nodes
   - Generate summary via AI:
     - Call `/api/chat` with "summarize" prompt
     - Support multiple summary lengths (short, medium, long)
     - Extract key points as bullet list
   - Display summary with formatting (react-markdown)
   - Show confidence level
   - Regenerate button
   - Export summary as text
2. Implement MethodologyNode:
   - Extract methodology section from paper
   - Parse methodology components:
     - Study design
     - Data collection
     - Analysis methods
     - Limitations
   - Display structured methodology
   - Highlight key methods
   - Link to related papers with similar methods

**Technologies**:
- OpenAI SDK
- react-markdown with remark-gfm

**Deliverables**:
- `frontend/components/nodes/SummaryNode.tsx`
- `frontend/components/nodes/MethodologyNode.tsx`
- `backend/src/services/summaryService.ts`

#### Developer 3: Results Visualization Node
**Tasks**:
1. Implement ResultsVisualizationNode:
   - Detect data tables in paper text
   - Parse data with papaparse
   - Offer chart types:
     - Bar chart
     - Line chart
     - Scatter plot
     - Pie chart
   - Render charts with Plotly.js:
     - Interactive tooltips
     - Zoom and pan
     - Export as PNG/SVG
   - Allow manual data input (CSV paste)
   - Axis label configuration
   - Color scheme selection
2. Create data extraction helpers:
   - Table detection regex
   - CSV parsing
   - Data validation

**Technologies**:
- Plotly.js 3.1.2
- papaparse 5.5.3
- Cheerio 1.0.0 (for HTML tables)

**Deliverables**:
- `frontend/components/nodes/ResultsVisualizationNode.tsx`
- `frontend/lib/utils/dataExtractor.ts`
- `frontend/lib/utils/chartBuilder.ts`

**Integration Point**: All devs test that:
- Citation graph renders correctly with Plotly
- Summary generates from paper context
- Methodology extracts structured data
- Results visualization creates charts
- All nodes handle large inputs gracefully
- Export functions work

---

### Phase 8: Visualization & Orchestration

**Goal**: Polish UI, implement agent workflows, optimize performance

**Duration**: User experience and advanced features

#### Developer 1: Agent Workflow Orchestrator
**Tasks**:
1. Create WorkflowBuilder component:
   - Visual workflow designer
   - Drag-and-drop agent sequence
   - Define input/output mappings
   - Save workflows as templates
2. Implement workflow execution:
   - Sequential agent invocation
   - Parallel agent invocation (where possible)
   - Result aggregation
   - Error handling and retries
   - Progress visualization
3. Pre-built workflows:
   - "Full Paper Analysis": Researcher → Critic → Synthesizer
   - "Methodology Review": Researcher → Critic (methodology focus)
   - "Citation Validation": Citation Tracker → Web Research
   - "Question Generation": Question Generator → Researcher (answer)
4. Create WorkflowExecutionNode:
   - Select workflow template
   - Configure parameters
   - Execute workflow
   - Display results from all agents

**Technologies**:
- React Flow (for workflow visualization)
- Zustand for workflow state

**Deliverables**:
- `frontend/components/workflow/WorkflowBuilder.tsx`
- `frontend/components/nodes/WorkflowExecutionNode.tsx`
- `backend/src/services/workflowOrchestrator.ts`
- `frontend/lib/stores/workflowStore.ts`

#### Developer 2: UI/UX Polish & Theme
**Tasks**:
1. Consistent design system:
   - Define color palette per node type:
     - Input nodes: Blue (#3B82F6)
     - Research nodes: Green (#10B981)
     - Agent nodes: Purple (#8B5CF6)
     - Visualization nodes: Orange (#F59E0B)
   - Typography scale
   - Spacing system (4px base)
   - Border radius standards
2. Enhance node UI:
   - Smooth animations (framer-motion optional)
   - Hover states
   - Focus states
   - Loading skeletons
   - Error states with retry
   - Success/failure toast notifications
3. Dark mode support:
   - Toggle in toolbar
   - Persist preference
   - Update all components
   - Adjust canvas background
4. Responsive design:
   - Mobile-friendly toolbar (collapsible)
   - Responsive node sizing
   - Touch-friendly controls

**Technologies**:
- Tailwind CSS
- Lucide React icons
- framer-motion 11.0.0 (optional)
- react-hot-toast 2.4.1

**Deliverables**:
- `frontend/app/globals.css` (theme CSS)
- `frontend/components/ui/*` (UI primitives)
- `frontend/lib/theme.ts`
- Updated all node components with consistent styling

#### Developer 3: Performance Optimization
**Tasks**:
1. React optimization:
   - Memoize all node components (React.memo)
   - Use useCallback for event handlers
   - Implement virtual scrolling for long lists
   - Lazy load heavy components (Plotly, PDF viewer)
   - Code splitting with next/dynamic
2. React Flow optimization:
   - Use `nodeTypes` with memoized components
   - Minimize re-renders with shallow comparison
   - Optimize edge rendering
   - Implement viewport culling for 50+ nodes
3. Backend optimization:
   - Cache agent responses in Redis (TTL: 1 hour)
   - Implement database query optimization (indexes)
   - Add response compression (gzip)
   - Optimize PDF parsing (stream processing)
4. Monitoring setup:
   - Add performance metrics (custom hooks)
   - Log slow operations
   - Track API response times
   - Monitor WebSocket connection health

**Technologies**:
- React.memo, useCallback, useMemo
- next/dynamic
- compression middleware
- Redis caching

**Deliverables**:
- Optimized components with memoization
- `frontend/lib/hooks/usePerformance.ts`
- `backend/src/middleware/compression.ts`
- `backend/src/services/cacheService.ts`
- Performance monitoring dashboard (optional)

**Integration Point**: All devs test that:
- Workflows execute correctly
- UI is consistent across all nodes
- Dark mode works
- Canvas performs well with 30+ nodes
- API responses are cached
- All animations are smooth (60fps)

---

### Phase 9: Testing & Deployment

**Goal**: Comprehensive testing, production build, deployment

**Duration**: Final polish and launch

#### Developer 1: Backend Testing & Docker Production
**Tasks**:
1. Write backend tests:
   - Unit tests for services (Jest)
   - Integration tests for API endpoints (Supertest)
   - Test agent communication flow
   - Test error handling
   - Test rate limiting
2. Docker production configuration:
   - Multi-stage Dockerfile for backend
   - Optimize image size (Alpine base)
   - Production docker-compose.yml
   - Configure environment variables
   - Set up health checks
3. Database preparation:
   - Run migrations on production DB
   - Seed initial data (agent capabilities)
   - Backup strategy
4. Deploy backend:
   - Choose platform (Railway, Render, AWS ECS)
   - Configure environment variables
   - Set up monitoring (logs)
   - Configure domain/SSL

**Technologies**:
- Jest 29.7.0
- Supertest 6.3.4
- Docker multi-stage builds
- Railway/Render for deployment

**Deliverables**:
- `backend/src/**/*.test.ts`
- `backend/Dockerfile`
- `docker-compose.prod.yml`
- Deployed backend URL

#### Developer 2: Frontend Testing & Vercel Deployment
**Tasks**:
1. Write frontend tests:
   - Unit tests for utilities (Vitest)
   - Component tests for nodes (React Testing Library)
   - Integration tests for canvas (Playwright optional)
   - Test WebSocket connection
   - Test state persistence
2. Build optimization:
   - Analyze bundle size
   - Optimize images (next/image)
   - Implement ISR or SSG where applicable
   - Configure Next.js caching
3. Production configuration:
   - Set environment variables for Vercel
   - Configure API routes (if needed)
   - Set up redirects/rewrites
4. Deploy frontend:
   - Deploy to Vercel
   - Connect to production backend
   - Test in production
   - Configure custom domain (optional)

**Technologies**:
- Vitest 1.2.0
- React Testing Library 14.2.0
- Playwright 1.41.0 (optional)
- Vercel CLI

**Deliverables**:
- `frontend/src/**/*.test.tsx`
- `frontend/next.config.js` (optimized)
- Deployed frontend URL on Vercel

#### Developer 3: Documentation & Final QA
**Tasks**:
1. Write comprehensive documentation:
   - README.md:
     - Project overview
     - Architecture diagram
     - Setup instructions
     - Development workflow
     - Deployment guide
   - API.md:
     - All endpoints documented
     - Request/response examples
     - Error codes
   - AGENT_PROTOCOL.md:
     - Agent communication protocol
     - Tool schema examples
     - Integration guide
   - CONTRIBUTING.md:
     - Code style guide
     - PR process
     - Testing requirements
2. Create demo content:
   - Sample paper PDFs
   - Example workflows
   - Tutorial video (screen recording)
   - Demo canvas (pre-configured)
3. Final QA testing:
   - Test all 13 node types
   - Test agent-to-agent communication
   - Test workflows
   - Test error scenarios
   - Cross-browser testing
   - Performance testing (Lighthouse)
4. Create presentation materials:
   - Demo script
   - Feature highlights
   - Technical architecture slides
   - Video demo

**Technologies**:
- Markdown
- Screen recording tools (OBS, Loom)
- Google Slides/PowerPoint

**Deliverables**:
- `README.md`
- `docs/API.md`
- `docs/AGENT_PROTOCOL.md`
- `docs/CONTRIBUTING.md`
- `docs/ARCHITECTURE.md`
- Demo video
- Presentation slides

**Integration Point**: All devs test that:
- All tests pass
- Production builds succeed
- Backend and frontend deployed successfully
- End-to-end flows work in production
- Documentation is complete and accurate
- Demo runs smoothly

---

## Task Distribution Strategy

### Parallel Work Recommendations

**Phases that can run in parallel**:
- Phase 1 (all 3 devs work simultaneously on different infrastructure)
- Phase 3 (canvas, state, and toolbar are independent)
- Phase 5 (all node types are independent)
- Phase 6 (all agents are independent)
- Phase 7 (all visualization nodes are independent)

**Phases that require synchronization**:
- Phase 2 (agent communication layer must be complete before Phase 6)
- Phase 4 (backend foundation must be complete before Phase 5)
- Phase 8 (depends on all previous phases)
- Phase 9 (testing requires complete system)

### Communication Checkpoints

**Daily Standups**:
- What did you complete yesterday?
- What will you work on today?
- Any blockers?

**Integration Points** (end of each phase):
- All 3 devs test integrated features together
- Resolve merge conflicts
- Update shared types/interfaces
- Sync on API contracts

**Code Review**:
- Each PR reviewed by at least one other dev
- Focus on API contracts between frontend/backend
- Validate agent tool schemas together

---

## Dependencies & Critical Path

### Critical Path (must be completed sequentially)

1. **Phase 1** → **Phase 2** → **Phase 6**
   - Infrastructure → Agent Communication Layer → Agent Implementation
   - Cannot build agents without communication layer

2. **Phase 1** → **Phase 4** → **Phase 5**
   - Infrastructure → Backend API → Essential Nodes
   - Nodes need API to function

3. **Phase 3** must complete before **Phase 5**
   - Canvas system needed before adding nodes

4. **Phases 1-7** must complete before **Phase 8**
   - Cannot optimize what doesn't exist

### Dependencies Map

```
Phase 1 (Infrastructure)
├─→ Phase 2 (Agent Communication) [Critical]
│   ├─→ Phase 6 (Agent System) [Critical]
│   └─→ Phase 8 (Orchestration)
├─→ Phase 3 (Canvas)
│   ├─→ Phase 5 (Essential Nodes)
│   ├─→ Phase 6 (Agent Nodes)
│   └─→ Phase 7 (Advanced Nodes)
└─→ Phase 4 (Backend API)
    ├─→ Phase 5 (Essential Nodes)
    ├─→ Phase 6 (Agent System)
    └─→ Phase 7 (Advanced Nodes)

Phases 5, 6, 7 → Phase 8 (Polish) → Phase 9 (Testing)
```

---

## Success Criteria

### Functional Requirements

**Must Have** (MVP):
- ✅ Upload PDF and extract metadata
- ✅ Create 13 types of nodes on canvas
- ✅ Connect nodes with edges
- ✅ Drag, resize, lock nodes
- ✅ Save and load canvas state
- ✅ Chat with paper context
- ✅ Web academic search
- ✅ 6 specialized AI agents operational
- ✅ Agents can call each other as tools
- ✅ Agent communication visualized in real-time
- ✅ Citation graph visualization
- ✅ Generate summaries and extract methodology
- ✅ Visualize results data
- ✅ Autosave every 30 seconds
- ✅ Real-time streaming responses

**Should Have** (Stretch Goals):
- ✅ Pre-built agent workflows
- ✅ Dark mode
- ✅ Export canvas/reports
- ✅ Agent debug panel
- ✅ Performance monitoring
- ✅ Response caching

**Nice to Have** (Post-MVP):
- ⏳ Multi-user collaboration (real-time)
- ⏳ Version history for canvas
- ⏳ Advanced analytics dashboard
- ⏳ Custom agent creation (user-defined tools)
- ⏳ Mobile app

### Performance Targets

- **First Load**: <2 seconds
- **Time to Interactive**: <3 seconds
- **Canvas FPS**: 60fps with 30+ nodes
- **Streaming Latency**: <500ms for first token
- **PDF Parse**: <5 seconds for 20-page paper
- **Agent Invocation**: <3 seconds for simple tools
- **Agent Workflow**: <15 seconds for 3-agent chain
- **Lighthouse Score**: >90 for all metrics

### Code Quality Targets

- **Test Coverage**: >70% for backend, >60% for frontend
- **TypeScript**: Strict mode, no `any` types
- **ESLint**: Zero errors, minimal warnings
- **Bundle Size**: Frontend < 500KB (initial load)
- **API Response Size**: <1MB for canvas load
- **Database Queries**: <100ms for 95th percentile

### Challenge Alignment (Hackathon Judging Criteria)

**"Can AI reason and collaborate to uncover something new?"**

✅ **Reasoning**: Every agent conclusion includes:
- Step-by-step reasoning chain
- Evidence and sources
- Confidence levels
- Verifiable citations

✅ **Collaboration**: Agents:
- Discover each other's tools
- Call each other for specialized analysis
- Build on each other's findings
- Resolve conflicts through synthesis

✅ **New Discoveries**: System enables:
- Emergent insights from agent synthesis
- Cross-paper pattern recognition
- Novel question generation
- Hypothesis formation from multi-agent analysis

✅ **Verifiable**: All claims:
- Backed by exact paper citations
- Include page numbers/snippets
- Linked to source PDFs
- Traceable through agent invocation history

✅ **Visual**: Canvas:
- Makes reasoning visible and tangible
- Shows agent communication graph
- Displays confidence levels
- Visualizes citation networks

---

## Technology Decision Rationale

### Why PostgreSQL over SQLite?
- Better multi-user support
- Advanced indexing for performance
- JSON operators for complex queries
- Production-ready with proper scaling
- Docker deployment standard practice

### Why EventEmitter over BullMQ/Redis?
- **Zero dependencies** - Built into Node.js, no external infrastructure
- **Simplicity** - 10x simpler implementation, easier to debug
- **Perfect for in-process** - All agents run in single Node.js process
- **Fast** - No network latency, direct function calls
- **Full control** - Custom orchestration logic without framework constraints
- **MCP-like protocol** - Easier to implement custom tool interface
- **Good enough** - Hackathon doesn't need horizontal scaling
- **One less Docker container** - No Redis setup/maintenance
- **Type-safe** - TypeScript event payloads with generics
- **Easier testing** - Mock events without Redis infrastructure

**Trade-offs accepted**:
- ⚠️ No job persistence (fine - agents recompute if needed)
- ⚠️ Single process only (fine - can scale later if needed)
- ✅ Simpler architecture = faster development
- ✅ Perfect for prototype/hackathon scope

### Why Socket.io over plain WebSockets?
- Automatic reconnection
- Room-based messaging (per canvas)
- Fallback to polling if WS unavailable
- Built-in event system
- Better debugging tools

### Why Turborepo + pnpm?
- Fastest package manager (benchmark proven)
- Efficient monorepo caching
- Shared dependencies across workspaces
- Turborepo task orchestration
- Industry standard for modern monorepos

### Why Next.js 16 over other frameworks?
- Latest App Router with React 19
- Server components for performance
- Built-in API routes (optional)
- Vercel deployment optimization
- Best React framework for production

---

## Risk Mitigation

### Technical Risks

**Risk**: Agent circular dependencies cause infinite loops
**Mitigation**:
- Implement call stack tracking
- Max chain depth of 5
- Circuit breaker pattern
- Timeout all invocations (30s)

**Risk**: Canvas performance degrades with many nodes
**Mitigation**:
- Viewport culling (only render visible nodes)
- Memoize all components
- Virtual scrolling for lists
- Lazy load heavy components (Plotly)

**Risk**: LLM API costs exceed budget
**Mitigation**:
- Cache all responses (Redis, 1hr TTL)
- Use GPT-4o-mini (cheaper model)
- Implement rate limiting
- Set monthly budget alert

**Risk**: PDF parsing fails for complex papers
**Mitigation**:
- Fallback to OCR (Tesseract.js)
- Manual text input option
- Error messages guide user
- Support plain text upload

**Risk**: WebSocket connections drop frequently
**Mitigation**:
- Auto-reconnection with exponential backoff
- Queue messages during disconnect
- Fallback to polling
- Display connection status

### Team Coordination Risks

**Risk**: Merge conflicts due to parallel work
**Mitigation**:
- Clear module boundaries
- Shared types in separate file
- Frequent commits (multiple times per day)
- PR size limit (< 500 lines)

**Risk**: API contract mismatches between frontend/backend
**Mitigation**:
- Define OpenAPI spec upfront
- Use Zod schemas on both sides
- Shared TypeScript types (generate from Prisma)
- Integration tests for all endpoints

**Risk**: Incomplete understanding of agent protocol
**Mitigation**:
- Document protocol in Phase 2
- All devs review agent architecture together
- Create example agent first (reference implementation)
- Pair programming for first agent

---

## Environment Variables Reference

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://canvas_user:canvas_password@localhost:5432/research_canvas

# Redis
REDIS_URL=redis://localhost:6379

# AI APIs
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...

# Server
PORT=4000
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret_change_in_production
CORS_ORIGIN=http://localhost:3000

# Optional
SENTRY_DSN=https://...  # Error tracking
LOG_LEVEL=debug
```

---

## Quick Start Commands

```bash
# 1. Start Docker services
docker-compose up -d

# 2. Install dependencies
pnpm install

# 3. Setup database
cd backend
pnpm prisma migrate dev
pnpm prisma db seed

# 4. Start development servers
cd ..
pnpm dev  # Starts both frontend and backend

# Frontend: http://localhost:3000
# Backend: http://localhost:4000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

---

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/phase-X-feature-name` - Feature branches

### Commit Convention
```
type(scope): message

Types: feat, fix, docs, style, refactor, test, chore
Scope: frontend, backend, agent, canvas, api, db

Examples:
feat(agent): implement researcher agent with tool interface
fix(canvas): resolve node drag performance issue
docs(api): add agent communication protocol documentation
```

### PR Process
1. Create feature branch from `develop`
2. Commit changes with conventional commits
3. Push and open PR to `develop`
4. At least 1 approval required
5. CI must pass (lint, type-check, build)
6. Squash and merge

---

## Next Steps After Planning

1. **Team Kickoff Meeting** (1 hour):
   - Review this plan together
   - Assign Phase 1 tasks
   - Set up communication channels (Slack/Discord)
   - Schedule daily standups (15min)
   - Agree on code style and conventions

2. **Setup Development Environment** (2 hours):
   - All devs clone repo
   - Install pnpm globally
   - Start Docker containers
   - Verify database connection
   - Run sample migration

3. **Phase 1 Execution** (Day 1):
   - Each dev works on assigned Phase 1 tasks
   - First integration point at end of day
   - Demo: All services running

4. **Iterate Through Phases**:
   - Complete one phase before starting next
   - Test integration points thoroughly
   - Update documentation as you go
   - Demo features at end of each phase

---

## Conclusion

This action plan provides a comprehensive roadmap for building the Research Agent Canvas with **MCP-like inter-agent communication**. The plan is optimized for **3 full-stack developers** working in parallel, with clear phase boundaries, integration points, and success criteria.

**Key Innovations**:
1. **Agent Tool Protocol**: Agents expose capabilities as callable tools
2. **Visual Agent Communication**: Real-time visualization of agent collaboration
3. **Emergent Intelligence**: Multi-agent synthesis produces novel insights
4. **Verifiable Reasoning**: Every claim traceable to source evidence

**Production-Ready Features**:
- PostgreSQL with Docker
- Redis-backed message queue
- WebSocket real-time updates
- CI/CD with GitHub Actions
- Performance optimization
- Comprehensive testing

Good luck with the hackathon! This system directly addresses the challenge question: **"AI can now summarize and retrieve information — but can it reason and collaborate to uncover something new?"**

The answer: **Yes, through structured multi-agent collaboration with verifiable reasoning chains.** 🚀
