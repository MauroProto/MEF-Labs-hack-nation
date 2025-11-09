import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  JudgeRequest,
  JudgeVerdict,
  RubricCriterion,
} from "../../types/debate.types";

export class JudgeAgent extends BaseDebateAgent {
  async judge(request: JudgeRequest): Promise<JudgeVerdict> {
    const { question, topics, arguments: debaterArguments, rubric } = request;

    const systemPrompt = `${this.getSystemPrompt()}

Score each debater per topic using the provided rubric. Scores are within [0,1]. Include notes explaining deductions. Then compute weighted totals and select a bestOverall posture, and list insights (novel, actionable, non-obvious) that are well-supported across arguments.

Output ONLY valid JSON that conforms to this schema:
{
  "perDebater": [{
    "posture": string,
    "perTopic": [{
      "topic": string,
      "scores": {
        "correctness": number,
        "evidence": number,
        "coverage": number,
        "clarity": number,
        "novelty": number
      },
      "notes": string
    }],
    "totals": {
      "weighted": number,
      "byCriterion": {
        "correctness": number,
        "evidence": number,
        "coverage": number,
        "clarity": number,
        "novelty": number
      }
    }
  }],
  "bestOverall": string,
  "insights": string[]
}`;

    const rubricText = rubric
      .map(
        (r) => `- ${r.id} (weight: ${r.weight}): ${r.description}`
      )
      .join("\n");

    const argumentsText = debaterArguments
      .map((arg) => {
        const topicsText = arg.perTopic
          .map((pt) => {
            const paperCites = pt.cites.paper
              ? `\n    Paper citations: ${pt.cites.paper.length} chunks`
              : "";
            const webCites = pt.cites.web
              ? `\n    Web citations: ${pt.cites.web.length} sources`
              : "";
            return `  - Topic: ${pt.topic}
    Claim: ${pt.claim}
    Reasoning: ${pt.reasoning}${paperCites}${webCites}`;
          })
          .join("\n\n");

        return `Posture: ${arg.posture}
Overall Position: ${arg.overallPosition}

${topicsText}`;
      })
      .join("\n\n" + "=".repeat(80) + "\n\n");

    const userPrompt = `Question: ${question}

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Rubric:
${rubricText}

Debater Arguments:

${argumentsText}

Evaluate each debater's argument for each topic using the rubric. Provide scores (0-1), notes, compute totals, identify the best overall posture, and extract key insights.`;

    const response = await this.callOpenAIWithJsonResponse<JudgeVerdict>(
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

