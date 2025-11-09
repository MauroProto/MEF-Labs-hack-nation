# MAS DEBATE SYSTEM - DOCUMENTATION INDEX

## Documentos de Referencia (START HERE)

### 1. MAS_DEBATE_EXECUTIVE_SUMMARY.md (5 min read)
**¿Qué es?** Resumen ejecutivo del sistema
**Contiene:**
- Flujo en 30 segundos
- Descripción de cada agente
- API endpoints
- Frontend integration
- Performance metrics
- Limitaciones y mejoras futuras

**Para quién:** Ejecutivos, product managers, nuevos desarrolladores

---

### 2. MAS_DEBATE_DETAILED_ANALYSIS.md (30 min read)
**¿Qué es?** Análisis técnico completo y profundo
**Contiene:**
- Arquitectura general (11 secciones)
- Todos los agentes explicados en detalle
- Coordinador y orquestación
- API layer completo
- SSE streaming (protocol y events)
- Frontend integration
- Tipos de datos
- Flujo paso a paso con ejemplo concreto
- Detalles técnicos (OpenAI integration, paralelismo, prompts, etc.)

**Para quién:** Desarrolladores backend, arquitectos, técnicos

---

### 3. MAS_DEBATE_TECHNICAL_DEEP_DIVE.md (15 min read)
**¿Qué es?** Análisis técnico avanzado
**Contiene:**
- Secuencia temporal de llamadas a OpenAI
- Estructura completa de prompts
- Error handling y recovery
- Optimizaciones de performance
- Integraciones del sistema
- Casos edge y limitaciones
- Mejoras recomendadas

**Para quién:** Desarrolladores avanzados, optimizadores, arquitectos

---

### 4. MAS_DEBATE_SYSTEM.md (User Guide)
**¿Qué es?** Documentación de usuario del sistema
**Contiene:**
- API reference (endpoints)
- Data contracts (tipos)
- Usage examples (curl, programmatic)
- Environment variables
- Implementation details
- Future enhancements

**Para quién:** Backend developers, API users, integrators

---

## Archivos de Código (En Repositorio)

### Backend Services

```
backend/src/services/debate/
├── BaseDebateAgent.ts
│   └─ Clase base para todos los agentes
│   └─ OpenAI client initialization
│   └─ JSON extraction logic
│
├── FurtherQuestionsGenerator.ts
│   └─ Genera 8-12 preguntas
│   └─ Input: Paper (50k chars limit)
│   └─ Output: questions[]
│
├── PostureGenerator.ts
│   └─ Genera N posturas + 3-8 tópicos
│   └─ Input: Paper + question + numPostures
│   └─ Output: postures[] + topics[]
│
├── DebaterAgent.ts
│   └─ Argumenta desde una postura
│   └─ Único con tool calling (lookupPaper, webSearch)
│   └─ Agentic loop (max 10 iterations)
│   └─ Output: DebaterArgument per-topic
│
├── JudgeAgent.ts
│   └─ Evalúa argumentos con rúbrica
│   └─ 5 criterios: value, cohesiveness, relevance, clarity, engagement
│   └─ Output: JudgeVerdict con scores
│
├── ReporterAgent.ts
│   └─ Compila reporte ejecutivo
│   └─ JSON + Markdown output
│   └─ Output: DebateReport completo
│
├── DebateCoordinator.ts
│   └─ Orquestador principal
│   └─ Coordina todos los pasos
│   └─ Paralleliza debaters
│   └─ Maneja callbacks de progreso
│
├── webSearchService.ts
│   └─ Tavily API integration
│   └─ Fallback si no API key
│
└── index.ts
    └─ Exports de todos los agentes
```

### Backend Controllers & Routes

```
backend/src/
├── controllers/masDebateController.ts
│   ├─ generateQuestions()
│   ├─ generatePosturesAndTopics()
│   ├─ runDebate()
│   └─ runCompleteDebateFlow()
│
├── routes/masDebateRoutes.ts
│   ├─ POST /api/mas-debate/questions
│   ├─ POST /api/mas-debate/postures
│   ├─ POST /api/mas-debate/run
│   └─ POST /api/mas-debate/run-complete
│
└── types/debate.types.ts
    ├─ Paper, DebateSession
    ├─ WebSearchResult, LookupHit
    ├─ DebaterArgument
    ├─ JudgeVerdict, Rubric
    ├─ DebateReport
    ├─ Request/Response types
    └─ DEFAULT_RUBRIC definition
```

### Frontend

