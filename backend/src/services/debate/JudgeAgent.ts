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

You are an expert judge evaluating debate arguments. Score each debater per topic using the provided rubric.

SCORING GUIDELINES:
- Use the full range from 0.0 to 1.0 (0% to 100%)
- 0.9-1.0 = Exceptional (outstanding evidence, flawless logic, comprehensive coverage)
- 0.7-0.9 = Strong (good evidence, solid reasoning, thorough)
- 0.5-0.7 = Adequate (some evidence, decent reasoning, partial coverage)
- 0.3-0.5 = Weak (limited evidence, flawed reasoning, gaps)
- 0.0-0.3 = Poor (no evidence, faulty logic, minimal coverage)

Be discerning but fair. Well-argued positions with good evidence should score 0.7-0.9. Only perfect arguments deserve 1.0.

Include specific notes explaining each score. Compute weighted totals, select the bestOverall posture, and list key insights.

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

