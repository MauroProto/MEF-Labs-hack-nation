/**
 * Canvas Component
 *
 * Main canvas component integrating React Flow with:
 * - Background
 * - Controls
 * - MiniMap
 * - Toolbar
 * - Custom nodes
 * - Connection handling
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/lib/stores/canvasStore';
import { Toolbar } from './Toolbar';
import { CanvasControls } from './CanvasControls';
import { ConnectionLine } from './ConnectionLine';
import { NODE_COLORS } from '@/lib/nodeTypes';

// Import node components (will be implemented in Phase 5)
// For now, we'll use a placeholder
import { NodeWrapper } from '../nodes/NodeWrapper';

// Placeholder node component for MVP
function PlaceholderNode({ id, data, selected }: any) {
  return (
    <NodeWrapper id={id} data={data} selected={selected}>
      <div className="text-sm text-gray-500">
        <p>This is a placeholder for the {data.config.label} node.</p>
        <p className="mt-2 text-xs">Will be implemented in Phase 5.</p>
      </div>
    </NodeWrapper>
  );
}

// Node types mapping
const nodeTypes = {
  'paper-upload': PlaceholderNode,
  'note': PlaceholderNode,
  'paper-chat': PlaceholderNode,
  'web-research': PlaceholderNode,
  'researcher-agent': PlaceholderNode,
  'critic-agent': PlaceholderNode,
  'synthesizer-agent': PlaceholderNode,
  'question-generator': PlaceholderNode,
  'citation-tracker': PlaceholderNode,
  'citation-graph': PlaceholderNode,
  'summary': PlaceholderNode,
  'methodology': PlaceholderNode,
  'results-visualization': PlaceholderNode,
  'insight-report': PlaceholderNode,
};

export function Canvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    viewport,
    setViewport,
  } = useCanvasStore();

  // Use React Flow hooks for local state management
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  // Sync local state with store
  React.useEffect(() => {
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);

  React.useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  // Update store when nodes change
  React.useEffect(() => {
    if (JSON.stringify(nodes) !== JSON.stringify(storeNodes)) {
      setStoreNodes(nodes);
    }
  }, [nodes, storeNodes, setStoreNodes]);

  // Update store when edges change
  React.useEffect(() => {
    if (JSON.stringify(edges) !== JSON.stringify(storeEdges)) {
      setStoreEdges(edges);
    }
  }, [edges, storeEdges, setStoreEdges]);

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      } as Edge;

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // MiniMap node colors
  const nodeColor = useCallback((node: any) => {
    return node.data?.config?.color || '#94a3b8';
  }, []);

  // Default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }),
    []
  );

  return (
    <div className="w-full h-screen bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ConnectionLine}
        fitView
        defaultViewport={viewport}
        onViewportChange={setViewport}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]} // Middle and right mouse button
        zoomOnDoubleClick={false}
      >
        {/* Background with dots */}
        <Background
          gap={12}
          size={1}
          color="#e5e7eb"
        />

        {/* Built-in controls */}
        <Controls
          showZoom
          showFitView
          showInteractive
          position="bottom-left"
        />

        {/* MiniMap */}
        <MiniMap
          nodeColor={nodeColor}
          position="bottom-right"
          pannable
          zoomable
          style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
          }}
        />

        {/* Custom Panels */}
        <Panel position="top-left">
          <Toolbar />
        </Panel>

        <Panel position="top-right">
          <CanvasControls />
        </Panel>

        {/* Save indicator */}
        <Panel position="bottom-center">
          <SaveIndicator />
        </Panel>
      </ReactFlow>
    </div>
  );
}

// Save indicator component
function SaveIndicator() {
  const { lastSaved, isSaving } = useCanvasStore();

  if (isSaving) {
    return (
      <div className="bg-white rounded-full px-4 py-2 shadow-lg border border-gray-200 flex items-center gap-2">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
        <span className="text-xs text-gray-600">Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="bg-white rounded-full px-4 py-2 shadow-lg border border-gray-200">
        <span className="text-xs text-gray-600">
          Saved {new Date(lastSaved).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  return null;
}
