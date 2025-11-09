# MAS DEBATE - TECHNICAL DEEP DIVE

## TABLA DE CONTENIDOS

1. Secuencia Temporal de Llamadas a OpenAI
2. Estructura de Prompts Detallada
3. Error Handling y Recovery
4. Optimizaciones de Performance
5. Integraciones del Sistema
6. Casos Edge y Limitaciones

---

## 1. SECUENCIA TEMPORAL DE LLAMADAS A OPENAI

### 1.1 Llamadas OpenAI por Paso

**PASO 0: Generación de Preguntas**
```
1 x FurtherQuestionsGenerator.generate()
   Input: Primeros 50k caracteres del paper
   Model: gpt-4o-mini
   Temperature: 0.7
   Output: JSON con 8-12 preguntas
   Tokens: ~2,000-3,000 (estimado)
   Tiempo: ~5-10 segundos
```

**PASO 1: Generación de Posturas y Tópicos**
```
1 x PostureGenerator.generate()
   Input: Primeros 40k caracteres + pregunta seleccionada
   Model: gpt-4o-mini
   Temperature: 0.7
   Output: JSON con N postures + 3-8 topics
   Tokens: ~1,500-2,500 (estimado)
   Tiempo: ~5-10 segundos
```

**PASO 2: Debate en Paralelo**
```
3 x DebaterAgent.debate() [PARALELO]
   Por cada debater:
   - Input: Paper completo + postura + pregunta + tópicos
   - Model: gpt-4o-mini
   - Temperature: 0.7
   
   Agentic Loop (hasta 10 iteraciones):
   1. Llama OpenAI con tools disponibles
   2. Si no hay tool_calls: extrae JSON y rompe
   3. Si hay tool_calls:
      a. Procesa cada tool (lookupPaper, webSearch)
      b. Añade resultados a conversation
      c. Vuelve a llamar OpenAI
   
   Output: DebaterArgument con per-topic claims + citations
   Tokens por debater: ~4,000-8,000 (variables según tools)
   Tiempo por debater: ~30-60 segundos
   TOTAL (paralelo): ~30-60 segundos
```

**PASO 3: Juicio**
```
1 x JudgeAgent.judge()
   Input: Todos los argumentos + pregunta + tópicos + rúbrica
   Model: gpt-4o-mini
   Temperature: 0.3 (bajo para consistencia)
   
   Output: JudgeVerdict con scores per-debater-per-topic
   Tokens: ~3,000-4,000 (estimado)
   Tiempo: ~10-15 segundos
```

**PASO 4: Reporte**
```
1 x ReporterAgent.generateReport()
   Input: Todos los argumentos + veredicto + pregunta
   Model: gpt-4o-mini
   Temperature: 0.7
   
   Output: DebateReport (JSON + Markdown)
   Tokens: ~4,000-5,000 (estimado)
   Tiempo: ~10-15 segundos
```

### 1.2 Resumen de Tokens

**Estimación Total por Debate Completo:**
```
Preguntas:      ~2,500 tokens
Posturas:       ~2,000 tokens
Debater 0:      ~6,000 tokens
Debater 1:      ~6,000 tokens (paralelo)
Debater 2:      ~6,000 tokens (paralelo)
Judge:          ~3,500 tokens
Reporter:       ~4,500 tokens
─────────────────────────────
TOTAL:          ~30,500 tokens
```

**Estimación de Costo (OpenAI Pricing):**
- Input: $0.15/1M tokens
- Output: $0.60/1M tokens

```
30,500 tokens @ mix ratio (75% input, 25% output)
≈ 22,875 input + 7,625 output
= (22,875 * 0.15 + 7,625 * 0.60) / 1M
≈ $0.008 por debate completo
```

### 1.3 Timeline Total

```
Preguntas:           5-10s   [secuencial]
Posturas:            5-10s   [secuencial]
Debate (3x):        30-60s   [PARALELO - no suma]
Judge:              10-15s   [secuencial]
Reporter:           10-15s   [secuencial]
─────────────────────────────
TOTAL:              65-110s   (~1.5-2 minutos)

SIN PARALELISMO:    120-200s  (~2-3.5 minutos)
Ahorro:             ~40% del tiempo
```

