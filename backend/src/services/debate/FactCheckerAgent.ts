import OpenAI from "openai";
import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  DebaterArgument,
  WebSearchResult,
  Paper,
} from "../../types/debate.types";
import { webSearch } from "./webSearchService";

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
  paper: Paper;
}

export class FactCheckerAgent extends BaseDebateAgent {
  /**
   * Intelligent fact-checking that only verifies claims that:
   * 1. Sound like they could be false
   * 2. Are not directly from the paper
   * 3. Make specific external factual assertions
   */
  async checkFacts(request: FactCheckRequest): Promise<FactCheckSummary> {
    const { arguments: debaterArguments, paper } = request;
    
    console.log(`[FactChecker] Starting intelligent fact-check for ${debaterArguments.length} debaters...`);

    const factCheckSummary: DebaterFactCheck[] = [];

    for (const arg of debaterArguments) {
      console.log(`[FactChecker] Checking posture: ${arg.posture}`);
      
      const debaterCheck: DebaterFactCheck = {
        posture: arg.posture,
        perTopic: [],
        totals: {
          meanFactualScore: 0,
          trueTotal: 0,
          falseTotal: 0,
        },
      };

      for (const topicArg of arg.perTopic) {
        const topicCheck: TopicFactCheck = {
          topic: topicArg.topic,
          checkedClaims: [],
          topicVerdict: {
            trueCount: 0,
            falseCount: 0,
            uncertainCount: 0,
            verifiableCount: 0,
            factualScore: 0,
          },
        };

        // Check if this claim needs fact-checking
        const needsFactCheck = await this.shouldFactCheck(paper, topicArg.claim, topicArg.reasoning);
        
        if (!needsFactCheck.shouldCheck) {
          console.log(`[FactChecker] Skipping topic "${topicArg.topic}": ${needsFactCheck.reason}`);
          
          topicCheck.checkedClaims.push({
            claim: topicArg.claim.slice(0, 200),
            verifiable: false,
            status: "NotApplicable",
            evidence: [],
            notes: needsFactCheck.reason,
          });
        } else {
          console.log(`[FactChecker] Checking topic "${topicArg.topic}": ${needsFactCheck.reason}`);
          
          // Perform web search to verify the suspicious claim
          const searchQuery = needsFactCheck.extractedClaim || topicArg.claim;
          const searchResults = await webSearch(searchQuery, 3);
          
          // Check if we got real results (not fallback)
          const isRealSearch = searchResults.length > 0 && searchResults[0].url !== "";
          
          if (isRealSearch) {
            topicCheck.topicVerdict.verifiableCount++;
            
            // Use LLM to analyze if the search results support or refute the claim
            const verification = await this.verifyClaimWithEvidence(
              searchQuery,
              searchResults
            );
            
            if (verification.status === "True") {
              topicCheck.topicVerdict.trueCount++;
            } else if (verification.status === "False") {
              topicCheck.topicVerdict.falseCount++;
            } else {
              topicCheck.topicVerdict.uncertainCount++;
            }
            
            topicCheck.checkedClaims.push({
              claim: searchQuery.slice(0, 200),
              verifiable: true,
              status: verification.status,
              evidence: searchResults.slice(0, 2),
              notes: verification.notes,
            });
          } else {
            topicCheck.checkedClaims.push({
              claim: searchQuery.slice(0, 200),
              verifiable: false,
              status: "Uncertain",
              evidence: [],
              notes: "Could not find external sources to verify this claim.",
            });
          }
        }

        if (topicCheck.topicVerdict.verifiableCount > 0) {
          topicCheck.topicVerdict.factualScore =
            (topicCheck.topicVerdict.trueCount + topicCheck.topicVerdict.uncertainCount * 0.5) / 
            topicCheck.topicVerdict.verifiableCount;
        }

        debaterCheck.perTopic.push(topicCheck);
      }

      // Calculate debater totals
      const totalVerifiable = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.verifiableCount, 0);
      const totalTrue = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.trueCount, 0);
      const totalFalse = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.falseCount, 0);

      debaterCheck.totals.trueTotal = totalTrue;
      debaterCheck.totals.falseTotal = totalFalse;
      if (totalVerifiable > 0) {
        const totalUncertain = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.uncertainCount, 0);
        debaterCheck.totals.meanFactualScore = (totalTrue + totalUncertain * 0.5) / totalVerifiable;
      }

      factCheckSummary.push(debaterCheck);
    }

    console.log(`[FactChecker] Fact-check complete!`);
    
    return { factCheckSummary };
  }

  /**
   * Determines if a claim needs fact-checking using LLM
   */
  private async shouldFactCheck(
    paper: Paper,
    claim: string,
    reasoning: string
  ): Promise<{ shouldCheck: boolean; reason: string; extractedClaim?: string }> {
    const prompt = `Analyze this debate claim about the paper and determine if it needs fact-checking.
PAPER TITLE: "${paper.title}"
PAPER CONTENT: "${paper.text}"

CLAIM: "${claim}"
REASONING: "${reasoning}"

A claim needs fact-checking if it:
- Makes specific factual assertions that could be false (statistics, dates, specific events)
- References external sources, studies, or real-world data not from the paper
- Makes claims about what "research shows" or "studies indicate" without paper citations
- Contains potentially verifiable facts about the real world

A claim does NOT need fact-checking if it:
- Is purely theoretical, philosophical, or opinion-based
- Is directly supported by paper citations (already verified)
- Uses hedging language like "may", "could", "suggests", "likely"
- Is about the paper's own methodology or findings (internal to paper)
- Is common knowledge or definitional

Return JSON:
{
  "shouldCheck": boolean,
  "reason": string (brief explanation),
  "extractedClaim": string | null (if shouldCheck=true, extract the specific factual claim to verify)
}`;

    try {
      const response = await this.callOpenAIWithJsonResponse<{
        shouldCheck: boolean;
        reason: string;
        extractedClaim?: string;
      }>([{ role: "user", content: prompt }], this.getSystemPrompt());

      return response;
    } catch (error) {
      console.error("[FactChecker] Error in shouldFactCheck:", error);
      // Default to not checking if there's an error
      return {
        shouldCheck: false,
        reason: "Error analyzing claim",
      };
    }
  }

  /**
   * Verifies a claim against web search evidence using LLM
   */
  private async verifyClaimWithEvidence(
    claim: string,
    evidence: WebSearchResult[]
  ): Promise<{ status: FactCheckStatus; notes: string }> {
    const prompt = `Verify this claim against the provided web search evidence.

CLAIM: "${claim}"

EVIDENCE:
${evidence.map((e, i) => `${i + 1}. ${e.title}\n   ${e.snippet}\n   Source: ${e.url}`).join("\n\n")}

Based on the evidence:
- If 2+ sources clearly support the claim → status: "True"
- If 2+ sources clearly contradict the claim → status: "False"  
- If evidence is mixed, unclear, or insufficient → status: "Uncertain"

Return JSON:
{
  "status": "True" | "False" | "Uncertain",
  "notes": string (brief explanation of why, citing source numbers)
}`;

    try {
      const response = await this.callOpenAIWithJsonResponse<{
        status: FactCheckStatus;
        notes: string;
      }>([{ role: "user", content: prompt }], this.getSystemPrompt());

      return response;
    } catch (error) {
      console.error("[FactChecker] Error in verifyClaimWithEvidence:", error);
      return {
        status: "Uncertain",
        notes: "Error analyzing evidence",
      };
    }
  }

  /**
   * OLD IMPLEMENTATION - kept for reference but not used
   * This was too slow because it required many LLM calls with tool use
   */
  private async checkFactsWithLLM(request: FactCheckRequest): Promise<FactCheckSummary> {
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
          result = await webSearch(toolInput.query);
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

}

