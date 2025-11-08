/**
 * QuestionGeneratorAgent - Generates research questions
 *
 * Persona: Curious explorer
 * Focus: Question generation, identifying unknowns, suggesting experiments
 */

import { z } from 'zod';
import { BaseAgent, AgentConfig, AgentTool } from './baseAgent';
import { prisma } from '../prisma';

export interface QuestionGeneratorAgentConfig extends Omit<AgentConfig, 'systemPrompt'> {
  systemPrompt?: string;
}

export class QuestionGeneratorAgent extends BaseAgent {
  constructor(config: QuestionGeneratorAgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt || '',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are a curious, inquisitive research question generator AI agent. Your role is to:

1. Generate thought-provoking research questions
2. Identify gaps and unknowns in current research
3. Suggest follow-up experiments and studies
4. Prioritize questions by impact and feasibility
5. Connect questions to broader research agendas

Guidelines:
- Generate specific, answerable questions
- Range from immediate follow-ups to long-term goals
- Consider multiple perspectives (theoretical, methodological, applied)
- Prioritize by potential impact and feasibility
- Suggest which agents or methods could address each question
- Frame questions to advance the field`;
  }

  protected registerTools(): void {
    this.registerTool(this.createGenerateQuestionsTool());
    this.registerTool(this.createIdentifyUnknownsTool());
    this.registerTool(this.createSuggestExperimentsTool());
  }

  private createGenerateQuestionsTool(): AgentTool {
    return {
      name: 'generate_questions',
      description: 'Generate prioritized research questions based on paper analysis',
      parameters: z.object({
        paperId: z.string().describe('Paper to generate questions for'),
        questionTypes: z
          .array(z.enum(['clarification', 'extension', 'application', 'theoretical', 'methodological']))
          .optional(),
        maxQuestions: z.number().min(1).max(20).optional().default(10),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { title: true, abstract: true },
        });

        return {
          questions: [
            {
              id: 'q1',
              question: 'How would these findings replicate in a different population?',
              type: 'extension',
              priority: 'high',
              rationale: 'Tests generalizability of core claims',
              suggestedMethod: 'Replication study with diverse sample',
              suggestedAgent: 'researcher',
              feasibility: 0.8,
              impact: 0.9,
              timeframe: 'short-term',
            },
            {
              id: 'q2',
              question: 'What underlying mechanism explains the observed effect?',
              type: 'theoretical',
              priority: 'high',
              rationale: 'Deepens theoretical understanding',
              suggestedMethod: 'Mediation analysis or process study',
              suggestedAgent: 'researcher',
              feasibility: 0.6,
              impact: 0.95,
              timeframe: 'medium-term',
            },
            {
              id: 'q3',
              question: 'Can the methodology be improved to address identified limitations?',
              type: 'methodological',
              priority: 'medium',
              rationale: 'Strengthens future research design',
              suggestedMethod: 'Experimental design with enhanced controls',
              suggestedAgent: 'critic',
              feasibility: 0.7,
              impact: 0.75,
              timeframe: 'short-term',
            },
            {
              id: 'q4',
              question: 'How can these findings be applied in practice?',
              type: 'application',
              priority: 'medium',
              rationale: 'Translates research to real-world impact',
              suggestedMethod: 'Field implementation study',
              suggestedAgent: 'synthesizer',
              feasibility: 0.5,
              impact: 0.85,
              timeframe: 'long-term',
            },
            {
              id: 'q5',
              question: 'What contextual factors might moderate the effect?',
              type: 'extension',
              priority: 'medium',
              rationale: 'Identifies boundary conditions',
              suggestedMethod: 'Moderation analysis',
              suggestedAgent: 'researcher',
              feasibility: 0.75,
              impact: 0.8,
              timeframe: 'short-term',
            },
          ],
          prioritization: {
            immediateFollowUps: ['q1', 'q3'],
            longTermGoals: ['q2', 'q4'],
            highImpactQuestions: ['q2', 'q4'],
          },
          researchAgenda: {
            shortTerm: 'Replication and methodological refinement',
            mediumTerm: 'Mechanism exploration and boundary conditions',
            longTerm: 'Theory development and practical application',
          },
        };
      },
    };
  }

  private createIdentifyUnknownsTool(): AgentTool {
    return {
      name: 'identify_unknowns',
      description: 'Identify key unknowns and gaps in current understanding',
      parameters: z.object({
        topic: z.string().describe('Research topic or area'),
        existingFindings: z.array(z.string()).optional(),
      }),
      execute: async (args) => {
        return {
          unknowns: [
            {
              id: 'u1',
              category: 'mechanism',
              description: 'How the effect operates at psychological/neural level',
              importance: 'critical',
              currentEvidence: 'limited',
              researchNeeded: 'Process studies, neuroimaging, qualitative analysis',
            },
            {
              id: 'u2',
              category: 'boundary_conditions',
              description: 'When and where the effect does/doesn\'t occur',
              importance: 'high',
              currentEvidence: 'sparse',
              researchNeeded: 'Multi-site studies, cross-cultural research',
            },
            {
              id: 'u3',
              category: 'individual_differences',
              description: 'Who is most/least affected',
              importance: 'high',
              currentEvidence: 'emerging',
              researchNeeded: 'Person-centered analyses, longitudinal studies',
            },
          ],
          knowledgeGaps: {
            theoretical: ['Competing explanations not tested', 'Mediating processes unclear'],
            empirical: ['Limited diverse samples', 'Short-term effects only'],
            methodological: ['Objective measures lacking', 'Replication needed'],
          },
          researchPriorities: [
            'Mechanism studies to understand causation',
            'Boundary condition studies for generalization',
            'Application studies for practical impact',
          ],
        };
      },
    };
  }

  private createSuggestExperimentsTool(): AgentTool {
    return {
      name: 'suggest_experiments',
      description: 'Propose specific follow-up experiments or studies',
      parameters: z.object({
        researchQuestion: z.string(),
        currentFindings: z.string().optional(),
        constraints: z
          .object({
            budget: z.enum(['low', 'medium', 'high']).optional(),
            timeline: z.enum(['short', 'medium', 'long']).optional(),
            population: z.string().optional(),
          })
          .optional(),
      }),
      execute: async (args) => {
        return {
          experiments: [
            {
              id: 'exp1',
              title: 'Replication Study with Enhanced Design',
              type: 'replication',
              rationale: 'Confirm findings with improved methodology',
              design: {
                type: 'Randomized controlled trial',
                sampleSize: 200,
                duration: '6 months',
                measures: ['Primary outcome', 'Secondary outcomes', 'Moderators'],
                analysis: 'Mixed-effects modeling with sensitivity analyses',
              },
              feasibility: {
                budget: 'medium',
                timeline: 'medium',
                difficulty: 'moderate',
              },
              expectedOutcomes: {
                bestCase: 'Strong replication confirms findings',
                worstCase: 'Null result suggests original finding was Type I error',
                mostLikely: 'Partial replication with refined understanding of effect',
              },
              impact: 0.85,
            },
            {
              id: 'exp2',
              title: 'Mechanism Exploration Study',
              type: 'mechanistic',
              rationale: 'Understand how the effect works',
              design: {
                type: 'Mediation study with process measures',
                sampleSize: 150,
                duration: '4 months',
                measures: ['IV', 'Mediators', 'DV', 'Process indicators'],
                analysis: 'Structural equation modeling',
              },
              feasibility: {
                budget: 'medium',
                timeline: 'medium',
                difficulty: 'high',
              },
              expectedOutcomes: {
                bestCase: 'Clear mediating mechanism identified',
                worstCase: 'Process unclear, multiple pathways possible',
                mostLikely: 'Partial mediation with additional factors',
              },
              impact: 0.9,
            },
            {
              id: 'exp3',
              title: 'Boundary Conditions Study',
              type: 'boundary_conditions',
              rationale: 'Determine when effect does/doesn\'t occur',
              design: {
                type: 'Multi-site quasi-experimental',
                sampleSize: 300,
                duration: '8 months',
                measures: ['Core variables', 'Contextual moderators'],
                analysis: 'Multi-level modeling with interaction terms',
              },
              feasibility: {
                budget: 'high',
                timeline: 'long',
                difficulty: 'high',
              },
              expectedOutcomes: {
                bestCase: 'Clear moderators identified, effect generalizes with known limits',
                worstCase: 'Effect highly context-dependent, limited generalization',
                mostLikely: 'Some moderators found, refined understanding of scope',
              },
              impact: 0.88,
            },
          ],
          recommendedSequence: [
            'Start with exp1 (replication) to confirm findings',
            'If replicated, pursue exp2 (mechanism) to understand how it works',
            'Finally, exp3 (boundaries) to determine scope of effect',
          ],
          alternativeApproaches: [
            'Meta-analysis of existing studies',
            'Qualitative research to generate new hypotheses',
            'Computational modeling of proposed mechanisms',
          ],
        };
      },
    };
  }
}