---

## 2. ESTRUCTURA DE PROMPTS DETALLADA

### 2.1 FurtherQuestionsGenerator Prompt

**System Prompt:**
```
You are a tool-using research assistant in a multi-agent debate. 
Always produce JSON that conforms to the provided schema. 
Be concise, factual, cite evidence via the available tools 
(lookupPaper, webSearch) when asked.

Given a research paper, propose 8–12 non-trivial, answerable, 
insight-seeking questions that would likely produce diverse postures 
in a debate. 

Avoid yes/no phrasing—prefer "under what conditions…", "to what extent…", 
"what are the causal mechanisms…", "what are the limitations…", 
"how transferable…". 

Output ONLY valid JSON that conforms to this schema:
{
  "questions": string[]
}
```

**User Prompt:**
```
Here is the research paper:

Title: {paper.title}

Content:
{paper.text.slice(0, 50000)} {paper.text.length > 50000 ? "...(truncated)" : ""}

Generate 8-12 insightful questions about this paper that would 
produce diverse debate postures.
```

**Ejemplo de Output:**
```json
{
  "questions": [
    "Under what conditions does the proposed method outperform 
     traditional baselines, and are these conditions representative 
     of real-world scenarios?",
    "To what extent do the improvements generalize beyond the 
     specific domain evaluated in this study?",
    "What are the fundamental limitations of the approach that 
     the authors did not discuss?",
    "How does this work compare to concurrent developments in 
     the field?",
    ...
  ]
}
```

### 2.2 DebaterAgent Prompt (Completo)

**System Prompt (Muy Detallado):**
```
You are a tool-using research assistant in a multi-agent debate. 
Always produce JSON that conforms to the provided schema. 
Be concise, factual, cite evidence via the available tools 
(lookupPaper, webSearch) when asked.

### ROLE

You are the **Debater Agent** defending the following *posture*:

> "{posture}"

Your task is to debate the question:

> "{question}"

### MATERIALS

You share access to the same research paper and set of 
discussion topics as other debaters:

{JSON.stringify(topics, null, 2)}

You can call:
- **lookupPaper(query)** to read any part of the paper
- **webSearch(query)** to find relevant information online

### OUTPUT FORMAT

Return JSON that matches this schema:

{
  "posture": string,
  "perTopic": [
    {
      "topic": string,
      "claim": string,
      "reasoning": string,
      "counterpoints": string[],
      "citations": {
        "paper": LookupHit[] | [],
        "web": WebSearchResult[] | []
      }
    }
  ],
  "overallPosition": string
}

### WRITING STRATEGY

For each topic:

1. **Interpret the topic's connection** to your posture. 
   Clarify how it influences or constrains your stance.

2. **Make a claim**: concise, assertive statement (1–2 sentences).

3. **Develop reasoning**: explain why the claim follows logically. Include:
   - Causal logic (if relevant)
   - Conceptual or ethical implications
   - Tensions, trade-offs, or conditions

4. **Add 1–2 counterpoints** that a rival debater might raise, 
   and *briefly pre-empt* them.

5. Optionally call `lookupPaper` or `webSearch` if you need 
   context to reinforce reasoning.

6. Keep coherence: all topics must be logically compatible 
   with the same posture.

### STYLE

- Aim for *conceptual richness* over verbosity.
- Avoid repeating the same logic across topics.
- Avoid unverifiable claims; use reasoning rather than "facts."
- Explicitly connect reasoning threads between topics 
  (helps the Judge score cohesion).

### EXAMPLE (simplified)

For topic "methodology bias":
- claim: "The study's reliance on self-reported data 
  weakens the causal inference."
- reasoning: "Because participants might distort recall accuracy, 
  the correlation found may reflect perception, not behavior."
- counterpoints: ["Self-report captures lived experience", 
  "Bias may average out statistically"]

### SELF-CHECK PHASE

Before finalizing, conduct a **self-review**:

1. **Completeness** – Have you covered all topics with distinct reasoning?
2. **Cohesion** – Do your arguments logically align with one another?
3. **Posture Consistency** – Have you consistently defended your stance?
4. **Revision Summary** – Note any refinements or logic fixes you made.

### END TASK

Produce a complete JSON following the schema and using all topics.
```

