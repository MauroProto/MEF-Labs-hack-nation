/**
 * Agent Controller
 *
 * HTTP request handlers for agent registration and discovery endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { agentRegistry } from '../services/agentRegistry';
import { agentCapability } from '../services/agentCapability';
import { AgentMetadata, AgentType, ToolSchema, AgentError } from '../types/agent.types';

/**
 * Request validation schemas
 */
const RegisterAgentSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  agentType: z.enum([
    'researcher',
    'critic',
    'synthesizer',
    'question_generator',
    'citation_tracker',
    'web_research',
  ]),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  capabilities: z.array(z.any()), // ToolSchema array
  status: z.enum(['idle', 'working', 'error']).default('idle'),
  version: z.string().default('1.0.0'),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['idle', 'working', 'error']),
  error: z.string().optional(),
});

/**
 * Register a new agent
 * POST /api/agents/register
 */
export async function registerAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    const validatedData = RegisterAgentSchema.parse(req.body);

    // Validate each tool schema
    for (const tool of validatedData.capabilities) {
      agentCapability.validate(tool);
    }

    // Register agent
    const agent = await agentRegistry.register(validatedData);

    // Optionally persist capabilities to database
    for (const tool of validatedData.capabilities as ToolSchema[]) {
      try {
        await agentCapability.upsert(
          validatedData.agentType,
          tool,
          validatedData.version
        );
      } catch (error) {
        console.error(`Failed to persist tool ${tool.name}:`, error);
        // Continue - agent is registered even if capability persistence fails
      }
    }

    res.status(201).json({
      success: true,
      agent,
      message: `Agent ${agent.nodeId} registered successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deregister an agent
 * DELETE /api/agents/:nodeId
 */
export async function deregisterAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { nodeId } = req.params;

    await agentRegistry.deregister(nodeId);

    res.json({
      success: true,
      message: `Agent ${nodeId} deregistered successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all active agents
 * GET /api/agents
 */
export async function getAllAgents(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type } = req.query;

    let agents: AgentMetadata[];

    if (type && typeof type === 'string') {
      agents = agentRegistry.getAgentsByType(type as AgentType);
    } else {
      agents = agentRegistry.getAllAgents();
    }

    const stats = agentRegistry.getStats();

    res.json({
      success: true,
      agents,
      stats,
      count: agents.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific agent
 * GET /api/agents/:nodeId
 */
export async function getAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { nodeId } = req.params;

    const agent = agentRegistry.getAgent(nodeId);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found',
        nodeId,
      });
      return;
    }

    res.json({
      success: true,
      agent,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get agent capabilities (tools)
 * GET /api/agents/:nodeId/capabilities
 */
export async function getAgentCapabilities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { nodeId } = req.params;

    const capabilities = agentRegistry.getCapabilities(nodeId);

    res.json({
      success: true,
      nodeId,
      capabilities,
      count: capabilities.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all available tools across all agents
 * GET /api/capabilities
 */
export async function getAllCapabilities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, search } = req.query;

    let tools;

    if (search && typeof search === 'string') {
      tools = agentRegistry.searchTools(search);
    } else if (category && typeof category === 'string') {
      tools = agentRegistry.searchByCapability(category).flatMap((agent) =>
        agent.capabilities.map((tool) => ({
          agentId: agent.nodeId,
          agentType: agent.agentType,
          tool,
        }))
      );
    } else {
      tools = agentRegistry.listAllTools();
    }

    res.json({
      success: true,
      tools,
      count: tools.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update agent status
 * PATCH /api/agents/:nodeId/status
 */
export async function updateAgentStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { nodeId } = req.params;
    const validatedData = UpdateStatusSchema.parse(req.body);

    await agentRegistry.updateStatus(nodeId, validatedData.status, validatedData.error);

    res.json({
      success: true,
      nodeId,
      status: validatedData.status,
      message: `Agent status updated to ${validatedData.status}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get registry statistics
 * GET /api/agents/stats
 */
export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = agentRegistry.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search agents by capability
 * GET /api/agents/search/capability
 */
export async function searchByCapability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category } = req.query;

    if (!category || typeof category !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Category query parameter is required',
      });
      return;
    }

    const agents = agentRegistry.searchByCapability(category);

    res.json({
      success: true,
      category,
      agents,
      count: agents.length,
    });
  } catch (error) {
    next(error);
  }
}
