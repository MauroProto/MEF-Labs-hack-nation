import OpenAI from "openai";

export interface DebateAgentConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export abstract class BaseDebateAgent {
  protected client: OpenAI;
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;

  constructor(config: DebateAgentConfig = {}) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = config.model || "gpt-5-2025-08-07";
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
  }

  protected getSystemPrompt(): string {
    return `You are a tool-using research assistant in a multi-agent debate. Always produce JSON that conforms to the provided schema. Be concise, factual, cite evidence via the available tools (lookupPaper, webSearch) when asked.`;
  }

  protected async callOpenAI(
    messages: OpenAI.ChatCompletionMessageParam[],
    systemPrompt?: string,
    tools?: OpenAI.ChatCompletionTool[]
  ): Promise<OpenAI.ChatCompletion> {
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt || this.getSystemPrompt(),
      },
      ...messages,
    ];

    const params: OpenAI.ChatCompletionCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: allMessages,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    return await this.client.chat.completions.create(params);
  }

  protected extractJsonFromResponse(response: OpenAI.ChatCompletion): any {
    const message = response.choices[0]?.message;
    if (!message?.content) {
      throw new Error("No content in response");
    }

    const text = message.content;

    // Look for JSON in code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        // Continue to next attempt
      }
    }

    // Try to parse the entire text as JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to find JSON object in text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          throw new Error(`Failed to parse JSON from response: ${text.slice(0, 200)}`);
        }
      }
    }

    throw new Error("No valid JSON found in response");
  }

  protected async callOpenAIWithJsonResponse<T>(
    messages: OpenAI.ChatCompletionMessageParam[],
    systemPrompt?: string,
    tools?: OpenAI.ChatCompletionTool[]
  ): Promise<T> {
    const response = await this.callOpenAI(messages, systemPrompt, tools);
    return this.extractJsonFromResponse(response) as T;
  }
}

