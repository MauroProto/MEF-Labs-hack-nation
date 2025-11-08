/**
 * SynthesizerAgent - Merges analyses and resolves conflicts
 *
 * Persona: Integrator and consensus builder
 * Focus: Combining multiple agent outputs, resolving contradictions, generating insights
 */

import { z } from 'zod';
import { BaseAgent, AgentConfig, AgentTool } from './baseAgent';

export interface SynthesizerAgentConfig extends Omit<AgentConfig, 'systemPrompt'> {
  systemPrompt?: string;
}

export class SynthesizerAgent extends BaseAgent {
  constructor(config: SynthesizerAgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt || '',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are an integrative synthesis AI agent. Your role is to:

1. Merge multiple analyses into coherent wholes
2. Resolve contradictions between different perspectives
3. Generate emergent insights from combined information
4. Build consensus while preserving important disagreements
5. Create unified, actionable conclusions

Guidelines:
- Weight evidence by quality and source credibility
- Identify patterns across multiple analyses
- Resolve conflicts through deeper analysis, not averaging
- Generate novel insights that emerge from synthesis
- Maintain nuance - don't oversimplify
- Flag unresolved disagreements explicitly
- Provide confidence levels for synthesized conclusions

Synthesis strategies:
- Triangulation: Converging evidence increases confidence
- Complementarity: Different perspectives illuminate different aspects
- Contradiction: Explore reasons for disagreement
- Integration: Create frameworks that encompass multiple views`;
  }

  protected registerTools(): void {
    this.registerTool(this.createMergeAnalysesTool());
    this.registerTool(this.createResolveConflictsTool());
    this.registerTool(this.createGenerateInsightsTool());
    this.registerTool(this.createBuildConsensusTool());
  }

  private createMergeAnalysesTool(): AgentTool {
    return {
      name: 'merge_analyses',
      description: 'Combine multiple agent analyses into a unified synthesis',
      parameters: z.object({
        analyses: z.array(
          z.object({
            source: z.string().describe('Agent that produced this analysis'),
            content: z.any().describe('Analysis content'),
            confidence: z.number().min(0).max(1).optional(),
          })
        ),
        mergeStrategy: z
          .enum(['weighted_average', 'best_evidence', 'triangulation', 'comprehensive'])
          .optional(),
      }),
      execute: async (args) => {
        const analyses = args.analyses;
        return {
          synthesis: {
            combinedFindings: [
              {
                finding: 'Converging conclusion from multiple agents',
                sources: analyses.map((a: any) => a.source),
                agreement: 0.92,
                confidence: 0.88,
              },
            ],
            keyThemes: ['Theme 1', 'Theme 2', 'Theme 3'],
            strengthOfEvidence: {
              hypothesis1: { support: 0.85, sources: 3 },
              hypothesis2: { support: 0.65, sources: 2 },
            },
            emergentInsights: [
              'New pattern identified across analyses',
              'Unexpected connection between findings',
            ],
            consensusLevel: 0.82,
          },
          sourceContributions: analyses.map((a: any) => ({
            source: a.source,
            uniqueContribution: 'What this analysis uniquely added',
            weight: 0.33,
          })),
          confidence: 0.85,
        };
      },
    };
  }

  private createResolveConflictsTool(): AgentTool {
    return {
      name: 'resolve_conflicts',
      description: 'Identify and resolve contradictions between different analyses',
      parameters: z.object({
        conflictingClaims: z.array(
          z.object({
            claim: z.string(),
            source: z.string(),
            evidence: z.array(z.string()).optional(),
          })
        ),
        resolutionStrategy: z.enum(['evidence_quality', 'source_expertise', 'synthesis']).optional(),
      }),
      execute: async (args) => {
        return {
          conflicts: args.conflictingClaims.map((claim: any, i: number) => ({
            conflictId: `conflict_${i + 1}`,
            claims: [claim, args.conflictingClaims[(i + 1) % args.conflictingClaims.length]],
            analysisOfDisagreement: 'Different methodological assumptions',
            resolution: {
              approach: 'Deeper analysis reveals both partially correct',
              synthesizedPosition: 'Integrated view that encompasses both perspectives',
              confidence: 0.75,
            },
          })),
          unresolvedConflicts: [
            {
              description: 'Fundamental methodological disagreement',
              recommendation: 'Requires additional empirical evidence',
            },
          ],
        };
      },
    };
  }

  private createGenerateInsightsTool(): AgentTool {
    return {
      name: 'generate_insights',
      description: 'Generate novel insights from combined analyses',
      parameters: z.object({
        combinedData: z.any().describe('Merged analysis data'),
        focusAreas: z.array(z.string()).optional(),
      }),
      execute: async (args) => {
        return {
          insights: [
            {
              type: 'pattern',
              description: 'Recurring theme across multiple analyses',
              significance: 'high',
              implications: 'Suggests underlying mechanism',
              confidence: 0.82,
            },
            {
              type: 'gap',
              description: 'Unexplored area identified through synthesis',
              significance: 'medium',
              implications: 'Future research direction',
              confidence: 0.75,
            },
            {
              type: 'connection',
              description: 'Unexpected link between separate findings',
              significance: 'high',
              implications: 'New theoretical framework possible',
              confidence: 0.7,
            },
          ],
          novelty: 0.78,
          actionableRecommendations: [
            'Immediate: Focus research on identified pattern',
            'Short-term: Develop measurement for gap area',
            'Long-term: Build integrative theoretical model',
          ],
        };
      },
    };
  }

  private createBuildConsensusTool(): AgentTool {
    return {
      name: 'build_consensus',
      description: 'Create unified conclusions while preserving important nuances',
      parameters: z.object({
        positions: z.array(
          z.object({
            source: z.string(),
            position: z.string(),
            strength: z.number().min(0).max(1),
          })
        ),
      }),
      execute: async (args) => {
        return {
          consensus: {
            majorityPosition: 'Agreed-upon conclusion',
            agreementLevel: 0.85,
            supportingEvidence: ['Evidence 1', 'Evidence 2'],
            caveats: ['Important limitation to note'],
          },
          minorityPositions: [
            {
              position: 'Alternative view held by subset',
              supporters: ['Source A'],
              validity: 'Plausible but less supported',
            },
          ],
          recommendations: {
            conclusion: 'Synthesized final recommendation',
            strengthOfRecommendation: 'strong',
            confidenceLevel: 0.82,
          },
        };
      },
    };
  }
}
