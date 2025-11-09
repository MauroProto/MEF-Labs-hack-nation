import OpenAI from "openai";
import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  DebaterRequest,
  DebaterArgument,
  LookupHit,
  Paper,
} from "../../types/debate.types";

export class DebaterAgent extends BaseDebateAgent {
  private paper!: Paper;

  async debate(request: DebaterRequest): Promise<DebaterArgument> {
    const { posture, question, topics, paper } = request;
    this.paper = paper;

    const systemPrompt = `${this.getSystemPrompt()}

You are Debater "${posture}". You must address every topic in the provided list from the perspective of your posture.

You may call lookupPaper(query) to fetch relevant paper chunks.

For each topic: make a clear claim, give reasoning, and cite evidence. Then produce a short overallPosition.

Output ONLY valid JSON that conforms to this schema:
{
  "posture": string,
  "perTopic": [{
    "topic": string,
    "claim": string,
    "reasoning": string,
    "cites": {
      "paper": [{ "chunkId": string, "text": string, "score": number }],
      "web": [{ "title": string, "url": string, "snippet": string }]
    }
  }],
  "overallPosition": string
}`;

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
        }
        // Note: webSearch is handled directly by OpenAI's web_search tool
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
}

