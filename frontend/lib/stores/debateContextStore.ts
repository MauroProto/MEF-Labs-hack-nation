/**
 * Debate Context Store
 *
 * Manages debate contexts and their connections to nodes (similar to paperContextStore)
 * Allows chat nodes to access full debate transcripts when connected to debate nodes
 */

import { create } from 'zustand';
import type { EnhancedDebateReport } from '../api/masDebateApi';

export type DebateContext = {
  id: string;  // nodeId of the debate node
  report: EnhancedDebateReport;
  markdown: string;
  questions: string[];
  timestamp: Date;
};

type DebateContextStore = {
  // Map of debate node ID -> debate context
  debates: Map<string, DebateContext>;

  // Map of node ID -> debate node ID (for nodes connected to debates)
  nodeDebateConnections: Map<string, string>;

  // Actions
  addDebate: (nodeId: string, report: EnhancedDebateReport) => void;
  connectNodeToDebate: (nodeId: string, debateNodeId: string) => void;
  disconnectNodeFromDebate: (nodeId: string) => void;
  getDebateForNode: (nodeId: string) => DebateContext | null;
  clearDebate: (nodeId: string) => void;
};

export const useDebateContextStore = create<DebateContextStore>((set, get) => ({
  debates: new Map(),
  nodeDebateConnections: new Map(),

  addDebate: (nodeId: string, report: EnhancedDebateReport) => {
    const debateContext: DebateContext = {
      id: nodeId,
      report,
      markdown: report.markdown,
      questions: report.questions,
      timestamp: new Date(),
    };

    set((state) => {
      const newDebates = new Map(state.debates);
      newDebates.set(nodeId, debateContext);
      return { debates: newDebates };
    });
  },

  connectNodeToDebate: (nodeId: string, debateNodeId: string) => {
    set((state) => {
      const newConnections = new Map(state.nodeDebateConnections);
      newConnections.set(nodeId, debateNodeId);
      return { nodeDebateConnections: newConnections };
    });
  },

  disconnectNodeFromDebate: (nodeId: string) => {
    set((state) => {
      const newConnections = new Map(state.nodeDebateConnections);
      newConnections.delete(nodeId);
      return { nodeDebateConnections: newConnections };
    });
  },

  getDebateForNode: (nodeId: string) => {
    const { debates, nodeDebateConnections } = get();
    const debateNodeId = nodeDebateConnections.get(nodeId);

    if (!debateNodeId) return null;

    return debates.get(debateNodeId) || null;
  },

  clearDebate: (nodeId: string) => {
    set((state) => {
      const newDebates = new Map(state.debates);
      newDebates.delete(nodeId);

      // Also remove any connections to this debate
      const newConnections = new Map(state.nodeDebateConnections);
      for (const [connectedNodeId, debateId] of newConnections.entries()) {
        if (debateId === nodeId) {
          newConnections.delete(connectedNodeId);
        }
      }

      return {
        debates: newDebates,
        nodeDebateConnections: newConnections
      };
    });
  },
}));
