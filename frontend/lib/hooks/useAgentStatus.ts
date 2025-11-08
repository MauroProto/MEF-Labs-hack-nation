'use client';

/**
 * Agent Status Hook
 *
 * Track the status of all registered agents in real-time.
 * Provides a centralized store of agent metadata and statuses.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAgentEvents, AgentRegisteredEvent, AgentStatusEvent } from './useAgentEvents';

/**
 * Agent metadata stored in the hook
 */
export interface AgentMetadata {
  nodeId: string;
  agentType: string;
  name: string;
  status: 'idle' | 'busy' | 'error';
  capabilities: Array<{
    name: string;
    description: string;
    category: string;
  }>;
  error?: string;
  registeredAt: Date;
  lastUpdated: Date;
}

/**
 * Agent status statistics
 */
export interface AgentStats {
  total: number;
  idle: number;
  busy: number;
  error: number;
  byType: Record<string, number>;
}

/**
 * useAgentStatus Hook
 *
 * Tracks all registered agents and their current status.
 *
 * Usage:
 * ```tsx
 * const { agents, getAgent, getAgentsByType, stats } = useAgentStatus();
 *
 * const researcher = getAgent('researcher-1');
 * const allResearchers = getAgentsByType('researcher');
 * console.log(`${stats.busy} agents are currently busy`);
 * ```
 */
export function useAgentStatus() {
  const [agents, setAgents] = useState<Map<string, AgentMetadata>>(new Map());

  // Handle agent registration
  const handleRegistered = useCallback((event: AgentRegisteredEvent) => {
    setAgents((prev) => {
      const next = new Map(prev);
      next.set(event.nodeId, {
        nodeId: event.nodeId,
        agentType: event.agentType,
        name: event.name,
        status: 'idle',
        capabilities: event.capabilities,
        registeredAt: new Date(event.timestamp),
        lastUpdated: new Date(event.timestamp),
      });
      return next;
    });
  }, []);

  // Handle agent deregistration
  const handleDeregistered = useCallback((event: { nodeId: string }) => {
    setAgents((prev) => {
      const next = new Map(prev);
      next.delete(event.nodeId);
      return next;
    });
  }, []);

  // Handle agent status change
  const handleStatus = useCallback((event: AgentStatusEvent) => {
    setAgents((prev) => {
      const next = new Map(prev);
      const agent = next.get(event.nodeId);

      if (agent) {
        next.set(event.nodeId, {
          ...agent,
          status: event.status,
          error: event.error,
          lastUpdated: new Date(event.timestamp),
        });
      }

      return next;
    });
  }, []);

  // Subscribe to agent events
  useAgentEvents({
    onRegistered: handleRegistered,
    onDeregistered: handleDeregistered,
    onStatus: handleStatus,
  });

  // Get agent by nodeId
  const getAgent = useCallback(
    (nodeId: string): AgentMetadata | undefined => {
      return agents.get(nodeId);
    },
    [agents]
  );

  // Get all agents as array
  const getAllAgents = useCallback((): AgentMetadata[] => {
    return Array.from(agents.values());
  }, [agents]);

  // Get agents by type
  const getAgentsByType = useCallback(
    (agentType: string): AgentMetadata[] => {
      return Array.from(agents.values()).filter((agent) => agent.agentType === agentType);
    },
    [agents]
  );

  // Get agents by status
  const getAgentsByStatus = useCallback(
    (status: 'idle' | 'busy' | 'error'): AgentMetadata[] => {
      return Array.from(agents.values()).filter((agent) => agent.status === status);
    },
    [agents]
  );

  // Get agents with specific capability
  const getAgentsWithCapability = useCallback(
    (capabilityName: string): AgentMetadata[] => {
      return Array.from(agents.values()).filter((agent) =>
        agent.capabilities.some((cap) => cap.name === capabilityName)
      );
    },
    [agents]
  );

  // Calculate statistics
  const getStats = useCallback((): AgentStats => {
    const allAgents = Array.from(agents.values());

    const stats: AgentStats = {
      total: allAgents.length,
      idle: 0,
      busy: 0,
      error: 0,
      byType: {},
    };

    allAgents.forEach((agent) => {
      // Count by status
      if (agent.status === 'idle') stats.idle++;
      else if (agent.status === 'busy') stats.busy++;
      else if (agent.status === 'error') stats.error++;

      // Count by type
      stats.byType[agent.agentType] = (stats.byType[agent.agentType] || 0) + 1;
    });

    return stats;
  }, [agents]);

  // Clear all agents (for testing/reset)
  const clearAgents = useCallback(() => {
    setAgents(new Map());
  }, []);

  // Load initial agents from API
  const loadAgents = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/agents`);

      if (!response.ok) {
        throw new Error('Failed to load agents');
      }

      const data = await response.json();
      const agentsData = data.agents || [];

      setAgents((prev) => {
        const next = new Map(prev);

        agentsData.forEach((agent: any) => {
          next.set(agent.nodeId, {
            nodeId: agent.nodeId,
            agentType: agent.agentType,
            name: agent.name,
            status: agent.status || 'idle',
            capabilities: agent.capabilities || [],
            registeredAt: new Date(agent.createdAt),
            lastUpdated: new Date(agent.updatedAt),
          });
        });

        return next;
      });

      console.log('[useAgentStatus] Loaded', agentsData.length, 'agents from API');
    } catch (error) {
      console.error('[useAgentStatus] Failed to load agents:', error);
    }
  }, []);

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    getAgent,
    getAllAgents,
    getAgentsByType,
    getAgentsByStatus,
    getAgentsWithCapability,
    stats: getStats(),
    clearAgents,
    loadAgents,
  };
}
