# Claude Context Guide for Research Agent Canvas

This document helps developers on this project provide optimal context to Claude for better code generation and assistance.

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

When implementing agents, reference these 6 types:

1. **researcher** - Deep analysis, extracts claims/evidence
2. **critic** - Validates claims, identifies weaknesses
3. **synthesizer** - Merges analyses, resolves conflicts
4. **question_generator** - Generates research questions
5. **citation_tracker** - Verifies citations, builds graphs
6. **web_research** - Searches academic databases

Each exposes tools via OpenAI function calling format.

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

**Last Updated**: Phase 2 (Agent Communication Layer in progress)
**Next Phase**: Agent Registry & Discovery (Phase 2.1)
