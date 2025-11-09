import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  ReporterRequest,
  DebateReport,
  WebSearchResult,
} from "../../types/debate.types";

export class ReporterAgent extends BaseDebateAgent {
  async generateReport(request: ReporterRequest): Promise<DebateReport> {
    const { question, topics, postures, arguments: debaterArguments, verdict } = request;

    const systemPrompt = `${this.getSystemPrompt()}

Produce a comprehensive debate report with a crisp executive summary, posture ranking, validated insights, controversies, and 5–7 recommended links. Provide a human-readable markdown section at the end.

Output ONLY valid JSON that conforms to this schema:
{
  "question": string,
  "topics": string[],
  "postures": string[],
  "summary": string,
  "rankedPostures": [{ "posture": string, "score": number }],
  "validatedInsights": string[],
  "controversialPoints": string[],
  "recommendedNextReads": [{ "title": string, "url": string, "snippet": string }],
  "appendix": {
    "perDebaterKeyClaims": [{ "posture": string, "claims": [{ "topic": string, "claim": string }] }],
    "scoringTable": [...]
  },
  "markdown": string
}`;

    const verdictText = JSON.stringify(verdict, null, 2);
    const argumentsText = JSON.stringify(debaterArguments, null, 2);

    const userPrompt = `Question: ${question}

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Postures:
${postures.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Judge Verdict:
${verdictText}

Debater Arguments:
${argumentsText}

Generate a comprehensive debate report including:
1. Executive summary (2-3 paragraphs)
2. Ranked postures with scores
3. Validated insights (novel, actionable findings)
4. Controversial points (areas of disagreement)
5. 5-7 recommended next reads (generate realistic academic/research URLs)
6. Appendix with key claims and scoring table
7. A markdown version of the entire report for human reading`;

    const response = await this.callOpenAIWithJsonResponse<DebateReport>(
      [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      systemPrompt
    );

    // Ensure all required fields are present
    response.question = question;
    response.topics = topics;
    response.postures = postures;
    response.appendix.scoringTable = verdict.perDebater;

    return response;
  }

  private generateMarkdown(report: Partial<DebateReport>): string {
    const md: string[] = [];

    md.push(`# Debate Report: ${report.question}\n`);

    md.push(`## Executive Summary\n`);
    md.push(`${report.summary}\n`);

    md.push(`## Topics Covered\n`);
    report.topics?.forEach((topic, i) => {
      md.push(`${i + 1}. ${topic}`);
    });
    md.push("");

    md.push(`## Posture Rankings\n`);
    report.rankedPostures?.forEach((rp, i) => {
      md.push(`${i + 1}. **${rp.posture}** - Score: ${rp.score.toFixed(3)}`);
    });
    md.push("");

    md.push(`## Validated Insights\n`);
    report.validatedInsights?.forEach((insight) => {
      md.push(`- ${insight}`);
    });
    md.push("");

    md.push(`## Controversial Points\n`);
    report.controversialPoints?.forEach((point) => {
      md.push(`- ${point}`);
    });
    md.push("");

    md.push(`## Recommended Next Reads\n`);
    report.recommendedNextReads?.forEach((read, i) => {
      md.push(`${i + 1}. [${read.title}](${read.url})`);
      md.push(`   ${read.snippet}\n`);
    });

    md.push(`## Appendix\n`);
    md.push(`### Key Claims by Posture\n`);
    report.appendix?.perDebaterKeyClaims?.forEach((debater) => {
      md.push(`#### ${debater.posture}\n`);
      debater.claims.forEach((claim) => {
        md.push(`- **${claim.topic}**: ${claim.claim}`);
      });
      md.push("");
    });

    return md.join("\n");
  }
}