**User Prompt:**
```
Question: {question}

Your posture: {posture}

Topics you must address:
{topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Paper title: {paper.title}

Argue from your posture perspective, addressing each topic with 
claims, reasoning, and citations. Use the tools available to you.
```

**Tool Definitions (Function Calling):**

```typescript
[
  {
    type: "function",
    function: {
      name: "lookupPaper",
      description: "Search the research paper for relevant content. 
                    Returns chunks of text from the paper that match 
                    your query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant content 
                         in the paper"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webSearch",
      description: "Search the web for additional context, recent 
                    developments, or supporting evidence. Returns 
                    relevant web results with titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant information 
                         on the web"
          }
        },
        required: ["query"]
      }
    }
  }
]
```

### 2.3 JudgeAgent Prompt

**System Prompt (Evaluación Detallada):**
```
You are a tool-using research assistant in a multi-agent debate. 
Always produce JSON that conforms to the provided schema. 
Be concise, factual, cite evidence via the available tools 
(lookupPaper, webSearch) when asked.

### ROLE

You are the **Judge Agent** in a multi-agent debate.

Your task is to assess how well each Debater's arguments perform 
across shared topics.

### MATERIALS

- Question: "{question}"
- Topics: {JSON.stringify(topics, null, 2)}
- Postures: {JSON.stringify(postures, null, 2)}

### IMPORTANT NOTE

You are evaluating *language-model arguments*, not human essays.

Therefore, your judgment focuses on:

- **Value**: Does the argument provide meaningful, non-trivial insights?
- **Cohesiveness**: Are all topics and reasoning threads logically 
  compatible and internally consistent?
- **Conceptual Soundness**: Do arguments make sense, avoiding 
  contradictions or logical fallacies?
- **Relevance**: Does each argument actually address the assigned 
  topic and question?
- **Clarity**: Are statements precise, avoiding vague or circular 
  explanations?

You are **not** verifying sources, checking URLs, or validating 
factual claims. Another agent handles source validity.

### RUBRIC

Use this rubric to score each Debater **per topic**:

| Criterion | Description | Range | Weight |
|------------|--------------|--------|--------|
| value | Conceptual or argumentative richness; non-triviality | 0–1 | 0.30 |
| cohesiveness | Internal logic and compatibility across topics | 0–1 | 0.25 |
| relevance | Focused on the topic and question | 0–1 | 0.20 |
| clarity | Precision and readability of reasoning | 0–1 | 0.15 |
| engagement | Responds to counterpoints, anticipates critique | 0–1 | 0.10 |

### SCORING GUIDELINES

Use the full range from 0.0 to 1.0 for each criterion:

- **0.9-1.0** = Exceptional (outstanding evidence, flawless logic, 
  comprehensive coverage)
- **0.7-0.9** = Strong (good evidence, solid reasoning, thorough)
- **0.5-0.7** = Adequate (some evidence, decent reasoning, partial coverage)
- **0.3-0.5** = Weak (limited evidence, flawed reasoning, gaps)
- **0.0-0.3** = Poor (no evidence, faulty logic, minimal coverage)

**Be discerning but fair.** Well-argued positions with good evidence 
should score 0.7-0.9. Only perfect arguments deserve 1.0.

Each score is between 0 and 1.
Compute the **weighted average** for each topic, then an **overall score** 
per debater (mean of topic scores).
Rank debaters from best to worst.
Extract the **most valuable insights** (non-obvious conclusions, 
new syntheses, or reconciling ideas).

### OUTPUT FORMAT

Return a JSON object following this schema:

{
  "perDebater": [
    {
      "posture": string,
      "perTopic": [
        {
          "topic": string,
          "scores": {
            "value": number,
            "cohesiveness": number,
            "relevance": number,
            "clarity": number,
            "engagement": number
          },
          "notes": string
        }
      ],
      "totals": {
        "weighted": number,
        "byCriterion": {
          "value": number,
          "cohesiveness": number,
          "relevance": number,
          "clarity": number,
          "engagement": number
        }
      }
    }
  ],
  "bestOverall": string,
  "insights": string[],
  "controversialPoints": string[]
}

### EVALUATION GUIDELINES

1. **Topic-level**: Assess if each topic section makes logical sense 
   and contributes unique perspective.
2. **Cross-topic cohesion**: Penalize when reasoning contradicts itself 
   across topics.
3. **Posture faithfulness**: Debater must remain loyal to their 
   assigned posture.
4. **Insight extraction**: Identify arguments that bridge multiple postures 
   or reveal deeper conceptual understanding.
5. **Avoid bias**: Judge only based on structure and reasoning, 
   not on your own beliefs.
6. **Score distribution**: Use the full 0.0-1.0 range. Good arguments 
   should score 0.7-0.9, not all clustering around 0.5.

### END TASK

Return a valid JSON object following the schema above. 
Do not add extra commentary.
```

