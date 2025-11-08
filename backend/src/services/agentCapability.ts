/**
 * Agent Capability Service
 *
 * Manages tool schemas that agents expose.
 * Provides validation, versioning, and OpenAI function calling conversion.
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ToolSchema, AgentType, AgentError, ErrorCode } from '../types/agent.types';

const prisma = new PrismaClient();

/**
 * Zod schema for tool validation
 */
const ToolSchemaValidator = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z_]+$/),
  description: z.string().min(10).max(500),
  category: z.enum(['analysis', 'search', 'validation', 'synthesis', 'question']),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()),
  }),
  outputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
  }),
  examples: z
    .array(
      z.object({
        input: z.record(z.any()),
        output: z.record(z.any()),
      })
    )
    .optional(),
});

/**
 * OpenAI Function Calling Format
 */
export interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * AgentCapability Service
 *
 * Features:
 * - Tool schema validation
 * - CRUD operations for capabilities
 * - Version management
 * - OpenAI function format conversion
 * - Database persistence
 */
export class AgentCapabilityService {
  /**
   * Create or update a capability
   */
  public async upsert(
    agentType: AgentType,
    toolSchema: ToolSchema,
    version: string = '1.0.0'
  ): Promise<void> {
    // Validate tool schema
    this.validate(toolSchema);

    try {
      await prisma.agentCapability.upsert({
        where: {
          agentType_toolName: {
            agentType,
            toolName: toolSchema.name,
          },
        },
        update: {
          description: toolSchema.description,
          inputSchema: toolSchema.inputSchema as any,
          outputSchema: toolSchema.outputSchema as any,
          examples: (toolSchema.examples as any) || null,
          category: toolSchema.category,
          version,
        },
        create: {
          agentType,
          toolName: toolSchema.name,
          description: toolSchema.description,
          inputSchema: toolSchema.inputSchema as any,
          outputSchema: toolSchema.outputSchema as any,
          examples: (toolSchema.examples as any) || null,
          category: toolSchema.category,
          version,
        },
      });

      console.log(
        `[AgentCapability] Upserted tool: ${toolSchema.name} for ${agentType}`
      );
    } catch (error) {
      throw new AgentError(
        ErrorCode.InternalError,
        `Failed to upsert capability: ${(error as Error).message}`,
        { agentType, toolName: toolSchema.name, error }
      );
    }
  }

  /**
   * Get capability by agent type and tool name
   */
  public async get(agentType: AgentType, toolName: string): Promise<ToolSchema | null> {
    try {
      const capability = await prisma.agentCapability.findUnique({
        where: {
          agentType_toolName: {
            agentType,
            toolName,
          },
        },
      });

      if (!capability) {
        return null;
      }

      return this.toToolSchema(capability);
    } catch (error) {
      console.error('[AgentCapability] Get failed:', error);
      return null;
    }
  }

  /**
   * Get all capabilities for an agent type
   */
  public async getForAgentType(agentType: AgentType): Promise<ToolSchema[]> {
    try {
      const capabilities = await prisma.agentCapability.findMany({
        where: { agentType },
      });

      return capabilities.map((cap) => this.toToolSchema(cap));
    } catch (error) {
      console.error('[AgentCapability] GetForAgentType failed:', error);
      return [];
    }
  }

  /**
   * Get all capabilities by category
   */
  public async getByCategory(category: string): Promise<ToolSchema[]> {
    try {
      const capabilities = await prisma.agentCapability.findMany({
        where: { category },
      });

      return capabilities.map((cap) => this.toToolSchema(cap));
    } catch (error) {
      console.error('[AgentCapability] GetByCategory failed:', error);
      return [];
    }
  }

  /**
   * Get all capabilities
   */
  public async getAll(): Promise<ToolSchema[]> {
    try {
      const capabilities = await prisma.agentCapability.findMany();
      return capabilities.map((cap) => this.toToolSchema(cap));
    } catch (error) {
      console.error('[AgentCapability] GetAll failed:', error);
      return [];
    }
  }

  /**
   * Delete a capability
   */
  public async delete(agentType: AgentType, toolName: string): Promise<boolean> {
    try {
      await prisma.agentCapability.delete({
        where: {
          agentType_toolName: {
            agentType,
            toolName,
          },
        },
      });

      console.log(`[AgentCapability] Deleted tool: ${toolName} from ${agentType}`);
      return true;
    } catch (error) {
      console.error('[AgentCapability] Delete failed:', error);
      return false;
    }
  }

  /**
   * Validate tool schema
   */
  public validate(toolSchema: ToolSchema): void {
    const result = ToolSchemaValidator.safeParse(toolSchema);

    if (!result.success) {
      throw new AgentError(
        ErrorCode.ValidationFailed,
        'Tool schema validation failed',
        {
          errors: result.error.errors,
          schema: toolSchema,
        }
      );
    }
  }

