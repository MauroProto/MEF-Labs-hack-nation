# MEF-Labs-Hack-Nation: Comprehensive Project Analysis

**Analysis Date**: November 9, 2025
**Current Branch**: `ui` (merged with main)
**Status**: Actively developed with major debate system implementation

---

## 1. FRONTEND COMPONENTS

### Canvas System
- **EnhancedCanvas.tsx** (100 lines) - Main React Flow canvas with drag-drop, node creation, edge management
  - 14 node types registered
  - Paper context propagation via paper-upload → other nodes
  - Keyboard shortcuts (Delete key), pan/zoom controls, minimap
  - Node auto-positioning relative to viewport

- **SimpleCanvas.tsx** - Fallback simple canvas (not actively used)
- **Toolbar.tsx** / **EnhancedToolbar.tsx** - Node palette with drag-drop source
- **CanvasControls.tsx** - Zoom/fit/pan controls
- **SimpleControls.tsx** - Minimal control panel
- **ConnectionLine.tsx** - Custom edge renderer

### Input/Interaction Nodes
1. **PaperUploadNode.tsx** (283 lines) - PDF upload & parsing
   - Client-side PDF text extraction using pdfjs-dist 4.8.69
   - Extracts title, authors, full text (up to 12 pages)
   - Lazy-loaded PDFViewer component
   - Auto-creates paper-chat nodes on text selection
   - Stores paper in usePaperContextStore

2. **NoteNode.tsx** (150 lines) - Text note taking
   - Simple text input
   - Can send/receive connections
   - Supports both input and output

3. **PaperChatNode.tsx** (316 lines) - AI chat with paper context
   - Markdown message rendering with GitHub flavored markdown
   - Auto-detects connected papers via paperContextStore
   - Calls `/api/chat` endpoint with OpenAI (gpt-4o-mini)
   - Streaming message display
   - Fallback responses when API fails
   - Initial message auto-send from PDF selection

4. **PDFViewer.tsx** (235 lines) - Full PDF rendering component
   - react-pdf library with worker configuration
   - Text selection tracking for "Ask about this" button
   - Page pagination
   - Floating Ask button on selection
   - Max page limiting for previews

### Research/Experiment Nodes
5. **WebResearchNode.tsx** (272 lines) - AI research with streaming
   - Calls `/api/research/web-search` endpoint
   - Query input + research execution
   - Streaming progress updates
   - Abort signal for cancellation
   - Activities tracking
   - Markdown output rendering

6. **MasDebateNode.tsx** (352 lines) - Multi-Agent Debate System
   - **NEW** Improved debate with shared topics from DIFFERENT postures
   - Question generation → posture/topic generation → debate runs
   - 3-way debate (3 different perspectives on SAME topics)
   - Real-time debate progress tracking
   - History sidebar with previous debates
   - Loads debate results into MasDebateViewer
   - Uses useMasDebate hook for state management

### Agent Nodes (5 core agents - minimal UI)
7. **ResearcherAgentNode.tsx** (127 lines) - Deep analysis
8. **CriticAgentNode.tsx** (114 lines) - Validation & criticism
9. **SynthesizerAgentNode.tsx** (103 lines) - Conflict resolution
10. **QuestionGeneratorNode.tsx** (141 lines) - Research question generation
11. **CitationTrackerNode.tsx** (153 lines) - Citation verification

All agent nodes:
- Minimal UI with status indicators
- Connect to canvas nodes
- Handle agent metadata display
- Currently render via BaseNode with custom labels

### Visualization/Output Nodes (Placeholder)
12. **citation-graph** - Network visualization (renders as BaseNode)
13. **summary** - Paper summary output (renders as BaseNode)
14. **methodology** - Methodology extraction (renders as BaseNode)
15. **results-visualization** - Results charts (renders as BaseNode)
16. **insight-report** - Insight report (renders as BaseNode)

### Base Components
- **BaseNode.tsx** (217 lines) - Node wrapper with header/footer, status indicators
- **NodeWrapper.tsx** (95 lines) - Lightweight node container

---

## 2. FRONTEND STORES (Zustand)