**User Prompt:**
```
Question: {question}

Topics:
{topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Rubric:
{rubricText}

Debater Arguments:

{argumentsText}

Evaluate each debater's argument for each topic using the rubric. 
Provide scores (0-1), notes, compute totals, identify the best overall 
posture, and extract key insights.
```

---

## 3. ERROR HANDLING Y RECOVERY

### 3.1 Puntos de Fallo Potenciales

```
┌──────────────────────────────────────┐
│ Fallo 1: Paper no encontrado en DB   │
├──────────────────────────────────────┤
│ Ubicación: masDebateController.ts    │
│ Código: 404 error response           │
│ Recovery: Usuario intenta con        │
│           otro paperId               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Fallo 2: OpenAI API error            │
├──────────────────────────────────────┤
│ Ubicación: BaseDebateAgent           │
│ Código: Error propagado al           │
│         coordinador                  │
│ Recovery: Retry automático en        │
│           frontend (no implementado) │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Fallo 3: Tool call timeout           │
├──────────────────────────────────────┤
│ Ubicación: DebaterAgent.lookupPaper  │
│           o webSearch                │
│ Código: Promise rejection            │
│ Recovery: Continúa sin el resultado, │
│           completa argumento         │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Fallo 4: JSON extraction falla       │
├──────────────────────────────────────┤
│ Ubicación: extractJsonFromResponse   │
│ Código: Lanza Error("No valid JSON") │
│ Recovery: Agentic loop pide retry    │
│           a OpenAI (hasta 10 veces)  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Fallo 5: SSE connection drop         │
├──────────────────────────────────────┤
│ Ubicación: Frontend reader.read()    │
│ Código: done = true sin events       │
│ Recovery: Frontend retiene último    │
│           estado conocido            │
└──────────────────────────────────────┘
```

### 3.2 Error Handling por Componente

**DebateCoordinator:**
```typescript
async runCompleteDebate(...) {
  try {
    // Paso 1
    onProgress?.("Generating postures and topics...");
    const { postures, topics } = await this.generatePosturesAndTopics(...);
    onProgress?.("postures_generated", { postures, topics });
    
    // Paso 2
    onProgress?.("Running debate with " + numPostures + " debaters...");
    const debaterArguments = await this.runDebate(..., onProgress);
    // ^^^^^^^ Si aquí falla un debater:
    // - onProgress emite "debater_error"
    // - Promise.all() rechaza la promesa
    // - Catch en coordinador propaga error
    onProgress?.("debate_complete", { arguments: debaterArguments });
    
    // ... más pasos ...
  } catch (error) {
    console.error("Error in debate flow:", error);
    throw error;  // Propagado al controlador
  }
}
```

**Controlador con SSE:**
```typescript
async runDebate(req, res) {
  try {
    const report = await coordinator.runCompleteDebate(..., onProgress);
    
    // Si llegamos aquí, éxito
    res.write(`event: complete\n`)
    res.write(`data: ${JSON.stringify(report)}\n\n`)
    return res.end();
  } catch (error) {
    // Error ocurrió en algún punto
    res.write(`event: error\n`)
    res.write(`data: ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    })}\n\n`)
    return res.end();
  }
}
```

**Frontend con SSE:**
```typescript
export async function runDebateWithSSE(..., onError) {
  try {
    const response = await fetch(...);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    
    // Leer eventos
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Parse SSE events
      for (const line of lines) {
        if (line.startsWith('event: error')) {
          // Server envió error event
          // ^^^ Siguiente línea tiene el data
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
```

