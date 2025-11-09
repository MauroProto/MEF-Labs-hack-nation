/**
 * Note Node - Post-it Style
 *
 * Simple sticky note component with color options
 * Content is shared with connected nodes via noteContextStore
 */

'use client';

import React, { useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { Palette } from 'lucide-react';
import { useNoteContextStore } from '@/lib/stores/noteContextStore';

interface NoteNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

const POST_IT_COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100', text: 'text-gray-800', shadow: 'shadow-yellow-200/50' },
  { name: 'pink', bg: 'bg-pink-100', text: 'text-gray-800', shadow: 'shadow-pink-200/50' },
  { name: 'blue', bg: 'bg-blue-100', text: 'text-gray-800', shadow: 'shadow-blue-200/50' },
  { name: 'green', bg: 'bg-green-100', text: 'text-gray-800', shadow: 'shadow-green-200/50' },
  { name: 'purple', bg: 'bg-purple-100', text: 'text-gray-800', shadow: 'shadow-purple-200/50' },
  { name: 'orange', bg: 'bg-orange-100', text: 'text-gray-800', shadow: 'shadow-orange-200/50' },
];

export function NoteNode({ id, data, selected }: NoteNodeProps) {
  const [content, setContent] = useState(data.content || '');
  const [noteColor, setNoteColor] = useState(data.noteColor || 'yellow');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const { addNote, updateNote } = useNoteContextStore();

  const currentColor = POST_IT_COLORS.find(c => c.name === noteColor) || POST_IT_COLORS[0];

  // Initialize note in store on mount
  useEffect(() => {
    addNote(id, content, noteColor);
  }, []);

  // Auto-save and update store
  useEffect(() => {
    const timeout = setTimeout(() => {
      data.content = content;
      data.noteColor = noteColor;
      updateNote(id, content);
    }, 500);

    return () => clearTimeout(timeout);
  }, [content, noteColor, data, id, updateNote]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div
        className={`h-full ${currentColor.bg} transition-all duration-200 relative p-4`}
        onMouseDown={(e) => {
          // Only stop propagation if clicking on the container, not the textarea
          if (e.target === e.currentTarget) {
            e.stopPropagation();
          }
        }}
      >
        {/* Color picker button */}
        <div className="absolute top-2 right-2 z-10">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="p-1 hover:bg-black/5 rounded-full transition-all"
              title="Change color"
            >
              <Palette className="h-3 w-3 text-gray-500/60" />
            </button>

            {showColorPicker && (
              <div
                className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 grid grid-cols-3 gap-1.5 z-50"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {POST_IT_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteColor(color.name);
                      setShowColorPicker(false);
                    }}
                    className={`w-7 h-7 rounded ${color.bg} border-2 ${
                      color.name === noteColor ? 'border-gray-800 scale-110' : 'border-gray-300'
                    } hover:border-gray-600 hover:scale-110 transition-all`}
                    title={color.name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content area - textarea styled like a sticky note */}
        <textarea
          ref={textAreaRef}
          value={content}
          onChange={(e) => {
            e.stopPropagation();
            setContent(e.target.value);
          }}
          onKeyDown={(e) => {
            // Prevent keyboard events from propagating to the canvas
            e.stopPropagation();
          }}
          onKeyPress={(e) => {
            // Additional handler to ensure key events work
            e.stopPropagation();
          }}
          onInput={(e) => {
            // Additional handler for input events
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            // Prevent drag when clicking inside textarea
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Ensure clicks don't propagate
            e.stopPropagation();
          }}
          onFocus={(e) => {
            // Ensure focus works
            e.stopPropagation();
          }}
          placeholder="Write your note here..."
          className={`w-full h-full ${currentColor.bg} ${currentColor.text} focus:outline-none text-base leading-relaxed transition-all resize-none placeholder:text-gray-400/50 nodrag nopan`}
          style={{
            fontFamily: "'Kalam', 'Comic Sans MS', cursive",
            lineHeight: '1.6',
            padding: '0.75rem',
            border: 'none',
            background: 'transparent',
          }}
        />
      </div>
    </BaseNode>
  );
}