### **agentStore.ts**
```
State:
- agents: Map<nodeId, AgentMetadata>
- agentStatuses: Map<nodeId, AgentStatus>
- activeInvocations: Map<invocationId, AgentInvocation>
- invocationHistory: AgentInvocation[]
- messages: AgentMessage[]

Actions:
- registerAgent(metadata) / deregisterAgent(nodeId)
- updateAgentStatus(nodeId, status)
- findAgentsWithCapability(capability)
- addInvocation(invocation) / updateInvocation(id, updates)
- addMessage(message) / getMessagesForNode(nodeId)
```

### **paperContextStore.ts** (176 lines)
```
State:
- papers: Map<paperId, Paper>
- paperConnections: Map<nodeId, paperId>
- selectedPaper: Paper | null
- isUploading: boolean
- uploadProgress: number

Actions:
- addPaper(paper) / removePaper(paperId)
- connectNodeToPaper(nodeId, paperId)
- getPaperForNode(nodeId) / getNodesForPaper(paperId)
- getContextForNode(nodeId) - returns paper + all connected papers
- clearAll()

Key Features:
- Manages paper-to-node connections for context propagation
- No database persistence (in-memory only)
- Upload progress tracking
```

### **canvasStore.ts** (simplified - no persistence)
```
State:
- nodes: Node[]
- edges: Edge[]
- viewport: Viewport
- canvasId: string | null
- canvasName: string
- lockedNodes: Set<nodeId>

Actions:
- addNode(node) / removeNode(nodeId)
- addEdge(edge) / removeEdge(edgeId)
- setViewport(viewport)
- lockAllNodes() / unlockAllNodes()
- triggerAutosave() - stub (no implementation)
```

### **noteContextStore.ts**
- Simple text note storage (minimal functionality)

---

## 3. FRONTEND API ROUTES & HOOKS

### API Routes (Next.js)

**POST /api/chat**
- Accepts: messages, paperContext
- Returns: streaming markdown response
- Uses: gpt-4o-mini with paper context injection
- Provider: OpenAI API

**POST /api/research/web-search**
- Accepts: query, paperContext
- Returns: streaming research output
- Uses: o1-mini deep research model (mentions in WebResearchNode)
- Provider: OpenAI API

### Frontend Hooks

**useMasDebate.ts**
```
State:
- status: 'idle' | 'generating_questions' | 'selecting_question' | 'generating_postures' | 'debating' | 'judging' | 'generating_report' | 'completed' | 'error'
- questions: string[]
- postures: string[]
- topics: string[]
- debaterProgress: DebaterProgress[]
- arguments: DebaterArgument[]
- verdict: JudgeVerdict
- report: DebateReport
- history: DebateHistoryEntry[]

Key Functions:
- fetchQuestions(paperId) - Step 1
- generatePostures(paperId, question) - Step 2
- runDebate(paperId, question, numPostures) - Steps 2-5
- loadDebateFromHistory(id)
- reset()

SSE Support: Yes, for streaming progress updates
```

**useWebSocket.ts**
- Socket.io client connection
- Canvas room joining (join_canvas, leave_canvas)
- Event emission/listening
- Auto-reconnect with exponential backoff

**useAgentStatus.ts**
- Listens to agent status changes
- Updates UI based on agent state

**useAgentEvents.ts**
- Subscribes to agent events from event bus
- Message history tracking

**useMasDebateApi.ts** - Not a hook, API client library
- generateQuestions(paperId)
- generatePostures(paperId, question)
- runDebateWithSSE(paperId, question, numPostures)
- Event streaming for progress

---

## 4. BACKEND STRUCTURE

### Controllers (Request Handlers)

**agentController.ts** (6.5KB)
- registerAgent(POST)
- deregisterAgent(DELETE)
- getAllAgents(GET)
- getAgent(GET) - by nodeId
- getAgentCapabilities(GET)
- updateAgentStatus(PATCH)
- searchByCapability(GET)
- getStats(GET)

**paperController.ts** (228 lines)
- uploadPaper(POST) - PDF handling
- getPaper(GET) - by paperId
- getAllPapers(GET)
- deletePaper(DELETE)
- Stores full text, metadata in database

