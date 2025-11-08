/**
 * Toolbar Component
 *
 * Categorized node buttons for adding nodes to the canvas.
 * Categories: Input, Research, Agents, Visualization
 */

'use client';

import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getNodesByCategory,
  getNodeConfig,
  type NodeCategory,
  type NodeType,
} from '@/lib/nodeTypes';
import { useCanvasStore } from '@/lib/stores/canvasStore';

export function Toolbar() {
  const { screenToFlowPosition } = useReactFlow();
  const { addNode } = useCanvasStore();

  const [activeCategory, setActiveCategory] = React.useState<NodeCategory>('input');

  const categories: { id: NodeCategory; label: string }[] = [
    { id: 'input', label: 'Input' },
    { id: 'research', label: 'Research' },
    { id: 'agent', label: 'Agents' },
    { id: 'visualization', label: 'Visualization' },
  ];

  const handleAddNode = (nodeType: NodeType) => {
    const config = getNodeConfig(nodeType);

    // Get viewport center
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode = {
      id: nanoid(),
      type: nodeType,
      position: {
        x: viewportCenter.x - config.defaultWidth / 2,
        y: viewportCenter.y - config.defaultHeight / 2,
      },
      data: {
        label: config.label,
        type: nodeType,
        config,
      },
    };

    addNode(newNode);
  };

  const nodesInCategory = getNodesByCategory(activeCategory);

  return (
    <div className="absolute left-4 top-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 w-64">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900">Add Nodes</h3>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeCategory === category.id
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Node Buttons */}
      <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
        {nodesInCategory.map((nodeConfig) => {
          const Icon = nodeConfig.icon;
          return (
            <button
              key={nodeConfig.type}
              onClick={() => handleAddNode(nodeConfig.type)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors text-left group"
              title={nodeConfig.description}
            >
              <div
                className="flex items-center justify-center h-8 w-8 rounded flex-shrink-0"
                style={{ backgroundColor: `${nodeConfig.color}20` }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: nodeConfig.color }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                  {nodeConfig.label}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {nodeConfig.description}
                </div>
              </div>
              <Plus className="h-4 w-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
