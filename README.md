# Research Agent Canvas

A visual, node-based platform for AI-powered collaborative research paper analysis. Build intelligent workflows by connecting specialized nodes that analyze, debate, and synthesize insights from scientific papers using multi-agent systems.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black)
![React](https://img.shields.io/badge/React-19.2.0-blue)

## Overview

Research Agent Canvas transforms research paper analysis into an interactive, visual experience. Instead of traditional linear workflows, researchers can create dynamic analysis pipelines by dragging nodes onto a canvas and connecting them to share context and insights.

The platform leverages multiple specialized AI agents that can work independently or collaborate through debates, providing diverse perspectives on research questions and helping researchers uncover insights they might have missed.

## Key Features

### Visual Node-Based Interface
- **14 Node Types** organized in 4 categories: Input, Research, Agent, and Visualization
- **Drag-and-drop** workflow creation with automatic context propagation
- **Live connection** system that automatically shares data between connected nodes
- **Real-time updates** with streaming responses and live debate visualization

### Multi-Agent Debate System
The standout feature of the platform is the Academic Debate node, which orchestrates multi-agent debates:
- **3 AI Agents** with different perspectives debate research questions simultaneously
- **Real-time streaming** of arguments, questions, and responses across all agents
- **Multiple Q&A rounds** where agents cross-examine each other's positions
- **Automated judging** with detailed scoring, rankings, and consensus findings
- **Full transcript export** in markdown format with all arguments and evaluations

### Intelligent Context Sharing
Nodes automatically share context when connected:
- **Paper Upload → Chat**: Ask questions about specific papers with full text context
- **Debate → Chat**: Query debate results and explore different perspectives
- **Chat → Chat**: Build conversation chains that reference previous discussions
- All context sharing happens automatically through the visual connections

### Specialized AI Agents
- **Researcher Agent**: Deep analysis, claim extraction, methodology review
- **Critic Agent**: Validates claims, identifies biases and weaknesses
- **Synthesizer Agent**: Merges multiple analyses and resolves conflicts
- **Question Generator**: Creates research questions and suggests experiments
- **Citation Tracker**: Verifies citations and builds citation networks

### PDF Processing
- **Client-side extraction** using pdf.js (no server upload required)
- **Automatic parsing** of title, authors, abstract, and full text
- **Metadata extraction** from paper structure
- Supports papers up to 12 pages for optimal performance

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.0.1 | React framework with Turbopack |
| **React** | 19.2.0 | UI library |
| **TypeScript** | 5.9.3 | Type safety |
| **@xyflow/react** | 12.8.5 | Visual canvas and node system |
| **Zustand** | 5.0.8 | State management |
| **Tailwind CSS** | 3.4.0 | Styling |
| **shadcn/ui** | - | UI component library |
| **pdfjs-dist** | 4.8.69 | PDF text extraction |
| **Socket.io Client** | 4.8.1 | WebSocket communication |
| **React Markdown** | 10.1.0 | Markdown rendering |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ≥20.0.0 | Runtime environment |
| **Express** | 4.21.2 | Web framework |
| **TypeScript** | 5.9.3 | Type safety |
| **PostgreSQL** | 16 | Database |
| **Prisma** | 6.16.0 | ORM and migrations |
| **OpenAI API** | 6.7.0 | AI language models |
| **Socket.io** | 4.8.1 | WebSocket server |
| **Zod** | 3.23.8 | Schema validation |

### Development Tools
- **pnpm** 9.15.0 - Fast, disk space efficient package manager
- **Turbo** 2.6.0 - Monorepo build system
- **tsx** 4.15.6 - TypeScript execution for Node.js
- **Docker** - PostgreSQL containerization

## Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────────┐
│                 Next.js App                      │
│  ┌───────────────────────────────────────────┐  │
│  │         React Flow Canvas                  │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐       │  │
│  │  │ Paper  │──│  Chat  │──│ Debate │       │  │
│  │  │ Upload │  │  Node  │  │  Node  │       │  │
│  │  └────────┘  └────────┘  └────────┘       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         Zustand State Stores               │  │
│  │  • paperContextStore                       │  │
│  │  • debateContextStore                      │  │
│  │  • chatContextStore                        │  │
│  │  • canvasStore                             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
              │
              │ WebSocket / HTTP
              ▼
┌─────────────────────────────────────────────────┐
│              Express Backend                     │
│  ┌───────────────────────────────────────────┐  │
│  │       Debate Coordinator                   │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  PostureGenerator → DebaterAgent    │  │  │
│  │  │  QuestionerAgent ⇄ ResponseAgent    │  │  │
│  │  │  JudgeAgent → ReporterAgent         │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         PostgreSQL (Prisma)                │  │
│  │  • Papers, Canvas, Debates                 │  │
│  │  • Agent registry and messages             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### State Management

The frontend uses **Zustand** stores for different contexts:

- **`paperContextStore`**: Manages uploaded papers and paper-to-node connections
- **`debateContextStore`**: Stores debate results and debate-to-node connections
- **`chatContextStore`**: Manages chat history and upstream conversation chains
- **`canvasStore`**: Canvas state including nodes, edges, and viewport

### Real-time Communication

- **Server-Sent Events (SSE)**: Backend streams debate progress to frontend
- **WebSocket (Socket.io)**: Real-time collaboration and canvas updates
- **Custom hooks**: `useMasDebate` handles debate lifecycle and streaming state

### Multi-Agent Debate Flow

```
1. PostureGenerator
   └─> Creates 3 debate positions with specific topics and questions

2. Initial Arguments (Parallel)
   ├─> DebaterAgent (Posture 1) generates argument
   ├─> DebaterAgent (Posture 2) generates argument
   └─> DebaterAgent (Posture 3) generates argument

3. Q&A Rounds (Sequential, 3 rounds)
   ├─> Round 1
   │   ├─> QuestionerAgent (each debater asks questions to others)
   │   └─> ResponseAgent (each debater responds)
   ├─> Round 2
   │   ├─> QuestionerAgent
   │   └─> ResponseAgent
   └─> Round 3
       ├─> QuestionerAgent
       └─> ResponseAgent

4. Judging
   └─> JudgeAgent evaluates all arguments and exchanges
       └─> Produces scores, rankings, and detailed verdict

5. Report Generation
   └─> ReporterAgent creates final markdown report
       └─> Includes full transcript and downloadable document
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** 9.15.0 (required - do not use npm or yarn)
- **Docker** (for PostgreSQL)
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/research-agent-canvas.git
   cd research-agent-canvas
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   Create `backend/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/research_canvas?schema=public"
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=4000
   ```

4. **Start PostgreSQL**
   ```bash
   docker-compose up -d
   ```

5. **Initialize the database**
   ```bash
   cd backend
   pnpm prisma generate
   pnpm prisma migrate dev
   cd ..
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

   This starts both servers in parallel using Turbo:
   - **Frontend**: http://localhost:3000
   - **Backend**: http://localhost:4000

## Project Structure

```
research-agent-canvas/
├── frontend/                      # Next.js application
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/             # Chat API route with context support
│   │   ├── page.tsx              # Main canvas page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── canvas/
│   │   │   └── EnhancedCanvas.tsx # Main canvas component
│   │   ├── nodes/                # All 14 node implementations
│   │   │   ├── PaperUploadNode.tsx
│   │   │   ├── PaperChatNode.tsx
│   │   │   ├── MasDebateNode.tsx
│   │   │   ├── NoteNode.tsx
│   │   │   ├── WebResearchNode.tsx
│   │   │   ├── ResearcherAgentNode.tsx
│   │   │   ├── CriticAgentNode.tsx
│   │   │   ├── SynthesizerAgentNode.tsx
│   │   │   ├── QuestionGeneratorNode.tsx
│   │   │   └── CitationTrackerNode.tsx
│   │   ├── debate/               # Debate visualization
│   │   │   ├── LiveDebateView.tsx
│   │   │   └── DebateTranscriptViewer.tsx
│   │   ├── pdf/                  # PDF viewing components
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── stores/               # Zustand state management
│   │   │   ├── paperContextStore.ts
│   │   │   ├── debateContextStore.ts
│   │   │   ├── chatContextStore.ts
│   │   │   ├── canvasStore.ts
│   │   │   └── noteContextStore.ts
│   │   ├── hooks/
│   │   │   ├── useMasDebate.ts   # Debate lifecycle hook
│   │   │   └── useWebSocket.ts
│   │   ├── api/                  # API client functions
│   │   └── nodeTypes.ts          # Node type definitions
│   └── package.json
│
├── backend/                       # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── paperController.ts
│   │   │   ├── canvasController.ts
│   │   │   ├── masDebateController.ts
│   │   │   └── agentController.ts
│   │   ├── services/
│   │   │   └── debate/           # Multi-agent debate system
│   │   │       ├── DebateCoordinator.ts    # Orchestrates debates
│   │   │       ├── PostureGenerator.ts     # Creates debate positions
│   │   │       ├── DebaterAgent.ts         # Generates arguments
│   │   │       ├── QuestionerAgent.ts      # Asks questions
│   │   │       ├── ResponseAgent.ts        # Responds to questions
│   │   │       ├── JudgeAgent.ts           # Evaluates arguments
│   │   │       └── ReporterAgent.ts        # Creates final report
│   │   ├── lib/
│   │   │   ├── agents/           # Specialized research agents
│   │   │   ├── prisma.ts
│   │   │   └── websocket.ts
│   │   ├── routes/
│   │   │   ├── paperRoutes.ts
│   │   │   ├── canvasRoutes.ts
│   │   │   └── masDebateRoutes.ts
│   │   ├── types/                # TypeScript definitions
│   │   └── index.ts              # Express server
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── package.json
│
├── docker-compose.yml             # PostgreSQL container
├── turbo.json                     # Monorepo configuration
└── package.json                   # Root package.json
```

## Available Node Types

### Input Nodes (Blue)
- **Paper Upload**: Upload PDF files and extract text, metadata, and structure
- **Note**: Create markdown notes and annotations

### Research Nodes (Green)
- **Paper Chat**: Interactive AI conversation with paper context
- **Web Research**: AI-powered web research with streaming responses
- **Academic Debate**: Multi-agent debate system with 3 perspectives

### Agent Nodes (Purple)
- **Researcher Agent**: Deep analysis and evidence extraction
- **Critic Agent**: Claim validation and bias identification
- **Synthesizer Agent**: Analysis merging and conflict resolution
- **Question Generator**: Research question generation
- **Citation Tracker**: Citation verification and network analysis

### Visualization Nodes (Orange)
- **Citation Graph**: Citation network visualization
- **Summary**: Paper summary generation
- **Methodology**: Methodology extraction and analysis
- **Results Visualization**: Research results visualization
- **Insight Report**: Collective insights and findings

## Core Features

### 1. PDF Processing Pipeline

```typescript
// Client-side extraction in PaperUploadNode.tsx
1. User uploads PDF → File API
2. pdfjs loads document → ArrayBuffer
3. Extract text from pages (limit: 12 pages)
4. Parse metadata (title, authors, abstract)
5. Store in paperContextStore
6. Automatically connect to downstream nodes
```

### 2. Multi-Agent Debate Workflow

```typescript
// Complete debate flow
1. Upload paper → Auto-generate questions
2. Select questions to debate (1-5)
3. System generates 3 debate postures
4. Initial arguments (parallel streaming)
5. Q&A rounds (3 rounds of cross-examination)
6. Judge evaluation with detailed scores
7. Final report with rankings and consensus
8. Download full transcript in markdown
```

### 3. Context Propagation

When you connect nodes, context flows automatically:

```
Paper Upload Node (Paper ID: abc123)
         │
         ├──> Chat Node (receives: paper.fullText, paper.abstract)
         │
         └──> Debate Node (receives: paper data)
                   │
                   └──> Chat Node (receives: debate.markdown, debate.questions)
```

### 4. Real-time Streaming

All AI responses stream in real-time:
- **Chat messages**: Token-by-token streaming
- **Debate arguments**: Live argument generation from 3 agents simultaneously
- **Q&A exchanges**: Live question and response streaming
- **Progress updates**: Real-time status updates for all operations

## API Endpoints

### Papers
```
POST   /api/papers              Upload a paper
GET    /api/papers/:id          Get paper details
DELETE /api/papers/:id          Delete a paper
```

### Canvas
```
POST   /api/canvas              Create/update canvas
GET    /api/canvas/:id          Get canvas state
DELETE /api/canvas/:id          Delete canvas
```

### Multi-Agent Debate
```
POST   /api/mas-debate/questions        Generate questions from paper
POST   /api/mas-debate/postures         Generate debate postures
POST   /api/mas-debate/run-enhanced     Run multi-question debate (SSE)
```

### Chat
```
POST   /api/chat                Chat with AI (supports paper, debate, chat context)
```

## Database Schema

The system uses PostgreSQL with Prisma ORM. Main models:

| Model | Purpose |
|-------|---------|
| **User** | User accounts (future auth) |
| **Canvas** | Canvas state (nodes, edges as JSON) |
| **Paper** | Research papers with full text |
| **Agent** | Agent registry and capabilities |
| **AgentMessage** | Agent-to-agent communications |
| **AgentInvocation** | Tool call tracking and results |
| **DebateSession** | Debate metadata and settings |
| **Posture** | Debate postures and topics |
| **DebateTranscript** | Full debate transcripts |
| **DebateRound** | Individual Q&A rounds |
| **DebateExchange** | Question-response pairs |
| **JudgeVerdict** | Judge evaluations and scores |

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start both frontend and backend
pnpm build            # Build both applications
pnpm type-check       # Type check all workspaces
pnpm lint             # Lint all workspaces

# Database
cd backend
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run migrations
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:seed      # Seed database

# Docker
docker-compose up -d  # Start PostgreSQL
docker-compose down   # Stop PostgreSQL
docker-compose logs   # View logs
```

### Development Workflow

1. **Make changes** to frontend or backend code
2. **Hot reload** is enabled for both servers
3. **Type check** with `pnpm type-check`
4. **Database changes**:
   ```bash
   cd backend
   # Edit prisma/schema.prisma
   pnpm prisma migrate dev --name your_migration_name
   pnpm prisma generate
   ```

### Environment Variables

**Frontend (`frontend/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
OPENAI_API_KEY=your_key_here
```

**Backend (`backend/.env`)**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/research_canvas?schema=public"
OPENAI_API_KEY=your_key_here
PORT=4000
NODE_ENV=development
```

## How to Use

### Basic Workflow

1. **Upload a Paper**
   - Drag a "Paper Upload" node onto the canvas
   - Click to upload a PDF file
   - Wait for text extraction

2. **Chat About the Paper**
   - Drag a "Paper Chat" node
   - Connect Paper Upload → Paper Chat
   - Start asking questions

3. **Run a Debate**
   - Drag an "Academic Debate" node
   - Connect Paper Upload → Debate
   - Select questions and click "Start Debate"
   - Watch the live debate unfold

4. **Ask About Debate Results**
   - Drag another "Paper Chat" node
   - Connect Debate → Chat
   - Ask questions about the debate findings

### Advanced Workflows

**Multi-step Analysis**
```
Paper Upload → Researcher Agent → Critic Agent → Synthesizer → Chat
```

**Debate + Analysis**
```
Paper Upload → Debate → Chat (ask about debate)
            ↓
            → Researcher Agent → Note (document findings)
```

**Citation Analysis**
```
Paper Upload → Citation Tracker → Citation Graph
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint with TypeScript rules
- **Commits**: Clear, descriptive commit messages

## Troubleshooting

### Common Issues

**Database connection fails**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose down
docker-compose up -d
```

**Frontend can't connect to backend**
```bash
# Verify NEXT_PUBLIC_API_URL in frontend/.env.local
# Check backend is running on port 4000
curl http://localhost:4000/health
```

**Prisma client errors**
```bash
cd backend
pnpm prisma generate
pnpm prisma migrate dev
```

**pnpm install fails**
```bash
# Clear node_modules and lock files
rm -rf node_modules frontend/node_modules backend/node_modules
rm pnpm-lock.yaml

# Reinstall
pnpm install
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built for the **MEF Labs Hack Nation** hackathon
- Powered by **OpenAI API** for AI language models
- UI components from **shadcn/ui**
- Icons from **Lucide React**
- Canvas system powered by **@xyflow/react** (React Flow)
- PDF processing with **pdf.js**

## Support

For questions or issues:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

---

**Built for researchers, by researchers**
