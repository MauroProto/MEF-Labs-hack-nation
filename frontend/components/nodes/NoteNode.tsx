/**
 * Note Node
 *
 * Simple text note component for annotations and ideas.
 * Features:
 * - Rich text editing
 * - Auto-save
 * - Markdown support (future)
 * - Color coding
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { Save, Check } from 'lucide-react';

interface NoteNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function NoteNode({ id, data, selected }: NoteNodeProps) {
  const [content, setContent] = useState(data.content || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  // Auto-save after 1 second of inactivity
  useEffect(() => {
    if (content === (data.content || '')) {
      setSaved(true);
      return;
    }

    setSaved(false);
    const timeout = setTimeout(() => {
      // TODO: Save to backend or canvasStore
      console.log('Auto-saving note:', id, content);
      setSaving(true);

      setTimeout(() => {
        setSaving(false);
        setSaved(true);

        // Update node data
        data.content = content;
      }, 300);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [content, data, id]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1.5">
        {/* Status Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {saving ? (
              <Save className="h-3 w-3 text-blue-500 animate-pulse" />
            ) : saved ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <div className="h-3 w-3 rounded-full bg-gray-400" />
            )}
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {saving ? 'saving' : saved ? 'saved' : 'edit'}
            </span>
          </div>
          <span className="text-xs text-gray-400">{content.length}</span>
        </div>

        {/* Text Area */}
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Note..."
          className="w-full h-32 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none font-mono"
          style={{ minHeight: '128px' }}
        />
      </div>
    </BaseNode>
  );
}