**canvasController.ts** (5.2KB)
- createCanvas(POST)
- getCanvas(GET)
- updateCanvas(PATCH)
- deleteCanvas(DELETE)
- Stores nodes/edges as JSON

**masDebateController.ts** (277 lines)
- generateQuestions(POST) - uses PostureGenerator
- generatePosturesAndTopics(POST) - uses PostureGenerator
- runDebate(POST) - orchestrates entire debate pipeline
- runCompleteDebateFlow(POST) - questions + debate in one call
- SSE support for streaming progress

### Services (Business Logic)

**agentEventBus.ts** (251 lines) - EventEmitter-based singleton
```
Events:
- agent:invoke - RPC request
- agent:response - RPC response
- agent:registered - New agent registered
- agent:deregistered - Agent removed
- agent:status - Status change
- agent:error - Error occurred
- agent:broadcast - Broadcast message

Features:
- Type-safe event emission
- Event history (max 1000)
- Metrics per event type
- Correlation ID generation (nanoid)
- No external dependencies (pure EventEmitter)

Key Methods:
- emit(type, payload)
- on(type, handler)
- invoke(request) - emit agent:invoke
- onResponse(handler) - listen for responses
- statusChange(nodeId, status)
```

**agentOrchestrator.ts** (369 lines) - Coordination singleton
```
Responsibilities:
1. Route invocations between agents
2. Prevent circular dependencies
3. Manage timeouts (default 30s)
4. Cache results (LRU, 100 entries, 5min TTL)
5. Handle retries (exponential backoff, max 3)
6. Rate limit integration

Key Methods:
- invoke(params: AgentInvocationParams) - main entry point
- checkCircularDependency(from, to, context)
- checkConversationTurns(for debate detection)
- waitForResponse(requestId, timeout)
- handleResponse(response)

Circular Dependency Detection:
- Max call depth: 5
- Call stack tracking
- Bidirectional conversation limit
```

**agentRegistry.ts** (398 lines) - In-memory registry singleton
```
State:
- agents: Map<nodeId, AgentMetadata>
- agentsByType: Map<AgentType, Set<nodeId>>
- agentsByCapability: Map<toolName, Set<nodeId>>

Key Methods:
- registerAgent(metadata) - persists to database
- deregisterAgent(nodeId)
- getAgent(nodeId) / getAllAgents()
- getAgentsByType(type)
- findByCapability(toolName)
- getStats() - returns registry statistics

Auto-loads from database on startup
```

**agentCapability.ts** (499 lines) - Tool discovery service
```
Converts Zod schemas to JSON Schema format
Returns tools in OpenAI function calling format
Handles tool categorization and search
```

### Debate System Services (NEW)

Located in: `backend/src/services/debate/`

**BaseDebateAgent.ts** (89 lines)
- Abstract base for all debate agents
- OpenAI integration (gpt-4o-mini by default)
- Tool calling support
- Message history
- System prompt management
- JSON extraction from responses

**DebateCoordinator.ts** (7.3KB) - Orchestrates debate flow
```
Steps:
1. generateQuestions(paper) - FurtherQuestionsGenerator
2. generatePostures(paper, question) - PostureGenerator
3. runDebate(paper, question, postures) - Orchestrates debaters
4. judgeDebate(arguments, verdict) - JudgeAgent
5. generateReport(arguments, verdict) - ReporterAgent

Features:
- Shared topics across all debaters
- Progress callbacks for streaming updates
- Paper lookup/search tools available to agents
```

**DebaterAgent.ts** (8.2KB)
- Argues a SINGLE posture
- Addresses MULTIPLE shared topics
- Cites paper + web sources
- Responds to counterpoints
- Tools: lookupPaper, webSearch

**JudgeAgent.ts** (6.3KB)
- Evaluates debate arguments
- Configurable rubric (5 criteria: value, cohesiveness, relevance, clarity, engagement)
- Weighted scoring per debater
- Per-topic analysis
- Controversy detection

**ReporterAgent.ts** (3.8KB)
- Synthesizes debate results
- Ranks postures by score
- Extracts validated insights
- Identifies controversial points
- Generates markdown report

