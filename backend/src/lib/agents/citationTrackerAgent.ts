/**
 * CitationTrackerAgent - Verifies citations and builds citation graphs
 *
 * Persona: Meticulous historian
 * Focus: Citation validation, related paper discovery, impact assessment
 */

import { z } from 'zod';
import { BaseAgent, AgentConfig, AgentTool } from './baseAgent';
import { prisma } from '../prisma';

export interface CitationTrackerAgentConfig extends Omit<AgentConfig, 'systemPrompt'> {
  systemPrompt?: string;
}

export class CitationTrackerAgent extends BaseAgent {
  constructor(config: CitationTrackerAgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt || '',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are a meticulous citation tracking and bibliometric AI agent. Your role is to:

1. Verify citation accuracy and completeness
2. Discover related papers and build citation networks
3. Assess research impact through citation analysis
4. Identify seminal works and citation patterns
5. Track knowledge flows across research communities

Guidelines:
- Verify citations against authoritative sources
- Build complete citation graphs (citing and cited)
- Identify citation patterns (classics, recent, neglected)
- Assess impact through multiple metrics
- Track intellectual genealogy
- Identify citation manipulation or gaming
- Provide context for citation counts`;
  }

  protected registerTools(): void {
    this.registerTool(this.createVerifyCitationTool());
    this.registerTool(this.createFindRelatedPapersTool());
    this.registerTool(this.createBuildCitationGraphTool());
    this.registerTool(this.createAssessImpactTool());
  }

  private createVerifyCitationTool(): AgentTool {
    return {
      name: 'verify_citation',
      description: 'Verify the accuracy and completeness of a citation',
      parameters: z.object({
        citation: z.string().describe('Citation string to verify'),
        expectedFormat: z.enum(['APA', 'MLA', 'Chicago', 'Harvard', 'Vancouver']).optional(),
      }),
      execute: async (args) => {
        // In production, this would query Crossref, PubMed, Google Scholar APIs
        return {
          verification: {
            isValid: true,
            accuracy: 0.95,
            completeness: 0.9,
          },
          correctedCitation: 'Smith, J., & Jones, A. (2023). Title of paper. Journal Name, 15(3), 123-145. https://doi.org/10.1234/example',
          issues: [
            {
              type: 'formatting',
              severity: 'minor',
              description: 'Volume number missing parentheses',
              correction: 'Add parentheses around volume number',
            },
          ],
          metadata: {
            doi: '10.1234/example',
            title: 'Title of paper',
            authors: ['Smith, J.', 'Jones, A.'],
            year: 2023,
            journal: 'Journal Name',
            volume: 15,
            issue: 3,
            pages: '123-145',
            citationCount: 47,
          },
          availability: {
            openAccess: true,
            pdfUrl: 'https://example.com/paper.pdf',
            doi: 'https://doi.org/10.1234/example',
          },
        };
      },
    };
  }

  private createFindRelatedPapersTool(): AgentTool {
    return {
      name: 'find_related_papers',
      description: 'Discover papers related to a given paper through citations and content similarity',
      parameters: z.object({
        paperId: z.string().describe('Reference paper ID'),
        relationshipType: z
          .enum(['cites', 'cited_by', 'similar', 'same_authors', 'all'])
          .optional()
          .default('all'),
        maxResults: z.number().min(1).max(50).optional().default(10),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { title: true, authors: true, citations: true },
        });

        // In production, use Semantic Scholar, Crossref, or OpenAlex APIs
        return {
          relatedPapers: [
            {
              id: 'related1',
              title: 'Related Paper 1',
              authors: ['Author A', 'Author B'],
              year: 2022,
              relationship: 'cites',
              relevanceScore: 0.92,
              citationCount: 156,
              summary: 'Brief summary of how it relates',
            },
            {
              id: 'related2',
              title: 'Related Paper 2',
              authors: ['Author C'],
              year: 2023,
              relationship: 'cited_by',
              relevanceScore: 0.88,
              citationCount: 23,
              summary: 'Brief summary of how it relates',
            },
            {
              id: 'related3',
              title: 'Similar Research',
              authors: ['Author D', 'Author E'],
              year: 2021,
              relationship: 'similar',
              relevanceScore: 0.85,
              citationCount: 89,
              summary: 'Shares similar methodology/topic',
            },
          ],
          citationNetwork: {
            directCitations: 45,
            citedBy: 23,
            coAuthored: 3,
            similarContent: 67,
          },
          recommendations: [
            {
              paper: 'Seminal work in this area',
              reason: 'Most cited in citation network',
              priority: 'high',
            },
            {
              paper: 'Recent extension of these ideas',
              reason: 'Builds directly on this work',
              priority: 'high',
            },
            {
              paper: 'Alternative approach to same problem',
              reason: 'Different methodology, same research question',
              priority: 'medium',
            },
          ],
        };
      },
    };
  }

  private createBuildCitationGraphTool(): AgentTool {
    return {
      name: 'build_citation_graph',
      description: 'Create a citation network graph showing relationships between papers',
      parameters: z.object({
        paperId: z.string().describe('Central paper for the graph'),
        depth: z.number().min(1).max(3).optional().default(2).describe('How many citation levels to include'),
        includeMetrics: z.boolean().optional().default(true),
      }),
      execute: async (args) => {
        return {
          graph: {
            nodes: [
              {
                id: args.paperId,
                label: 'Central Paper',
                type: 'focal',
                citationCount: 47,
                year: 2023,
                influence: 0.85,
              },
              {
                id: 'cited1',
                label: 'Cited Paper 1',
                type: 'cited',
                citationCount: 234,
                year: 2020,
                influence: 0.92,
              },
              {
                id: 'citing1',
                label: 'Citing Paper 1',
                type: 'citing',
                citationCount: 12,
                year: 2024,
                influence: 0.65,
              },
            ],
            edges: [
              {
                source: args.paperId,
                target: 'cited1',
                type: 'cites',
                weight: 1,
              },
              {
                source: 'citing1',
                target: args.paperId,
                type: 'cites',
                weight: 1,
              },
            ],
          },
          metrics: args.includeMetrics
            ? {
                totalNodes: 3,
                totalEdges: 2,
                averageCitations: 97.67,
                networkDensity: 0.67,
                centralityScores: {
                  [args.paperId]: 0.85,
                  cited1: 0.92,
                  citing1: 0.45,
                },
                clusters: [
                  {
                    id: 'cluster1',
                    theme: 'Core methodology papers',
                    papers: [args.paperId, 'cited1'],
                  },
                ],
              }
            : undefined,
          insights: {
            seminalWorks: ['cited1'],
            emergingWorks: ['citing1'],
            citationPatterns: 'Primarily cites methodological foundations',
            knowledgeFlow: 'Information flows from methodology → application',
          },
        };
      },
    };
  }

  private createAssessImpactTool(): AgentTool {
    return {
      name: 'assess_impact',
      description: 'Assess the research impact of a paper through multiple metrics',
      parameters: z.object({
        paperId: z.string().describe('Paper to assess'),
        includeAltmetrics: z.boolean().optional().default(true),
      }),
      execute: async (args) => {
        const paper = await prisma.paper.findUnique({
          where: { id: args.paperId },
          select: { title: true, citations: true, metadata: true },
        });

        // In production, query Altmetric API, Dimensions, Web of Science
        return {
          traditionalMetrics: {
            citationCount: 47,
            citationsPerYear: 23.5,
            hIndex: 15,
            i10Index: 23,
            fieldNormalizedCitationImpact: 1.85,
          },
          temporalAnalysis: {
            yearsSincePublication: 2,
            citationTrajectory: 'increasing',
            peakCitationYear: 2024,
            citationVelocity: 2.5, // citations per month
            projectedFutureImpact: 'high',
          },
          qualitativeImpact: {
            influentialCitations: 12,
            methodologicalInfluence: 0.8,
            theoreticalInfluence: 0.7,
            appliedInfluence: 0.6,
          },
          altmetrics: args.includeAltmetrics
            ? {
                mentionsInNews: 5,
                twitterMentions: 234,
                downloads: 1567,
                saves: 89,
                readers: 456,
                altmetricScore: 78,
              }
            : undefined,
          comparativeContext: {
            percentileInField: 85,
            percentileInJournal: 92,
            typicalPaperCitations: 12,
            topPaperCitations: 500,
            assessment: 'Well above average impact for field and publication year',
          },
          impactPrediction: {
            currentTrend: 'growing',
            projectedCitationsIn5Years: 150,
            confidence: 0.75,
            factors: [
              'Strong early citation rate',
              'Methodological innovation',
              'Active research area',
            ],
          },
          recommendations: {
            trackingFrequency: 'quarterly',
            potentialForHighImpact: 0.82,
            suggestedActions: [
              'Promote on academic social media',
              'Present at major conferences',
              'Write follow-up papers extending the work',
            ],
          },
        };
      },
    };
  }
}
