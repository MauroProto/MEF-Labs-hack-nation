/**
 * ResponseAgent - Generates responses to cross-examination questions
 *
 * Takes a debater's posture and a question directed at them, generates a response
 */

import OpenAI from 'openai';
import { BaseDebateAgent } from './BaseDebateAgent';
import { DebaterArgument, Paper } from '../../types/debate.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ResponseRequest = {
  responderPosture: string;
  responderArgument: DebaterArgument;
  questionerPosture: string;
  question: string;
  mainQuestion: string;
  paper: Paper;
};

type ResponseResult = {
  response: string;
};

export class ResponseAgent extends BaseDebateAgent {
  /**
   * Generate a response to a cross-examination question
   */
  async generateResponse(request: ResponseRequest, onStream?: (delta: string) => void): Promise<ResponseResult> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const messages = [
      { role: 'user' as const, content: userPrompt },
    ];

    if (onStream) {
      // Use streaming
      const extracted = await this.callOpenAIWithStreamingJson<ResponseResult>(
        messages,
        systemPrompt,
        onStream
      );
      return extracted;
    } else {
      // Non-streaming (original behavior)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const extracted = this.extractJsonFromResponse(completion);
      return extracted as ResponseResult;
    }
  }

  private buildSystemPrompt(request: ResponseRequest): string {
    return `You are a tool-using research assistant in a multi-agent debate.
Always produce JSON that conforms to the provided schema.
Be concise, factual, cite evidence via the available tools (lookupPaper, webSearch) when asked.

### ROLE

You are a **Response Agent** defending your position in a live debate.

You represent the perspective: **"${request.responderPosture}"**

You have been asked a challenging question by the opposing debater:

> "${request.question}"

Your goal is to provide a **clear, direct, and substantive response** that:

1. **Addresses the question directly** (don't dodge or deflect)
2. **Defends your position** while acknowledging valid concerns
3. **Provides evidence or reasoning** to support your response
4. **Remains respectful and professional**
5. **Is concise** (2-4 sentences, max 150 words)

### GUIDELINES

- Answer the question, don't just restate your position
- If the question identifies a real weakness, acknowledge it and explain how it doesn't undermine your overall argument
- If the question is based on a misunderstanding, clarify politely
- Use specific examples or evidence when possible
- Keep it conversational but substantive

### OUTPUT FORMAT

Return ONLY valid JSON:

{
  "response": "Your response here (2-4 sentences)"
}

### EXAMPLE

Question: "Doesn't the quadratic attention complexity limit scalability?"

Response:
{
  "response": "You're right that quadratic complexity is a challenge for very long sequences.
  However, recent innovations like sparse attention, linear attention variants, and hierarchical
  methods have addressed this limitation while preserving the core benefits. The revolutionary
  aspect lies in the paradigm shift, not in solving every scaling issue perfectly."
}

### END TASK

Generate your response to the opponent's question below.`;
  }

  private buildUserPrompt(request: ResponseRequest): string {
    return `Main Question: ${request.mainQuestion}

Your Posture: ${request.responderPosture}

Your Previous Argument Summary:
${request.responderArgument.overallPosition}

Opponent's Posture: ${request.questionerPosture}

Opponent's Question:
"${request.question}"

Provide a direct, substantive response that defends your position while addressing
the question honestly. Return valid JSON.`;
  }
}