**FactCheckerAgent.ts** (12.4KB)
- Verifies claims made in debate
- Cross-references with paper content
- Fact extraction with confidence scores
- Contradiction detection
- Support/refute reasoning

**PostureGenerator.ts** (1.4KB)
- Generates 3 debate postures (Critic, Advocate, Synthesizer)
- Identifies topics from paper
- Creates guiding questions

**FurtherQuestionsGenerator.ts** (1.3KB)
- Generates research questions from paper
- Topic extraction
- Question prioritization

**webSearchService.ts** (1.9KB)
- Tavily API integration
- Web search for debate agents
- Configurable depth (free vs paid)

### Routes

**agentRoutes.ts** - Agent management endpoints
**paperRoutes.ts** - Paper CRUD endpoints
**canvasRoutes.ts** - Canvas CRUD endpoints
**capabilityRoutes.ts** - Tool discovery endpoint
**masDebateRoutes.ts** (41 lines) - Debate orchestration endpoints
```
POST /api/mas-debate/questions - Generate questions
POST /api/mas-debate/postures - Generate postures
POST /api/mas-debate/run - Run debate with SSE
POST /api/mas-debate/run-complete - Full flow with SSE
```

### WebSocket Server

**websocket.ts** - Socket.io setup
```
Rooms:
- canvas_{canvasId} - Per-canvas collaboration

Events:
- join_canvas - Connect to canvas room
- leave_canvas - Disconnect from canvas
- agent:status - Broadcast agent status
- agent:message - Broadcast agent message
- canvas:update - Canvas state sync

Features:
- Connection tracking per canvas
- Statistics aggregation
- Graceful shutdown
```

### Main Server

**index.ts** - Express app setup
```
Port: 4000
CORS: http://localhost:3001

Endpoints:
- GET /health - Server status + WebSocket stats
- GET /api - API info
- /api/canvas - Canvas routes
- /api/papers - Paper routes
- /api/agents - Agent routes
- /api/capabilities - Capability routes
- /api/mas-debate - Debate routes

Middleware:
- CORS enabled
- JSON body (50MB limit)
- Morgan logging
- Custom error handler for AgentError
```

---

## 5. DATABASE MODELS (Prisma)

### Core Models
- **User** - User accounts (email, name)
- **Canvas** - Canvas state (nodes, edges as JSON)
- **Paper** - Uploaded papers (title, authors, abstract, fullText, metadata)
- **Agent** - Agent registry (nodeId, agentType, capabilities, status)
- **AgentMessage** - Agent communications (from, to, content, confidence)
- **AgentInvocation** - Tool call tracking (invoker, target, toolName, params, result)
- **AgentCapability** - Normalized tool schemas (agentType, toolName, categories)
- **WebSearchResult** - Search cache with TTL

### Debate System Models
- **DebateSession** - Full debate workflow (status: initializing|debating|evaluating|completed)
- **Posture** - Debate position (debaterId, perspectiveTemplate, topics, guidingQuestions)
- **DebateTranscript** - Complete record with rounds
- **DebateRound** - Collection of exchanges (roundNumber, roundType: exposition|cross_examination)
- **DebateExchange** - Single communication (from, to, type: exposition|question|answer)
- **JudgeVerdict** - Evaluation result (criteria, scores, reasoning, verdict)

All models have proper indexes on frequently queried fields.

---

## 6. KEY FEATURES IMPLEMENTED

### Fully Implemented & Working

1. **PDF Upload & Parsing**
   - Client-side extraction using pdfjs-dist
   - Title, authors, full text extraction
   - Paper storage in Zustand store
   - ~12 page limit per paper

2. **Paper Context Propagation**
   - Paper-upload node connects to other nodes
   - PaperChatNode auto-detects connected papers
   - Paper context injected into API requests
   - Zustand store manages connections

3. **AI Chat with Paper Context**
   - OpenAI gpt-4o-mini integration
   - Paper title, authors, abstract injected as system prompt
   - Streaming markdown responses
   - Fallback responses on API error

4. **Web Research with Streaming**
   - OpenAI o1-mini deep research model
   - Query input with paper context
   - SSE streaming of progress updates
   - Abort signal support

