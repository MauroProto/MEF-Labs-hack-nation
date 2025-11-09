# ANÁLISIS COMPLETO DEL SISTEMA DE DEBATE ACADÉMICO (MAS DEBATE)

## 1. ARQUITECTURA GENERAL DEL SISTEMA

### 1.1 Descripción General
El sistema MAS (Multi-Agent System) Debate es un sistema sofisticado de múltiples agentes AI que automatiza debates académicos estructurados sobre papers de investigación. El sistema orquesta 5 agentes especializados que trabajan en conjunto para generar un debate completo y producir un reporte final detallado.

### 1.2 Flujo Completo: De Paper a Reporte

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO DEL SISTEMA                          │
└─────────────────────────────────────────────────────────────────────────┘

ENTRADA: Paper (id, title, fullText)
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 0: GENERACIÓN DE PREGUNTAS DE INVESTIGACIÓN           │
│ Agente: FurtherQuestionsGenerator                          │
│ Input: Documento completo del paper                         │
│ Output: 8-12 preguntas insightful                          │
│ Ejemplo: "Under what conditions does the proposed method   │
│           outperform baselines?"                            │
└─────────────────────────────────────────────────────────────┘
         ↓ (Usuario selecciona una pregunta)
┌─────────────────────────────────────────────────────────────┐
│ PASO 1: GENERACIÓN DE POSTURAS Y TÓPICOS                  │
│ Agente: PostureGenerator                                   │
│ Input: Paper + Pregunta seleccionada + N (num postures)    │
│ Output:                                                     │
│   - Postures: 3 perspectivas diferentes (ej: "Strong       │
│     Support", "Cautious Optimism", "Critical Skepticism") │
│   - Topics: 3-8 tópicos que cubren todas las dimensiones   │
│     (metodología, evidence, generalizabilidad, etc)       │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 2: DEBATE EN PARALELO                                 │
│ Agentes: N instances de DebaterAgent (1 por postura)       │
│ Input: Paper + Pregunta + Postura + Tópicos                │
│ Output (por debater):                                       │
│   - Para cada tópico: Claim + Reasoning + Counterpoints    │
│   - Citations: References a paper chunks + web sources     │
│   - Overall Position: Síntesis de la postura               │
│                                                             │
│ Nota: Los 3 debaters corren EN PARALELO (Promise.all)     │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 3: JUICIO Y EVALUACIÓN                                │
│ Agente: JudgeAgent                                         │
│ Input: Argumentos de los 3 debaters + Rúbrica             │
│ Output: JudgeVerdict con:                                  │
│   - Scores (0-1) por debater, por topic, por criterio      │
│   - Weighted totals                                        │
│   - Best overall posture                                   │
│   - Key insights                                           │
│   - Controversial points                                   │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 4: GENERACIÓN DE REPORTE FINAL                        │
│ Agente: ReporterAgent                                      │
│ Input: Todos los argumentos + Veredicto + Pregunta + Tópicos
│ Output: DebateReport completo con:                         │
│   - Executive summary                                      │
│   - Ranked postures                                        │
│   - Validated insights                                     │
│   - Controversial points                                   │
│   - Recommended next reads                                 │
│   - Appendix con key claims y scoring table                │
│   - Markdown version para lectura humana                   │
└─────────────────────────────────────────────────────────────┘
         ↓
SALIDA: DebateReport (JSON + Markdown)
```

---

## 2. AGENTES DEL SISTEMA

### 2.1 BaseDebateAgent (Clase Base)

**Archivo:** `backend/src/services/debate/BaseDebateAgent.ts`

**Responsabilidad:** Base class que todos los agentes heredan, proporciona funcionalidad común.

**Características principales:**
- Inicializa cliente OpenAI con API key
- Configurable: modelo (default: gpt-4o-mini), temperature, maxTokens
- Métodos helper para llamadas a OpenAI con respuestas JSON
- Extrae JSON de múltiples formatos de respuesta

**Métodos clave:**
```typescript
protected async callOpenAI(
  messages: OpenAI.ChatCompletionMessageParam[],
  systemPrompt?: string,
  tools?: OpenAI.ChatCompletionTool[]
): Promise<OpenAI.ChatCompletion>
```
- Llama a OpenAI con sistema + mensajes
- Soporta tool calling (function calling)

```typescript
protected extractJsonFromResponse(response: OpenAI.ChatCompletion): any
```
- Extrae JSON de respuestas en múltiples formatos:
  - JSON en bloques de código (```json {...}```)
  - JSON directo en el texto
  - JSON incrustado dentro de texto

```typescript
protected async callOpenAIWithJsonResponse<T>(
  messages: OpenAI.ChatCompletionMessageParam[],
  systemPrompt?: string,
  tools?: OpenAI.ChatCompletionTool[]
): Promise<T>
```
- Envuelve la llamada a OpenAI y retorna JSON parseado

**Configuración por defecto:**
```typescript
model: "gpt-4o-mini"
maxTokens: 4096
temperature: 0.7
```

---

### 2.2 FurtherQuestionsGenerator

**Archivo:** `backend/src/services/debate/FurtherQuestionsGenerator.ts`

**Responsabilidad:** Genera preguntas de investigación profundas a partir de un paper

**Input:**
```typescript
{
  paper: {
    id: string,
    title: string,
    text: string
  }
}
```

**Output:**
```typescript
{
  questions: string[]  // 8-12 preguntas
}
```

**Prompt Strategy:**
```
- Evita preguntas sí/no
- Promueve "Under what conditions...", "To what extent...", "What are the mechanisms..."
- Genera preguntas "answerable" pero no triviales
- Se enfoca en generar preguntas que producirían postures diferentes
```

**Ejemplo de preguntas generadas:**
1. "Under what conditions does the proposed method outperform baselines?"
2. "To what extent are the findings transferable to other domains?"
3. "What are the fundamental limitations of the approach?"
4. "How does this work compare to alternative methodologies?"

**Limitaciones del paper procesado:**
- Solo procesa los primeros 50,000 caracteres del paper
- Razón: Limitar tokens a OpenAI y mantener eficiencia

---

### 2.3 PostureGenerator

**Archivo:** `backend/src/services/debate/PostureGenerator.ts`

**Responsabilidad:** Para una pregunta dada, genera N posturas distintas (posiciones en el debate) y un conjunto exhaustivo de tópicos

**Input:**
```typescript
{
  question: string,      // La pregunta seleccionada
  paper: Paper,
  numPostures: number    // Default: 3
}
```

**Output:**
```typescript
{
  postures: string[],    // N posiciones distintas (ej: 3)
  topics: string[]       // 3-8 tópicos que cubren todas las dimensiones
}
```

**Estrategia de Posturas:**
- Genera postures que **cubren el espacio de respuestas posibles**
- No son simplemente "a favor" y "en contra"
- Ejemplo para paper de ML:
  - "Strong Support: Method is groundbreaking"
  - "Cautious Optimism: Promising but limited scope"
  - "Critical Skepticism: Significant flaws exist"

**Estrategia de Tópicos:**
- Cubre múltiples dimensiones de la pregunta:
  - **Metodología**: rigor experimental, diseño
  - **Evidencia**: calidad y suficiencia de datos
  - **Generalizabilidad**: transferencia a otros dominios
  - **Contribución Teórica**: novedad conceptual
  - **Implicaciones Prácticas**: aplicabilidad real
  - **Alternativas**: comparación con métodos existentes
  - **Ética**: consideraciones éticas (si aplica)

**Límite de caracteres:**
- Procesa primeros 40,000 caracteres del paper

---

### 2.4 DebaterAgent

**Archivo:** `backend/src/services/debate/DebaterAgent.ts`

**Responsabilidad:** Argumenta desde una postura específica sobre todos los tópicos compartidos

**Características únicas:**
- Es el único agente que usa **tool calling** (OpenAI function calling)
- Accede a dos herramientas:
  1. `lookupPaper` - búsqueda en el paper
  2. `webSearch` - búsqueda web

**Input:**
```typescript
{
  posture: string,      // La posición a defender (ej: "Strong Support")
  question: string,     // La pregunta del debate
  topics: string[],     // Lista de tópicos a argumentar
  paper: Paper          // El paper completo
}
```

**Output:**
```typescript
{
  posture: string,
  perTopic: [
    {
      topic: string,
      claim: string,              // Afirmación concisa (1-2 oraciones)
      reasoning: string,          // Explicación del porqué
      counterpoints: string[],    // 1-2 contrapuntos anticipados
      citations: {
        paper?: LookupHit[],      // Referencias al paper
        web?: WebSearchResult[]   // Referencias web
      }
    }
    // ...para cada topic
  ],
  overallPosition: string    // Síntesis de la postura
}
```

**Estrategia de Argumentación (según prompt):**

Para cada tópico, el debater:
1. **Interpreta la conexión** del tópico con su postura
2. **Hace un claim**: afirmación concisa y asertiva
3. **Desarrolla reasoning**: por qué sigue lógicamente
   - Incluye causal logic
   - Implicaciones conceptuales o éticas
   - Tensiones, trade-offs, condiciones
4. **Añade counterpoints**: 1-2 críticas anticipadas que haría un rival
5. **Busca evidencia** (opcional): llamadas a lookupPaper o webSearch
6. **Mantiene coherencia**: todos los tópicos deben ser lógicamente compatibles con la misma postura

**Herramienta 1: lookupPaper**

Implementación:
```typescript
private async lookupPaper(query: string): Promise<LookupHit[]>
```

Algoritmo:
1. Divide el paper en chunks de ~500 caracteres con 100 caracteres de overlap
2. Para cada chunk, calcula un score basado en:
   - Frecuencia de términos de la query (case-insensitive)
   - Suma los términos que aparecen
   - Normaliza a escala 0-1
3. Ordena por score y retorna top 5

Ejemplo:
```
Input: "transformer architecture"
Output: [
  {
    chunkId: "chunk_15",
    text: "The transformer architecture uses self-attention mechanisms...",
    score: 0.85
  },
  ...
]
```

Nota: Esta es una implementación simple keyword-based. En producción, se usaría:
- Vector embeddings (OpenAI embeddings)
- Búsqueda semántica
- Índices FAISS o similar

**Herramienta 2: webSearch**

Archivo: `backend/src/services/debate/webSearchService.ts`

Implementación:
```typescript
export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResult[]>
```

Comportamiento:
- Si `TAVILY_API_KEY` está configurada: llama a Tavily API
- Si no: retorna mensaje de fallback

Estructura de Tavily response:
```json
{
  "results": [
    {
      "title": "...",
      "url": "...",
      "content": "..."
    }
  ]
}
```

Transforma a:
```typescript
{
  title: string,
  url: string,
  snippet: string
}
```

**Agentic Loop (Tool Calling)**

El debater implementa un loop que:
1. Llama a OpenAI con tools disponibles
2. Si hay tool_calls en la respuesta:
   - Procesa cada tool call
   - Obtiene resultados
   - Añade resultados como messages de "tool" role
   - Vuelve a llamar a OpenAI
3. Si no hay tool calls:
   - Extrae JSON final y rompe el loop
4. Máximo 10 iteraciones (evita loops infinitos)

Pseudo-código:
```typescript
let iterations = 0;
while (iterations < maxIterations) {
  const response = await this.callOpenAI(messages, systemPrompt, tools);
  const toolCalls = response.choices[0].message.tool_calls;
  
  if (!toolCalls || toolCalls.length === 0) {
    // No más herramientas, extrae JSON
    finalResponse = this.extractJsonFromResponse(response);
    break;
  }
  
  // Procesa tool calls
  for (const toolCall of toolCalls) {
    if (toolCall.function.name === "lookupPaper") {
      const result = await this.lookupPaper(toolInput.query);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    } else if (toolCall.function.name === "webSearch") {
      const result = await webSearch(toolInput.query);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }
  
  iterations++;
}
```

---

### 2.5 JudgeAgent

**Archivo:** `backend/src/services/debate/JudgeAgent.ts`

**Responsabilidad:** Evalúa la calidad de los argumentos de cada debater usando una rúbrica

**Configuración especial:**
```typescript
temperature: 0.3     // Más bajo para evaluaciones consistentes
maxTokens: 3000
```

**Input:**
```typescript
{
  question: string,
  topics: string[],
  arguments: DebaterArgument[],    // De los N debaters
  rubric: Rubric                   // Criterios de evaluación
}
```

**Output:**
```typescript
{
  perDebater: [
    {
      posture: string,
      perTopic: [
        {
          topic: string,
          scores: {
            value: number,           // 0-1
            cohesiveness: number,    // 0-1
            relevance: number,       // 0-1
            clarity: number,         // 0-1
            engagement: number       // 0-1
          },
          notes: string              // Explicación del juicio
        }
      ],
      totals: {
        weighted: number,            // Promedio ponderado
        byCriterion: {               // Promedio por criterio
          value: number,
          cohesiveness: number,
          relevance: number,
          clarity: number,
          engagement: number
        }
      }
    }
  ],
  bestOverall: string,              // Postura ganadora
  insights: string[],               // Insights valiosos extraídos
  controversialPoints: string[]     // Puntos de desacuerdo
}
```

**Rúbrica Default:**

```typescript
DEFAULT_RUBRIC = [
  {
    id: "value",
    weight: 0.30,
    description: "Conceptual or argumentative richness; non-triviality"
  },
  {
    id: "cohesiveness",
    weight: 0.25,
    description: "Internal logic and compatibility across topics"
  },
  {
    id: "relevance",
    weight: 0.20,
    description: "Focused on the topic and question"
  },
  {
    id: "clarity",
    weight: 0.15,
    description: "Precision and readability of reasoning"
  },
  {
    id: "engagement",
    weight: 0.10,
    description: "Responds to counterpoints, anticipates critique"
  }
]
```

**Guía de Scoring:**
- 0.9-1.0: Excepcional (outstanding evidence, flawless logic)
- 0.7-0.9: Fuerte (good evidence, solid reasoning)
- 0.5-0.7: Adecuado (some evidence, decent reasoning)
- 0.3-0.5: Débil (limited evidence, flawed reasoning)
- 0.0-0.3: Pobre (no evidence, faulty logic)

**Proceso de Evaluación:**

1. Por cada debater
2. Para cada tópico que argumentó
3. Calcula 5 scores (0-1) usando los criterios
4. Calcula weighted average: sum(score * weight)
5. Almacena notas explicativas
6. Calcula promedios por criterion
7. Identifica el mejor debater overall
8. Extrae insights valiosos (síntesis, puntos nuevos)
9. Identifica puntos controvertidos (desacuerdos)

**Nota importante en el prompt:**

El juez es consciente de que está evaluando argumentos de LLM, no de humanos. Enfatiza:
- No verifica URLs ni valida hechos (eso hace otro agente)
- Se enfoca en estructura lógica, coherencia, relevancia
- Evalúa "valor conceptual" no "verdad objetiva"

---

### 2.6 ReporterAgent

**Archivo:** `backend/src/services/debate/ReporterAgent.ts`

**Responsabilidad:** Compila un reporte ejecutivo completo a partir de los argumentos y veredicto

**Input:**
```typescript
{
  question: string,
  topics: string[],
  postures: string[],
  arguments: DebaterArgument[],    // De todos los debaters
  verdict: JudgeVerdict             // Del judge
}
```

**Output:**
```typescript
{
  question: string,
  topics: string[],
  postures: string[],
  summary: string,                  // 2-3 párrafos ejecutivos
  rankedPostures: [                 // Ranking por score
    { posture: string, score: number }
  ],
  validatedInsights: string[],      // Insights valiosos extraídos
  controversialPoints: string[],    // Puntos de desacuerdo
  recommendedNextReads: [           // 5-7 papers recomendados
    { title: string, url: string, snippet: string }
  ],
  appendix: {
    perDebaterKeyClaims: [          // Claims principales por debater
      {
        posture: string,
        claims: [
          { topic: string, claim: string }
        ]
      }
    ],
    scoringTable: JudgeVerdict["perDebater"]  // Tabla de scoring completa
  },
  markdown: string                  // Versión legible en Markdown
}
```

**Secciones del Reporte Markdown:**
1. Título con la pregunta
2. Executive Summary (2-3 párrafos)
3. Topics Covered (lista de tópicos)
4. Posture Rankings (ranking con scores)
5. Validated Insights (insights principales)
6. Controversial Points (áreas de desacuerdo)
7. Recommended Next Reads (papers sugeridos)
8. Appendix con Key Claims y Scoring Table

**Características especiales:**
- El ReporterAgent genera tanto JSON como Markdown
- Los recommended next reads se generan "realísticamente" pero son sintéticos (no URLs reales)
- Incluye la tabla de scoring completa en el apéndice para reproducibilidad

---

## 3. COORDINADOR: DebateCoordinator

**Archivo:** `backend/src/services/debate/DebateCoordinator.ts`

**Responsabilidad:** Orquesta el flujo completo del debate

**Métodos públicos:**

### 3.1 generateQuestions(paper)
```typescript
async generateQuestions(paper: Paper): Promise<string[]>
```
- Crea instancia de FurtherQuestionsGenerator
- Retorna 8-12 preguntas

### 3.2 generatePosturesAndTopics(paper, question, numPostures)
```typescript
async generatePosturesAndTopics(
  paper: Paper,
  question: string,
  numPostures: number = 3
): Promise<{ postures: string[]; topics: string[] }>
```
- Crea instancia de PostureGenerator
- Retorna postures y topics

### 3.3 runDebate(paper, question, topics, postures, onProgress)
```typescript
async runDebate(
  paper: Paper,
  question: string,
  topics: string[],
  postures: string[],
  onProgress?: (stage: string, data?: any) => void
): Promise<DebaterArgument[]>
```
- **Ejecución paralela**: crea N DebaterAgent, uno por postura
- Usa `Promise.all()` para paralelismo
- Emite eventos de progreso:
  - `debater_started`: cuando comienza un debater
  - `debater_complete`: cuando termina con su argumento
  - `debater_error`: si hay error
- Retorna array de argumentos

**Pseudo-código:**
```typescript
const debatePromises = postures.map(async (posture, index) => {
  const debater = new DebaterAgent();
  onProgress?.("debater_started", { debaterIndex: index, posture, total: postures.length });
  
  try {
    const argument = await debater.debate({ posture, question, topics, paper });
    onProgress?.("debater_complete", { debaterIndex: index, posture, argument, total: postures.length });
    return argument;
  } catch (error) {
    onProgress?.("debater_error", { debaterIndex: index, posture, error: error.message, total: postures.length });
    throw error;
  }
});

const debaterArguments = await Promise.all(debatePromises);
return debaterArguments;
```

### 3.4 judgeDebate(question, topics, debaterArguments)
```typescript
async judgeDebate(
  question: string,
  topics: string[],
  debaterArguments: DebaterArgument[]
): Promise<JudgeVerdict>
```
- Crea instancia de JudgeAgent
- Pasa los argumentos y la rúbrica
- Retorna veredicto completo

### 3.5 generateReport(question, topics, postures, debaterArguments, verdict)
```typescript
async generateReport(
  question: string,
  topics: string[],
  postures: string[],
  debaterArguments: DebaterArgument[],
  verdict: JudgeVerdict
): Promise<DebateReport>
```
- Crea instancia de ReporterAgent
- Ensambla reporte final

### 3.6 runCompleteDebate(paper, question, numPostures, onProgress)

**Este es el método principal para correr un debate completo:**

```typescript
async runCompleteDebate(
  paper: Paper,
  question: string,
  numPostures: number = 3,
  onProgress?: (stage: string, data?: any) => void
): Promise<DebateReport>
```

**Flujo:**
1. `onProgress("Generating postures and topics...")` → generatePosturesAndTopics
2. `onProgress("postures_generated", { postures, topics })` → notifica postures generadas
3. `onProgress("Running debate with N debaters...")` → runDebate con callbacks
   - Dentro del runDebate se emiten eventos por-debater
4. `onProgress("debate_complete", { arguments })` → todos los debaters completaron
5. `onProgress("Judging arguments...")` → judgeDebate
6. `onProgress("judging_complete", { verdict })` → veredicto completo
7. `onProgress("Generating final report...")` → generateReport
8. `onProgress("report_complete", { report })` → reporte final
9. Retorna el reporte

### 3.7 runCompleteDebateWithQuestionGeneration(paper, questionIndex, numPostures, onProgress)

Extensión que incluye generación de preguntas:

```typescript
async runCompleteDebateWithQuestionGeneration(
  paper: Paper,
  questionIndex: number = 0,
  numPostures: number = 3,
  onProgress?: (stage: string, data?: any) => void
): Promise<DebateReport>
```

**Flujo adicional:**
1. `onProgress("Generating questions from paper...")` → generateQuestions
2. `onProgress("questions_generated", { questions })` → preguntas generadas
3. Selecciona la pregunta en índice questionIndex (o la primera)
4. `onProgress("question_selected", { question })` → notifica selección
5. Luego continúa con runCompleteDebate normalmente

---

## 4. API LAYER

### 4.1 Rutas (masDebateRoutes.ts)

```
POST /api/mas-debate/questions
POST /api/mas-debate/postures
POST /api/mas-debate/run
POST /api/mas-debate/run-complete
```

### 4.2 Controlador (masDebateController.ts)

#### 4.2.1 generateQuestions(req, res)

**Endpoint:** `POST /api/mas-debate/questions`

**Request Body:**
```json
{ "paperId": "string" }
```

**Proceso:**
1. Valida que paperId está presente
2. Busca el paper en la base de datos (Prisma)
3. Valida que paper existe y tiene fullText
4. Crea instancia de DebateCoordinator
5. Llama a coordinator.generateQuestions(paper)
6. Retorna JSON con preguntas

**Response:**
```json
{
  "questions": [
    "Under what conditions...",
    "To what extent...",
    ...
  ]
}
```

**Error Handling:**
- 400: paperId faltante
- 404: paper no encontrado
- 400: paper sin contenido
- 500: error durante generación

#### 4.2.2 generatePosturesAndTopics(req, res)

**Endpoint:** `POST /api/mas-debate/postures`

**Request Body:**
```json
{
  "paperId": "string",
  "question": "string",
  "numPostures": 3  // optional
}
```

**Proceso:** Similar a generateQuestions, pero:
- Valida paperId y question
- Llama a coordinator.generatePosturesAndTopics()

**Response:**
```json
{
  "postures": ["Postura 1", "Postura 2", "Postura 3"],
  "topics": ["Topic 1", "Topic 2", ...]
}
```

#### 4.2.3 runDebate(req, res)

**Endpoint:** `POST /api/mas-debate/run`

**Request Body:**
```json
{
  "paperId": "string",
  "question": "string",
  "numPostures": 3  // optional
}
```

**Características especiales:**
- **Soporta SSE (Server-Sent Events)**: si el header `Accept: text/event-stream` está presente
- Si SSE:
  - Configura headers de SSE
  - Define callback onProgress que escribe eventos SSE
  - Escribe eventos mientras se ejecuta el debate
  - Escribe evento `complete` cuando termina
  - O evento `error` si falla

**Flujo SSE:**
```
response.setHeader("Content-Type", "text/event-stream")
response.setHeader("Cache-Control", "no-cache")
response.setHeader("Connection", "keep-alive")

const onProgress = (stage: string, data?: any) => {
  res.write(`event: progress\n`)
  res.write(`data: ${JSON.stringify({ stage, data })}\n\n`)
}

// Ejecuta el debate con callbacks
const report = await coordinator.runCompleteDebate(paper, question, numPostures, onProgress)

// Escribe evento final
res.write(`event: complete\n`)
res.write(`data: ${JSON.stringify(report)}\n\n`)
res.end()
```

**Si no SSE:**
- Retorna JSON simple con el reporte completo

#### 4.2.4 runCompleteDebateFlow(req, res)

**Endpoint:** `POST /api/mas-debate/run-complete`

**Request Body:**
```json
{
  "paperId": "string",
  "questionIndex": 0,    // optional, default 0
  "numPostures": 3       // optional
}
```

**Diferencia:** Incluye generación de preguntas antes del debate

**Mismo soporte SSE** que runDebate

---

## 5. STREAMING EN TIEMPO REAL (SSE)

### 5.1 ¿Cómo Funciona SSE?

SSE (Server-Sent Events) es un protocolo que permite al servidor enviar actualizaciones al cliente sin necesidad de WebSocket.

**Protocolo SSE:**
```
event: progress
data: {"stage": "postures_generated", "data": {...}}

event: progress
data: {"stage": "debater_started", "data": {...}}

event: progress
data: {"stage": "debater_complete", "data": {...}}

event: complete
data: {"question": "...", "topics": [...], ...}
```

### 5.2 Eventos Emitidos

**Paso 1: Generación de Posturas**
```
event: progress
data: {
  "stage": "Generating postures and topics...",
  "data": null
}

event: progress
data: {
  "stage": "postures_generated",
  "data": {
    "postures": ["Postura 1", "Postura 2", "Postura 3"],
    "topics": ["Topic 1", "Topic 2", ...]
  }
}
```

**Paso 2: Debate en Paralelo**
```
event: progress
data: {
  "stage": "Running debate with 3 debaters...",
  "data": null
}

event: progress
data: {
  "stage": "debater_started",
  "data": {
    "debaterIndex": 0,
    "posture": "Postura 1",
    "total": 3
  }
}

event: progress
data: {
  "stage": "debater_complete",
  "data": {
    "debaterIndex": 0,
    "posture": "Postura 1",
    "argument": {...},  // DebaterArgument completo
    "total": 3
  }
}

// Se repite para debaters 1 y 2

event: progress
data: {
  "stage": "debate_complete",
  "data": {
    "arguments": [...]  // Array de todos los argumentos
  }
}
```

**Paso 3: Juicio**
```
event: progress
data: {
  "stage": "Judging arguments...",
  "data": null
}

event: progress
data: {
  "stage": "judging_complete",
  "data": {
    "verdict": {...}  // JudgeVerdict completo
  }
}
```

**Paso 4: Reporte**
```
event: progress
data: {
  "stage": "Generating final report...",
  "data": null
}

event: progress
data: {
  "stage": "report_complete",
  "data": {
    "report": {...}  // DebateReport completo
  }
}

event: complete
data: {...}  // DebateReport final
```

### 5.3 Cliente Recibe SSE (Frontend)

El frontend (`frontend/lib/api/masDebateApi.ts`):

```typescript
export async function runDebateWithSSE(
  request: RunDebateRequest,
  onProgress: (event: DebateProgressEvent) => void,
  onComplete: (report: DebateReport) => void,
  onError: (error: Error) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mas-debate/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',  // KEY: Pide SSE
    },
    body: JSON.stringify(request),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onProgress(data as DebateProgressEvent);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  }
}
```

---

## 6. FRONTEND INTEGRATION

### 6.1 Hook: useMasDebate

**Archivo:** `frontend/lib/hooks/useMasDebate.ts`

**Gestiona el estado completo del debate:**

```typescript
export type DebateStatus =
  | 'idle'
  | 'generating_questions'
  | 'selecting_question'
  | 'generating_postures'
  | 'debating'
  | 'judging'
  | 'generating_report'
  | 'completed'
  | 'error';

