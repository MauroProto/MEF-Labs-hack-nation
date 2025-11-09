/**
 * Note Node - Enhanced Edition
 *
 * Modern note-taking component with markdown support and rich features.
 * Features:
 * - Title and content fields
 * - Live markdown preview
 * - Formatting toolbar
 * - Color themes
 * - Auto-save
 * - Word/character counter
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BaseNode } from './BaseNode';
import {
  Type,
  AlignLeft,
  List,
  ListOrdered,
  Code,
  Eye,
  EyeOff,
  Palette,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NoteNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

const NOTE_COLORS = [
  { name: 'default', bg: 'bg-white', border: 'border-gray-100', accent: '#94a3b8' },
  { name: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-100', accent: '#eab308' },
  { name: 'green', bg: 'bg-green-50', border: 'border-green-100', accent: '#22c55e' },
  { name: 'blue', bg: 'bg-blue-50', border: 'border-blue-100', accent: '#3b82f6' },
  { name: 'purple', bg: 'bg-purple-50', border: 'border-purple-100', accent: '#a855f7' },
  { name: 'pink', bg: 'bg-pink-50', border: 'border-pink-100', accent: '#ec4899' },
];

export function NoteNode({ id, data, selected }: NoteNodeProps) {
  const [title, setTitle] = useState(data.title || '');
  const [content, setContent] = useState(data.content || '');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [noteColor, setNoteColor] = useState(data.noteColor || 'default');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentColor = NOTE_COLORS.find(c => c.name === noteColor) || NOTE_COLORS[0];

  // Auto-save after 1 second of inactivity
  useEffect(() => {
    if (title === (data.title || '') && content === (data.content || '') && noteColor === (data.noteColor || 'default')) {
      return;
    }

    setSaving(true);
    const timeout = setTimeout(() => {
      data.title = title;
      data.content = content;
      data.noteColor = noteColor;
      setSaving(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [title, content, noteColor, data]);

  // Formatting helpers
  const insertMarkdown = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);

    setContent(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText.length > 0) {
        // If there was selected text, select the formatted text
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        // If no text was selected, place cursor between the markers
        textarea.setSelectionRange(start + before.length, start + before.length);
      }
    }, 0);
  }, [content]);

  const formatBold = useCallback(() => insertMarkdown('**', '**'), [insertMarkdown]);
  const formatItalic = useCallback(() => insertMarkdown('*', '*'), [insertMarkdown]);
  const formatCode = useCallback(() => insertMarkdown('`', '`'), [insertMarkdown]);
  const formatBulletList = useCallback(() => insertMarkdown('\n- ', ''), [insertMarkdown]);
  const formatNumberedList = useCallback(() => insertMarkdown('\n1. ', ''), [insertMarkdown]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case 'b':
          e.preventDefault();
          formatBold();
          break;
        case 'i':
          e.preventDefault();
          formatItalic();
          break;
        case 'e':
          e.preventDefault();
          formatCode();
          break;
      }
    }
  }, [formatBold, formatItalic, formatCode]);

  // Word and character count
  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = content.length;

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className={`flex flex-col h-full ${currentColor.bg} transition-all duration-300 ease-in-out`}>
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className={`w-full px-4 py-3 text-lg font-semibold ${currentColor.bg} border-b ${currentColor.border} focus:outline-none placeholder:text-gray-400 transition-all duration-200`}
        />

        {/* Toolbar */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${currentColor.border} flex-shrink-0 transition-colors duration-200`}>
          <div className="flex items-center gap-1">
            {/* Format Buttons */}
            <button
              onClick={formatBold}
              className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
              title="Bold (⌘B)"
            >
              <Type className="h-3.5 w-3.5 text-gray-600 transition-colors" strokeWidth={3} />
            </button>
            <button
              onClick={formatItalic}
              className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
              title="Italic (⌘I)"
            >
              <Type className="h-3.5 w-3.5 text-gray-600 italic transition-colors" />
            </button>
            <button
              onClick={formatCode}
              className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
              title="Code (⌘E)"
            >
              <Code className="h-3.5 w-3.5 text-gray-600 transition-colors" />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1 transition-colors duration-200" />

            <button
              onClick={formatBulletList}
              className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5 text-gray-600 transition-colors" />
            </button>
            <button
              onClick={formatNumberedList}
              className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
              title="Numbered List"
            >
              <ListOrdered className="h-3.5 w-3.5 text-gray-600 transition-colors" />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1 transition-colors duration-200" />

            {/* Color Picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 hover:bg-gray-200/70 active:bg-gray-300/70 rounded transition-all duration-150 hover:scale-105 active:scale-95"
                title="Note Color"
              >
                <Palette className="h-3.5 w-3.5 text-gray-600 transition-colors" />
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => {
                        setNoteColor(color.name);
                        setShowColorPicker(false);
                      }}
                      className={`w-6 h-6 rounded-full ${color.bg} border-2 ${
                        color.name === noteColor ? 'border-gray-900 scale-110' : 'border-gray-300'
                      } hover:border-gray-500 hover:scale-110 transition-all duration-150 active:scale-95`}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1.5 rounded transition-all duration-150 hover:scale-105 active:scale-95 ${
              showPreview ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-200/70 active:bg-gray-300/70'
            }`}
            title={showPreview ? 'Edit' : 'Preview'}
          >
            {showPreview ? (
              <EyeOff className="h-3.5 w-3.5 text-blue-600 transition-colors" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-gray-600 transition-colors" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`transition-opacity duration-200 ${showPreview ? 'opacity-100' : 'opacity-0 absolute'}`}>
            {showPreview && (
              <div className={`p-4 prose prose-sm max-w-none ${currentColor.bg} animate-in fade-in duration-200`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-800">{children}</p>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 text-gray-900">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-2 text-gray-900">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 text-gray-900">{children}</h3>,
                    ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 text-gray-800">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-gray-800">{children}</ol>,
                    li: ({ children }) => <li className="text-gray-800">{children}</li>,
                    code: ({ children }) => (
                      <code className="bg-gray-200 px-2 py-0.5 rounded text-sm font-mono text-gray-900">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto mb-3 font-mono">
                        {children}
                      </pre>
                    ),
                    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-3">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {content || '*No content yet. Start writing...*'}
                </ReactMarkdown>
              </div>
            )}
          </div>

          <div className={`transition-opacity duration-200 ${!showPreview ? 'opacity-100' : 'opacity-0 absolute'}`}>
            {!showPreview && (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start writing... (Markdown supported)"
                className={`w-full h-full px-4 py-3 text-base ${currentColor.bg} focus:outline-none resize-none font-sans leading-relaxed text-gray-800 placeholder:text-gray-400 transition-all duration-200 animate-in fade-in`}
                style={{ minHeight: '200px' }}
              />
            )}
          </div>
        </div>

        {/* Footer - Stats */}
        <div className={`flex items-center justify-between px-4 py-2 border-t ${currentColor.border} text-xs text-gray-500 flex-shrink-0 transition-colors duration-200`}>
          <div className="flex items-center gap-3">
            <span className="transition-all duration-200">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span className="text-gray-300">•</span>
            <span className="transition-all duration-200">{charCount} {charCount === 1 ? 'char' : 'chars'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {saving ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-600 animate-in fade-in slide-in-from-right-2 duration-200">Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-green-500 animate-in fade-in scale-in-0 duration-300" />
                <span className="text-green-600 animate-in fade-in slide-in-from-right-2 duration-200">Saved</span>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
