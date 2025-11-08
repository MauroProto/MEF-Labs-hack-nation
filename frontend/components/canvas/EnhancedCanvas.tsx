/**
 * Enhanced Canvas
 *
 * Main canvas component with custom node types and drag & drop
 */

'use client';

import React, { useCallback, useMemo, useEffect } from 'react';
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
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EnhancedToolbar } from './EnhancedToolbar';
import { SimpleControls } from './SimpleControls';
import { NODE_COMPONENTS } from '@/lib/nodeComponents';
import { NODE_CONFIGS, CustomNode } from '@/lib/nodeTypes';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

export function EnhancedCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const connectNodeToPaper = usePaperContextStore((s) => s.connectNodeToPaper);
  const getPaperForNode = usePaperContextStore((s) => s.getPaperForNode);
  const paperConnections = usePaperContextStore((s) => s.paperConnections);

  // Define custom node types
  const nodeTypes: NodeTypes = useMemo(() => NODE_COMPONENTS, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      } as Edge;
      setEdges((eds) => addEdge(newEdge, eds));

      // If a paper-upload node connects to another node, attach its paper to the target node
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      if (sourceNode?.type === 'paper-upload' && params.target) {
        const paper = getPaperForNode(sourceNode.id);
        const pid = (paper && paper.id) || ((sourceNode.data as any)?.lastPaperId as string | undefined);
        if (pid) connectNodeToPaper(params.target, pid);
      } else if (targetNode?.type === 'paper-upload' && params.source) {
        const paper = getPaperForNode(targetNode.id);
        const pid = (paper && paper.id) || ((targetNode.data as any)?.lastPaperId as string | undefined);
        if (pid) connectNodeToPaper(params.source, pid);
      }
    },
    [setEdges, nodes, connectNodeToPaper, getPaperForNode]
  );

  // Handle drop from toolbar
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 150, // Center node
        y: event.clientY - reactFlowBounds.top - 100,
      };

      const config = NODE_CONFIGS[nodeType as keyof typeof NODE_CONFIGS];
      if (!config) return;

      const newNode: CustomNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: config.label,
          type: nodeType as any,
          config,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const nodeColor = useCallback((node: any) => {
    const config = NODE_CONFIGS[node.type as keyof typeof NODE_CONFIGS];
    return config?.color || '#3b82f6';
  }, []);

  // Add node on button click
  const addNode = useCallback((nodeType: string) => {
    const config = NODE_CONFIGS[nodeType as keyof typeof NODE_CONFIGS];
    if (!config) return;

    // Calculate center position
    const centerX = window.innerWidth / 2 - 150;
    const centerY = window.innerHeight / 2 - 100;

    const newNode: CustomNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: centerX, y: centerY },
      data: {
        label: config.label,
        type: nodeType as any,
        config,
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  // Keep paper connections in sync for existing edges and late uploads
  useEffect(() => {
    if (!nodes.length || !edges.length) return;

    const paperByNode: Record<string, string> = {};
    for (const n of nodes) {
      if (n.type === 'paper-upload') {
        const p = getPaperForNode(n.id);
        if (p?.id) paperByNode[n.id] = p.id;
      }
    }

    if (Object.keys(paperByNode).length === 0) return;

    for (const e of edges) {
      const sp = paperByNode[e.source];
      if (sp && paperConnections.get(e.target) !== sp) {
        connectNodeToPaper(e.target, sp);
      }
      const tp = paperByNode[e.target];
      if (tp && paperConnections.get(e.source) !== tp) {
        connectNodeToPaper(e.source, tp);
      }
    }
  }, [nodes, edges, paperConnections, connectNodeToPaper, getPaperForNode]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        deleteKeyCode="Delete"
        panOnScroll
        selectionOnDrag
        proOptions={{ hideAttribution: true }}
        elevateNodesOnSelect={false}
        nodesDraggable
        nodesConnectable
        elementsSelectable
      >
        <Background color="#e5e7eb" gap={16} size={0.5} />

        <Controls
          showZoom={false}
          showFitView
          showInteractive={false}
          position="bottom-left"
        />

        {/* Left Toolbar - Node Palette */}
        <Panel position="top-left">
          <EnhancedToolbar onAddNode={addNode} />
        </Panel>

        {/* Right Info Panel */}
        <Panel position="top-right">
          <SimpleControls />
        </Panel>
      </ReactFlow>
    </div>
  );
}