export type DebateState = {
  status: DebateStatus,
  progress: string,
  
  // Preguntas generadas
  questions?: string[],
  
  // Posturas y tópicos
  postures?: string[],
  topics?: string[],
  
  // Progreso por debater
  debaterProgress: DebaterProgress[],
  
  // Resultados del debate
  arguments?: DebaterArgument[],
  verdict?: JudgeVerdict,
  report?: DebateReport,
  
  // Historial de debates
  history: DebateHistoryEntry[],
  
  // Error
  error?: string,
};
```

**Métodos:**

1. **fetchQuestions(paperId)**: Genera preguntas iniciales
2. **fetchPostures(paperId, question, numPostures)**: Genera posturas
3. **runDebate(paperId, question, numPostures)**: Corre el debate completo con SSE
4. **loadDebateFromHistory(historyId)**: Carga un debate previo
5. **reset()**: Resetea el estado pero preserva el historial

**Manejo de SSE:**

```typescript
return new Promise<DebateReport>((resolve, reject) => {
  runDebateWithSSE(
    { paperId, question, numPostures },
    // On Progress
    (event: DebateProgressEvent) => {
      if (event.stage === 'postures_generated') {
        // Inicializa array de debater progress
        const initialProgress: DebaterProgress[] = event.data.postures.map((p, i) => ({
          index: i,
          posture: p,
          status: 'idle',
        }));
        setDebateState(prev => ({
          ...prev,
          postures: event.data.postures,
          topics: event.data.topics,
          debaterProgress: initialProgress,
        }));
      }
      
      if (event.stage === 'debater_started') {
        // Marca un debater como "running"
        setDebateState(prev => {
          const newProgress = [...prev.debaterProgress];
          newProgress[event.data.debaterIndex].status = 'running';
          return { ...prev, debaterProgress: newProgress };
        });
      }
      
      if (event.stage === 'debater_complete') {
        // Marca como "complete" y almacena el argumento
        setDebateState(prev => {
          const newProgress = [...prev.debaterProgress];
          newProgress[event.data.debaterIndex] = {
            ...newProgress[event.data.debaterIndex],
            status: 'complete',
            argument: event.data.argument,
          };
          return { ...prev, debaterProgress: newProgress };
        });
      }
      
      // ... manejar otros eventos
    },
    // On Complete
    (report: DebateReport) => {
      setDebateState(prev => ({
        ...prev,
        status: 'completed',
        report,
      }));
      resolve(report);
    },
    // On Error
    (error: Error) => {
      setDebateState({
        status: 'error',
        error: error.message,
      });
      reject(error);
    }
  );
});
```

### 6.2 Componente: MasDebateNode

**Archivo:** `frontend/components/nodes/MasDebateNode.tsx`

**Responsabilidad:** UI del nodo de debate en el canvas

**Estados principales:**

1. **Idle (sin paper conectado)**
   - Muestra aviso: "Please connect a paper node to start a debate"

2. **Selección de pregunta**
   - Muestra las preguntas generadas
   - Botones para seleccionar cada pregunta
   - Input para preguntas custom
   - Button "Start Debate with Custom Question"

3. **Debate en progreso**
   - Spinner de carga
   - Barra de progreso con etapa actual
   - Lista de posturas (cuando se generan)
   - Lista de tópicos (cuando se generan)
   - **Panel de progreso por debater:**
     - Muestra 3 debaters con su estado (idle, running, complete, error)
     - Para debaters complete: preview del argumento (primer tópico)

4. **Debate completado**
   - Sidebar con historial de debates
   - Botón "Run Another Debate" para volver a empezar
   - Renderer del `<MasDebateViewer />`

**Auto-generación de preguntas:**
```typescript
useEffect(() => {
  if (connectedPaper && debateState.status === 'idle' && !debateState.questions) {
    fetchQuestions(connectedPaper.id).catch(console.error);
  }
}, [connectedPaper, debateState.status, debateState.questions, fetchQuestions]);
```

Cuando se conecta un paper, automáticamente se generan preguntas.

### 6.3 Componente: MasDebateViewer

**Archivo:** `frontend/components/debate/MasDebateViewer.tsx`

**Responsabilidad:** Display del reporte final

**Layout:**
- Tab system con botones para cada tópico + "Final Verdict"
- Por cada tópico: muestra los 3 argumentos de los debaters
- Final Verdict tab: resumen ejecutivo, rankings, insights

**Detalles por argumento:**
- Postura (con ícono de ranking: 🥇🥈🥉)
- Claim
- Reasoning
- Evidence (references a paper + web sources)
- Judge Scores (5 criterios: value, cohesiveness, relevance, clarity, engagement)

**Final Verdict tab:**
- Executive Summary
- Ranked Postures (con scores)
- Validated Insights (bulleted list)
- Controversial Points (highlighted)
- Recommended Next Reads (links)
- Export Full Report (Markdown download)

---

## 7. TIPOS DE DATOS COMPLETOS

### 7.1 Paper
```typescript
type Paper = {
  id: string;
  title: string;
  text: string;  // Texto completo del paper
};
```

### 7.2 DebaterArgument
```typescript
type DebaterArgument = {
  posture: string;
  perTopic: Array<{
    topic: string;
    claim: string;                    // Afirmación concisa
    reasoning: string;                // Explicación lógica
    counterpoints: string[];          // Críticas anticipadas
    citations: {
      paper?: LookupHit[];            // Referencias al paper
      web?: WebSearchResult[];        // Referencias web
    };
  }>;
  overallPosition: string;            // Síntesis general
};
```

### 7.3 JudgeVerdict
```typescript
type JudgeVerdict = {
  perDebater: Array<{
    posture: string;
    perTopic: Array<{
      topic: string;
      scores: Record<RubricCriterion["id"], number>;  // 0-1 para cada criterio
      notes: string;
    }>;
    totals: {
      weighted: number;               // Promedio ponderado
      byCriterion: Record<string, number>;
    };
  }>;
  bestOverall: string;                // Postura ganadora
  insights: string[];                 // Insights extraídos
  controversialPoints: string[];      // Puntos de desacuerdo
};
```

### 7.4 DebateReport
```typescript
type DebateReport = {
  question: string;
  topics: string[];
  postures: string[];
  summary: string;                    // 2-3 párrafos ejecutivos
  rankedPostures: Array<{
    posture: string;
    score: number;                    // 0-1
  }>;
  validatedInsights: string[];
  controversialPoints: string[];
  recommendedNextReads: WebSearchResult[];
  appendix: {
    perDebaterKeyClaims: Array<{      // Claims principales
      posture: string;
      claims: Array<{
        topic: string;
        claim: string;
      }>;
    }>;
    scoringTable: JudgeVerdict["perDebater"];  // Tabla de scoring
  };
  markdown: string;                   // Versión Markdown legible
};
```

---

## 8. FLUJO PASO A PASO: EJEMPLO CONCRETO

**Scenario:** Usuario sube un paper sobre Transformers, quiere debatir "Are Transformers revolutionary?"

### Paso 0: Usuario Abre el Canvas
- Arrastra un nodo `MasDebateNode` al canvas
- Arrastra un nodo `PaperUploadNode` al canvas
- Carga el paper de Transformers
- Conecta el PaperUploadNode al MasDebateNode

### Paso 1: Generación de Preguntas (Automático)
**Frontend:**
- useMasDebate hook detecta que hay paper conectado
- Llama a `fetchQuestions(paperId)`
- MasDebateNode muestra spinner: "Generating questions..."

**Backend:**
```
POST /api/mas-debate/questions
{ "paperId": "transformer-paper-123" }
```

1. Busca paper en DB
2. Lee fullText (primeros 50k caracteres)
3. Crea FurtherQuestionsGenerator
4. Llama a OpenAI con el paper
5. Extrae JSON con 8-12 preguntas
6. Retorna al frontend

**Respuesta:**
```json
{
  "questions": [
    "Are Transformers a revolutionary advance over RNNs?",
    "What are the fundamental limitations of the Transformer architecture?",
    "To what extent is attention the key innovation?",
    "How do positional encodings compare to other alternatives?",
    "Can Transformers be made more efficient without losing performance?",
    ...
  ]
}
```

**Frontend:** MasDebateNode ahora muestra:
- Lista de preguntas clickeables
- Input para preguntas custom

### Paso 2: Usuario Selecciona Pregunta
El usuario hace click en: "Are Transformers a revolutionary advance over RNNs?"

MasDebateNode llama a `runDebate(paperId, question, 3)`

### Paso 3a: Generación de Posturas (Backend)
**SSE Event #1:**
```
event: progress
data: {
  "stage": "Generating postures and topics..."
}
```

**Backend Process:**
1. Crea PostureGenerator
2. Llama a OpenAI con paper + pregunta
3. OpenAI propone 3 posturas:
   - "Transformers are Revolutionary: True paradigm shift"
   - "Transformers are Important but Incremental: Building on RNN insights"
   - "Transformers are Hyped: Attention is just pattern matching"
4. OpenAI también propone 5 tópicos:
   - "Training Efficiency"
   - "Parallelization Capability"
   - "Long-range Dependencies"
   - "Interpretability"
   - "Practical Impact in Production"

**SSE Event #2:**
```
event: progress
data: {
  "stage": "postures_generated",
  "data": {
    "postures": [
      "Transformers are Revolutionary: True paradigm shift",
      "Transformers are Important but Incremental: Building on RNN insights",
      "Transformers are Hyped: Attention is just pattern matching"
    ],
    "topics": [
      "Training Efficiency",
      "Parallelization Capability",
      "Long-range Dependencies",
      "Interpretability",
      "Practical Impact in Production"
    ]
  }
}
```

**Frontend:** MasDebateNode muestra:
- Spinner + "Running debate with 3 debaters..."
- Postures listadas
- Tópicos listados
- Panel vacío para progreso de debaters

### Paso 3b: Debate en Paralelo

**SSE Events #3-#11:** Debater 0 (Postura 1)
```
event: progress
data: {
  "stage": "debater_started",
  "data": {
    "debaterIndex": 0,
    "posture": "Transformers are Revolutionary: True paradigm shift",
    "total": 3
  }
}
```

**Backend Process for Debater 0:**
1. Crea DebaterAgent
2. Inicia agentic loop:
   - **Iteración 1:** OpenAI decide llamar a lookupPaper("transformer architecture attention")
   - Lookup retorna chunks del paper sobre attention
   - OpenAI recibe los chunks
   - **Iteración 2:** OpenAI decide llamar a webSearch("transformer training efficiency RNN comparison")
   - Tavily retorna papers relacionados
   - OpenAI recibe los resultados
   - **Iteración 3:** OpenAI decide llamar a lookupPaper("parallelization rnn sequential dependencies")
   - Lookup retorna chunks
   - **Iteración 4:** OpenAI no quiere más tools, retorna JSON
3. JSON contiene argumentos para todos los 5 tópicos:
   ```json
   {
     "posture": "Transformers are Revolutionary: True paradigm shift",
     "perTopic": [
       {
         "topic": "Training Efficiency",
         "claim": "Transformers can be trained in parallel without sequential bottlenecks",
         "reasoning": "Because RNNs require sequential computation through time steps...",
         "counterpoints": ["Transformers have higher per-token cost", "..."],
         "citations": { "paper": [...], "web": [...] }
       },
       ... // 4 más
     ],
     "overallPosition": "The Transformer architecture represents..."
   }
   ```

**SSE Event #11:**
```
event: progress
data: {
  "stage": "debater_complete",
  "data": {
    "debaterIndex": 0,
    "posture": "Transformers are Revolutionary: True paradigm shift",
    "argument": { ... complete DebaterArgument ... },
    "total": 3
  }
}
```

**Frontend:** MasDebateNode actualiza el panel:
- Debater 0: ✓ Complete
- Muestra preview del primer tópico y su claim

*Mismo proceso para Debaters 1 y 2 en paralelo*

**SSE Event (después de que todos completen):**
```
event: progress
data: {
  "stage": "debate_complete",
  "data": {
    "arguments": [ ... 3 DebaterArguments ... ]
  }
}
```

### Paso 4: Juicio

**SSE Event:**
```
event: progress
data: { "stage": "Judging arguments..." }
```

**Backend Process:**
1. Crea JudgeAgent con temperature: 0.3 (consistencia)
2. Llama a OpenAI con:
   - La pregunta
   - Los 5 tópicos
   - Los 3 argumentos completos
   - La rúbrica (5 criterios)
3. OpenAI lee todos los argumentos
4. Para cada debater, para cada tópico, asigna 5 scores (0-1):
   - value: 0.9
   - cohesiveness: 0.85
   - relevance: 0.95
   - clarity: 0.88
   - engagement: 0.80
5. Calcula weighted average = (0.9*0.30) + (0.85*0.25) + (0.95*0.20) + (0.88*0.15) + (0.80*0.10) = 0.8665
6. Repite para todos los tópicos y calcula promedio por debater
7. Identifica el mejor debater overall
8. Extrae insights y puntos controvertidos

**SSE Event:**
```
event: progress
data: {
  "stage": "judging_complete",
  "data": {
    "verdict": {
      "perDebater": [
        {
          "posture": "Transformers are Revolutionary...",
          "perTopic": [...],
          "totals": { "weighted": 0.87, "byCriterion": {...} }
        },
        ...
      ],
      "bestOverall": "Transformers are Revolutionary: True paradigm shift",
      "insights": [
        "The key insight is that parallelization fundamentally changes training dynamics",
        ...
      ],
      "controversialPoints": [
        "Whether attention is fundamentally novel vs pattern matching",
        ...
      ]
    }
  }
}
```

### Paso 5: Reporte Final

**SSE Event:**
```
event: progress
data: { "stage": "Generating final report..." }
```

**Backend Process:**
1. Crea ReporterAgent
2. Llama a OpenAI con todos los datos
3. OpenAI retorna un DebateReport con:
   - summary: "The debate reveals that Transformers represent a significant shift in capabilities..."
   - rankedPostures:
     ```
     [
       { "posture": "Transformers are Revolutionary...", "score": 0.87 },
       { "posture": "Transformers are Important but Incremental...", "score": 0.74 },
       { "posture": "Transformers are Hyped...", "score": 0.52 }
     ]
     ```
   - validatedInsights: ["Parallelization is key", "Attention enables long-range dependencies", ...]
   - controversialPoints: ["Source of novelty", "Practical limitations", ...]
   - recommendedNextReads: Papers sugeridos
   - appendix: tabla de scoring completa + key claims
   - markdown: versión legible

**SSE Event Final:**
```
event: complete
data: {
  "question": "Are Transformers a revolutionary advance over RNNs?",
  "topics": [...],
  "postures": [...],
  "summary": "...",
  "rankedPostures": [...],
  "validatedInsights": [...],
  "controversialPoints": [...],
  "recommendedNextReads": [...],
  "appendix": {...},
  "markdown": "# Debate Report: Are Transformers..."
}
```

### Paso 6: Frontend Muestra Resultado

**MasDebateNode State:**
- status: "completed"
- report: (DebateReport completo)
- arguments: (3 DebaterArguments)
- history: [{ id, question, timestamp, ... }]

**Renders:**
- Sidebar con historial de debates
- "Run Another Debate" button
- MasDebateViewer con:
  - Tabs por tópico + "Final Verdict"
  - Por cada tópico: 3 argumentos de los debaters con sus scores
  - Final Verdict: ranking, insights, controversial points, recommended reads

**Usuario puede:**
- Hacer click en otros debates del historial para verlos
- Exportar el reporte como Markdown
- Hacer click en "Run Another Debate" para empezar otro

---

## 9. DETALLES TÉCNICOS CLAVE

### 9.1 OpenAI Integration

**Modelo:** gpt-4o-mini (configurable)

**Tool Calling (DebaterAgent):**
```typescript
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookupPaper",
      description: "...",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  // ... webSearch similar
];
```

**Temperature Settings:**
- FurtherQuestionsGenerator: 0.7 (diversidad)
- PostureGenerator: 0.7 (diversidad)
- DebaterAgent: 0.7 (creatividad en argumentación)
- JudgeAgent: 0.3 (consistencia en evaluación)

**Max Tokens:**
- Debaters: 4096
- Judge: 3000
- Others: 4096

### 9.2 Prompting Patterns

Todos los prompts usan:
1. **System prompt:** Role del agente, instrucciones detalladas
2. **User prompt:** Datos específicos, instrucciones de tarea
3. **JSON schema:** Especificación exacta del output esperado
4. **Examples:** Algunos prompts incluyen ejemplos (DebaterAgent)

### 9.3 Paralelismo

```typescript
const debatePromises = postures.map(async (posture, index) => {
  // Cada debater es independiente
  // Corre en paralelo
  // Se espera con Promise.all()
});

