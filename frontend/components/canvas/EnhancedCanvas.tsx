/**
 * Enhanced Canvas
 *
 * Main canvas component with custom node types and drag & drop
 */

'use client';

import React, { useCallback, useMemo, useEffect, useState } from 'react';
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
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Eye, EyeOff } from 'lucide-react';
import { EnhancedToolbar } from './EnhancedToolbar';
import { SimpleControls } from './SimpleControls';
import { NODE_COMPONENTS } from '@/lib/nodeComponents';
import { NODE_CONFIGS, CustomNode } from '@/lib/nodeTypes';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

function EnhancedCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const connectNodeToPaper = usePaperContextStore((s) => s.connectNodeToPaper);
  const getPaperForNode = usePaperContextStore((s) => s.getPaperForNode);
  const paperConnections = usePaperContextStore((s) => s.paperConnections);

  // MiniMap visibility state
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Get React Flow instance for viewport-aware positioning
  const { screenToFlowPosition } = useReactFlow();

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

      const config = NODE_CONFIGS[nodeType as keyof typeof NODE_CONFIGS];
      if (!config) return;

      // Convert screen coordinates to flow coordinates
      const dropPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Offset to center the node at drop point
      const position = {
        x: dropPosition.x - config.defaultWidth / 2,
        y: dropPosition.y - config.defaultHeight / 2,
      };

      const newNode: CustomNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: String(config.label), // Ensure it's a string
          type: nodeType as any,
          config,
          locked: false,
        },
        draggable: true,
        style: {
          width: config.defaultWidth,
          height: config.defaultHeight,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, screenToFlowPosition]
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
    if (!config) {
      console.error(`Config not found for node type: ${nodeType}`);
      return;
    }

    // Calculate center of current viewport
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // Offset to center the node (subtract half of default dimensions)
    const position = {
      x: viewportCenter.x - config.defaultWidth / 2,
      y: viewportCenter.y - config.defaultHeight / 2,
    };

    const newNode: CustomNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: {
        label: String(config.label), // Ensure it's a string
        type: nodeType as any,
        config,
        locked: false,
      },
      draggable: true,
      style: {
        width: config.defaultWidth,
        height: config.defaultHeight,
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, screenToFlowPosition]);

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

        {/* MiniMap with Toggle Button */}
        {showMiniMap ? (
          <>
            <MiniMap
              nodeColor={nodeColor}
              position="top-left"
              style={{
                width: 180,
                height: 120,
                backgroundColor: '#f9fafb',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
              }}
              maskColor="rgba(0, 0, 0, 0.05)"
              nodeStrokeWidth={3}
              pannable
              zoomable
            />
            <button
              onClick={() => setShowMiniMap(false)}
              className="absolute top-2 bg-white/80 backdrop-blur-sm rounded p-1 hover:bg-white transition-all z-10 opacity-60 hover:opacity-100"
              title="Hide MiniMap"
              style={{ left: '168px', pointerEvents: 'auto' }}
            >
              <EyeOff className="h-3 w-3 text-gray-600" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowMiniMap(true)}
            className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm rounded p-1.5 hover:bg-white transition-all z-10 opacity-60 hover:opacity-100"
            title="Show MiniMap"
            style={{ pointerEvents: 'auto' }}
          >
            <Eye className="h-3.5 w-3.5 text-gray-600" />
          </button>
        )}

        <Controls
          showZoom={true}
          showFitView
          showInteractive={false}
          position="bottom-right"
        />

        {/* Empty State - Welcome Message */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <div className="flex flex-col items-center mt-32">
              <pre className="text-gray-400 text-base font-mono leading-snug text-center">
{`┌──────────────────────────┐
│                          │
│    Research Canvas       │
│                          │
│    Click below to add    │
│    your first node       │
│                          │
└──────────────────────────┘`}
              </pre>
              <div className="flex flex-col items-center mt-2">
                <div className="text-gray-400 text-2xl">│</div>
                <div className="text-gray-400 text-2xl">│</div>
                <div className="text-gray-400 text-2xl">▼</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Toolbar - Node Palette */}
        <Panel position="bottom-center">
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

// Wrapper component with ReactFlowProvider
export function EnhancedCanvas() {
  return (
    <ReactFlowProvider>
      <EnhancedCanvasInner />
    </ReactFlowProvider>
  );
}
