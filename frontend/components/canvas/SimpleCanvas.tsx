'use client';

import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SimpleToolbar } from './SimpleToolbar';
import { SimpleControls } from './SimpleControls';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'default',
    data: { label: 'Welcome to Research Agent Canvas!' },
    position: { x: 250, y: 25 },
  },
  {
    id: '2',
    type: 'default',
    data: { label: 'Phase 3: Canvas System Complete ✅' },
    position: { x: 100, y: 125 },
  },
  {
    id: '3',
    type: 'default',
    data: { label: 'Next: Backend API + Agent Nodes' },
    position: { x: 400, y: 125 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
];

export function SimpleCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}`,
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      } as Edge;
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const nodeColor = useCallback((node: any) => {
    return '#3b82f6';
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        panOnScroll
        selectionOnDrag
      >
        <Background color="#e5e7eb" gap={12} size={1} />

        <Controls
          showZoom
          showFitView
          showInteractive
          position="bottom-left"
        />

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

        <Panel position="top-left">
          <SimpleToolbar />
        </Panel>

        <Panel position="top-right">
          <SimpleControls />
        </Panel>
      </ReactFlow>
    </div>
  );
}
