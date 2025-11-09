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
    this.model = config.model || "gpt-4o-mini";
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
        // Try next parsing method
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

  /**
   * Call OpenAI with streaming support
   * @param messages - Chat messages
   * @param systemPrompt - System prompt override
   * @param onStream - Callback for each text delta
   * @returns Full accumulated text
   */
  protected async callOpenAIWithStreaming(
    messages: OpenAI.ChatCompletionMessageParam[],
    systemPrompt?: string,
    onStream?: (delta: string) => void
  ): Promise<string> {
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt || this.getSystemPrompt(),
      },
      ...messages,
    ];

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: allMessages,
      stream: true,
    });

    let fullText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        if (onStream) {
          onStream(delta);
        }
      }
    }

    return fullText;
  }

  /**
   * Call OpenAI with streaming and parse final JSON response
   * @param messages - Chat messages
   * @param systemPrompt - System prompt override
   * @param onStream - Callback for each text delta
   * @returns Parsed JSON response
   */
  protected async callOpenAIWithStreamingJson<T>(
    messages: OpenAI.ChatCompletionMessageParam[],
    systemPrompt?: string,
    onStream?: (delta: string) => void
  ): Promise<T> {
    const fullText = await this.callOpenAIWithStreaming(messages, systemPrompt, onStream);

    // Parse the accumulated text as JSON
    const codeBlockMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]) as T;
      } catch (e) {
        // Try next method
      }
    }

    try {
      return JSON.parse(fullText) as T;
    } catch (e) {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as T;
        } catch (e2) {
          throw new Error(`Failed to parse JSON from streamed response: ${fullText.slice(0, 200)}`);
        }
      }
    }

    throw new Error("No valid JSON found in streamed response");
  }
}

