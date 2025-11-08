/**
 * Agent Registry
 *
 * In-memory registry of active agents with their capabilities.
 * Provides discovery API for agent-to-agent communication.
 */

import { PrismaClient } from '@prisma/client';
import { agentBus } from './agentEventBus';
import {
  AgentMetadata,
  AgentType,
  AgentStatus,
  ToolSchema,
  AgentError,
  ErrorCode,
} from '../types/agent.types';

const prisma = new PrismaClient();

/**
 * Agent Registry - Central directory of active agents
 *
 * Features:
 * - In-memory Map for fast lookups
 * - Optional database persistence
 * - Capability discovery
 * - Lifecycle management
 */
export class AgentRegistry {
  private agents: Map<string, AgentMetadata> = new Map();
  private agentsByType: Map<AgentType, Set<string>> = new Map();

  constructor() {
    // Initialize type index
    const agentTypes: AgentType[] = [
      'researcher',
      'critic',
      'synthesizer',
      'question_generator',
      'citation_tracker',
      'web_research',
    ];

    agentTypes.forEach((type) => {
      this.agentsByType.set(type, new Set());
    });
  }

  /**
   * Register a new agent
   */
  public async register(agent: Omit<AgentMetadata, 'createdAt' | 'updatedAt'>): Promise<AgentMetadata> {
    // Check if agent already exists
    if (this.agents.has(agent.nodeId)) {
      throw new AgentError(
        ErrorCode.InvalidParams,
        `Agent with nodeId ${agent.nodeId} already registered`,
        { nodeId: agent.nodeId }
      );
    }

    // Validate agent type
    if (!this.isValidAgentType(agent.agentType)) {
      throw new AgentError(ErrorCode.InvalidParams, `Invalid agent type: ${agent.agentType}`, {
        agentType: agent.agentType,
        validTypes: Array.from(this.agentsByType.keys()),
      });
    }

    // Create full metadata with timestamps
    const metadata: AgentMetadata = {
      ...agent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to in-memory registry
    this.agents.set(agent.nodeId, metadata);

    // Add to type index
    this.agentsByType.get(agent.agentType)?.add(agent.nodeId);

    // Emit registered event
    agentBus.registered(metadata);

    // Optional: Persist to database
    try {
      await prisma.agent.upsert({
        where: { nodeId: agent.nodeId },
        update: {
          agentType: agent.agentType,
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          capabilities: agent.capabilities as any,
          status: agent.status,
          version: agent.version,
          updatedAt: new Date(),
        },
        create: {
          id: agent.id,
          nodeId: agent.nodeId,
          agentType: agent.agentType,
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          capabilities: agent.capabilities as any,
          status: agent.status,
          version: agent.version,
        },
      });
    } catch (error) {
      console.error('[AgentRegistry] Database persistence failed:', error);
      // Don't throw - in-memory registration succeeded
    }

    console.log(`[AgentRegistry] Registered agent: ${agent.nodeId} (${agent.agentType})`);
    return metadata;
  }

  /**
   * Deregister an agent
   */
  public async deregister(nodeId: string): Promise<void> {
    const agent = this.agents.get(nodeId);

    if (!agent) {
      throw new AgentError(ErrorCode.AgentNotFound, `Agent ${nodeId} not found in registry`, {
        nodeId,
      });
    }

    // Remove from in-memory registry
    this.agents.delete(nodeId);

    // Remove from type index
    this.agentsByType.get(agent.agentType)?.delete(nodeId);

    // Emit deregistered event
    agentBus.deregistered(nodeId);

    // Optional: Update database status
    try {
      await prisma.agent.update({
        where: { nodeId },
        data: { status: 'idle', updatedAt: new Date() },
      });
    } catch (error) {
      console.error('[AgentRegistry] Database update failed:', error);
    }

    console.log(`[AgentRegistry] Deregistered agent: ${nodeId}`);
  }

  /**
   * Get agent by nodeId
   */
  public getAgent(nodeId: string): AgentMetadata | undefined {
    return this.agents.get(nodeId);
  }

  /**
   * Get agent or throw error
   */
  public getAgentOrThrow(nodeId: string): AgentMetadata {
    const agent = this.agents.get(nodeId);

    if (!agent) {
      throw new AgentError(ErrorCode.AgentNotFound, `Agent ${nodeId} not found`, { nodeId });
    }

    return agent;
  }

  /**
   * Get all agents
   */
  public getAllAgents(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by type
   */
  public getAgentsByType(type: AgentType): AgentMetadata[] {
    const nodeIds = this.agentsByType.get(type);

    if (!nodeIds) {
      return [];
    }

    return Array.from(nodeIds)
      .map((nodeId) => this.agents.get(nodeId))
      .filter((agent): agent is AgentMetadata => agent !== undefined);
  }

  /**
   * Get agent capabilities (tools)
   */
  public getCapabilities(nodeId: string): ToolSchema[] {
    const agent = this.getAgentOrThrow(nodeId);
    return agent.capabilities;
  }

  /**
   * Find tool in agent's capabilities
   */
  public findTool(nodeId: string, toolName: string): ToolSchema | undefined {
    const capabilities = this.getCapabilities(nodeId);
    return capabilities.find((tool) => tool.name === toolName);
  }

  /**
   * Check if agent has specific tool
   */
  public hasTool(nodeId: string, toolName: string): boolean {
    return this.findTool(nodeId, toolName) !== undefined;
  }

  /**
   * Update agent status
   */
  public async updateStatus(
    nodeId: string,
    status: AgentStatus,
    error?: string
  ): Promise<void> {
    const agent = this.getAgentOrThrow(nodeId);

    // Update in-memory
    agent.status = status;
    agent.updatedAt = new Date();

    // Emit status change event
    agentBus.statusChange(nodeId, status, error);

    // Optional: Update database
    try {
      await prisma.agent.update({
        where: { nodeId },
        data: { status, updatedAt: new Date() },
      });
    } catch (dbError) {
      console.error('[AgentRegistry] Database status update failed:', dbError);
    }
  }

  /**
   * Search agents by capability category
   */
  public searchByCapability(category: string): AgentMetadata[] {
    return this.getAllAgents().filter((agent) =>
      agent.capabilities.some((tool) => tool.category === category)
    );
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    totalAgents: number;
    byType: Record<AgentType, number>;
    byStatus: Record<AgentStatus, number>;
  } {
    const agents = this.getAllAgents();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    agents.forEach((agent) => {
      byType[agent.agentType] = (byType[agent.agentType] || 0) + 1;
      byStatus[agent.status] = (byStatus[agent.status] || 0) + 1;
    });

    return {
      totalAgents: agents.length,
      byType: byType as Record<AgentType, number>,
      byStatus: byStatus as Record<AgentStatus, number>,
    };
  }

  /**
   * List all available tools across all agents
   */
  public listAllTools(): Array<{
    agentId: string;
    agentType: AgentType;
    tool: ToolSchema;
  }> {
    const tools: Array<{ agentId: string; agentType: AgentType; tool: ToolSchema }> = [];

    this.agents.forEach((agent) => {
      agent.capabilities.forEach((tool) => {
        tools.push({
          agentId: agent.nodeId,
          agentType: agent.agentType,
          tool,
        });
      });
    });

    return tools;
  }

  /**
   * Search tools by name or description
   */
  public searchTools(query: string): Array<{
    agentId: string;
    agentType: AgentType;
    tool: ToolSchema;
  }> {
    const lowerQuery = query.toLowerCase();

    return this.listAllTools().filter(
      ({ tool }) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check if nodeId exists in registry
   */
  public has(nodeId: string): boolean {
    return this.agents.has(nodeId);
  }

  /**
   * Get count of agents
   */
  public count(): number {
    return this.agents.size;
  }

  /**
   * Clear all agents (for testing)
   */
  public clear(): void {
    this.agents.clear();
    this.agentsByType.forEach((set) => set.clear());
    console.log('[AgentRegistry] Cleared all agents');
  }

  /**
   * Load agents from database (on startup)
   */
  public async loadFromDatabase(): Promise<number> {
    try {
      const dbAgents = await prisma.agent.findMany({
        where: { status: { not: 'error' } }, // Only load non-errored agents
      });

      let loaded = 0;

      for (const dbAgent of dbAgents) {
        try {
          const metadata: AgentMetadata = {
            id: dbAgent.id,
            nodeId: dbAgent.nodeId,
            agentType: dbAgent.agentType as AgentType,
            name: dbAgent.name,
            description: dbAgent.description,
            systemPrompt: dbAgent.systemPrompt,
            capabilities: dbAgent.capabilities as ToolSchema[],
            status: dbAgent.status as AgentStatus,
            version: dbAgent.version,
            createdAt: dbAgent.createdAt,
            updatedAt: dbAgent.updatedAt,
          };

          this.agents.set(metadata.nodeId, metadata);
          this.agentsByType.get(metadata.agentType)?.add(metadata.nodeId);
          loaded++;
        } catch (error) {
          console.error(`[AgentRegistry] Failed to load agent ${dbAgent.nodeId}:`, error);
        }
      }

      console.log(`[AgentRegistry] Loaded ${loaded} agents from database`);
      return loaded;
    } catch (error) {
      console.error('[AgentRegistry] Failed to load from database:', error);
      return 0;
    }
  }

  /**
   * Private: Validate agent type
   */
  private isValidAgentType(type: string): type is AgentType {
    return this.agentsByType.has(type as AgentType);
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
