import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  PostureGeneratorRequest,
  PostureGeneratorResponse,
} from "../../types/debate.types";

export class PostureGenerator extends BaseDebateAgent {
  async generate(
    request: PostureGeneratorRequest
  ): Promise<PostureGeneratorResponse> {
    const { question, paper, numPostures } = request;

    const systemPrompt = `${this.getSystemPrompt()}

For a selected question, propose N distinct postures (concise labels) that cover the plausible answer space. Then propose a complete topic set—3–8 topics that together exhaust the question's dimensions (methods, scope, assumptions, counter-examples, external validity, alternatives, ethics, etc.).

Output ONLY valid JSON that conforms to this schema:
{
  "postures": string[],
  "topics": string[]
}`;

    const userPrompt = `Here is the research paper:

Title: ${paper.title}

Content:
${paper.text.slice(0, 40000)} ${paper.text.length > 40000 ? "...(truncated)" : ""}

Question to debate: ${question}

Generate exactly ${numPostures} distinct postures that cover different perspectives on this question, and 3-8 topics that comprehensively cover all dimensions of the question.`;

    const response = await this.callOpenAIWithJsonResponse<PostureGeneratorResponse>(
      [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      systemPrompt
    );

    return response;
  }
}

