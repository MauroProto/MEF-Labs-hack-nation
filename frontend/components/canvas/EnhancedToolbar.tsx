/**
 * Enhanced Toolbar
 *
 * Draggable node palette organized by category
 */

'use client';

import React from 'react';
import { getNodesByCategory, NodeCategory, NodeConfig } from '@/lib/nodeTypes';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CATEGORIES: { key: NodeCategory; label: string }[] = [
  { key: 'input', label: 'Input' },
  { key: 'research', label: 'Research' },
  { key: 'agent', label: 'Agents' },
  { key: 'visualization', label: 'Visualization' },
];

interface EnhancedToolbarProps {
  onAddNode: (nodeType: string) => void;
}

export function EnhancedToolbar({ onAddNode }: EnhancedToolbarProps) {
  const [expandedCategories, setExpandedCategories] = React.useState<Set<NodeCategory>>(
    new Set(['input', 'research', 'agent'])
  );

  const toggleCategory = (category: NodeCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg border border-gray-200 w-56 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 sticky top-0 bg-white/90 backdrop-blur z-10">
        <h3 className="font-medium text-xs text-gray-900">Nodes</h3>
      </div>

      {/* Categories */}
      <div className="p-2">
        {CATEGORIES.map((category) => {
          const nodes = getNodesByCategory(category.key);
          const isExpanded = expandedCategories.has(category.key);

          return (
            <div key={category.key} className="mb-1.5">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded"
              >
                <span className="capitalize text-xs">{category.label}</span>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Nodes */}
              {isExpanded && (
                <div className="mt-1 space-y-0.5">
                  {nodes.map((node) => (
                    <NodeButton
                      key={node.type}
                      node={node}
                      onAddNode={onAddNode}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface NodeButtonProps {
  node: NodeConfig;
  onAddNode: (nodeType: string) => void;
}

function NodeButton({ node, onAddNode }: NodeButtonProps) {
  const Icon = node.icon;

  return (
    <button
      onClick={() => onAddNode(node.type)}
      className="w-full flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-200"
      title={node.description}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: node.color }} />
      <span className="text-xs font-medium text-gray-700 truncate">{node.label}</span>
    </button>
  );
}
