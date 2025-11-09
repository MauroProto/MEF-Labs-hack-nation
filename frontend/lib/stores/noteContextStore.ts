/**
 * Note Context Store
 *
 * Simple store to track notes and their connections for context sharing
 */

import { create } from 'zustand';

export interface Note {
  id: string;
  content: string;
  color: string;
  createdAt: Date;
}

export interface NoteContextState {
  notes: Map<string, Note>;
  noteConnections: Map<string, string>; // nodeId -> noteId

  addNote: (noteId: string, content: string, color: string) => void;
  updateNote: (noteId: string, content: string) => void;
  removeNote: (noteId: string) => void;
  getNote: (noteId: string) => Note | undefined;
  getNoteForNode: (nodeId: string) => Note | undefined;
  getContextForNode: (nodeId: string) => string | undefined;
}

export const useNoteContextStore = create<NoteContextState>()((set, get) => ({
  notes: new Map(),
  noteConnections: new Map(),

  addNote: (noteId, content, color) =>
    set((state) => {
      const newNotes = new Map(state.notes);
      newNotes.set(noteId, {
        id: noteId,
        content,
        color,
        createdAt: new Date(),
      });
      return { notes: newNotes };
    }),

  updateNote: (noteId, content) =>
    set((state) => {
      const note = state.notes.get(noteId);
      if (!note) return state;

      const newNotes = new Map(state.notes);
      newNotes.set(noteId, { ...note, content });
      return { notes: newNotes };
    }),

  removeNote: (noteId) =>
    set((state) => {
      const newNotes = new Map(state.notes);
      const newConnections = new Map(state.noteConnections);

      newNotes.delete(noteId);

      // Remove all connections to this note
      for (const [nodeId, connectedNoteId] of newConnections) {
        if (connectedNoteId === noteId) {
          newConnections.delete(nodeId);
        }
      }

      return {
        notes: newNotes,
        noteConnections: newConnections,
      };
    }),

  getNote: (noteId) => get().notes.get(noteId),

  getNoteForNode: (nodeId) => {
    const noteId = get().noteConnections.get(nodeId);
    return noteId ? get().notes.get(noteId) : undefined;
  },

  getContextForNode: (nodeId) => {
    const note = get().getNoteForNode(nodeId);
    return note?.content;
  },
}));