```
frontend/
├── components/
│   ├── nodes/MasDebateNode.tsx
│   │   └─ Node en canvas
│   │   └─ 4 estados: idle, selecting, debating, completed
│   │   └─ Auto-genera preguntas cuando se conecta paper
│   │   └─ Muestra progress en tiempo real
│   │
│   └── debate/MasDebateViewer.tsx
│       └─ Display de resultados
│       └─ Tabs por tópico + Final Verdict
│       └─ Scores visualization
│       └─ Export Markdown button
│
├── lib/
│   ├── hooks/useMasDebate.ts
│   │   ├─ State management
│   │   ├─ SSE event handling
│   │   ├─ Per-debater progress tracking
│   │   └─ Debate history (in-memory)
│   │
│   ├── api/masDebateApi.ts
│   │   ├─ generateQuestions()
│   │   ├─ generatePostures()
│   │   ├─ runDebateWithSSE()
│   │   ├─ runCompleteDebateWithSSE()
│   │   └─ SSE event parsing
│   │
│   └── types (from debate.types.ts)
│       └─ All TypeScript interfaces
│
└── [components already reference MasDebateNode]
```

---

## Flujo de Llamadas

### User Interaction Flow

```
User Interface
    ↓
MasDebateNode (React Component)
    ├─ Auto-fetch questions when paper connected
    ├─ User selects question or enters custom
    └─ Calls useMasDebate.runDebate()
        ↓
    useMasDebate Hook
        ├─ State management
        ├─ SSE connection
        └─ Progress tracking
            ↓
        masDebateApi.runDebateWithSSE()
            ├─ Fetch with Accept: text/event-stream
            ├─ ReadableStream reader
            └─ Parse SSE events line-by-line
                ↓
            Backend API (masDebateRoutes)
                ├─ Express route handler
                └─ runDebate() controller
                    ↓
                DebateCoordinator
                    ├─ generatePosturesAndTopics()
                    ├─ runDebate() [paralleliza 3 debaters]
                    ├─ judgeDebate()
                    ├─ generateReport()
                    └─ Emite onProgress callbacks
                        ↓
                    OpenAI API (3-5 llamadas paralelas)
                        ├─ FurtherQuestionsGenerator
                        ├─ PostureGenerator
                        ├─ DebaterAgent (3x en paralelo)
                        ├─ JudgeAgent
                        └─ ReporterAgent
                            ↓
                        [Retorna DebateReport]
                            ↓
                    [SSE escribe event: complete]
                            ↓
        [Frontend parsea y muestra resultados]
            ↓
        MasDebateViewer (displays final report)
```

---

## Tipo de Datos - Data Flow

```
INPUT: Paper
  ↓
[FurtherQuestionsGenerator]
  ↓
OUTPUT: Questions[]
  ↓
[User selects] → Selected Question
  ↓
[PostureGenerator]
  ↓
OUTPUT: Postures[] + Topics[]
  ↓
[DebaterAgent x3 - PARALELO]
  ├─ Input: Paper + Posture + Question + Topics
  └─ Tool Calls:
      ├─ lookupPaper() → LookupHit[]
      └─ webSearch() → WebSearchResult[]
  ↓
OUTPUT: DebaterArgument[3]
  ↓
[JudgeAgent]
  ├─ Input: Arguments[3] + Rubric
  └─ Scoring:
      ├─ 5 criteria
      ├─ per debater
      ├─ per topic
      └─ per criterion
  ↓
OUTPUT: JudgeVerdict
  ↓
[ReporterAgent]
  ├─ Input: Arguments[3] + Verdict + Question
  └─ Output:
      ├─ JSON (DebateReport)
      └─ Markdown
  ↓
FINAL OUTPUT: DebateReport
  ├─ question, topics, postures
  ├─ summary
  ├─ rankedPostures
  ├─ validatedInsights
  ├─ controversialPoints
  ├─ recommendedNextReads
  ├─ appendix (keyClaims + scoringTable)
  └─ markdown
```

---

## Configuración & Variables de Entorno

```bash
# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:4000

# .env (backend)
OPENAI_API_KEY=sk-proj-...          # Required
TAVILY_API_KEY=tvly-...             # Optional (fallback si no present)

# Configurables (in BaseDebateAgent)
MODEL=gpt-4o-mini                   # Default model
MAX_TOKENS=4096                     # Default
TEMPERATURE=0.7                     # Default (except Judge: 0.3)
```

---

## SSE Events Complete List