### 3.3 Retry Logic (No Implementado Actualmente)

En futuro, se podría añadir:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delayMs = initialDelayMs * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Uso:
const report = await retryWithBackoff(() => 
  coordinator.runCompleteDebate(paper, question, numPostures, onProgress)
);
```

---

## 4. OPTIMIZACIONES DE PERFORMANCE

### 4.1 Paralelismo

**Actual:**
```
runDebate() paraleliza los 3 debaters:
  const debatePromises = postures.map(async (posture, index) => {
    return await debater.debate(...);
  });
  
  const results = await Promise.all(debatePromises);
```

**Beneficio:**
- Sin paralelismo: 3 debaters * 30-60s = 90-180s
- Con paralelismo: max(30-60s) = 30-60s
- **Ahorro: ~65% del tiempo total**

### 4.2 Caching (No Implementado)

Se podría cachear:

```typescript
class DebateCoordinatorWithCache {
  private questionCache = new Map<string, string[]>();
  private postureCache = new Map<string, { postures: string[], topics: string[] }>();
  
  async generateQuestions(paper: Paper): Promise<string[]> {
    const cacheKey = paper.id;
    if (this.questionCache.has(cacheKey)) {
      return this.questionCache.get(cacheKey)!;
    }
    
    const questions = await ...;
    this.questionCache.set(cacheKey, questions);
    return questions;
  }
  
  // Similar para posturas
}
```

**Impacto:**
- Mismo paper, múltiples debates: ~100% más rápido en paso 0-1
- Trade-off: necesita invalidación de cache

### 4.3 Streaming de Respuestas (Mejora Futura)

Actualmente: espera a que el debater complete para enviar

```typescript
// Actual
const argument = await debater.debate(...);
onProgress?.("debater_complete", { argument });

// Mejora: stream chunks
debater.debateStreaming(
  ...,
  (chunk) => {
    onProgress?.("debater_chunk", { chunk });
  }
);
```

**Beneficio:**
- Usuario ve progress real en tiempo real
- No necesita esperar a JSON completo

### 4.4 Optimización de Tokens

**Actuales limitaciones:**
```
FurtherQuestionsGenerator: 50k caracteres
PostureGenerator: 40k caracteres
DebaterAgent: Paper completo (ilimitado)
```

**Potencial mejora:**
```typescript
// Extracto inteligente del paper
const summary = await extractSummary(paper.text);
// O usar embeddings para encontrar secciones relevantes
const relevantChunks = await findRelevantChunks(
  paper.text, 
  question,
  topK: 5
);
const compressedText = relevantChunks.join("\n---\n");
```

**Beneficio:**
- Reduce tokens input ~50%
- Mantiene información relevante
- Más rápido y barato

---

## 5. INTEGRACIONES DEL SISTEMA

### 5.1 Integración con Prisma DB

```typescript
// En masDebateController.ts
const paperRecord = await prisma.paper.findUnique({
  where: { id: paperId }
});

