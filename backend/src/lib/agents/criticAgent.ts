/**
 * CriticAgent - Validates claims and identifies weaknesses
 *
 * Persona: Skeptical reviewer
 * Focus: Critical analysis, bias detection, methodological validation
 */

import { z } from 'zod';
import { BaseAgent, AgentConfig, AgentTool } from './baseAgent';

/**
 * CriticAgent configuration
 */
export interface CriticAgentConfig extends Omit<AgentConfig, 'systemPrompt'> {
  systemPrompt?: string;
}

/**
 * CriticAgent - Critically evaluates research and identifies weaknesses
 */
export class CriticAgent extends BaseAgent {
  constructor(config: CriticAgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt || '',
    });
  }

  /**
   * Default system prompt for critic agent
   */
  protected getDefaultSystemPrompt(): string {
    return `You are a skeptical, rigorous research critic AI agent. Your role is to:

1. Critically evaluate research claims and arguments
2. Identify methodological weaknesses and biases
3. Assess the validity of conclusions based on evidence
4. Suggest improvements to strengthen research
5. Challenge assumptions and identify logical fallacies

Guidelines:
- Be constructively critical, not dismissive
- Distinguish between fatal flaws and minor issues
- Provide specific, actionable feedback
- Consider alternative explanations for findings
- Assess statistical rigor and sample adequacy
- Identify potential confounding variables
- Check for bias in design, analysis, or interpretation
- Evaluate generalizability of findings

Evaluation criteria:
- Internal validity (causal claims justified?)
- External validity (generalizable?)
- Construct validity (measures what it claims?)
- Statistical conclusion validity (appropriate tests?)
- Methodological rigor
- Logical consistency
- Evidence quality

Output format:
- Severity levels: critical, major, minor, suggestion
- Specific locations where issues occur
- Confidence in critique (0-1)
- Suggested remedies`;
  }

  /**
   * Register critic-specific tools
   */
  protected registerTools(): void {
    this.registerTool(this.createValidateClaimTool());
    this.registerTool(this.createCritiqueMethodologyTool());
    this.registerTool(this.createIdentifyBiasesTool());
    this.registerTool(this.createSuggestImprovementsTool());
  }

  /**
   * Tool: Validate a specific claim
   */
  private createValidateClaimTool(): AgentTool {
    return {
      name: 'validate_claim',
      description: 'Critically evaluate a specific claim with supporting evidence and identify potential issues',
      parameters: z.object({
        claim: z.string().describe('The claim to validate'),
        evidence: z.array(z.string()).describe('Supporting evidence provided'),
        context: z.string().optional().describe('Additional context (methodology, data, etc.)'),
      }),
      execute: async (args) => {
        // In production, this would use OpenAI to analyze the claim critically
        return {
          claim: args.claim,
          validation: {
            isValid: 'conditional',
            confidence: 0.75,
            verdict: 'Claim is partially supported but has limitations',
          },
          strengths: [
            'Evidence directly supports main assertion',
            'Statistical significance achieved (p < 0.05)',
            'Effect size is meaningful (d = 0.65)',
          ],
          weaknesses: [
            {
              issue: 'Sample size may be insufficient for generalization',
              severity: 'major',
              impact: 'Limits external validity',
              evidence: 'Only N=50 participants',
            },
            {
              issue: 'Potential selection bias in participant recruitment',
              severity: 'moderate',
              impact: 'May skew results toward specific population',
              evidence: 'Convenience sampling from single institution',
            },
            {
              issue: 'Alternative explanations not ruled out',
              severity: 'minor',
              impact: 'Confounding variables possible',
              evidence: 'No control for socioeconomic status',
            },
          ],
          alternativeExplanations: [
            'Results could be due to confounding variable X',
            'Measurement error might account for observed effect',
            'Temporal factors not considered',
          ],
          recommendations: [
            'Replicate with larger, more diverse sample',
            'Control for identified confounds',
            'Consider alternative theoretical frameworks',
          ],
          overallAssessment: {
            evidenceQuality: 0.7,
            logicalSoundness: 0.75,
            methodologicalRigor: 0.65,
            conclusion: 'Accept with major reservations',
          },
        };
      },
    };
  }

  /**
   * Tool: Critique methodology
   */
  private createCritiqueMethodologyTool(): AgentTool {
    return {
      name: 'critique_methodology',
      description: 'Assess the quality and rigor of research methodology',
      parameters: z.object({
        methodology: z.object({
          design: z.string().describe('Study design description'),
          sampleSize: z.number().optional(),
          measures: z.array(z.string()).optional(),
          analysis: z.string().optional(),
        }),
        researchQuestion: z.string().optional().describe('The research question being addressed'),
      }),
      execute: async (args) => {
        return {
          methodologicalAssessment: {
            design: {
              appropriateness: 0.8,
              strengths: [
                'Design matches research question',
                'Controls for major confounds',
              ],
              weaknesses: [
                {
                  issue: 'Cross-sectional design limits causal inference',
                  severity: 'major',
                  remedy: 'Consider longitudinal or experimental design',
                },
              ],
            },
            sampling: {
              adequacy: 0.6,
              issues: [
                {
                  issue: 'Sample size may lack statistical power',
                  severity: 'major',
                  calculation: 'Power analysis suggests N=100 minimum, current N=50',
                  remedy: 'Increase sample size or adjust analysis',
                },
                {
                  issue: 'Non-random sampling affects generalizability',
                  severity: 'moderate',
                  remedy: 'Use stratified random sampling',
                },
              ],
            },
            measurement: {
              validity: 0.75,
              reliability: 0.8,
              concerns: [
                {
                  issue: 'Self-report measures subject to social desirability bias',
                  severity: 'moderate',
                  remedy: 'Include objective measures or behavioral observations',
                },
              ],
            },
            analysis: {
              appropriateness: 0.85,
              rigor: 0.8,
              issues: [
                {
                  issue: 'Multiple comparisons not corrected',
                  severity: 'moderate',
                  remedy: 'Apply Bonferroni or FDR correction',
                },
              ],
            },
            internalValidity: {
              score: 0.7,
              threats: [
                'Selection bias',
                'Instrumentation effects',
                'History effects (timing of data collection)',
              ],
            },
            externalValidity: {
              score: 0.6,
              threats: [
                'Narrow population sampled',
                'Artificial laboratory setting',
                'Limited ecological validity',
              ],
            },
          },
          overallRating: {
            rigor: 0.72,
            verdict: 'Adequate with notable limitations',
            recommendation: 'Publishable with revisions addressing major issues',
          },
          priorityImprovements: [
            '1. Increase sample size to achieve adequate power',
            '2. Implement random sampling or justify convenience sample',
            '3. Add objective measures to complement self-reports',
            '4. Correct for multiple comparisons',
          ],
        };
      },
    };
  }

  /**
   * Tool: Identify biases
   */
  private createIdentifyBiasesTool(): AgentTool {
    return {
      name: 'identify_biases',
      description: 'Detect potential biases in research design, analysis, or interpretation',
      parameters: z.object({
        researchSummary: z.string().describe('Summary of the research'),
        methodology: z.string().optional(),
        results: z.string().optional(),
        interpretation: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          detectedBiases: [
            {
              type: 'selection_bias',
              description: 'Participants self-selected, may differ from general population',
              location: 'Sampling method',
              severity: 'major',
              evidence: 'Recruitment via social media may attract specific demographics',
              impact: 'Results may not generalize to broader population',
              mitigation: 'Use random sampling or report demographic comparisons',
            },
            {
              type: 'confirmation_bias',
              description: 'Analysis and interpretation favor hypothesis',
              location: 'Discussion section',
              severity: 'moderate',
              evidence: 'Alternative explanations mentioned but not thoroughly explored',
              impact: 'Overstates support for primary hypothesis',
              mitigation: 'Actively test alternative hypotheses',
            },
            {
              type: 'publication_bias',
              description: 'Only statistically significant results emphasized',
              location: 'Results reporting',
              severity: 'moderate',
              evidence: 'Null findings mentioned briefly in limitations',
              impact: 'Literature may appear more conclusive than warranted',
              mitigation: 'Report all planned analyses, including null results',
            },
            {
              type: 'measurement_bias',
              description: 'Self-report measures prone to social desirability',
              location: 'Data collection',
              severity: 'moderate',
              evidence: 'Sensitive topics measured via direct questions',
              impact: 'Participants may provide socially acceptable responses',
              mitigation: 'Use indirect measures or validated scales with lie detection',
            },
          ],
          riskAssessment: {
            overallBiasRisk: 'moderate-high',
            confidence: 0.78,
            mostConcerning: 'selection_bias',
            leastConcerning: 'measurement_bias',
          },
          recommendations: [
            'Implement random or stratified sampling',
            'Pre-register analysis plan to prevent p-hacking',
            'Include replication study with different sample',
            'Use validated instruments with built-in validity checks',
            'Report all planned comparisons, not just significant ones',
          ],
        };
      },
    };
  }

  /**
   * Tool: Suggest improvements
   */
  private createSuggestImprovementsTool(): AgentTool {
    return {
      name: 'suggest_improvements',
      description: 'Provide specific, actionable recommendations to strengthen the research',
      parameters: z.object({
        researchArea: z
          .enum(['design', 'methodology', 'analysis', 'interpretation', 'writing'])
          .describe('Area to focus improvement suggestions on'),
        currentApproach: z.string().describe('Description of current approach'),
        identifiedIssues: z.array(z.string()).optional().describe('Known issues to address'),
      }),
      execute: async (args) => {
        const suggestionsByArea: Record<string, any[]> = {
          design: [
            {
              priority: 'high',
              suggestion: 'Implement randomized controlled trial design',
              rationale: 'Enables causal inference',
              implementation: 'Randomly assign participants to experimental/control groups',
              expectedImprovement: '+25% internal validity',
            },
            {
              priority: 'high',
              suggestion: 'Add longitudinal component',
              rationale: 'Assess temporal dynamics and stability of effects',
              implementation: 'Collect data at T1, T2, T3 (baseline, 6mo, 12mo)',
              expectedImprovement: 'Enables causal modeling, identifies temporal patterns',
            },
            {
              priority: 'medium',
              suggestion: 'Include active control group',
              rationale: 'Controls for placebo and attention effects',
              implementation: 'Design comparable intervention for control group',
              expectedImprovement: 'Strengthens treatment-specific claims',
            },
          ],
          methodology: [
            {
              priority: 'high',
              suggestion: 'Increase sample size to N=200',
              rationale: 'Achieves 0.80 power for medium effect (d=0.5)',
              implementation: 'Conduct power analysis, adjust recruitment',
              expectedImprovement: 'Reduces Type II error risk',
            },
            {
              priority: 'high',
              suggestion: 'Add objective behavioral measures',
              rationale: 'Reduces self-report bias',
              implementation: 'Include observational coding, physiological measures',
              expectedImprovement: '+30% construct validity',
            },
            {
              priority: 'medium',
              suggestion: 'Use validated, standardized instruments',
              rationale: 'Enables comparison with prior research',
              implementation: 'Select instruments with established psychometrics',
              expectedImprovement: 'Enhances reliability and comparability',
            },
          ],
          analysis: [
            {
              priority: 'high',
              suggestion: 'Pre-register analysis plan',
              rationale: 'Prevents p-hacking and HARKing',
              implementation: 'Submit to OSF or AsPredicted before data collection',
              expectedImprovement: 'Increases transparency and credibility',
            },
            {
              priority: 'medium',
              suggestion: 'Conduct sensitivity analyses',
              rationale: 'Tests robustness of findings',
              implementation: 'Re-run analyses with outliers removed, different specifications',
              expectedImprovement: 'Demonstrates result stability',
            },
            {
              priority: 'medium',
              suggestion: 'Report effect sizes and confidence intervals',
              rationale: 'Provides practical significance context',
              implementation: 'Calculate Cohen\'s d, OR, R² with 95% CI',
              expectedImprovement: 'Aids interpretation and meta-analysis',
            },
          ],
          interpretation: [
            {
              priority: 'high',
              suggestion: 'Discuss alternative explanations thoroughly',
              rationale: 'Demonstrates balanced evaluation',
              implementation: 'Dedicate section to competing hypotheses',
              expectedImprovement: 'Strengthens argument through transparent reasoning',
            },
            {
              priority: 'medium',
              suggestion: 'Explicitly state limitations and their impact',
              rationale: 'Guides future research and tempers overclaims',
              implementation: 'Create structured limitations section with implications',
              expectedImprovement: 'Increases reader trust and research utility',
            },
          ],
          writing: [
            {
              priority: 'high',
              suggestion: 'Improve clarity of causal language',
              rationale: 'Avoids overstating correlational findings',
              implementation: 'Replace "causes" with "is associated with" where appropriate',
              expectedImprovement: 'Reduces misinterpretation risk',
            },
            {
              priority: 'medium',
              suggestion: 'Add visual summary of methodology',
              rationale: 'Enhances comprehension of complex design',
              implementation: 'Create flowchart of participant flow and procedures',
              expectedImprovement: 'Increases accessibility and replicability',
            },
          ],
        };

        return {
          focusArea: args.researchArea,
          improvements: suggestionsByArea[args.researchArea] || [],
          quickWins: [
            'Report all descriptive statistics (M, SD, range)',
            'Include correlation matrix of all variables',
            'Add power analysis to methods',
            'Provide raw data or summary statistics in supplement',
          ],
          longTermGoals: [
            'Conduct direct replication study',
            'Test in different cultural context',
            'Develop theoretical model based on findings',
          ],
          estimatedImpact: {
            publishability: '+2 levels (e.g., regional → national journal)',
            citability: '+40% expected citations',
            replicability: '+50% likelihood of successful replication',
            influence: 'High - addresses key methodological concerns',
          },
        };
      },
    };
  }
}
