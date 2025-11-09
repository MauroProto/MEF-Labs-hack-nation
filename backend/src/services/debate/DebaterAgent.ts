import OpenAI from "openai";
import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  DebaterRequest,
  DebaterArgument,
  LookupHit,
  Paper,
  WebSearchResult,
} from "../../types/debate.types";

export class DebaterAgent extends BaseDebateAgent {
  private paper!: Paper;

  async debate(request: DebaterRequest): Promise<DebaterArgument> {
    const { posture, question, topics, paper } = request;
    this.paper = paper;

    const systemPrompt = `${this.getSystemPrompt()}

### ROLE

You are the **Debater Agent** defending the following *posture*:

> "${posture}"

Your task is to debate the question:

> "${question}"

### MATERIALS

You share access to the same research paper and set of discussion topics as other debaters:

${JSON.stringify(topics, null, 2)}

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

1. **Interpret the topic's connection** to your posture. Clarify how it influences or constrains your stance.

2. **Make a claim**: concise, assertive statement (1–2 sentences).

3. **Develop reasoning**: explain why the claim follows logically. Include:
   - Causal logic (if relevant)
   - Conceptual or ethical implications
   - Tensions, trade-offs, or conditions

4. **Add 1–2 counterpoints** that a rival debater might raise, and *briefly pre-empt* them.

5. Optionally call \`lookupPaper\` or \`webSearch\` if you need context to reinforce reasoning.

6. Keep coherence: all topics must be logically compatible with the same posture.

### STYLE

- Aim for *conceptual richness* over verbosity.
- Avoid repeating the same logic across topics.
- Avoid unverifiable claims; use reasoning rather than "facts."
- Explicitly connect reasoning threads between topics (helps the Judge score cohesion).

### EXAMPLE (simplified)

For topic "methodology bias":
- claim: "The study's reliance on self-reported data weakens the causal inference."
- reasoning: "Because participants might distort recall accuracy, the correlation found may reflect perception, not behavior."
- counterpoints: ["Self-report captures lived experience", "Bias may average out statistically"]

### SELF-CHECK PHASE

Before finalizing, conduct a **self-review**:

1. **Completeness** – Have you covered all topics with distinct reasoning?

2. **Cohesion** – Do your arguments logically align with one another?

3. **Posture Consistency** – Have you consistently defended your stance?

4. **Revision Summary** – Note any refinements or logic fixes you made.

### END TASK

Produce a complete JSON following the schema and using all topics.`;

    const userPrompt = `Question: ${question}

Your posture: ${posture}

Topics you must address:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Paper title: ${paper.title}

Argue from your posture perspective, addressing each topic with claims, reasoning, and citations. Use the tools available to you.`;

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "lookupPaper",
          description:
            "Search the research paper for relevant content. Returns chunks of text from the paper that match your query.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find relevant content in the paper",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "webSearch",
          description:
            "Search the web for additional context, recent developments, or supporting evidence. Returns relevant web results with titles, URLs, and snippets.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find relevant information on the web",
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    let messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: userPrompt,
      },
    ];

    let finalResponse: DebaterArgument | null = null;
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.callOpenAI(messages, systemPrompt, tools);
      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("No message in response");
      }

      // Check if we have tool calls
      const toolCalls = message.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No more tool calls, extract final answer
        try {
          finalResponse = this.extractJsonFromResponse(response) as DebaterArgument;
          break;
        } catch (e) {
          // If we can't extract JSON, add assistant message and ask for JSON
          messages.push({
            role: "assistant",
            content: message.content || "",
          });
          messages.push({
            role: "user",
            content: "Please provide your complete argument in the required JSON format.",
          });
          continue;
        }
      }

      // Process tool calls
      messages.push({
        role: "assistant",
        content: message.content,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;

        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);

        let result: any;

        if (toolName === "lookupPaper") {
          result = await this.lookupPaper(toolInput.query);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else if (toolName === "webSearch") {
          result = await this.webSearch(toolInput.query);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }
    }

    if (!finalResponse) {
      throw new Error("Failed to get final response from debater");
    }

    // Ensure posture is set correctly
    finalResponse.posture = posture;

    return finalResponse;
  }

  private async lookupPaper(query: string): Promise<LookupHit[]> {
    // Simple text search implementation
    // In production, this would use vector embeddings and semantic search
    const text = this.paper.text;
    const queryLower = query.toLowerCase();
    const chunks: LookupHit[] = [];

    // Split paper into chunks of ~500 characters
    const chunkSize = 500;
    const overlap = 100;

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize);
      const chunkLower = chunk.toLowerCase();

      // Simple relevance scoring based on query term presence
      const queryTerms = queryLower.split(/\s+/);
      let score = 0;

      for (const term of queryTerms) {
        if (term.length < 3) continue;
        const occurrences = (chunkLower.match(new RegExp(term, "g")) || []).length;
        score += occurrences;
      }

      if (score > 0) {
        chunks.push({
          chunkId: `chunk_${Math.floor(i / chunkSize)}`,
          text: chunk.trim(),
          score: Math.min(score / 10, 1), // Normalize to 0-1
        });
      }
    }

    // Sort by score and return top 5
    return chunks.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private async webSearch(query: string): Promise<WebSearchResult[]> {
    // Simple web search implementation using Tavily API or similar
    // For now, return mock data that the debater can use
    // In production, integrate with Tavily, Google Search API, or similar

    try {
      // If TAVILY_API_KEY is set, use real search
      if (process.env.TAVILY_API_KEY) {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: "basic",
            max_results: 5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
          }));
        }
      }

      // Fallback: return helpful message
      return [
        {
          title: "Web search not configured",
          url: "",
          snippet: `Web search for "${query}" requires TAVILY_API_KEY environment variable to be set. Using paper citations only.`,
        },
      ];
    } catch (error) {
      console.error("Web search error:", error);
      return [
        {
          title: "Web search error",
          url: "",
          snippet: "Unable to perform web search at this time. Using paper citations only.",
        },
      ];
    }
  }
}