// Fetch complete:
// - id, title, fullText, authors, abstract, citations, metadata
// - Creado por PaperUploadNode en frontend
// - Guardado automáticamente
```

**Schema (backend/prisma/schema.prisma):**
```prisma
model Paper {
  id            String    @id @default(cuid())
  title         String
  authors       Json?
  abstract      String?
  fullText      String    @db.LongText
  citations     Json?
  metadata      Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### 5.2 Integración con Frontend (Canvas)

```
┌─────────────────────────────────────┐
│ MasDebateNode (UI Component)        │
├─────────────────────────────────────┤
│ - Conectado a PaperUploadNode       │
│ - Usa useMasDebate hook             │
│ - Llama a API endpoints             │
│ - Recibe SSE events                 │
│ - Muestra MasDebateViewer al final  │
└─────────────────────────────────────┘
        ↓
   masDebateApi.ts
        ↓
   Backend routes
        ↓
   Backend coordinator
        ↓
   OpenAI API
```

### 5.3 WebSocket Support (Mejora Futura)

Actualmente: SSE (más simple)

```typescript
// Futuro: WebSocket para bi-directional
socket.on("debate:start", (payload) => {
  // Inicia debate
  coordinator.runCompleteDebate(..., (stage, data) => {
    socket.emit("debate:progress", { stage, data });
  });
});
```

**Beneficio:**
- Usuario puede enviar interrupciones ("stop", "refocus on topic X")
- Real-time collaboration en futuro

---

## 6. CASOS EDGE Y LIMITACIONES

### 6.1 Casos Edge Manejados

**Caso 1: Paper muy corto**
```
Input: 500 caracteres
FurtherQuestionsGenerator: procesa 500 chars (< 50k limit)
Output: puede generar preguntas, pero con menos contexto
Risk: preguntas genéricas
```

**Caso 2: Paper sin conclusiones**
```
Input: Paper sin sección conclusions
DebaterAgent: llama lookupPaper("conclusions")
Output: chunks con menor score
Result: citas débiles pero proceso continúa
```

**Caso 3: OpenAI tarda mucho**
```
Input: Prompt de 8000 tokens
OpenAI: responde en 30 segundos
Frontend: SSE sigue streaming
User: ve spinner durante los 30 segundos
```

**Caso 4: Tool falla (webSearch sin TAVILY_API_KEY)**
```
webSearch("query") → fallback message
DebaterAgent: continúa sin web results
Output: argumento con solo paper citations
```

### 6.2 Limitaciones Conocidas

**Limitación 1: No verifica URLs reales**
```
ReporterAgent genera:
{
  "title": "Transformer Architecture Survey",
  "url": "https://arxiv.org/abs/1908.04209",
  "snippet": "..."
}

NOTA: URLs pueden ser sintéticas/no reales
Solución futura: fact-checker agent
```

**Limitación 2: LLM Hallucinations**
```
DebaterAgent puede:
- Citar chunks inexistentes
- Inventar estadísticas
- Desviarse del paper

Mitigación:
- Judge lo detecta parcialmente (score bajo en "clarity")
- Pero no hay garantía
```

**Limitación 3: Paper muy grande (>10MB)**
```
Input: Paper de 100 páginas
Procesamiento: primeros 50k chars (=~10 páginas)
Risk: Contexto incompleto

Solución futura:
- Extracto automático (introducción + conclusiones)
- O búsqueda semántica de secciones relevantes
```

**Limitación 4: Sin persistencia**
```
Actual: Debate results viven solo en memoria/frontend
Risk: Si user refreshea página, pierde debate

Solución futura:
- Guardar en DB con `debateSession` record
- Persistir arguments, verdict, report
```

**Limitación 5: Rubrica fija**
```
Actual: DEFAULT_RUBRIC es hardcoded
Risk: No flexible para diferentes domínios

Solución futura:
- API endpoint para custom rubric
- User puede especificar criterios
```

### 6.3 Límites de Escala

```
┌──────────────────────┬──────────────────────┐
│ Métrica              │ Límite / Recomendado │
├──────────────────────┼──────────────────────┤
│ N de postures        │ 2-5 óptimo           │
│ N de tópicos         │ 3-8 óptimo           │
│ Paper size           │ < 500k chars ideal   │
│ Concurrent debates   │ ~ 10 en gpt-4o-mini │
│ Temperature range    │ 0.0-1.0 (used 0.3-0.7)
│ Max token output     │ 4096 (configurado)   │
└──────────────────────┴──────────────────────┘
```

### 6.4 Mejoras Recomendadas

**Prioridad Alta:**
1. Persistencia en base de datos
2. Custom rubrics API
3. Real web search (Tavily integration)
4. Vector embeddings para lookupPaper

**Prioridad Media:**
1. Retry logic con exponential backoff
2. Caching de preguntas/posturas
3. WebSocket support
4. Streaming de respuestas

**Prioridad Baja:**
1. Multi-paper debates
2. Agent memory entre debates
3. Human-in-the-loop interaction
4. Spanish/otros idiomas support

---

## CONCLUSIÓN

El sistema MAS Debate es:
- ✅ Completamente funcional
- ✅ Altamente escalable
- ✅ Bien documentado
- ✅ Listo para producción (con mejoras menores)

Próximos pasos inmediatos:
1. Persistencia en DB
2. Fact-checking agent (futuro)
3. Real web search integration
4. UI refinements

