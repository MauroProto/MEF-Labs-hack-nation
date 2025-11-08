/**
 * Agent Store
 *
 * Zustand store for managing agent registry and status.
 * Features:
 * - Agent registration and deregistration
 * - Agent status tracking
 * - Agent capabilities management
 * - Real-time agent communication tracking
 */

import { create } from 'zustand';

export type AgentType =
  | 'researcher'
  | 'critic'
  | 'synthesizer'
  | 'question_generator'
  | 'citation_tracker'
  | 'web_research';

export type AgentStatus = 'idle' | 'working' | 'error';

export interface AgentMetadata {
  id: string;
  nodeId: string;
  agentType: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[]; // Tool names this agent provides
  lastActive: Date | null;
}

export interface AgentInvocation {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  error?: string;
}

export interface AgentMessage {
  id: string;
  fromNodeId: string;
  toNodeId?: string;
  content: string;
  timestamp: Date;
  type: 'analysis' | 'question' | 'critique' | 'response' | 'tool_call';
}

export interface AgentState {
  // Registry
  agents: Map<string, AgentMetadata>; // nodeId -> metadata

  // Status tracking
  agentStatuses: Map<string, AgentStatus>; // nodeId -> status

  // Invocations
  activeInvocations: Map<string, AgentInvocation>; // invocationId -> invocation
  invocationHistory: AgentInvocation[];

  // Messages
  messages: AgentMessage[];

  // Actions - Registration
  registerAgent: (metadata: AgentMetadata) => void;
  deregisterAgent: (nodeId: string) => void;
  getAgent: (nodeId: string) => AgentMetadata | undefined;
  getAllAgents: () => AgentMetadata[];

  // Actions - Status
  updateAgentStatus: (nodeId: string, status: AgentStatus) => void;
  getAgentStatus: (nodeId: string) => AgentStatus | undefined;

  // Actions - Capabilities
  getAgentCapabilities: (nodeId: string) => string[];
  findAgentsWithCapability: (capability: string) => AgentMetadata[];

  // Actions - Invocations
  addInvocation: (invocation: AgentInvocation) => void;
  updateInvocation: (invocationId: string, updates: Partial<AgentInvocation>) => void;
  getActiveInvocations: () => AgentInvocation[];

  // Actions - Messages
  addMessage: (message: AgentMessage) => void;
  getMessagesForNode: (nodeId: string) => AgentMessage[];
  clearMessages: () => void;

  // Actions - Utilities
  clearAll: () => void;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  // Initial state
  agents: new Map(),
  agentStatuses: new Map(),
  activeInvocations: new Map(),
  invocationHistory: [],
  messages: [],

  // Registration actions
  registerAgent: (metadata) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const newStatuses = new Map(state.agentStatuses);

      newAgents.set(metadata.nodeId, metadata);
      newStatuses.set(metadata.nodeId, metadata.status);

      return { agents: newAgents, agentStatuses: newStatuses };
    }),

  deregisterAgent: (nodeId) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const newStatuses = new Map(state.agentStatuses);

      newAgents.delete(nodeId);
      newStatuses.delete(nodeId);

      // Clear related invocations
      const newActiveInvocations = new Map(state.activeInvocations);
      for (const [id, invocation] of newActiveInvocations) {
        if (invocation.fromNodeId === nodeId || invocation.toNodeId === nodeId) {
          newActiveInvocations.delete(id);
        }
      }

      return {
        agents: newAgents,
        agentStatuses: newStatuses,
        activeInvocations: newActiveInvocations,
      };
    }),

  getAgent: (nodeId) => get().agents.get(nodeId),

  getAllAgents: () => Array.from(get().agents.values()),

  // Status actions
  updateAgentStatus: (nodeId, status) =>
    set((state) => {
      const newStatuses = new Map(state.agentStatuses);
      const newAgents = new Map(state.agents);

      newStatuses.set(nodeId, status);

      const agent = newAgents.get(nodeId);
      if (agent) {
        newAgents.set(nodeId, {
          ...agent,
          status,
          lastActive: new Date(),
        });
      }

      return { agentStatuses: newStatuses, agents: newAgents };
    }),

  getAgentStatus: (nodeId) => get().agentStatuses.get(nodeId),

  // Capabilities actions
  getAgentCapabilities: (nodeId) => {
    const agent = get().agents.get(nodeId);
    return agent?.capabilities || [];
  },

  findAgentsWithCapability: (capability) => {
    const allAgents = Array.from(get().agents.values());
    return allAgents.filter((agent) =>
      agent.capabilities.includes(capability)
    );
  },

  // Invocation actions
  addInvocation: (invocation) =>
    set((state) => {
      const newActiveInvocations = new Map(state.activeInvocations);
      newActiveInvocations.set(invocation.id, invocation);

      return { activeInvocations: newActiveInvocations };
    }),

  updateInvocation: (invocationId, updates) =>
    set((state) => {
      const newActiveInvocations = new Map(state.activeInvocations);
      const invocation = newActiveInvocations.get(invocationId);

      if (invocation) {
        const updated = { ...invocation, ...updates };
        newActiveInvocations.set(invocationId, updated);

        // If completed or failed, move to history
        if (updated.status === 'completed' || updated.status === 'failed') {
          newActiveInvocations.delete(invocationId);
          return {
            activeInvocations: newActiveInvocations,
            invocationHistory: [...state.invocationHistory, updated],
          };
        }
      }

      return { activeInvocations: newActiveInvocations };
    }),

  getActiveInvocations: () => Array.from(get().activeInvocations.values()),

  // Message actions
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  getMessagesForNode: (nodeId) =>
    get().messages.filter(
      (msg) => msg.fromNodeId === nodeId || msg.toNodeId === nodeId
    ),

  clearMessages: () => set({ messages: [] }),

  // Utility actions
  clearAll: () =>
    set({
      agents: new Map(),
      agentStatuses: new Map(),
      activeInvocations: new Map(),
      invocationHistory: [],
      messages: [],
    }),
}));
