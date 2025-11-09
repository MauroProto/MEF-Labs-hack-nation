/**
 * BaseNode Component
 *
 * Reusable base component for all node types.
 * Features:
 * - Color-coded header by node type
 * - 4-directional handles (top, right, bottom, left)
 * - Lock/unlock functionality
 * - Delete button
 * - Selection ring styling
 * - Hover effects
 */

'use client';

import React from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react';
import { Lock, Unlock, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import type { NodeConfig } from '@/lib/nodeTypes';

export interface BaseNodeProps {
  id: string;
  data: {
    label: string;
    config: NodeConfig;
    locked?: boolean;
  };
  selected?: boolean;
  children?: React.ReactNode;
}

export function BaseNode({ id, data, selected, children }: BaseNodeProps) {
  const { config, locked = false } = data;
  const { toggleNodeLock } = useCanvasStore();
  const { deleteElements, setNodes } = useReactFlow();

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, locked: !locked },
              draggable: locked, // If currently locked, make draggable
            }
          : node
      )
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, locked: !locked },
              draggable: locked, // If currently locked, make draggable
            }
          : node
      )
    );
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (locked) {
      // Keep wheel events inside the node; allow element to scroll
      e.stopPropagation();
    }
  };

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'group rounded-lg border-[3px] bg-white text-gray-900',
        selected && !locked && 'border-blue-500 ring-1 ring-blue-200',
        !selected && !locked && 'border-gray-200',
        locked && 'border-orange-500 ring-2 ring-orange-200 nopan'
      )}
      style={{
        width: '100%',
        height: '100%',
        minWidth: config.defaultWidth,
        minHeight: config.defaultHeight,
        willChange: selected ? 'width, height' : 'auto'
      }}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      {/* Node Resizer - only show when selected */}
      {selected && !locked && (
        <NodeResizer
          minWidth={config.defaultWidth}
          minHeight={config.defaultHeight}
          isVisible={selected}
          lineClassName="border-blue-500"
          handleClassName="h-5 w-5 bg-white border-2 border-blue-500 rounded"
          keepAspectRatio={false}
        />
      )}

      {/* Handles for connections - 4 sides, only visible on node hover */}
      {config.hasInput && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            className="!h-4 !w-4 !bg-gray-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            className="!h-4 !w-4 !bg-gray-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
          <Handle
            type="target"
            position={Position.Bottom}
            id="bottom"
            className="!h-4 !w-4 !bg-gray-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
        </>
      )}

      {config.hasOutput && (
        <>
          <Handle
            type="source"
            position={Position.Top}
            id="top-source"
            className="!h-4 !w-4 !bg-blue-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!h-4 !w-4 !bg-blue-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom-source"
            className="!h-4 !w-4 !bg-blue-500 !border-2 !border-white opacity-0 group-hover:opacity-60 transition-opacity"
          />
        </>
      )}

      {/* Header - Draggable area */}
      <div
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5 bg-white border-b border-gray-200 rounded-t-lg",
          !locked && "cursor-grab active:cursor-grabbing"
        )}
        data-drag-handle
      >
        <div className="flex items-center gap-1.5">
          {!locked && <GripVertical className="h-3.5 w-3.5 text-gray-400" />}
          <span className="inline-block h-2.5 w-1 rounded-sm" style={{ backgroundColor: config.color }} />
          <Icon className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-sm text-gray-900">{data.label}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleLockToggle}
            className="rounded p-0.5 hover:bg-gray-100"
            title={locked ? 'Unlock' : 'Lock'}
          >
            {locked ? <Lock className="h-3 w-3 text-gray-500" /> : <Unlock className="h-3 w-3 text-gray-500" />}
          </button>

          <button
            onClick={handleDelete}
            className="rounded p-0.5 hover:bg-gray-100"
            title="Delete"
          >
            <Trash2 className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content - nopan prevents canvas panning when scrolling */}
      <div
        className={cn(
          'nopan',
          locked ? 'overflow-auto' : 'overflow-hidden'
        )}
        style={{
          height: 'calc(100% - 36px)',
          minHeight: `calc(${config.defaultHeight}px - 36px)`,
          padding: 0,
          margin: 0,
          touchAction: locked ? 'pan-y' : undefined
        }}
        onWheelCapture={locked ? (e) => e.stopPropagation() : undefined}
        onWheel={locked ? (e) => e.stopPropagation() : undefined}
      >
        {children}
      </div>
    </div>
  );
}