```
┌─────────────────────────────────────────────────────┐
│ PASO 1: Generación de Posturas                      │
├─────────────────────────────────────────────────────┤
event: progress
data: { "stage": "Generating postures and topics..." }

event: progress
data: {
  "stage": "postures_generated",
  "data": { "postures": [...], "topics": [...] }
}
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PASO 2: Debate en Paralelo                          │
├─────────────────────────────────────────────────────┤
event: progress
data: { "stage": "Running debate with N debaters..." }

event: progress
data: {
  "stage": "debater_started",
  "data": { "debaterIndex": 0, "posture": "...", "total": 3 }
}

event: progress
data: {
  "stage": "debater_complete",
  "data": {
    "debaterIndex": 0,
    "argument": { ... DebaterArgument ... },
    "total": 3
  }
}

event: progress
data: {
  "stage": "debater_error",
  "data": { "debaterIndex": 0, "error": "...", "total": 3 }
}

event: progress
data: {
  "stage": "debate_complete",
  "data": { "arguments": [...] }
}
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PASO 3: Juicio                                      │
├─────────────────────────────────────────────────────┤
event: progress
data: { "stage": "Judging arguments..." }

event: progress
data: {
  "stage": "judging_complete",
  "data": { "verdict": { ... JudgeVerdict ... } }
}
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PASO 4: Reporte                                     │
├─────────────────────────────────────────────────────┤
event: progress
data: { "stage": "Generating final report..." }

event: progress
data: {
  "stage": "report_complete",
  "data": { "report": { ... DebateReport ... } }
}
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ COMPLETADO                                          │
├─────────────────────────────────────────────────────┤
event: complete
data: { ... DebateReport ... }

[O en caso de error:]
event: error
data: { "error": "..." }
└─────────────────────────────────────────────────────┘
```

---

## Performance Metrics

| Métrica | Valor |
|---------|-------|
| Tiempo total | 65-110s (~1.5-2 min) |
| Paso: Preguntas | 5-10s |
| Paso: Posturas | 5-10s |
| Paso: Debate (paralelo) | 30-60s |
| Paso: Judge | 10-15s |
| Paso: Reporter | 10-15s |
| Tokens estimados | ~30,500 |
| Costo estimado | ~$0.008 |
| Ahorro por paralelismo | ~40% |

---

## Checklist para Nuevos Desarrolladores

- [ ] Leer MAS_DEBATE_EXECUTIVE_SUMMARY.md (5 min)
- [ ] Leer secciones 1-2 de MAS_DEBATE_DETAILED_ANALYSIS.md (15 min)
- [ ] Revisar backend/src/services/debate/ (understand agents)
- [ ] Revisar frontend/lib/hooks/useMasDebate.ts (understand state)
- [ ] Revisar frontend/components/nodes/MasDebateNode.tsx (understand UI)
- [ ] Probar flujo completo en localhost:3000
- [ ] Leer rest of MAS_DEBATE_DETAILED_ANALYSIS.md (understand flow)
- [ ] Leer MAS_DEBATE_TECHNICAL_DEEP_DIVE.md (advanced topics)

---

## Quick Links

### API Testing
- **Local Backend:** http://localhost:4000
- **Local Frontend:** http://localhost:3000
- **Swagger/Docs:** No disponible (documentado en archivos)

### Common Commands
```bash
# Start dev servers
pnpm dev

# Backend only
cd backend && pnpm dev

# Frontend only
cd frontend && pnpm dev

# Test debate flow
cd backend && tsx src/scripts/testMasDebate.ts

# Type check
pnpm type-check

# Lint
pnpm lint
```

### Key Files to Modify
1. **Add new agent:** Create file in `backend/src/services/debate/`
2. **Add new tool:** Modify `backend/src/services/debate/DebaterAgent.ts`
3. **Change rubric:** Edit `DEFAULT_RUBRIC` in `backend/src/types/debate.types.ts`
4. **Change prompts:** Modify files in `backend/src/services/debate/`
5. **Change UI:** Modify `frontend/components/nodes/MasDebateNode.tsx`

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not found"
**Solution:** Set environment variable in backend/.env

### Issue: "Paper not found"
**Solution:** Asegúrate de que el paper fue subido via PaperUploadNode

### Issue: "Web search returns fallback message"
**Solution:** Configure TAVILY_API_KEY en backend/.env

### Issue: "SSE connection closes early"
**Solution:** Verifica que el backend no crasheó (check console)

### Issue: "Debate results lost on page refresh"
**Solution:** Resultados se guardan en memoria solamente (mejora futura: persistencia en DB)

---

## Contributing Guidelines

1. All code must be TypeScript (no `any` types)
2. Follow existing patterns in BaseDebateAgent
3. Add proper error handling
4. Document prompts thoroughly
5. Update type definitions in debate.types.ts
6. Test with sample paper before submitting

---

**Last Updated:** November 2024
**Status:** Complete and Production Ready
**Documentation Version:** 1.0

