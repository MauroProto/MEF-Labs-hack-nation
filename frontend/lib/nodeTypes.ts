/**
 * Node Type Definitions
 *
 * Defines all node types, their properties, and configuration.
 */

import { Node } from '@xyflow/react';
import { LucideIcon } from 'lucide-react';
import {
  FileText,
  MessageSquare,
  Search,
  BookOpen,
  Eye,
  Lightbulb,
  FlaskConical,
  BarChart,
  StickyNote,
  Network,
  Sparkles,
  HelpCircle,
  LinkIcon,
} from 'lucide-react';

/**
 * All available node types in the canvas
 */
export type NodeType =
  // Input/Output nodes
  | 'paper-upload'
  | 'note'
  // Research nodes
  | 'paper-chat'
  | 'web-research'
  // Agent nodes
  | 'researcher-agent'
  | 'critic-agent'
  | 'synthesizer-agent'
  | 'question-generator'
  | 'citation-tracker'
  // Visualization/Report nodes
  | 'citation-graph'
  | 'summary'
  | 'methodology'
  | 'results-visualization'
  | 'insight-report';

/**
 * Node category for organization
 */
export type NodeCategory = 'input' | 'research' | 'agent' | 'visualization';

/**
 * Color scheme for node types
 */
export const NODE_COLORS: Record<NodeCategory, string> = {
  input: '#3B82F6', // Blue
  research: '#10B981', // Green
  agent: '#8B5CF6', // Purple
  visualization: '#F59E0B', // Orange
};

/**
 * Node configuration
 */
export interface NodeConfig {
  type: NodeType;
  label: string;
  description: string;
  category: NodeCategory;
  icon: LucideIcon;
  color: string;
  defaultWidth: number;
  defaultHeight: number;
  hasInput: boolean; // Can receive connections
  hasOutput: boolean; // Can send connections
}

/**
 * Node type registry
 */
export const NODE_CONFIGS: Record<NodeType, NodeConfig> = {
  // Input/Output nodes
  'paper-upload': {
    type: 'paper-upload',
    label: 'Paper Upload',
    description: 'Upload and parse PDF research papers',
    category: 'input',
    icon: FileText,
    color: NODE_COLORS.input,
    defaultWidth: 900,
    defaultHeight: 1000,
    hasInput: false,
    hasOutput: true,
  },
  note: {
    type: 'note',
    label: 'Note',
    description: 'Add notes and annotations',
    category: 'input',
    icon: StickyNote,
    color: NODE_COLORS.input,
    defaultWidth: 450,
    defaultHeight: 500,
    hasInput: true,
    hasOutput: true,
  },

  // Research nodes
  'paper-chat': {
    type: 'paper-chat',
    label: 'Paper Chat',
    description: 'Chat with AI about the paper',
    category: 'research',
    icon: MessageSquare,
    color: NODE_COLORS.research,
    defaultWidth: 500,
    defaultHeight: 600,
    hasInput: true,
    hasOutput: true,
  },
  'web-research': {
    type: 'web-research',
    label: 'Web Research',
    description: 'AI research with streaming',
    category: 'research',
    icon: Search,
    color: NODE_COLORS.research,
    defaultWidth: 380,
    defaultHeight: 450,
    hasInput: true,
    hasOutput: true,
  },

  // Agent nodes
  'researcher-agent': {
    type: 'researcher-agent',
    label: 'Researcher Agent',
    description: 'Deep analysis and evidence extraction',
    category: 'agent',
    icon: BookOpen,
    color: NODE_COLORS.agent,
    defaultWidth: 350,
    defaultHeight: 400,
    hasInput: true,
    hasOutput: true,
  },
  'critic-agent': {
    type: 'critic-agent',
    label: 'Critic Agent',
    description: 'Validates claims and identifies weaknesses',
    category: 'agent',
    icon: Eye,
    color: NODE_COLORS.agent,
    defaultWidth: 350,
    defaultHeight: 400,
    hasInput: true,
    hasOutput: true,
  },
  'synthesizer-agent': {
    type: 'synthesizer-agent',
    label: 'Synthesizer Agent',
    description: 'Merges analyses and resolves conflicts',
    category: 'agent',
    icon: Sparkles,
    color: NODE_COLORS.agent,
    defaultWidth: 350,
    defaultHeight: 400,
    hasInput: true,
    hasOutput: true,
  },
  'question-generator': {
    type: 'question-generator',
    label: 'Question Generator',
    description: 'Generates research questions',
    category: 'agent',
    icon: HelpCircle,
    color: NODE_COLORS.agent,
    defaultWidth: 350,
    defaultHeight: 350,
    hasInput: true,
    hasOutput: true,
  },
  'citation-tracker': {
    type: 'citation-tracker',
    label: 'Citation Tracker',
    description: 'Verifies citations and builds graphs',
    category: 'agent',
    icon: LinkIcon,
    color: NODE_COLORS.agent,
    defaultWidth: 350,
    defaultHeight: 350,
    hasInput: true,
    hasOutput: true,
  },

  // Visualization/Report nodes
  'citation-graph': {
    type: 'citation-graph',
    label: 'Citation Graph',
    description: 'Visualizes citation network',
    category: 'visualization',
    icon: Network,
    color: NODE_COLORS.visualization,
    defaultWidth: 500,
    defaultHeight: 400,
    hasInput: true,
    hasOutput: false,
  },
  summary: {
    type: 'summary',
    label: 'Summary',
    description: 'Generates paper summary',
    category: 'visualization',
    icon: FileText,
    color: NODE_COLORS.visualization,
    defaultWidth: 350,
    defaultHeight: 300,
    hasInput: true,
    hasOutput: true,
  },
  methodology: {
    type: 'methodology',
    label: 'Methodology',
    description: 'Extracts and analyzes methodology',
    category: 'visualization',
    icon: FlaskConical,
    color: NODE_COLORS.visualization,
    defaultWidth: 350,
    defaultHeight: 350,
    hasInput: true,
    hasOutput: true,
  },
  'results-visualization': {
    type: 'results-visualization',
    label: 'Results Visualization',
    description: 'Visualizes research results',
    category: 'visualization',
    icon: BarChart,
    color: NODE_COLORS.visualization,
    defaultWidth: 450,
    defaultHeight: 400,
    hasInput: true,
    hasOutput: false,
  },
  'insight-report': {
    type: 'insight-report',
    label: 'Insight Report',
    description: 'Collective insight report',
    category: 'visualization',
    icon: Lightbulb,
    color: NODE_COLORS.visualization,
    defaultWidth: 400,
    defaultHeight: 500,
    hasInput: true,
    hasOutput: false,
  },
};

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: NodeCategory): NodeConfig[] {
  return Object.values(NODE_CONFIGS).filter(
    (config) => config.category === category
  );
}

/**
 * Get node configuration
 */
export function getNodeConfig(type: NodeType): NodeConfig {
  return NODE_CONFIGS[type];
}

/**
 * Custom node data interface
 */
export interface CustomNodeData {
  label: string;
  type: NodeType;
  config: NodeConfig;
  locked?: boolean;
  [key: string]: any; // Allow custom properties per node type
}

/**
 * Custom node type
 */
export type CustomNode = Node<CustomNodeData>;
