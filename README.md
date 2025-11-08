# Research Agent Canvas

Visual multi-agent AI system for collaborative scientific paper analysis where agents can discover, call, and use each other as tools (MCP-like architecture).

## Tech Stack

### Frontend
- Next.js 16.0.0 with App Router
- React 19.2.0
- TypeScript 5.9.3
- shadcn/ui (Radix UI primitives)
- @xyflow/react 12.8.5 (canvas system)
- Zustand 5.0.8 (state management)
- Tailwind CSS 4.0
- Socket.io-client 4.8.1

### Backend
- Node.js >=20.0.0
- Express 4.21.2
- PostgreSQL 16 (Docker)
- Prisma ORM 6.16.0
- OpenAI 6.7.0 (GPT-4o-mini)
- Socket.io 4.8.1
- Custom EventEmitter-based agent orchestration

### Agent Communication
- Node.js EventEmitter (in-process event bus)
- WebSocket (Socket.io) for real-time UI updates
- JSON-RPC 2.0 style messaging
- Zod 3.23.8 for schema validation
- Custom orchestrator with cycle detection

## Prerequisites

- Node.js >=20.0.0
- pnpm 9.15.0 (required)
- Docker 24+ and Docker Compose 2+
- OpenAI API key
- Tavily API key (for web search)

## Quick Start

### 1. Clone and Install

```bash
# Install pnpm globally if you haven't
npm install -g pnpm@9.15.0

# Install dependencies
pnpm install
```

### 2. Setup Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your API keys:
# - OPENAI_API_KEY
# - TAVILY_API_KEY

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Start Database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Wait for database to be healthy
docker-compose ps
```

### 4. Setup Prisma

```bash
# Generate Prisma client
cd backend
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# (Optional) Seed database
pnpm prisma:seed
```

### 5. Start Development Servers

```bash
# From root directory, start both frontend and backend
pnpm dev

# Or start them separately:
# Terminal 1 - Frontend (http://localhost:3000)
cd frontend
pnpm dev

# Terminal 2 - Backend (http://localhost:4000)
cd backend
pnpm dev
```

## Project Structure

```
research-agent-canvas/
├── frontend/              # Next.js 16 App
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   │   ├── canvas/       # Canvas components
│   │   ├── nodes/        # Node types (13 types)
│   │   └── ui/           # shadcn/ui components
│   └── lib/              # Utilities, stores, hooks
│       ├── stores/       # Zustand stores
│       ├── hooks/        # Custom hooks
│       └── api/          # API client
├── backend/              # Express API
│   ├── src/
│   │   ├── index.ts      # Entry point
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   │   ├── agentRegistry.ts    # Agent discovery
│   │   │   ├── agentOrchestrator.ts # Agent coordination
│   │   │   └── agentEventBus.ts    # EventEmitter bus
│   │   └── lib/
│   │       └── agents/   # 6 specialized AI agents
│   └── prisma/
│       └── schema.prisma # Database schema
├── docker-compose.yml    # PostgreSQL container
├── turbo.json           # Turborepo config
└── pnpm-workspace.yaml  # pnpm workspace
```

## Available Scripts

### Root Level
- `pnpm dev` - Start both frontend and backend
- `pnpm build` - Build both apps
- `pnpm lint` - Lint all workspaces
- `pnpm type-check` - Type check all workspaces
- `pnpm clean` - Clean all build artifacts

### Frontend
- `pnpm dev` - Start dev server (port 3000)
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint

### Backend
- `pnpm dev` - Start dev server with hot reload (port 4000)
- `pnpm build` - Build TypeScript to dist/
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio GUI

## Database

### Schema Overview

The database includes 8 models:
1. **User** - User accounts
2. **Canvas** - Research canvas state (nodes + edges)
3. **Paper** - Uploaded research papers with metadata
4. **Agent** - Registry of active agents and capabilities
5. **AgentMessage** - Agent communications and reasoning
6. **AgentInvocation** - Agent-to-agent tool calls
7. **AgentCapability** - Tool schemas by agent type
8. **WebSearchResult** - Cached web search results

### Prisma Commands

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Create and apply a new migration
pnpm prisma:migrate

# Open Prisma Studio (database GUI)
pnpm prisma:studio

# Reset database (⚠️ deletes all data)
pnpm prisma migrate reset
```

## Agent Communication Architecture

The system uses a custom MCP-like protocol:

1. **Agent Registry** - In-memory Map of active agents
2. **EventEmitter Bus** - Zero-dependency event system
3. **Orchestrator** - Routes invocations, prevents cycles
4. **WebSocket** - Real-time UI updates via Socket.io

### Agent Types

1. **Researcher** - Deep analysis, extracts claims/evidence
2. **Critic** - Validates claims, identifies weaknesses
3. **Synthesizer** - Merges analyses, resolves conflicts
4. **Question Generator** - Generates research questions
5. **Citation Tracker** - Verifies citations, builds graphs
6. **Web Research** - Searches academic databases

## Docker Services

### PostgreSQL
- Image: `postgres:16-alpine`
- Port: `5432`
- Database: `research_canvas`
- User: `canvas_user`
- Password: `canvas_password` (change in production!)

### Managing Docker

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker-compose logs -f postgres

# Remove all data (⚠️ destructive)
docker-compose down -v
```

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://canvas_user:canvas_password@localhost:5432/research_canvas

# AI APIs
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...

# Server
PORT=4000
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret_change_in_production
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Port Already in Use
```bash
# Frontend (3000)
# Change port: PORT=3001 pnpm dev

# Backend (4000)
# Change in backend/.env: PORT=4001
```

### Prisma Issues
```bash
# Regenerate Prisma client
cd backend
pnpm prisma:generate

# If migrations fail, reset database
pnpm prisma migrate reset
```

## Development Workflow

1. **Make schema changes** → Update `backend/prisma/schema.prisma`
2. **Create migration** → `pnpm prisma:migrate`
3. **Generate client** → `pnpm prisma:generate`
4. **Update backend types** → TypeScript will auto-detect changes
5. **Restart dev server** → `pnpm dev`

## Next Steps

See [ACTION_PLAN.md](./ACTION_PLAN.md) for the complete implementation roadmap.

**Phase 1** (Current): Infrastructure Setup ✅
- [x] Monorepo structure
- [x] Docker & Database
- [x] Environment configuration
- [x] Prisma schema

**Phase 2** (Next): Agent Communication Layer
- [ ] Agent Registry & Discovery
- [ ] EventEmitter Orchestration
- [ ] WebSocket Real-time Updates

## License

MIT

## Contributing

This is a hackathon project. For questions or contributions, please open an issue.
