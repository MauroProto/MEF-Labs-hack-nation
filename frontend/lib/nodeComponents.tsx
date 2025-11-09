/**
 * Node Component Registry
 *
 * Maps node types to their React components
 */

import { NodeType } from './nodeTypes';
import { PaperUploadNode } from '@/components/nodes/PaperUploadNode';
import { NoteNode } from '@/components/nodes/NoteNode';
import { PaperChatNode } from '@/components/nodes/PaperChatNode';
import { DebateNode } from '@/components/nodes/DebateNode';
import { ResearcherAgentNode } from '@/components/nodes/ResearcherAgentNode';
import { CriticAgentNode } from '@/components/nodes/CriticAgentNode';
import { SynthesizerAgentNode } from '@/components/nodes/SynthesizerAgentNode';
import { QuestionGeneratorNode } from '@/components/nodes/QuestionGeneratorNode';
import { CitationTrackerNode } from '@/components/nodes/CitationTrackerNode';
import { BaseNode } from '@/components/nodes/BaseNode';

export const NODE_COMPONENTS: Record<NodeType, React.ComponentType<any>> = {
  // Input nodes
  'paper-upload': PaperUploadNode,
  'note': NoteNode,

  // Research nodes
  'paper-chat': PaperChatNode,
  'web-research': BaseNode, // TODO: Implement WebResearchNode
  'debate': DebateNode,

  // Agent nodes (minimal UI)
  'researcher-agent': ResearcherAgentNode,
  'critic-agent': CriticAgentNode,
  'synthesizer-agent': SynthesizerAgentNode,
  'question-generator': QuestionGeneratorNode,
  'citation-tracker': CitationTrackerNode,

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
