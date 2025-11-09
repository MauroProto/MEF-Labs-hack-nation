/**
 * Chat Context Store
 *
 * Manages conversation history and connections between chat nodes,
 * enabling context sharing across connected chats.
 */

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatConversation {
  nodeId: string;
  messages: ChatMessage[];
  lastUpdated: Date;
  paperContext?: {
    paperId: string;
    title: string;
  };
}

export interface ChatContextState {
  // Map of nodeId → conversation
  conversations: Map<string, ChatConversation>;

  // Map of nodeId → connected upstream chat nodeIds (sources of context)
  chatConnections: Map<string, Set<string>>;

  // Store or update a conversation for a node
  updateConversation: (nodeId: string, messages: ChatMessage[], paperContext?: { paperId: string; title: string }) => void;

  // Get conversation for a specific node
  getConversation: (nodeId: string) => ChatConversation | undefined;

  // Connect a chat node to another chat node (source → target)
  connectChatToChat: (sourceNodeId: string, targetNodeId: string) => void;

  // Disconnect a chat from another
  disconnectChat: (sourceNodeId: string, targetNodeId: string) => void;

  // Get all upstream chat contexts for a node (chats that feed into this one)
  getUpstreamChats: (nodeId: string) => ChatConversation[];

  // Get full context chain for a node (all upstream conversations)
  getContextChain: (nodeId: string) => ChatConversation[];

  // Remove a conversation
  removeConversation: (nodeId: string) => void;

  // Clear all
  clearAll: () => void;
}

export const useChatContextStore = create<ChatContextState>()((set, get) => ({
  conversations: new Map(),
  chatConnections: new Map(),

  updateConversation: (nodeId, messages, paperContext) =>
    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(nodeId, {
        nodeId,
        messages,
        lastUpdated: new Date(),
        paperContext,
      });
      console.log(`[ChatContextStore] Updated conversation for ${nodeId}:`, messages.length, 'messages');
      return { conversations: newConversations };
    }),

  getConversation: (nodeId) => get().conversations.get(nodeId),

  connectChatToChat: (sourceNodeId, targetNodeId) =>
    set((state) => {
      const newConnections = new Map(state.chatConnections);
      const existing = newConnections.get(targetNodeId) || new Set();
      existing.add(sourceNodeId);
      newConnections.set(targetNodeId, existing);
      console.log(`[ChatContextStore] Connected ${sourceNodeId} → ${targetNodeId}`);
      return { chatConnections: newConnections };
    }),

  disconnectChat: (sourceNodeId, targetNodeId) =>
    set((state) => {
      const newConnections = new Map(state.chatConnections);
      const existing = newConnections.get(targetNodeId);
      if (existing) {
        existing.delete(sourceNodeId);
        if (existing.size === 0) {
          newConnections.delete(targetNodeId);
        } else {
          newConnections.set(targetNodeId, existing);
        }
      }
      return { chatConnections: newConnections };
    }),

  getUpstreamChats: (nodeId) => {
    const state = get();
    const upstreamNodeIds = state.chatConnections.get(nodeId);
    if (!upstreamNodeIds || upstreamNodeIds.size === 0) return [];

    const upstreamChats: ChatConversation[] = [];
    for (const upstreamId of upstreamNodeIds) {
      const conversation = state.conversations.get(upstreamId);
      if (conversation) {
        upstreamChats.push(conversation);
      }
    }

    return upstreamChats;
  },

  getContextChain: (nodeId) => {
    const state = get();
    const visited = new Set<string>();
    const chain: ChatConversation[] = [];

    // Recursive function to collect all upstream chats
    const collectUpstream = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return; // Avoid cycles
      visited.add(currentNodeId);

      const upstreamNodeIds = state.chatConnections.get(currentNodeId);
      if (!upstreamNodeIds) return;

      for (const upstreamId of upstreamNodeIds) {
        // First collect upstream of the upstream (depth-first)
        collectUpstream(upstreamId);

        // Then add this upstream conversation
        const conversation = state.conversations.get(upstreamId);
        if (conversation && !chain.some(c => c.nodeId === upstreamId)) {
          chain.push(conversation);
        }
      }
    };

    collectUpstream(nodeId);
    return chain;
  },

  removeConversation: (nodeId) =>
    set((state) => {
      const newConversations = new Map(state.conversations);
      const newConnections = new Map(state.chatConnections);

      newConversations.delete(nodeId);

      // Remove this node from all connections
      for (const [targetId, sources] of newConnections) {
        if (sources.has(nodeId)) {
          sources.delete(nodeId);
          if (sources.size === 0) {
            newConnections.delete(targetId);
          }
        }
      }

      // Remove connections where this node is the target
      newConnections.delete(nodeId);

      return {
        conversations: newConversations,
        chatConnections: newConnections,
      };
    }),

  clearAll: () =>
    set({
      conversations: new Map(),
      chatConnections: new Map(),
    }),
}));
