/**
 * Posture Generator Service
 *
 * Generates 3 debate postures from research analysis
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { Posture } from '../types/agent.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PERSPECTIVE_TEMPLATES = [
  'Critical Analyst',
  'Methodological Advocate',
  'Integrative Synthesizer',
];

/**
 * Generate 3 debate postures from research analysis
 */
export async function generatePostures(
  sessionId: string,
  researchAnalysis: string,
  debaterIds: string[] = ['debater-1', 'debater-2', 'debater-3']
): Promise<Posture[]> {
  const prompt = `Based on the following research analysis, generate 3 distinct debate postures for a structured academic debate:

# Research Analysis
${researchAnalysis}

---

Generate 3 postures with different perspectives:

1. **Critical Analyst**: Focus on limitations, methodological concerns, and areas needing scrutiny
2. **Methodological Advocate**: Focus on strengths, novelty, and contributions of the research approach
3. **Integrative Synthesizer**: Focus on connections to existing work, broader implications, and synthesis

For each posture, provide:
- **Topics** (3-5 specific topics this posture should address)
- **Initial Position** (2-3 sentence stance this debater will take)
- **Guiding Questions** (3-4 questions this posture will explore)

Output as JSON:

\`\`\`json
{
  "postures": [
    {
      "perspectiveTemplate": "Critical Analyst",
      "topics": ["topic1", "topic2", "topic3"],
      "initialPosition": "Clear stance...",
      "guidingQuestions": ["question1", "question2", "question3"]
    },
    {
      "perspectiveTemplate": "Methodological Advocate",
      ...
    },
    {
      "perspectiveTemplate": "Integrative Synthesizer",
      ...
    }
  ]
}
\`\`\`

Ensure each posture:
- Has distinct, non-overlapping topics
- Takes a clear position that can be defended
- Includes probing, substantive guiding questions
- Is grounded in the research analysis provided`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert debate moderator creating diverse, balanced debate postures for academic discourse.

Your goal is to create postures that:
1. Cover different analytical perspectives
2. Ensure comprehensive exploration of the research
3. Promote substantive intellectual exchange
4. Avoid superficial or redundant positions`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText);

    if (!parsed.postures || parsed.postures.length !== 3) {
      throw new Error('Invalid posture generation response');
    }

    // Map to Posture objects
    const postures: Posture[] = parsed.postures.map((p: any, index: number) => ({
      id: nanoid(),
      sessionId,
      debaterId: debaterIds[index],
      perspectiveTemplate: p.perspectiveTemplate || PERSPECTIVE_TEMPLATES[index],
      topics: Array.isArray(p.topics) ? p.topics : [],
      initialPosition: p.initialPosition || '',
      guidingQuestions: Array.isArray(p.guidingQuestions) ? p.guidingQuestions : [],
      createdAt: new Date(),
    }));

    return postures;
  } catch (error) {
    console.error('Posture generation failed:', error);

    // Return fallback postures
    return createFallbackPostures(sessionId, researchAnalysis, debaterIds);
  }
}

/**
 * Create fallback postures if OpenAI fails
 */
function createFallbackPostures(
  sessionId: string,
  researchAnalysis: string,
  debaterIds: string[]
): Posture[] {
  return [
    {
      id: nanoid(),
      sessionId,
      debaterId: debaterIds[0],
      perspectiveTemplate: 'Critical Analyst',
      topics: [
        'Methodological limitations',
        'Data quality and sampling',
        'Alternative explanations',
      ],
      initialPosition:
        'This research presents interesting findings but requires careful scrutiny of its methodological choices and limitations before accepting its conclusions.',
      guidingQuestions: [
        'What are the key limitations of the methodology used?',
        'Are there alternative explanations for the findings?',
        'How robust is the evidence presented?',
      ],
      createdAt: new Date(),
    },
    {
      id: nanoid(),
      sessionId,
      debaterId: debaterIds[1],
      perspectiveTemplate: 'Methodological Advocate',
      topics: [
        'Novel methodological contributions',
        'Strength of evidence',
        'Practical applications',
      ],
      initialPosition:
        'The research employs rigorous methods and makes meaningful contributions to the field through its innovative approach and strong empirical support.',
      guidingQuestions: [
        'What methodological innovations does this work introduce?',
        'How does the evidence support the main claims?',
        'What are the practical implications of these findings?',
      ],
      createdAt: new Date(),
    },
    {
      id: nanoid(),
      sessionId,
      debaterId: debaterIds[2],
      perspectiveTemplate: 'Integrative Synthesizer',
      topics: [
        'Connections to existing literature',
        'Theoretical implications',
        'Future research directions',
      ],
      initialPosition:
        'This work contributes to ongoing scholarly conversations and opens new avenues for investigation by synthesizing existing knowledge with novel insights.',
      guidingQuestions: [
        'How does this research build on or challenge existing work?',
        'What are the broader theoretical implications?',
        'What future research directions does this suggest?',
      ],
      createdAt: new Date(),
    },
  ];
}