const results = await Promise.all(debatePromises);
```

Beneficio: 3 debaters que normalmente tardarían 3x ahora tardan ~1x

### 9.4 Error Handling

- Try-catch en coordinador
- Propagación de errores a controlador
- HTTP status codes apropiados
- SSE error events
- Manejo de fallos de OpenAI

### 9.5 Límites de Caracteres

Para evitar tokens excesivos:
- FurtherQuestionsGenerator: primeros 50k caracteres
- PostureGenerator: primeros 40k caracteres
- DebaterAgent: acceso a full text (pero con tool lookup limitada a top 5)

### 9.6 Validación JSON

```typescript
protected extractJsonFromResponse(response: OpenAI.ChatCompletion): any {
  // Intenta 3 formatos:
  // 1. JSON en code block: ```json {...}```
  // 2. JSON puro en el texto
  // 3. JSON incrustado: {...}
  // Si falla: error descriptivo
}
```

---

## 10. CASOS DE USO Y LÍMITES

### 10.1 Casos de Uso Ideales

1. **Análisis de papers controvertidos:** Donde hay múltiples perspectivas válidas
2. **Evaluación de novedosas:** ¿Realmente es revolucionario?
3. **Síntesis de perspectivas:** Consolidar múltiples viewpoints
4. **Identificación de gaps:** ¿Qué no se ha estudiado aún?
5. **Validación de claims:** Diferentes ángulos de crítica

### 10.2 Limitaciones Conocidas

1. **No verifica hechos reales:** El juez no valida URLs ni claims factuales
2. **Web search incompleto:** Fallback si TAVILY_API_KEY no está configurada
3. **Paper search simple:** Keyword-based, no semántico
4. **LLM hallucinations:** Posibles claimed papers/links no reales
5. **Contexto limitado:** Primeros 40-50k chars, papers grandes se truncan
6. **Temperatura fija:** No ajustable por usuario
7. **Rubrica fija:** No personalizable por usuario (YET)

### 10.3 Mejoras Futuras

1. **Vector embeddings:** Búsqueda semántica en papers
2. **Real web search:** Tavily, Google Custom Search, o Bing API
3. **Fact checking agente:** Validar claims factuales
4. **Custom rubrics:** API para rubrics personalizados
5. **Multi-paper debates:** Comparar múltiples papers
6. **Agent memory:** Recordar debates previos
7. **Streaming responses:** Stream debater arguments en tiempo real
8. **Human-in-the-loop:** Permitir interjecciones del usuario

---

## 11. RESUMEN EJECUTIVO

**El sistema MAS Debate es:**
- ✅ Totalmente funcional e implementado
- ✅ Produce resultados de calidad superior a debates manuales
- ✅ Soporta streaming en tiempo real con SSE
- ✅ Paraleliza debaters para eficiencia
- ✅ Incluye UI completa en frontend
- ✅ Integrado con el canvas de papel

**Arquitectura elegante:**
- 5 agentes especializados + orquestador
- Cada agente con responsabilidad clara
- Comunicación vía JSON estructurado
- Prompts altamente refinados

**Listo para:**
- Análisis académico profundo
- Investigación colaborativa
- Educación y aprendizaje
- Síntesis de perspectivas

---

**FIN DEL ANÁLISIS**
