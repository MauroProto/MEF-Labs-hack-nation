/**
 * BaseAgent - Abstract base class for all AI agents
 *
 * Provides:
 * - Tool registration system
 * - OpenAI function calling integration
 * - Context management
 * - Message history
 * - Error handling
 * - Streaming support
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { agentBus } from '../../services/agentEventBus';
import { AgentError, ErrorCode } from '../../types/agent.types';

/**
 * Tool definition for agent capabilities
 */
export interface AgentTool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>) => Promise<any>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  nodeId: string;
  name: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  paperId?: string;
  canvasId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Abstract BaseAgent class
 * All specialized agents extend this class
 */
export abstract class BaseAgent {
  protected openai: OpenAI;
  protected nodeId: string;
  protected name: string;
  protected model: string;
  protected temperature: number;
  protected maxTokens: number;
  protected systemPrompt: string;
  protected tools: Map<string, AgentTool> = new Map();
  protected messageHistory: ChatCompletionMessageParam[] = [];

  constructor(config: AgentConfig) {
    this.nodeId = config.nodeId;
    this.name = config.name;
    this.model = config.model || 'gpt-4-turbo-preview';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens || 2000;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();

    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AgentError(
        ErrorCode.InternalError,
        'OPENAI_API_KEY environment variable is not set'
      );
    }

    this.openai = new OpenAI({ apiKey });

    // Register tools (implemented by subclasses)
    this.registerTools();

    // Notify registration
    this.emitStatus('idle');
  }

  /**
   * Abstract method: Get default system prompt
   * Must be implemented by subclasses
   */
  protected abstract getDefaultSystemPrompt(): string;

  /**
   * Abstract method: Register agent-specific tools
   * Must be implemented by subclasses
   */
  protected abstract registerTools(): void;

  /**
   * Register a tool with the agent
   */
  protected registerTool<T extends z.ZodType>(tool: AgentTool<T>): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tools in OpenAI function calling format
   */
  protected getOpenAITools(): ChatCompletionTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    }));
  }

  /**
   * Convert Zod schema to JSON Schema for OpenAI
   */
  private zodToJsonSchema(schema: z.ZodType): Record<string, any> {
    // Simple conversion for common Zod types
    // For production, use zod-to-json-schema library
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJson(value as z.ZodType);
        if (!(value as any).isOptional()) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    return this.zodTypeToJson(schema);
  }

  /**
   * Convert individual Zod type to JSON Schema type
   */
  private zodTypeToJson(type: z.ZodType): Record<string, any> {
    if (type instanceof z.ZodString) {
      return { type: 'string' };
    }
    if (type instanceof z.ZodNumber) {
      return { type: 'number' };
    }
    if (type instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    if (type instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJson(type.element),
      };
    }
    if (type instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: type.options,
      };
    }
    return { type: 'string' }; // Fallback
  }

  /**
   * Execute agent with a user message
   */
  public async execute(
    userMessage: string,
    context: AgentContext = {}
  ): Promise<string> {
    try {
      this.emitStatus('working');

      // Add user message to history
      this.messageHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Call OpenAI with tools
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.messageHistory,
        ],
        tools: this.getOpenAITools(),
        tool_choice: 'auto',
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new AgentError(
          ErrorCode.InternalError,
          'No response from OpenAI'
        );
      }

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        this.messageHistory.push(message);

        // Execute tool calls
        const toolResults = await Promise.all(
          message.tool_calls.map(async (toolCall) => {
            const tool = this.tools.get(toolCall.function.name);
            if (!tool) {
              throw new AgentError(
                ErrorCode.ToolNotFound,
                `Tool ${toolCall.function.name} not found`
              );
            }

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await tool.execute(args);

              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: JSON.stringify(result),
              };
            } catch (error) {
              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
              };
            }
          })
        );

        // Add tool results to history
        this.messageHistory.push(...toolResults);

        // Get final response after tool execution
        const finalResponse = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...this.messageHistory,
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        });

        const finalMessage = finalResponse.choices[0]?.message;
        if (finalMessage?.content) {
          this.messageHistory.push(finalMessage);
          this.emitStatus('completed');
          return finalMessage.content;
        }
      }

      // No tool calls, return direct response
      if (message.content) {
        this.messageHistory.push(message);
        this.emitStatus('completed');
        return message.content;
      }

      throw new AgentError(
        ErrorCode.InternalError,
        'No content in OpenAI response'
      );
    } catch (error) {
      this.emitStatus('error', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Execute a specific tool directly
   */
  public async invokeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new AgentError(
        ErrorCode.ToolNotFound,
        `Tool ${toolName} not found on agent ${this.name}`
      );
    }

    try {
      // Validate arguments against schema
      const validatedArgs = tool.parameters.parse(args);
      return await tool.execute(validatedArgs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AgentError(
          ErrorCode.ValidationFailed,
          `Invalid arguments for tool ${toolName}: ${error.message}`,
          { errors: error.errors }
        );
      }
      throw error;
    }
  }

  /**
   * Get list of available tools
   */
  public getTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool schema
   */
  public getToolSchema(toolName: string): ChatCompletionTool | null {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    };
  }

  /**
   * Clear message history
   */
  public clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Get message history
   */
  public getHistory(): ChatCompletionMessageParam[] {
    return [...this.messageHistory];
  }

  /**
   * Emit status change event
   */
  protected emitStatus(
    status: 'idle' | 'working' | 'completed' | 'error',
    error?: string
  ): void {
    agentBus.statusChange(this.nodeId, status as any, error);
  }

  /**
   * Get agent metadata
   */
  public getMetadata() {
    return {
      nodeId: this.nodeId,
      name: this.name,
      agentType: this.constructor.name,
      model: this.model,
      temperature: this.temperature,
      tools: this.getTools(),
      systemPrompt: this.systemPrompt,
    };
  }
}