5. **Multi-Agent Debate System** (NEW)
   ```
   Flow:
   1. Upload paper
   2. Auto-generate research questions
   3. Select question
   4. Generate 3 postures (perspectives)
   5. Identify shared topics
   6. 3 parallel debaters argue same topics from different angles
   7. Judge evaluates all arguments against rubric
   8. Reporter generates final markdown report
   9. Results displayed in MasDebateViewer
   10. History sidebar allows replay
   ```
   
   Features:
   - All debaters discuss SAME topics
   - DIFFERENT perspectives on each topic
   - Fact checking with evidence citations
   - Configurable rubric
   - Progress streaming via SSE
   - Debate history tracking

6. **React Flow Canvas**
   - 15 node types (5 input, 4 research, 5 agent, visualization stubs)
   - Drag-drop from toolbar
   - Edge-based paper context propagation
   - Zoom, pan, minimap
   - Keyboard shortcuts (Delete)
   - Node selection & metadata display

7. **Agent Infrastructure** (Framework only, not actively invoked from UI)
   - Agent registration & discovery
   - Rate limiting (token bucket)
   - Event bus for communication
   - Orchestrator with circular dependency detection
   - Result caching
   - Timeout management

8. **Database Persistence**
   - PostgreSQL with Prisma ORM
   - 8 core models + 6 debate models
   - Full schema with indexes
   - Canvas persistence (nodes/edges as JSON)

9. **WebSocket Real-time Communication**
   - Socket.io server setup
   - Canvas room management
   - Event broadcasting infrastructure
   - Statistics tracking

### Partially Implemented

1. **Agent Nodes** - UI exists but doesn't invoke backend agents
   - ResearcherAgentNode - Status display only
   - CriticAgentNode - Status display only
   - SynthesizerAgentNode - Status display only
   - QuestionGeneratorNode - Status display only
   - CitationTrackerNode - Status display only
   
2. **Canvas Persistence** - Schema complete, controllers exist, but no auto-save
   - Database models ready
   - CRUD endpoints implemented
   - Frontend triggers autosave (stub)
   - No actual save on node changes

3. **Real-time Updates** - WebSocket infrastructure ready
   - Server accepts connections
   - Canvas room joins work
   - Event broadcasting available
   - Frontend hooks partially integrated
   - Status updates not fully wired

### Not Implemented

1. **User Authentication** - No auth system
2. **Agent-to-Agent Communication in UI** - Backend supports, UI doesn't trigger
3. **Visualization Nodes** - Render as BaseNode only, no actual visualizations
4. **Citation Graph** - Not rendered
5. **Results Visualization** - Not rendered
6. **Multi-canvas Collaboration** - Infrastructure ready, not integrated in UI

---

## 7. NODE TYPES REFERENCE

| Node Type | Category | Input? | Output? | Implementation |
|-----------|----------|--------|--------|-----------------|
| paper-upload | input | ✓ | ✓ | Fully working (PDF parsing) |
| note | input | ✓ | ✓ | Fully working (text input) |
| paper-chat | research | ✓ | ✓ | Fully working (OpenAI chat) |
| web-research | research | ✓ | ✓ | Fully working (O1-mini) |
| debate | research | ✓ | ✓ | Fully working (MAS debate) |
| researcher-agent | agent | ✓ | ✓ | UI only (no backend invoke) |
| critic-agent | agent | ✓ | ✓ | UI only (no backend invoke) |
| synthesizer-agent | agent | ✓ | ✓ | UI only (no backend invoke) |
| question-generator | agent | ✓ | ✓ | UI only (no backend invoke) |
| citation-tracker | agent | ✓ | ✓ | UI only (no backend invoke) |
| citation-graph | visualization | ✓ | ✗ | BaseNode stub |
| summary | visualization | ✓ | ✓ | BaseNode stub |
| methodology | visualization | ✓ | ✓ | BaseNode stub |
| results-visualization | visualization | ✓ | ✗ | BaseNode stub |
| insight-report | visualization | ✓ | ✗ | BaseNode stub |

---

## 8. RECENT CHANGES ON UI BRANCH

Changes from main → ui:

