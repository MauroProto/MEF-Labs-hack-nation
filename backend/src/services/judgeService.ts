/**
 * Judge Service
 *
 * Evaluates debate transcripts using configurable criteria
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import {
  DebateTranscript,
  JudgeVerdict,
} from '../types/agent.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number; // 0-1, should sum to 1 across all criteria
}

const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  {
    name: 'Evidence Quality',
    description: 'Strength and relevance of evidence presented',
    weight: 0.3,
  },
  {
    name: 'Logical Coherence',
    description: 'Clarity and consistency of argumentation',
    weight: 0.25,
  },
  {
    name: 'Topic Coverage',
    description: 'Comprehensiveness in addressing assigned topics',
    weight: 0.25,
  },
  {
    name: 'Response Quality',
    description: 'Directness and substance of answers to questions',
    weight: 0.2,
  },
];

/**
 * Evaluate a debate transcript and produce a verdict
 */
export async function evaluateDebate(
  sessionId: string,
  transcript: DebateTranscript,
  criteria: EvaluationCriteria[] = DEFAULT_CRITERIA
): Promise<JudgeVerdict> {
  // Build evaluation prompt
  const prompt = buildEvaluationPrompt(transcript, criteria);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert debate judge evaluating a structured academic debate about a research paper.

Your task is to:
1. Evaluate each debater's performance against specific criteria
2. Provide scores (0-100) for each criterion
3. Give detailed reasoning for your evaluation
4. Provide an overall verdict identifying the strongest analysis

Be objective, thorough, and fair in your assessment.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent evaluation
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const evaluation = JSON.parse(responseText);

    // Build verdict object
    const verdict: JudgeVerdict = {
      id: nanoid(),
      sessionId,
      judgeId: 'judge-gpt4',
      criteria: criteria.reduce((acc, c) => {
        acc[c.name] = c.description;
        return acc;
      }, {} as Record<string, string>),
      scores: evaluation.scores || {},
      reasoning: evaluation.reasoning || 'No reasoning provided',
      confidence: evaluation.confidence || 0.7,
      verdict: evaluation.verdict || 'Evaluation complete',
      timestamp: new Date(),
    };

    return verdict;
  } catch (error) {
    console.error('Judge evaluation failed:', error);

    // Return a fallback verdict
    return {
      id: nanoid(),
      sessionId,
      judgeId: 'judge-fallback',
      criteria: criteria.reduce((acc, c) => {
        acc[c.name] = c.description;
        return acc;
      }, {} as Record<string, string>),
      scores: {},
      reasoning: `Evaluation failed: ${(error as Error).message}. Manual review recommended.`,
      confidence: 0,
      verdict: 'Unable to complete automated evaluation',
      timestamp: new Date(),
    };
  }
}

/**
 * Build the evaluation prompt from transcript
 */
function buildEvaluationPrompt(
  transcript: DebateTranscript,
  criteria: EvaluationCriteria[]
): string {
  const { postures, rounds } = transcript;

  let prompt = `# Debate Evaluation

## Postures
${postures.map((p, i) => `
### Posture ${i + 1}: ${p.perspectiveTemplate}
**Debater**: ${p.debaterId}
**Position**: ${p.initialPosition}
**Topics**: ${p.topics.join(', ')}
**Guiding Questions**: ${p.guidingQuestions.join('; ')}
`).join('\n')}

## Debate Transcript

`;

  // Add all rounds and exchanges
  for (const round of rounds) {
    prompt += `\n### Round ${round.roundNumber}: ${round.roundType === 'exposition' ? 'Exposition' : 'Cross-Examination'}\n`;

    if (round.roundType === 'cross_examination' && round.targetPosture) {
      const targetPosture = postures.find(p => p.id === round.targetPosture);
      if (targetPosture) {
        prompt += `**Target**: ${targetPosture.perspectiveTemplate} (${targetPosture.debaterId})\n`;
      }
    }

    for (const exchange of round.exchanges) {
      const exchangeType = exchange.type.toUpperCase();
      prompt += `\n**[${exchangeType}]** From: ${exchange.from}${exchange.to ? ` | To: ${exchange.to}` : ''}\n`;
      prompt += `${exchange.content}\n`;
    }
  }

  // Add evaluation criteria
  prompt += `\n\n## Evaluation Criteria\n\n`;
  prompt += `Evaluate each debater on the following criteria (score 0-100 for each):\n\n`;

  criteria.forEach(c => {
    prompt += `- **${c.name}** (weight: ${(c.weight * 100).toFixed(0)}%): ${c.description}\n`;
  });

  // Add output format instructions
  prompt += `\n\n## Required Output Format

Provide your evaluation as JSON with this exact structure:

\`\`\`json
{
  "scores": {
    "${postures[0].debaterId}": {
      "${criteria[0].name}": <0-100>,
      "${criteria[1].name}": <0-100>,
      ...
    },
    "${postures[1].debaterId}": { ... },
    "${postures[2].debaterId}": { ... }
  },
  "reasoning": "Detailed explanation of your evaluation. For each debater, explain:\n- Strengths in their argumentation\n- Weaknesses or areas for improvement\n- How well they covered their assigned topics\n- Quality of their responses to questions\n- Overall contribution to the debate",
  "confidence": <0.0-1.0>,
  "verdict": "Summary verdict identifying which analysis was most compelling and why"
}
\`\`\`

Ensure all debaters are evaluated fairly and scores reflect actual performance relative to the criteria.`;

  return prompt;
}

/**
 * Calculate weighted scores for each debater
 */
export function calculateWeightedScores(
  verdict: JudgeVerdict,
  criteria: EvaluationCriteria[] = DEFAULT_CRITERIA
): Record<string, number> {
  const weightedScores: Record<string, number> = {};

  for (const [debaterId, scores] of Object.entries(verdict.scores)) {
    let totalScore = 0;

    for (const criterion of criteria) {
      const score = (scores as any)[criterion.name] || 0;
      totalScore += score * criterion.weight;
    }

    weightedScores[debaterId] = Math.round(totalScore);
  }

  return weightedScores;
}
