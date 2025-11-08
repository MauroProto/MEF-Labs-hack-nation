/**
 * CanvasControls Component
 *
 * Control panel for canvas operations:
 * - Zoom in/out
 * - Fit view
 * - Lock all / Unlock all
 * - Clear canvas
 * - Save/Load canvas
 */

'use client';

import React from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Lock,
  Unlock,
  Trash2,
  Save,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/lib/stores/canvasStore';

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const {
    lockAllNodes,
    unlockAllNodes,
    clearCanvas,
    lockedNodes,
    nodes,
    isSaving,
  } = useCanvasStore();

  const allNodesLocked = lockedNodes.size === nodes.length && nodes.length > 0;

  const handleToggleLockAll = () => {
    if (allNodesLocked) {
      unlockAllNodes();
    } else {
      lockAllNodes();
    }
  };

  const handleClearCanvas = () => {
    if (
      confirm(
        'Are you sure you want to clear the entire canvas? This action cannot be undone.'
      )
    ) {
      clearCanvas();
    }
  };

  const handleSave = () => {
    // TODO: Implement save to backend
    console.log('Save canvas');
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export canvas');
  };

  return (
    <div className="absolute right-4 top-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-2 space-y-1">
        {/* Zoom Controls */}
        <div className="space-y-1">
          <ControlButton
            onClick={() => zoomIn()}
            icon={ZoomIn}
            label="Zoom In"
          />
          <ControlButton
            onClick={() => zoomOut()}
            icon={ZoomOut}
            label="Zoom Out"
          />
          <ControlButton
            onClick={() => fitView({ padding: 0.2 })}
            icon={Maximize}
            label="Fit View"
          />
        </div>

        <div className="border-t border-gray-200" />

        {/* Lock Controls */}
        <ControlButton
          onClick={handleToggleLockAll}
          icon={allNodesLocked ? Unlock : Lock}
          label={allNodesLocked ? 'Unlock All' : 'Lock All'}
        />

        <div className="border-t border-gray-200" />

        {/* Canvas Operations */}
        <ControlButton
          onClick={handleSave}
          icon={Save}
          label="Save Canvas"
          disabled={isSaving}
        />
        <ControlButton
          onClick={handleExport}
          icon={Download}
          label="Export"
        />
        <ControlButton
          onClick={handleClearCanvas}
          icon={Trash2}
          label="Clear Canvas"
          variant="danger"
        />
      </div>

      {/* Saving Indicator */}
      {isSaving && (
        <div className="px-3 py-2 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
            <span>Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ControlButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

function ControlButton({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
  disabled = false,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        variant === 'default' &&
          'text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-white',
        variant === 'danger' &&
          'text-red-600 hover:bg-red-50 disabled:text-red-300 disabled:hover:bg-white',
        disabled && 'cursor-not-allowed'
      )}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