1. **PDF Viewer Enhancement** - New component in `/frontend/components/pdf/PDFViewer.tsx`
   - Uses react-pdf library
   - Text selection with floating "Ask" button
   - Page-by-page rendering

2. **Debate System Refinements** (in backend/src/services/debate/)
   - DebateCoordinator improvements
   - FactCheckerAgent enhancements
   - Better progress reporting

3. **MasDebateController Updates** - SSE streaming improvements
4. **Test Debate Flow** - Added backend test scripts

Main branch focus: Core architecture
UI branch focus: Better debate UX + PDF viewer

---

## 9. TECHNOLOGY STACK SUMMARY

### Frontend
- **Framework**: Next.js 16 (Turbopack)
- **React**: 19.2.0
- **Canvas**: @xyflow/react 12.8.5
- **State**: Zustand 5.0.8
- **PDF**: react-pdf 9.2.1 + pdfjs-dist 4.8.69
- **API**: OpenAI 6.7.0
- **Real-time**: Socket.io-client 4.8.1
- **Styling**: Tailwind CSS 3.4.0 + shadcn/ui
- **Markdown**: react-markdown + remark-gfm

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express
- **WebSocket**: Socket.io 4.8.1
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6.16.0+
- **API**: OpenAI SDK
- **Utilities**: nanoid, express-cors, morgan, dotenv

### Architecture
- **Agent Comm**: Custom EventEmitter (NOT Redis/BullMQ)
- **Orchestration**: Custom singleton pattern (NOT LangGraph)
- **Rate Limiting**: Token bucket algorithm
- **Build**: Turborepo with monorepo

---

## 10. CRITICAL INTEGRATION POINTS

### Paper Context Flow
```
PaperUploadNode (PDF select)
  ↓ (text selection triggers)
PaperChatNode (created dynamically)
  ↓ (connectNodeToPaper via edge)
usePaperContextStore.getPaperForNode()
  ↓ (injected into /api/chat)
OpenAI gpt-4o-mini (with paper context)
  ↓
Markdown response in UI
```

### Debate Flow
```
MasDebateNode (paper connected)
  ↓ (auto-fetch questions)
/api/mas-debate/questions (PostureGenerator)
  ↓ (select question)
/api/mas-debate/run (DebateCoordinator)
  ↓ (parallel debaters)
Debater 1, Debater 2, Debater 3 (DebaterAgent)
  ↓ (all agents)
JudgeAgent (evaluates all arguments)
  ↓
ReporterAgent (generates markdown)
  ↓
MasDebateViewer (displays with tabs per topic)
```

### WebSocket Connection
```
Frontend (Socket.io client)
  ↓ (auto-connect on mount)
Backend WebSocket server (initializeWebSocket)
  ↓ (listen for join_canvas)
Per-canvas room (canvas_{canvasId})
  ↓ (broadcast events)
All connected clients in room
```

---

## 11. FILE ORGANIZATION

