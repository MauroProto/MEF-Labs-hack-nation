/**
 * Node Component Registry
 *
 * Maps node types to their React components
 */

import { NodeType } from './nodeTypes';
import { PaperUploadNode } from '@/components/nodes/PaperUploadNode';
import { NoteNode } from '@/components/nodes/NoteNode';
import { PaperChatNode } from '@/components/nodes/PaperChatNode';
import { MasDebateNode } from '@/components/nodes/MasDebateNode';
import { BaseNode } from '@/components/nodes/BaseNode';

export const NODE_COMPONENTS: Record<NodeType, React.ComponentType<any>> = {
  // Input nodes
  'paper-upload': PaperUploadNode,
  'note': NoteNode,

  // Research nodes
  'paper-chat': PaperChatNode,
  'web-research': BaseNode, // TODO: Implement WebResearchNode
  'debate': MasDebateNode, // Improved debate system with shared topics

  // Agent nodes (placeholder - not implemented)
  'researcher-agent': BaseNode,
  'critic-agent': BaseNode,
  'synthesizer-agent': BaseNode,
  'question-generator': BaseNode,
  'citation-tracker': BaseNode,

  // Visualization nodes (placeholder)
  'citation-graph': BaseNode,
  'summary': BaseNode,
  'methodology': BaseNode,
  'results-visualization': BaseNode,
  'insight-report': BaseNode,
};

/**
 * Get component for node type
 */
export function getNodeComponent(type: NodeType): React.ComponentType<any> {
  return NODE_COMPONENTS[type] || BaseNode;
}
