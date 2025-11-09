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

  const systemPrompt = `You are a debate participant with the following posture:

**Perspective**: ${posture.perspectiveTemplate}

**Position**: ${posture.initialPosition}

**Focus Topics**: ${posture.topics.join(', ')}

**Guiding Questions**:
${posture.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Your role is to present your perspective clearly and persuasively, using evidence from the research to support your position. Be scholarly, analytical, and thorough.`;

  const userPrompt = `Present your opening statement for this debate based on the following research analysis:

${researchAnalysis}

Provide a comprehensive exposition (300-500 words) that:
1. Introduces your perspective
2. Outlines your main arguments
3. References specific evidence from the research
4. Sets up the key questions you want to address

Your exposition should be well-structured and academically rigorous.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
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

  const systemPrompt = `You are a debate participant with the following posture:

**Perspective**: ${posture.perspectiveTemplate}

**Position**: ${posture.initialPosition}

**Focus Topics**: ${posture.topics.join(', ')}

Your role is to ask probing, analytical questions that challenge other perspectives while advancing your own position.`;

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
    model: 'gpt-4o',
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

  const systemPrompt = `You are a debate participant with the following posture:

**Perspective**: ${posture.perspectiveTemplate}

**Position**: ${posture.initialPosition}

**Focus Topics**: ${posture.topics.join(', ')}

**Guiding Questions**:
${posture.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Your role is to defend your perspective with evidence while engaging constructively with challenges.`;

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
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  return completion.choices[0].message.content || 'No answer generated';
}
