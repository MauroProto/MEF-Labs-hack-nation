/**
 * Agent System Exports
 *
 * All AI agents for the Research Agent Canvas platform
 */

export { BaseAgent, type AgentConfig, type AgentTool, type AgentContext } from './baseAgent';
export { ResearcherAgent, type ResearcherAgentConfig } from './researcherAgent';
export { CriticAgent, type CriticAgentConfig } from './criticAgent';
export { SynthesizerAgent, type SynthesizerAgentConfig } from './synthesizerAgent';
export { QuestionGeneratorAgent, type QuestionGeneratorAgentConfig } from './questionGeneratorAgent';
export { CitationTrackerAgent, type CitationTrackerAgentConfig } from './citationTrackerAgent';

/**
 * Agent factory - creates agents by type
 */
import { ResearcherAgent } from './researcherAgent';
import { CriticAgent } from './criticAgent';
import { SynthesizerAgent } from './synthesizerAgent';
import { QuestionGeneratorAgent } from './questionGeneratorAgent';
import { CitationTrackerAgent } from './citationTrackerAgent';
import type { AgentConfig } from './baseAgent';
import { AgentError, ErrorCode } from '../../types/agent.types';

export type AgentType =
  | 'researcher'
  | 'critic'
  | 'synthesizer'
  | 'question_generator'
  | 'citation_tracker';

export class AgentFactory {
  /**
   * Create an agent instance by type
   */
  static createAgent(type: AgentType, config: AgentConfig) {
    switch (type) {
      case 'researcher':
        return new ResearcherAgent(config);
      case 'critic':
        return new CriticAgent(config);
      case 'synthesizer':
        return new SynthesizerAgent(config);
      case 'question_generator':
        return new QuestionGeneratorAgent(config);
      case 'citation_tracker':
        return new CitationTrackerAgent(config);
      default:
        throw new AgentError(
          ErrorCode.InvalidRequest,
          `Unknown agent type: ${type}`
        );
    }
  }

  /**
   * Get available agent types
   */
  static getAgentTypes(): AgentType[] {
    return ['researcher', 'critic', 'synthesizer', 'question_generator', 'citation_tracker'];
  }

  /**
   * Get agent description
   */
  static getAgentDescription(type: AgentType): string {
    const descriptions: Record<AgentType, string> = {
      researcher:
        'Deep analysis and evidence extraction from research papers',
      critic:
        'Critical evaluation of research claims and methodologies',
      synthesizer:
        'Integration of multiple analyses into unified insights',
      question_generator:
        'Generation of research questions and future directions',
      citation_tracker:
        'Citation verification and impact assessment',
    };
    return descriptions[type];
  }
}
