/**
 * Paper Context Store (Simplified - No Persistence)
 */

import { create } from 'zustand';

export interface PaperAuthor {
  name: string;
  affiliation?: string;
}

export interface PaperCitation {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
}

export interface Paper {
  id: string;
  canvasId: string;
  title: string;
  authors: PaperAuthor[];
  abstract: string | null;
  fullText: string;
  citations: PaperCitation[];
  metadata: {
    doi?: string;
    year?: number;
    journal?: string;
    keywords?: string[];
    pageCount?: number;
    uploadedAt: Date;
    fileUrl?: string;
    filename?: string;
  };
}

export interface PaperContextState {
  papers: Map<string, Paper>;
  paperConnections: Map<string, string>;
  selectedPaper: Paper | null;
  isUploading: boolean;
  uploadProgress: number;

  addPaper: (paper: Paper) => void;
  removePaper: (paperId: string) => void;
  getPaper: (paperId: string) => Paper | undefined;
  getAllPapers: () => Paper[];
  updatePaper: (paperId: string, updates: Partial<Paper>) => void;
  connectNodeToPaper: (nodeId: string, paperId: string) => void;
  disconnectNode: (nodeId: string) => void;
  getPaperForNode: (nodeId: string) => Paper | undefined;
  getNodesForPaper: (paperId: string) => string[];
  selectPaper: (paper: Paper | null) => void;
  setUploading: (isUploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  getContextForNode: (nodeId: string) => {
    paper: Paper | undefined;
    connectedPapers: Paper[];
  };
  clearAll: () => void;
}

export const usePaperContextStore = create<PaperContextState>()((set, get) => ({
  papers: new Map(),
  paperConnections: new Map(),
  selectedPaper: null,
  isUploading: false,
  uploadProgress: 0,

  addPaper: (paper) =>
    set((state) => {
      const newPapers = new Map(state.papers);
      newPapers.set(paper.id, paper);
      console.log('[PaperContextStore] Added paper:', paper.fullText.length);
      return { papers: newPapers };
    }),

  removePaper: (paperId) =>
    set((state) => {
      const newPapers = new Map(state.papers);
      const newConnections = new Map(state.paperConnections);

      newPapers.delete(paperId);

      for (const [nodeId, connectedPaperId] of newConnections) {
        if (connectedPaperId === paperId) {
          newConnections.delete(nodeId);
        }
      }

      return {
        papers: newPapers,
        paperConnections: newConnections,
        selectedPaper:
          state.selectedPaper?.id === paperId ? null : state.selectedPaper,
      };
    }),

  getPaper: (paperId) => get().papers.get(paperId),

  getAllPapers: () => Array.from(get().papers.values()),

  updatePaper: (paperId, updates) =>
    set((state) => {
      const paper = state.papers.get(paperId);
      if (!paper) return state;

      const newPapers = new Map(state.papers);
      newPapers.set(paperId, { ...paper, ...updates });

      return { papers: newPapers };
    }),

  connectNodeToPaper: (nodeId, paperId) =>
    set((state) => {
      const newConnections = new Map(state.paperConnections);
      newConnections.set(nodeId, paperId);
      return { paperConnections: newConnections };
    }),

  disconnectNode: (nodeId) =>
    set((state) => {
      const newConnections = new Map(state.paperConnections);
      newConnections.delete(nodeId);
      return { paperConnections: newConnections };
    }),

  getPaperForNode: (nodeId) => {
    const paperId = get().paperConnections.get(nodeId);
    return paperId ? get().papers.get(paperId) : undefined;
  },

  getNodesForPaper: (paperId) => {
    const connections = get().paperConnections;
    const nodeIds: string[] = [];

    for (const [nodeId, connectedPaperId] of connections) {
      if (connectedPaperId === paperId) {
        nodeIds.push(nodeId);
      }
    }

    return nodeIds;
  },

  selectPaper: (paper) => set({ selectedPaper: paper }),

  setUploading: (isUploading) => set({ isUploading }),

  setUploadProgress: (progress) => set({ uploadProgress: progress }),

  getContextForNode: (nodeId) => {
    const state = get();
    const directPaper = state.getPaperForNode(nodeId);
    const allPapers = state.getAllPapers();

    return {
      paper: directPaper,
      connectedPapers: directPaper ? [directPaper] : allPapers,
    };
  },

  clearAll: () =>
    set({
      papers: new Map(),
      paperConnections: new Map(),
      selectedPaper: null,
      isUploading: false,
      uploadProgress: 0,
    }),
}));
