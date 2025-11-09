import OpenAI from "openai";
import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  DebaterArgument,
  WebSearchResult,
} from "../../types/debate.types";

export type FactCheckStatus = "True" | "False" | "Uncertain" | "NotApplicable";

export type CheckedClaim = {
  claim: string;
  verifiable: boolean;
  status: FactCheckStatus;
  evidence: WebSearchResult[];
  notes: string;
};

export type TopicFactCheck = {
  topic: string;
  checkedClaims: CheckedClaim[];
  topicVerdict: {
    trueCount: number;
    falseCount: number;
    uncertainCount: number;
    verifiableCount: number;
    factualScore: number;
  };
};

export type DebaterFactCheck = {
  posture: string;
  perTopic: TopicFactCheck[];
  totals: {
    meanFactualScore: number;
    trueTotal: number;
    falseTotal: number;
  };
};

export type FactCheckSummary = {
  factCheckSummary: DebaterFactCheck[];
};

export interface FactCheckRequest {
  arguments: DebaterArgument[];
}

export class FactCheckerAgent extends BaseDebateAgent {
  async checkFacts(request: FactCheckRequest): Promise<FactCheckSummary> {
    const { arguments: debaterArguments } = request;

    const systemPrompt = `${this.getSystemPrompt()}

### PURPOSE

Your task is to assess the **factual accuracy** of each Debater's statements by performing web searches.

You DO NOT judge the logic, rhetoric, or argument quality — only factual correctness.

### YOUR TOOLS

- You can call the \`webSearch(query)\` function to verify factual claims.
- Each query should focus on verifying the **key factual statement** in a claim.
- You may issue multiple searches if the claim includes several verifiable facts.

### HOW TO JUDGE A FACT

When evaluating, ask:

1. **Is the claim verifiable?**  
   - If it expresses an opinion, theory, or hypothetical reasoning → mark as "Not applicable".

2. **Does the claim agree with reliable web sources?**  
   - If at least 2 independent, reputable sources (academic, .edu, .gov, or known news outlets) confirm → mark "True".
   - If multiple sources contradict or lack evidence → mark "False".
   - If unclear or ambiguous → mark "Uncertain".

3. **Provide supporting evidence snippets and URLs**.

### OUTPUT FORMAT

Return JSON like this:

{
  "factCheckSummary": [
    {
      "posture": string,
      "perTopic": [
        {
          "topic": string,
          "checkedClaims": [
            {
              "claim": string,
              "verifiable": boolean,
              "status": "True" | "False" | "Uncertain" | "NotApplicable",
              "evidence": WebSearchResult[],
              "notes": string
            }
          ],
          "topicVerdict": {
            "trueCount": number,
            "falseCount": number,
            "uncertainCount": number,
            "verifiableCount": number,
            "factualScore": number
          }
        }
      ],
      "totals": {
        "meanFactualScore": number,
        "trueTotal": number,
        "falseTotal": number
      }
    }
  ]
}

### SCORING RULES

- Each "True" claim = 1 point, "False" = 0, "Uncertain" = 0.5
- \`factualScore\` = True / Verifiable claims
- Skip non-verifiable reasoning (philosophical, ethical, speculative)

### NOTES

- Use short, reliable snippets as evidence.
- Do not fabricate URLs or snippets.
- Summarize the main tendency of results in \`notes\`.
- You do not rank postures — just check factual reliability.

### END TASK

Return valid JSON matching the schema.`;

    const argumentsText = JSON.stringify(debaterArguments, null, 2);

    const userPrompt = `Here are the debater arguments to fact-check:

${argumentsText}

For each debater and each topic, identify verifiable factual claims and check them using webSearch. Return the complete fact-check summary in JSON format.`;

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "webSearch",
          description:
            "Search the web to verify factual claims. Returns relevant web results from reliable sources.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to verify a specific factual claim",
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

    let finalResponse: FactCheckSummary | null = null;
    let iterations = 0;
    const maxIterations = 15; // More iterations for fact-checking

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
          finalResponse = this.extractJsonFromResponse(response) as FactCheckSummary;
          break;
        } catch (e) {
          // If we can't extract JSON, add assistant message and ask for JSON
          messages.push({
            role: "assistant",
            content: message.content || "",
          });
          messages.push({
            role: "user",
            content: "Please provide your complete fact-check summary in the required JSON format.",
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

        if (toolName === "webSearch") {
          result = await this.webSearch(toolInput.query);
        } else {
          result = { error: "Unknown tool" };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalResponse) {
      throw new Error("Failed to get final response from fact-checker");
    }

    return finalResponse;
  }

  private async webSearch(query: string): Promise<WebSearchResult[]> {
    console.log('[FactCheckerAgent] Web searching for fact-check:', query);

    // Mock web search implementation
    // In production, this would call a real search API (Google, Bing, Tavily, etc.)
    return [
      {
        title: `Fact-check: ${query}`,
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
        snippet: `Mock fact-check result for "${query}". In production, this would return real web search results from reliable sources like academic databases, .edu/.gov sites, and reputable news outlets.`,
      },
      {
        title: `${query} - Verification`,
        url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`,
        snippet: `Additional verification context for ${query}. This demonstrates the fact-checking capability with multiple sources.`,
      },
    ];
  }
}