```
MEF-Labs-hack-nation/
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts (OpenAI chat)
│   │   │   └── research/web-search/route.ts (Deep research)
│   │   ├── page.tsx (Main page wrapper)
│   │   ├── layout.tsx
│   │   └── debug/page.tsx
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── EnhancedCanvas.tsx (Main canvas)
│   │   │   ├── EnhancedToolbar.tsx (Node palette)
│   │   │   ├── SimpleCanvas.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── CanvasControls.tsx
│   │   │   ├── ConnectionLine.tsx
│   │   │   └── SimpleControls.tsx
│   │   ├── nodes/ (15 node types)
│   │   │   ├── PaperUploadNode.tsx (PDF parser)
│   │   │   ├── PaperChatNode.tsx (OpenAI chat)
│   │   │   ├── WebResearchNode.tsx (Deep research)
│   │   │   ├── MasDebateNode.tsx (Multi-agent debate)
│   │   │   ├── [5 Agent nodes]
│   │   │   ├── BaseNode.tsx
│   │   │   └── PDFViewer.tsx (PDF render)
│   │   ├── debate/
│   │   │   └── MasDebateViewer.tsx (Results display)
│   │   ├── pdf/
│   │   │   └── PDFViewer.tsx (New PDF component)
│   │   ├── providers/
│   │   │   ├── ReactFlowProvider.tsx
│   │   │   └── WebSocketProvider.tsx
│   │   ├── ui/ (shadcn/ui components)
│   │   └── debug/
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── agentStore.ts (Zustand)
│   │   │   ├── paperContextStore.ts (Zustand)
│   │   │   ├── canvasStore.ts (Zustand)
│   │   │   └── noteContextStore.ts
│   │   ├── hooks/
│   │   │   ├── useMasDebate.ts (Debate state)
│   │   │   ├── useWebSocket.ts (Socket.io)
│   │   │   ├── useAgentEvents.ts
│   │   │   └── useAgentStatus.ts
│   │   ├── api/
│   │   │   └── masDebateApi.ts (API client)
│   │   ├── nodeComponents.tsx (Registry)
│   │   ├── nodeTypes.ts (Configuration)
│   │   └── utils.ts
│   └── package.json

├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── agentController.ts (Registration)
│   │   │   ├── paperController.ts (Paper CRUD)
│   │   │   ├── canvasController.ts (Canvas CRUD)
│   │   │   └── masDebateController.ts (Debate flow)
│   │   ├── routes/
│   │   │   ├── agentRoutes.ts
│   │   │   ├── paperRoutes.ts
│   │   │   ├── canvasRoutes.ts
│   │   │   ├── capabilityRoutes.ts
│   │   │   └── masDebateRoutes.ts
│   │   ├── services/
│   │   │   ├── agentEventBus.ts (EventEmitter)
│   │   │   ├── agentOrchestrator.ts (Coordination)
│   │   │   ├── agentRegistry.ts (Discovery)
│   │   │   ├── agentCapability.ts (Tool schemas)
│   │   │   └── debate/
│   │   │       ├── BaseDebateAgent.ts
│   │   │       ├── DebateCoordinator.ts (Orchestrator)
│   │   │       ├── DebaterAgent.ts
│   │   │       ├── JudgeAgent.ts
│   │   │       ├── ReporterAgent.ts
│   │   │       ├── FactCheckerAgent.ts
│   │   │       ├── PostureGenerator.ts
│   │   │       ├── FurtherQuestionsGenerator.ts
│   │   │       └── webSearchService.ts
│   │   ├── types/
│   │   │   ├── agent.types.ts (MCP-like protocol)
│   │   │   └── debate.types.ts (Debate types)
│   │   ├── lib/
│   │   │   ├── prisma.ts (Client)
│   │   │   ├── rateLimiter.ts (Token bucket)
│   │   │   └── websocket.ts (Socket.io)
│   │   ├── scripts/ (Testing)
│   │   │   └── [test/debug scripts]
│   │   └── index.ts (Express server)
│   ├── prisma/
│   │   └── schema.prisma (8+6 models)
│   └── package.json

├── docker-compose.yml (PostgreSQL)
├── turbo.json (Turborepo)
├── package.json (Monorepo)
├── CLAUDE.md (This file - original)
├── ACTION_PLAN.md (Implementation roadmap)
├── DEBATE_SYSTEM_SUMMARY.md (Debate architecture)
└── HACKATHON_PAPER_CANVAS_BLUEPRINT.md (Requirements)
```

---

## 12. WHAT'S ACTUALLY IMPLEMENTED VS PLANNED

### Phase 1-2: Core Foundation ✓ 100%
- Express server
- PostgreSQL + Prisma
- WebSocket setup
- Event bus
- Rate limiting
- Agent registry

### Phase 3: Canvas System ✓ 100%
- React Flow integration
- 15 node types defined
- Drag-drop interface
- Custom edges
- Node selection

### Phase 4: Paper System ✓ 100%
- PDF upload (client-side parsing)
- Paper storage
- Context propagation
- Paper metadata extraction

### Phase 5: Chat & Research ✓ 100%
- OpenAI chat integration (gpt-4o-mini)
- Web research node (o1-mini)
- Streaming responses
- Markdown rendering

### Phase 6: Debate System ✓ 100% (NEW on UI branch)
- Question generation
- Posture generation
- Multi-agent debate (3 perspectives)
- Judge evaluation
- Report generation
- History tracking
- SSE streaming

