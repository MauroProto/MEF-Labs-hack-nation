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
import { useDebateContextStore } from '@/lib/stores/debateContextStore';
import { useChatContextStore } from '@/lib/stores/chatContextStore';

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

function EnhancedCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const connectNodeToPaper = usePaperContextStore((s) => s.connectNodeToPaper);
  const getPaperForNode = usePaperContextStore((s) => s.getPaperForNode);
  const paperConnections = usePaperContextStore((s) => s.paperConnections);

  // Debate context for mas-debate node connections
  const connectNodeToDebate = useDebateContextStore((s) => s.connectNodeToDebate);
  const getDebateForNode = useDebateContextStore((s) => s.getDebateForNode);

  // Chat context for chat-to-chat connections
  const connectChatToChat = useChatContextStore((s) => s.connectChatToChat);

  // MiniMap visibility state
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Get React Flow instance for viewport-aware positioning and deletion
  const { screenToFlowPosition } = useReactFlow();

  // Define custom node types
  const nodeTypes: NodeTypes = useMemo(() => NODE_COMPONENTS, []);
  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 1 }), []);
  const translateExtent = useMemo(() => [[-2000, -2000], [4000, 4000]] as [[number, number], [number, number]], []);

  // Auto-focus the canvas container on mount to enable keyboard shortcuts
  const containerRef = React.useRef<HTMLDivElement>(null);
  const handleFixedUIWheel = useCallback((event: React.WheelEvent) => {
    event.stopPropagation();
    if (event.ctrlKey) event.preventDefault();
  }, []);
  const handleFixedUIPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    // Focus the container when component mounts
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      } as Edge;
      setEdges((eds) => addEdge(newEdge, eds));

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // If a paper-upload node connects to another node, attach its paper to the target node
      if (sourceNode?.type === 'paper-upload' && params.target) {
        const paper = getPaperForNode(sourceNode.id);
        const pid = (paper && paper.id) || ((sourceNode.data as any)?.lastPaperId as string | undefined);
        if (pid) connectNodeToPaper(params.target, pid);
      } else if (targetNode?.type === 'paper-upload' && params.source) {
        const paper = getPaperForNode(targetNode.id);
        const pid = (paper && paper.id) || ((targetNode.data as any)?.lastPaperId as string | undefined);
        if (pid) connectNodeToPaper(params.source, pid);
      }

      // If a mas-debate node connects to another node (especially paper-chat), attach debate context
      if (sourceNode?.type === 'mas-debate' && params.target) {
        const debate = getDebateForNode(sourceNode.id);
        if (debate) {
          connectNodeToDebate(params.target, sourceNode.id);
          console.log(`[EnhancedCanvas] Connected debate ${sourceNode.id} → ${params.target}`);
        }
      } else if (targetNode?.type === 'mas-debate' && params.source) {
        const debate = getDebateForNode(targetNode.id);
        if (debate) {
          connectNodeToDebate(params.source, targetNode.id);
          console.log(`[EnhancedCanvas] Connected debate ${targetNode.id} → ${params.source}`);
        }
      }

      // If a paper-chat node connects to another paper-chat node, establish chat context connection
      if (sourceNode?.type === 'paper-chat' && targetNode?.type === 'paper-chat') {
        connectChatToChat(params.source, params.target);
        console.log(`[EnhancedCanvas] Connected chat ${params.source} → ${params.target}`);
      }

      // If a paper-chat or web-research connects to another paper-chat or web-research, establish context connection
      const contextNodeTypes = ['paper-chat', 'web-research'];
      if (
        sourceNode?.type &&
        targetNode?.type &&
        contextNodeTypes.includes(sourceNode.type) &&
        contextNodeTypes.includes(targetNode.type)
      ) {
        connectChatToChat(params.source, params.target);
        console.log(`[EnhancedCanvas] Connected context ${params.source} (${sourceNode.type}) → ${params.target} (${targetNode.type})`);
      }
    },
    [setEdges, nodes, connectNodeToPaper, getPaperForNode, connectNodeToDebate, getDebateForNode, connectChatToChat]
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
        selectable: true,
        deletable: true,
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
      selectable: true,
      deletable: true,
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
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', outline: 'none' }}
    >
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
        panOnDrag={false}
        selectionOnDrag={false}
        onlyRenderVisibleElements
        defaultViewport={defaultViewport}
        translateExtent={translateExtent}
        proOptions={{ hideAttribution: true }}
        elevateNodesOnSelect={false}
        nodesDraggable
        nodesConnectable
        nodesFocusable
        edgesFocusable
        elementsSelectable
        selectNodesOnDrag={false}
      >
        <Background color="#e5e7eb" gap={16} size={0.5} />

        {/* Controls - moved to top-left */}
        <div
          onWheel={handleFixedUIWheel}
          onPointerDown={handleFixedUIPointerDown}
        >
          <Controls
            showZoom={true}
            showFitView
            showInteractive={false}
            position="top-left"
          />
        </div>

        {/* MiniMap with Toggle Button - moved to bottom-right */}
        {showMiniMap ? (
          <>
            <MiniMap
              nodeColor={nodeColor}
              position="bottom-right"
              style={{
                width: 240,
                height: 160,
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
              className="absolute bottom-2 bg-white/80 backdrop-blur-sm rounded p-1 hover:bg-white transition-all z-10 opacity-60 hover:opacity-100"
              title="Hide MiniMap"
              style={{ right: '228px', pointerEvents: 'auto' }}
            >
              <EyeOff className="h-3 w-3 text-gray-600" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowMiniMap(true)}
            className="absolute bottom-2 right-2 bg-white/80 backdrop-blur-sm rounded p-1.5 hover:bg-white transition-all z-10 opacity-60 hover:opacity-100"
            title="Show MiniMap"
            style={{ pointerEvents: 'auto' }}
          >
            <Eye className="h-3.5 w-3.5 text-gray-600" />
          </button>
        )}

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
          <div
            onWheel={handleFixedUIWheel}
            onPointerDown={handleFixedUIPointerDown}
          >
            <EnhancedToolbar onAddNode={addNode} />
          </div>
        </Panel>

        {/* Right Info Panel */}
        <Panel position="top-right">
          <div
            onWheel={handleFixedUIWheel}
            onPointerDown={handleFixedUIPointerDown}
          >
            <SimpleControls />
          </div>
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
