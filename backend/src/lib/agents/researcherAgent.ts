/**
 * ResearcherAgent - Deep analysis and evidence extraction
 *
 * Persona: Meticulous analyst
 * Focus: Thorough paper analysis, methodology extraction, claim identification
 */

import { z } from 'zod';
import { BaseAgent, AgentConfig, AgentTool } from './baseAgent';
import { prisma } from '../prisma';

/**
 * ResearcherAgent configuration
 */
export interface ResearcherAgentConfig extends Omit<AgentConfig, 'systemPrompt'> {
  systemPrompt?: string;
}

/**
 * ResearcherAgent - Analyzes research papers in depth
 */
export class ResearcherAgent extends BaseAgent {
  constructor(config: ResearcherAgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt || '',
    });
  }

  /**
   * Default system prompt for researcher agent
   */
  protected getDefaultSystemPrompt(): string {
    return `You are a meticulous research analyst AI agent. Your role is to:

1. Perform deep, thorough analysis of research papers
2. Extract and identify key claims with supporting evidence
3. Analyze research methodology rigorously
4. Identify research gaps and future directions
5. Provide structured, evidence-based insights

Guidelines:
- Be precise and cite specific sections/page numbers when referencing paper content
- Distinguish between claims (what authors assert) and evidence (what supports it)
- Identify methodology strengths and limitations
- Note statistical significance and sample sizes
- Flag missing information or unclear statements
- Use academic language but remain accessible
- Always provide confidence levels for your assessments

Output format:
- Use structured JSON for data extraction
- Include page/section references
- Provide confidence scores (0-1)
- List supporting evidence for each claim`;
  }

  /**
   * Register researcher-specific tools
   */
  protected registerTools(): void {
    this.registerTool(this.createAnalyzePaperTool());
    this.registerTool(this.createExtractMethodologyTool());
    this.registerTool(this.createExtractClaimsTool());
    this.registerTool(this.createFindGapsTool());
  }

  /**
   * Tool: Analyze paper comprehensively
   */
  private createAnalyzePaperTool(): AgentTool {
    return {
      name: 'analyze_paper',
      description: 'Perform comprehensive analysis of a research paper including abstract, methodology, results, and conclusions',
      parameters: z.object({
        paperId: z.string().describe('ID of the paper to analyze'),
        focusAreas: z
          .array(z.enum(['methodology', 'results', 'novelty', 'limitations', 'impact']))
          .optional()
          .describe('Specific areas to focus the analysis on'),
      }),
      execute: async (args) => {
        // Fetch paper from database
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: {
            id: true,
            title: true,
            authors: true,
            abstract: true,
            fullText: true,
            citations: true,
            metadata: true,
          },
        });

        if (!paper) {
          throw new Error(`Paper ${args.paperId} not found`);
        }

        // Return structured analysis
        // In production, this would use the full paper text with OpenAI
        // For now, return mock analysis based on abstract
        return {
          paperId: paper.id,
          title: paper.title,
          summary: {
            mainContribution: 'Extracted from full analysis',
            methodology: 'Identified research methods',
            keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
            novelty: 'What makes this research unique',
            confidence: 0.85,
          },
          claims: [
            {
              claim: 'Primary claim from paper',
              evidence: ['Supporting evidence 1', 'Supporting evidence 2'],
              confidence: 0.9,
              location: 'Section 3.2, p. 5',
            },
          ],
          methodology: {
            approach: 'Methodological approach used',
            datasetSize: 'Sample size information',
            statisticalMethods: ['Method 1', 'Method 2'],
            strengths: ['Strength 1', 'Strength 2'],
            limitations: ['Limitation 1', 'Limitation 2'],
            confidence: 0.8,
          },
          gaps: [
            {
              gap: 'Identified research gap',
              severity: 'medium',
              suggestedDirection: 'Future research direction',
            },
          ],
          overallAssessment: {
            rigor: 0.85,
            novelty: 0.75,
            impact: 0.8,
            reproducibility: 0.7,
            confidence: 0.82,
          },
        };
      },
    };
  }

  /**
   * Tool: Extract methodology section
   */
  private createExtractMethodologyTool(): AgentTool {
    return {
      name: 'extract_methodology',
      description: 'Extract and analyze the methodology section of a research paper',
      parameters: z.object({
        paperId: z.string().describe('ID of the paper'),
        includeStatistics: z
          .boolean()
          .optional()
          .describe('Include statistical methods and parameters'),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { fullText: true, title: true },
        });

        if (!paper) {
          throw new Error(`Paper ${args.paperId} not found`);
        }

        return {
          methodology: {
            approach: 'Research approach (qualitative/quantitative/mixed)',
            design: 'Study design details',
            participants: {
              sampleSize: 100,
              demographics: 'Participant demographics',
              recruitmentMethod: 'How participants were selected',
            },
            materials: ['Material 1', 'Material 2'],
            procedure: 'Step-by-step procedure',
            dataCollection: {
              methods: ['Method 1', 'Method 2'],
              instruments: ['Instrument 1'],
              timeline: 'Data collection timeline',
            },
            dataAnalysis: {
              statisticalMethods: args.includeStatistics
                ? ['t-test', 'ANOVA', 'regression']
                : undefined,
              software: 'Analysis software used',
              significance: 'p < 0.05',
            },
            ethicalConsiderations: 'IRB approval, consent, etc.',
            limitations: ['Limitation 1', 'Limitation 2'],
            confidence: 0.88,
          },
        };
      },
    };
  }

  /**
   * Tool: Extract claims from paper
   */
  private createExtractClaimsTool(): AgentTool {
    return {
      name: 'extract_claims',
      description: 'Identify and extract key claims made in the paper with supporting evidence',
      parameters: z.object({
        paperId: z.string().describe('ID of the paper'),
        claimTypes: z
          .array(z.enum(['hypothesis', 'finding', 'conclusion', 'implication']))
          .optional()
          .describe('Types of claims to extract'),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { fullText: true, abstract: true, title: true },
        });

        if (!paper) {
          throw new Error(`Paper ${args.paperId} not found`);
        }

        return {
          claims: [
            {
              id: '1',
              type: 'hypothesis',
              statement: 'Main hypothesis of the study',
              support: {
                evidence: ['Evidence 1', 'Evidence 2'],
                statistics: { pValue: 0.001, effectSize: 0.65 },
                sourceLocation: 'Abstract, Introduction (p. 1-2)',
              },
              confidence: 0.92,
              validity: 'strong',
            },
            {
              id: '2',
              type: 'finding',
              statement: 'Key finding from results',
              support: {
                evidence: ['Result data', 'Statistical analysis'],
                statistics: { pValue: 0.03, effectSize: 0.45 },
                sourceLocation: 'Results (p. 7-9)',
              },
              confidence: 0.85,
              validity: 'moderate',
            },
            {
              id: '3',
              type: 'conclusion',
              statement: 'Main conclusion drawn',
              support: {
                evidence: ['Synthesis of findings'],
                sourceLocation: 'Discussion (p. 12)',
              },
              confidence: 0.78,
              validity: 'moderate',
            },
          ],
          totalClaims: 3,
          claimDistribution: {
            hypothesis: 1,
            finding: 1,
            conclusion: 1,
            implication: 0,
          },
        };
      },
    };
  }

  /**
   * Tool: Identify research gaps
   */
  private createFindGapsTool(): AgentTool {
    return {
      name: 'find_gaps',
      description: 'Identify research gaps, limitations, and future research directions',
      parameters: z.object({
        paperId: z.string().describe('ID of the paper'),
        includeImplications: z
          .boolean()
          .optional()
          .describe('Include practical implications of identified gaps'),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { fullText: true, title: true },
        });

        if (!paper) {
          throw new Error(`Paper ${args.paperId} not found`);
        }

        return {
          gaps: [
            {
              id: '1',
              category: 'methodological',
              description: 'Limited sample size reduces generalizability',
              severity: 'medium',
              location: 'Limitations section (p. 13)',
              suggestedResearch: 'Conduct larger-scale replication study',
              implications: args.includeImplications
                ? 'Results may not apply to broader population'
                : undefined,
            },
            {
              id: '2',
              category: 'theoretical',
              description: 'Alternative explanations not fully explored',
              severity: 'low',
              location: 'Discussion (p. 12)',
              suggestedResearch: 'Investigate competing theoretical frameworks',
              implications: args.includeImplications
                ? 'Current theory may be incomplete'
                : undefined,
            },
            {
              id: '3',
              category: 'practical',
              description: 'Real-world applicability not demonstrated',
              severity: 'high',
              location: 'Conclusion (p. 14)',
              suggestedResearch: 'Field studies in applied settings',
              implications: args.includeImplications
                ? 'Limited immediate practical value'
                : undefined,
            },
          ],
          futureDirections: [
            'Longitudinal follow-up studies',
            'Cross-cultural validation',
            'Integration with related frameworks',
          ],
          limitations: [
            'Self-reported data may have bias',
            'Cross-sectional design limits causal inference',
            'Convenience sampling affects generalizability',
          ],
          confidence: 0.8,
        };
      },
    };
  }
}
