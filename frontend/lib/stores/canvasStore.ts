/**
 * Canvas Store (Simplified - No Persistence)
 *
 * Temporary simplified version without localStorage persistence
 */

import { create } from 'zustand';
import type { Node, Edge, Viewport } from '@xyflow/react';

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  canvasId: string | null;
  canvasName: string;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  lockedNodes: Set<string>;

  addNode: (node: Node) => void;
  updateNode: (nodeId: string, data: Partial<Node>) => void;
  removeNode: (nodeId: string) => void;
  setNodes: (nodes: Node[]) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: Viewport) => void;
  setCanvasId: (id: string) => void;
  setCanvasName: (name: string) => void;
  clearCanvas: () => void;
  loadCanvas: (data: { nodes: Node[]; edges: Edge[]; name?: string }) => void;
  triggerAutosave: () => void;
  setIsSaving: (isSaving: boolean) => void;
  toggleNodeLock: (nodeId: string) => void;
  isNodeLocked: (nodeId: string) => boolean;
  lockAllNodes: () => void;
  unlockAllNodes: () => void;
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasId: null,
  canvasName: 'Untitled Canvas',
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  lockedNodes: new Set(),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNode: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...data } : node
      ),
    })),

  removeNode: (nodeId) =>
    set((state) => {
      const newNodes = state.nodes.filter((node) => node.id !== nodeId);
      const newEdges = state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      const newLockedNodes = new Set(state.lockedNodes);
      newLockedNodes.delete(nodeId);

      return { nodes: newNodes, edges: newEdges, lockedNodes: newLockedNodes };
    }),

  setNodes: (nodes) => set({ nodes }),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    })),

  setEdges: (edges) => set({ edges }),

  setViewport: (viewport) => set({ viewport }),

  setCanvasId: (id) => set({ canvasId: id }),

  setCanvasName: (name) => set({ canvasName: name }),

  clearCanvas: () =>
    set({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      canvasId: null,
      canvasName: 'Untitled Canvas',
      lockedNodes: new Set(),
    }),

  loadCanvas: (data) =>
    set({
      nodes: data.nodes,
      edges: data.edges,
      canvasName: data.name || 'Untitled Canvas',
      isLoading: false,
    }),

  triggerAutosave: () => {
    // Simplified: no autosave for now
  },

  setIsSaving: (isSaving) => set({ isSaving }),

  toggleNodeLock: (nodeId) =>
    set((state) => {
      const newLockedNodes = new Set(state.lockedNodes);
      if (newLockedNodes.has(nodeId)) {
        newLockedNodes.delete(nodeId);
      } else {
        newLockedNodes.add(nodeId);
      }
      return { lockedNodes: newLockedNodes };
    }),

  isNodeLocked: (nodeId) => get().lockedNodes.has(nodeId),

  lockAllNodes: () =>
    set((state) => {
      const allNodeIds = state.nodes.map((node) => node.id);
      return { lockedNodes: new Set(allNodeIds) };
    }),

  unlockAllNodes: () => set({ lockedNodes: new Set() }),
}));
