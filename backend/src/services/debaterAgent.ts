/**
 * Debater Agent
 *
 * Specialized agent for debate participation.
 * Uses OpenAI directly without agent orchestrator registration.
 */

import OpenAI from 'openai';
import { Posture } from '../types/agent.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DebaterContext {
  posture: Posture;
  researchAnalysis: string;
  debateHistory: Array<{ from: string; to?: string; content: string }>;
}

/**
 * Generate exposition - initial presentation of posture
 */
export async function generateExposition(context: DebaterContext): Promise<string> {
  const { posture, researchAnalysis } = context;

  const systemPrompt = `You are an expert academic debater participating in a structured scholarly debate.

# YOUR ASSIGNED PERSPECTIVE
**Role**: ${posture.perspectiveTemplate}
**Core Position**: ${posture.initialPosition}
**Focus Areas**: ${posture.topics.join(', ')}

# GUIDING QUESTIONS
${posture.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# COGNITIVE REASONING FRAMEWORK
Follow this structured approach in your exposition:

1. **PERCEPTION** - Present key observations from the research
   - Identify salient facts and evidence
   - Note methodological approaches

2. **SITUATION** - Contextualize within your perspective
   - Explain how evidence supports or challenges your position
   - Connect findings to broader implications

3. **NORM** - Establish standards for evaluation
   - Define criteria for assessing research quality
   - Set benchmarks for your arguments

# OUTPUT REQUIREMENTS
- Use precise academic language
- Cite specific evidence and page numbers when available
- Structure arguments logically with clear transitions
- Maintain scholarly tone while being persuasive
- Provide confidence levels (high/medium/low) for major claims`;

  const userPrompt = `Present your opening statement for this debate based on the following research analysis:

${researchAnalysis}

Provide a comprehensive exposition (300-500 words) that:
1. Introduces your perspective
2. Outlines your main arguments
3. References specific evidence from the research
4. Sets up the key questions you want to address

Your exposition should be well-structured and academically rigorous.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return completion.choices[0].message.content || 'No response generated';
}

/**
 * Generate question for another debater
 */
export async function generateQuestion(
  context: DebaterContext,
  targetPosture: Posture
): Promise<string> {
  const { posture, researchAnalysis, debateHistory } = context;

  const systemPrompt = `You are an expert academic debater in cross-examination mode.

# YOUR PERSPECTIVE
**Role**: ${posture.perspectiveTemplate}
**Position**: ${posture.initialPosition}
**Focus Areas**: ${posture.topics.join(', ')}

# CROSS-EXAMINATION STRATEGY
Your goal is to challenge the opponent's position through incisive questioning that:

1. **IDENTIFY ASSUMPTIONS** - Expose unstated premises in their argument
2. **TEST EVIDENCE** - Question the quality, relevance, and interpretation of their sources
3. **PROBE LOGIC** - Challenge reasoning gaps or contradictions
4. **EXPLORE IMPLICATIONS** - Push them to confront consequences of their position

# QUESTION CHARACTERISTICS
- Specific and focused (not vague or multiple questions in one)
- Evidence-based (reference concrete claims they made)
- Strategic (advance your perspective while testing theirs)
- Respectful but rigorous (maintain academic decorum)`;

  const historyText = debateHistory
    .map((ex) => `[${ex.from}${ex.to ? ` → ${ex.to}` : ''}]: ${ex.content}`)
    .join('\n\n');

  const userPrompt = `You are questioning the "${targetPosture.perspectiveTemplate}" perspective.

**Their position**: ${targetPosture.initialPosition}

**Their topics**: ${targetPosture.topics.join(', ')}

**Debate history so far**:
${historyText}

Generate a focused, challenging question (100-200 words) that:
1. Addresses a specific claim or assumption they made
2. Relates to the research evidence
3. Advances the debate productively
4. Is academically rigorous

Your question:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  return completion.choices[0].message.content || 'No question generated';
}

/**
 * Generate answer to a question
 */
export async function generateAnswer(
  context: DebaterContext,
  question: string,
  questioner: string
): Promise<string> {
  const { posture, researchAnalysis, debateHistory } = context;

  const systemPrompt = `You are an expert academic debater responding to cross-examination.

# YOUR PERSPECTIVE
**Role**: ${posture.perspectiveTemplate}
**Position**: ${posture.initialPosition}
**Focus Areas**: ${posture.topics.join(', ')}

# GUIDING PRINCIPLES
${posture.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# RESPONSE STRATEGY
Construct your answer using this framework:

1. **DIRECT ADDRESS** - Answer the specific question asked
   - Don't evade or deflect
   - State your position clearly

2. **JUSTIFICATION** - Provide evidence and reasoning
   - Reference research findings
   - Explain logical connections
   - Acknowledge data limitations where relevant

3. **NUANCE** - Show intellectual honesty
   - Concede valid points from the questioner
   - Clarify misconceptions
   - Distinguish strong vs. weak claims

4. **REINFORCEMENT** - Circle back to your core position
   - Show how your answer supports your overall argument
   - Maintain consistency with previous statements

# ANSWER QUALITY STANDARDS
- Prioritize truth over rhetorical victory
- Use precise language and specific examples
- Maintain academic rigor and intellectual honesty
- Balance confidence with appropriate epistemic humility`;

  const historyText = debateHistory
    .map((ex) => `[${ex.from}${ex.to ? ` → ${ex.to}` : ''}]: ${ex.content}`)
    .join('\n\n');

  const userPrompt = `${questioner} has asked you:

"${question}"

**Research context**:
${researchAnalysis.substring(0, 1000)}...

**Debate history**:
${historyText}

Provide a substantive answer (200-300 words) that:
1. Directly addresses the question
2. Supports your position with evidence
3. Acknowledges valid points while maintaining your perspective
4. Advances the intellectual discussion

Your answer:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  return completion.choices[0].message.content || 'No answer generated';
}
