import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  FurtherQuestionsRequest,
  FurtherQuestionsResponse,
} from "../../types/debate.types";

export class FurtherQuestionsGenerator extends BaseDebateAgent {
  async generate(
    request: FurtherQuestionsRequest
  ): Promise<FurtherQuestionsResponse> {
    const { paper } = request;

    const systemPrompt = `${this.getSystemPrompt()}

Given a research paper, propose 8–12 non-trivial, answerable, insight-seeking questions that would likely produce diverse postures in a debate. 

Avoid yes/no phrasing—prefer "under what conditions…", "to what extent…", "what are the causal mechanisms…", "what are the limitations…", "how transferable…". 

Output ONLY valid JSON that conforms to this schema:
{
  "questions": string[]
}`;

    const userPrompt = `Here is the research paper:

Title: ${paper.title}

Content:
${paper.text.slice(0, 50000)} ${paper.text.length > 50000 ? "...(truncated)" : ""}

Generate 8-12 insightful questions about this paper that would produce diverse debate postures.`;

    const response = await this.callOpenAIWithJsonResponse<FurtherQuestionsResponse>(
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

