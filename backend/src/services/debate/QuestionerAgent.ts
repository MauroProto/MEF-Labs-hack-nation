/**
 * QuestionerAgent - Generates cross-examination questions between debaters
 *
 * Takes one debater's posture and another's argument, generates a challenging question
 */

import OpenAI from 'openai';
import { BaseDebateAgent } from './BaseDebateAgent';
import { DebaterArgument } from '../../types/debate.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type QuestionerRequest = {
  questionerPosture: string;
  targetPosture: string;
  targetArgument: DebaterArgument;
  mainQuestion: string;
};

type QuestionerResponse = {
  question: string;
};

export class QuestionerAgent extends BaseDebateAgent {
  /**
   * Generate a challenging cross-examination question from one debater to another
   */
  async generateQuestion(request: QuestionerRequest, onStream?: (delta: string) => void): Promise<QuestionerResponse> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const messages = [
      { role: 'user' as const, content: userPrompt },
    ];

    if (onStream) {
      // Use streaming
      const extracted = await this.callOpenAIWithStreamingJson<QuestionerResponse>(
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
        max_tokens: 500,
      });

      const extracted = this.extractJsonFromResponse(completion);
      return extracted as QuestionerResponse;
    }
  }

  private buildSystemPrompt(request: QuestionerRequest): string {
    return `You are a tool-using research assistant in a multi-agent debate.
Always produce JSON that conforms to the provided schema.
Be concise, factual, cite evidence via the available tools (lookupPaper, webSearch) when asked.

### ROLE

You are a **Questioner Agent** generating cross-examination questions in a live debate.

You represent the perspective: **"${request.questionerPosture}"**

Your goal is to challenge the opposing debater's argument by asking ONE insightful,
specific question that:

1. **Identifies a weakness, gap, or assumption** in their reasoning
2. **Forces clarification** on an ambiguous or contradictory point
3. **Probes the boundaries** of their position
4. **Relates directly to the main question**: "${request.mainQuestion}"

### GUIDELINES

- Ask ONE question only (not multiple questions)
- Be respectful but challenging
- Focus on logic, evidence, or conceptual clarity
- Avoid rhetorical questions that don't expect an answer
- Keep it concise (1-2 sentences max)

### OUTPUT FORMAT

Return ONLY valid JSON:

{
  "question": "Your challenging question here"
}

### EXAMPLE

If the target argues "Transformers are revolutionary because they parallelize training",
you might ask:

{
  "question": "While parallelization is valuable, doesn't the quadratic attention complexity
  limit scalability to very long sequences, undermining the revolutionary claim?"
}

### END TASK

Generate a single challenging question based on the opponent's argument below.`;
  }

  private buildUserPrompt(request: QuestionerRequest): string {
    const argumentSummary = request.targetArgument.perTopic
      .map(
        (t) =>
          `Topic: ${t.topic}\nClaim: ${t.claim}\nReasoning: ${t.reasoning.substring(0, 200)}...`
      )
      .join('\n\n');

    return `Main Question: ${request.mainQuestion}

Your Posture: ${request.questionerPosture}

Opponent's Posture: ${request.targetPosture}

Opponent's Arguments:
${argumentSummary}

Overall Position: ${request.targetArgument.overallPosition}

Generate a challenging cross-examination question that probes a weakness or ambiguity
in their argument. Return valid JSON.`;
  }
}
