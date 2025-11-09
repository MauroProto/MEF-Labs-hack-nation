import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  JudgeRequest,
  JudgeVerdict,
  RubricCriterion,
} from "../../types/debate.types";

export class JudgeAgent extends BaseDebateAgent {
  constructor() {
    // Use lower temperature for more consistent, faster judging
    super({ temperature: 0.3, maxTokens: 3000 });
  }

  async judge(request: JudgeRequest): Promise<JudgeVerdict> {
    const { question, topics, arguments: debaterArguments, rubric, factCheck } = request;

    const postures = debaterArguments.map(arg => arg.posture);

    const factCheckInfo = factCheck ? `

### FACT-CHECK RESULTS

The Fact-Checker Agent has verified the factual claims. Use these results to inform your evaluation:

${JSON.stringify(factCheck, null, 2)}

**Important**: Consider factual accuracy when scoring, especially for the "value" criterion. Arguments with verified facts should score higher than those with false or unverifiable claims.` : '';

    const systemPrompt = `${this.getSystemPrompt()}

### ROLE

You are the **Judge Agent** in a multi-agent debate.

Your task is to assess how well each Debater's arguments perform across shared topics.

### MATERIALS

- Question: "${question}"
- Topics: ${JSON.stringify(topics, null, 2)}
- Postures: ${JSON.stringify(postures, null, 2)}

### IMPORTANT NOTE

You are evaluating *language-model arguments*, not human essays.

Therefore, your judgment focuses on:

- **Value**: Does the argument provide meaningful, non-trivial insights?
- **Cohesiveness**: Are all topics and reasoning threads logically compatible and internally consistent?
- **Conceptual Soundness**: Do arguments make sense, avoiding contradictions or logical fallacies?
- **Relevance**: Does each argument actually address the assigned topic and question?
- **Clarity**: Are statements precise, avoiding vague or circular explanations?

You are **not** verifying sources, checking URLs, or validating factual claims.
Another agent handles source validity.

### RUBRIC

Use this rubric to score each Debater **per topic**:

| Criterion | Description | Range | Weight |
|------------|--------------|--------|--------|
| value | Conceptual or argumentative richness; non-triviality | 0–1 | 0.30 |
| cohesiveness | Internal logic and compatibility across topics | 0–1 | 0.25 |
| relevance | Focused on the topic and question | 0–1 | 0.20 |
| clarity | Precision and readability of reasoning | 0–1 | 0.15 |
| engagement | Responds to counterpoints, anticipates critique | 0–1 | 0.10 |

### SCORING GUIDELINES

Use the full range from 0.0 to 1.0 for each criterion:

- **0.9-1.0** = Exceptional (outstanding evidence, flawless logic, comprehensive coverage)
- **0.7-0.9** = Strong (good evidence, solid reasoning, thorough)
- **0.5-0.7** = Adequate (some evidence, decent reasoning, partial coverage)
- **0.3-0.5** = Weak (limited evidence, flawed reasoning, gaps)
- **0.0-0.3** = Poor (no evidence, faulty logic, minimal coverage)

**Be discerning but fair.** Well-argued positions with good evidence should score 0.7-0.9. Only perfect arguments deserve 1.0.

Each score is between 0 and 1.
Compute the **weighted average** for each topic, then an **overall score** per debater (mean of topic scores).
Rank debaters from best to worst.
Extract the **most valuable insights** (non-obvious conclusions, new syntheses, or reconciling ideas).

### OUTPUT FORMAT

Return a JSON object following this schema:

{
  "perDebater": [
    {
      "posture": string,
      "perTopic": [
        {
          "topic": string,
          "scores": {
            "value": number,
            "cohesiveness": number,
            "relevance": number,
            "clarity": number,
            "engagement": number
          },
          "notes": string
        }
      ],
      "totals": {
        "weighted": number,
        "byCriterion": {
          "value": number,
          "cohesiveness": number,
          "relevance": number,
          "clarity": number,
          "engagement": number
        }
      }
    }
  ],
  "bestOverall": string,
  "insights": string[],
  "controversialPoints": string[]
}

### EVALUATION GUIDELINES

1. **Topic-level**: Assess if each topic section makes logical sense and contributes unique perspective.
2. **Cross-topic cohesion**: Penalize when reasoning contradicts itself across topics.
3. **Posture faithfulness**: Debater must remain loyal to their assigned posture.
4. **Insight extraction**: Identify arguments that bridge multiple postures or reveal deeper conceptual understanding.
5. **Avoid bias**: Judge only based on structure and reasoning, not on your own beliefs.
6. **Score distribution**: Use the full 0.0-1.0 range. Good arguments should score 0.7-0.9, not all clustering around 0.5.

### END TASK

Return a valid JSON object following the schema above. Do not add extra commentary.${factCheckInfo}`;

    const rubricText = rubric
      .map(
        (r) => `- ${r.id} (weight: ${r.weight}): ${r.description}`
      )
      .join("\n");

    const argumentsText = debaterArguments
      .map((arg) => {
        const topicsText = arg.perTopic
          .map((pt) => {
            const counterpoints = pt.counterpoints && pt.counterpoints.length > 0
              ? `\n    Counterpoints: ${pt.counterpoints.join('; ')}`
              : "";
            const paperCites = pt.citations.paper
              ? `\n    Paper citations: ${pt.citations.paper.length} chunks`
              : "";
            const webCites = pt.citations.web
              ? `\n    Web citations: ${pt.citations.web.length} sources`
              : "";
            return `  - Topic: ${pt.topic}
    Claim: ${pt.claim}
    Reasoning: ${pt.reasoning}${counterpoints}${paperCites}${webCites}`;
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