  /**
   * Convert tool schema to OpenAI function calling format
   */
  public toOpenAIFunction(toolSchema: ToolSchema, agentNodeId?: string): OpenAIFunction {
    // Optionally prefix with agent nodeId to make globally unique
    const functionName = agentNodeId
      ? `agent_${agentNodeId}_${toolSchema.name}`
      : toolSchema.name;

    return {
      type: 'function',
      function: {
        name: functionName,
        description: toolSchema.description,
        parameters: {
          type: 'object',
          properties: toolSchema.inputSchema.properties,
          required: toolSchema.inputSchema.required,
        },
      },
    };
  }

  /**
   * Convert multiple tool schemas to OpenAI functions
   */
  public toOpenAIFunctions(
    toolSchemas: ToolSchema[],
    agentNodeId?: string
  ): OpenAIFunction[] {
    return toolSchemas.map((schema) => this.toOpenAIFunction(schema, agentNodeId));
  }

  /**
   * Seed default capabilities for agent types
   */
  public async seedDefaults(): Promise<number> {
    let seeded = 0;

    // Researcher Agent Tools
    const researcherTools: ToolSchema[] = [
      {
        name: 'analyze_paper',
        description: 'Perform deep analysis of a research paper with evidence extraction',
        category: 'analysis',
        inputSchema: {
          type: 'object',
          properties: {
            paperId: { type: 'string', description: 'ID of the paper to analyze' },
            focusAreas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific areas to focus on',
            },
          },
          required: ['paperId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            claims: { type: 'array', items: { type: 'object' } },
            evidence: { type: 'array', items: { type: 'object' } },
            confidence: { type: 'number' },
          },
        },
      },
      {
        name: 'extract_methodology',
        description: 'Extract and analyze research methodology from a paper',
        category: 'analysis',
        inputSchema: {
          type: 'object',
          properties: {
            paperId: { type: 'string', description: 'ID of the paper' },
          },
          required: ['paperId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            studyDesign: { type: 'string' },
            dataCollection: { type: 'string' },
            analysisMethods: { type: 'array', items: { type: 'string' } },
            limitations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    ];

    // Critic Agent Tools
    const criticTools: ToolSchema[] = [
      {
        name: 'validate_claim',
        description: 'Verify a specific claim with evidence and reasoning',
        category: 'validation',
        inputSchema: {
          type: 'object',
          properties: {
            claim: { type: 'string', description: 'The claim to validate' },
            context: { type: 'string', description: 'Context for the claim' },
          },
          required: ['claim'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            confidence: { type: 'number' },
            evidence: { type: 'array', items: { type: 'object' } },
            critiques: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    ];

    // Synthesizer Agent Tools
    const synthesizerTools: ToolSchema[] = [
      {
        name: 'merge_analyses',
        description: 'Combine multiple agent analyses into unified insights',
        category: 'synthesis',
        inputSchema: {
          type: 'object',
          properties: {
            analyses: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of analysis results',
            },
          },
          required: ['analyses'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            synthesis: { type: 'string' },
            emergentInsights: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
          },
        },
      },
    ];

    // Question Generator Agent Tools
    const questionTools: ToolSchema[] = [
      {
        name: 'generate_questions',
        description: 'Generate research questions based on paper analysis',
        category: 'question',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Research topic' },
            context: { type: 'string', description: 'Background context' },
          },
          required: ['topic'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  priority: { type: 'string' },
                  suggestedAgent: { type: 'string' },
                },
              },
            },
          },
        },
      },
    ];

    // Citation Tracker Agent Tools
    const citationTools: ToolSchema[] = [
      {
        name: 'verify_citation',
        description: 'Validate citation accuracy and relevance',
        category: 'validation',
        inputSchema: {
          type: 'object',
          properties: {
            citation: { type: 'string', description: 'Citation text' },
            context: { type: 'string', description: 'Context where citation appears' },
          },
          required: ['citation'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            source: { type: 'object' },
            confidence: { type: 'number' },
          },
        },
      },
    ];

    // Web Research Agent Tools
    const webResearchTools: ToolSchema[] = [
      {
        name: 'search_academic',
        description: 'Search academic databases for related research',
        category: 'search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            databases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Databases to search',
            },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            results: { type: 'array', items: { type: 'object' } },
            count: { type: 'number' },
          },
        },
      },
    ];

    // Seed all tools
    const toolsByType: Array<[AgentType, ToolSchema[]]> = [
      ['researcher', researcherTools],
      ['critic', criticTools],
      ['synthesizer', synthesizerTools],
      ['question_generator', questionTools],
      ['citation_tracker', citationTools],
      ['web_research', webResearchTools],
    ];

    for (const [agentType, tools] of toolsByType) {
      for (const tool of tools) {
        try {
          await this.upsert(agentType, tool);
          seeded++;
        } catch (error) {
          console.error(`Failed to seed ${tool.name} for ${agentType}:`, error);
        }
      }
    }

    console.log(`[AgentCapability] Seeded ${seeded} default tool schemas`);
    return seeded;
  }

  /**
   * Private: Convert database model to ToolSchema
   */
  private toToolSchema(capability: any): ToolSchema {
    return {
      name: capability.toolName,
      description: capability.description,
      category: capability.category,
      inputSchema: capability.inputSchema as any,
      outputSchema: capability.outputSchema as any,
      examples: capability.examples as any,
    };
  }
}

// Singleton instance
export const agentCapability = new AgentCapabilityService();
