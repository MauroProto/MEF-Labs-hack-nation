/**
 * Enhanced Toolbar
 *
 * Minimalist icon-based node palette
 */

'use client';

import React from 'react';
import { NODE_CONFIGS } from '@/lib/nodeTypes';

interface EnhancedToolbarProps {
  onAddNode: (nodeType: string) => void;
}

// Only the 4 essential nodes
const ESSENTIAL_NODES = ['paper-upload', 'note', 'paper-chat', 'web-research'] as const;

export function EnhancedToolbar({ onAddNode }: EnhancedToolbarProps) {
  return (
    <div className="flex items-center justify-center">
      <div className="bg-white rounded-lg px-2 py-2 flex flex-row gap-1 items-center">
        {ESSENTIAL_NODES.map((nodeType) => {
          const config = NODE_CONFIGS[nodeType];
          if (!config) return null;
          const Icon = config.icon;

          return (
            <button
              key={nodeType}
              onClick={() => onAddNode(nodeType)}
              className="group relative p-2 rounded hover:bg-gray-100 transition-colors"
              title={config.label}
            >
              <Icon className="h-5 w-5 text-gray-900" />

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2">
                  {config.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