### Phase 7: Agent Nodes ⚠️ 30%
- UI exists (ResearcherAgent, CriticAgent, etc.)
- No backend invocation from UI
- Backend infrastructure ready but unused

### Phase 8: Visualization ⚠️ 0%
- Nodes defined
- Render as BaseNode stubs
- No actual visualizations

### Phase 9: Persistence ⚠️ 30%
- Database schema complete
- CRUD endpoints implemented
- No auto-save trigger
- Manual save possible but not wired

### Phase 10: Real-time Collab ⚠️ 20%
- WebSocket server running
- Room management ready
- Event broadcasting infrastructure
- Frontend integration minimal

### Phases 11-12: Auth, Advanced Features ✗ 0%
- No authentication
- No user accounts
- No multi-user support

---

## 13. KNOWN GAPS & OPPORTUNITIES

### Critical Gaps
1. **Agent Invocation Gap** - UI nodes don't call backend agents
   - Nodes created but non-functional
   - Backend infrastructure idle
   - Fix: Add API call buttons to agent nodes

2. **Canvas Persistence Gap** - No auto-save
   - Zustand store not synced to DB
   - Would require timer + POST to /api/canvas
   - Users lose work on refresh

3. **Visualization Gap** - Chart/graph nodes are stubs
   - No Citation Graph rendering
   - No Results Visualization
   - Could use D3.js or Plotly (both in dependencies!)

### Optimization Opportunities
1. **Caching** - Agent responses cached in orchestrator (5min TTL, 100 entries)
   - Could be improved with Redis for multi-instance
   - Current in-memory only

2. **Real-time Updates** - WebSocket ready but underutilized
   - Could broadcast debate progress to all clients
   - Could sync canvas changes in real-time

3. **Rate Limiting** - Token bucket working
   - Could expose UI indicators for rate limit status
   - Could warn users before hitting limit

### Technical Debt
1. **Type Safety** - Mix of strict types and any
2. **Error Handling** - Some fallbacks hardcoded
3. **Testing** - No test suite present
4. **Documentation** - Code well-commented, but no user docs

---

## 14. DEPLOYMENT & RUNNING

```bash
# Install
pnpm install

# Start PostgreSQL
docker-compose up -d

# Prisma setup
pnpm prisma:generate
pnpm prisma:migrate

# Development
pnpm dev  # Both frontend & backend
# OR
cd frontend && pnpm dev  # Frontend only (localhost:3000)
cd backend && pnpm dev   # Backend only (localhost:4000)

# Production build
pnpm build

# Environment variables needed:
# Backend: DATABASE_URL, OPENAI_API_KEY, TAVILY_API_KEY (optional), PORT
# Frontend: NEXT_PUBLIC_API_URL
```

---

## 15. SUMMARY TABLE

| Aspect | Status | Quality | Notes |
|--------|--------|---------|-------|
| **Architecture** | Mature | High | Custom, lightweight, no external dependencies for events |
| **Frontend UI** | Complete | High | 15 node types, smooth interactions, good UX |
| **Paper Handling** | Complete | High | Client-side PDF parsing, full text extraction |
| **Chat System** | Complete | High | OpenAI integrated, context injection working |
| **Web Research** | Complete | High | Streaming responses, paper context aware |
| **Debate System** | Complete | High | NEW - Multi-perspective analysis, fact-checking |
| **Database** | Complete | High | Comprehensive schema, proper indexing |
| **Agent Framework** | Complete | Medium | Infrastructure ready, UI integration incomplete |
| **Canvas UI** | Complete | High | React Flow working smoothly |
| **Canvas Persistence** | Partial | Medium | Schema done, save logic incomplete |
| **Real-time Collab** | Partial | Low | Infrastructure ready, UI integration minimal |
| **Visualization Nodes** | Planned | Low | Defined but not implemented |
| **Authentication** | Missing | N/A | No auth system |
| **Testing** | Missing | N/A | No test suite |

---

**Overall Assessment**: 
Production-ready core (debate, chat, research). Agent framework foundation strong but unused. UI complete and polished. Main opportunity: connect agent nodes to backend for true multi-agent capabilities.

---

