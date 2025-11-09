import { BaseDebateAgent } from "./BaseDebateAgent";
import {
  DebaterArgument,
  WebSearchResult,
  Paper,
} from "../../types/debate.types";
import { webSearch } from "./webSearchService";

export type FactCheckStatus = "True" | "False" | "Uncertain" | "NotApplicable";

export type CheckedClaim = {
  claim: string;
  verifiable: boolean;
  status: FactCheckStatus;
  evidence: WebSearchResult[];
  notes: string;
};

export type TopicFactCheck = {
  topic: string;
  checkedClaims: CheckedClaim[];
  topicVerdict: {
    trueCount: number;
    falseCount: number;
    uncertainCount: number;
    verifiableCount: number;
    factualScore: number;
  };
};

export type DebaterFactCheck = {
  posture: string;
  perTopic: TopicFactCheck[];
  totals: {
    meanFactualScore: number;
    trueTotal: number;
    falseTotal: number;
  };
};

export type FactCheckSummary = {
  factCheckSummary: DebaterFactCheck[];
};

export interface FactCheckRequest {
  arguments: DebaterArgument[];
  paper: Paper;
}

export class FactCheckerAgent extends BaseDebateAgent {
  /**
   * Simplified 3-stage fact-checking:
   * 1. Identify claims that need checking (pattern-based + LLM)
   * 2. Perform web searches in parallel
   * 3. Evaluate evidence together
   */
  async checkFacts(request: FactCheckRequest): Promise<FactCheckSummary> {
    const { arguments: debaterArguments } = request;
    
    console.log(`[FactChecker] Starting fact-check for ${debaterArguments.length} debaters...`);

    // STAGE 1: Identify claims to check (simple pattern matching first)
    console.log('[FactChecker] Identifying claims to fact-check...');
    const claimsToCheck = this.identifyClaimsToCheck(debaterArguments);
    console.log(`[FactChecker] Found ${claimsToCheck.length} claims to verify`);

    // STAGE 2: Perform web searches in parallel
    console.log('[FactChecker] Performing web searches...');
    const searchResults = await Promise.all(
      claimsToCheck.map(async claim => ({
        ...claim,
        results: await webSearch(claim.searchQuery, 3),
      }))
    );
    console.log(`[FactChecker] Completed ${searchResults.length} web searches`);

    // STAGE 3: Evaluate evidence
    console.log('[FactChecker] Evaluating evidence...');
    const evaluations = await this.evaluateEvidence(searchResults);

    // Build the final fact-check summary
    const factCheckSummary: DebaterFactCheck[] = debaterArguments.map((arg, debaterIndex) => {
      const debaterCheck: DebaterFactCheck = {
        posture: arg.posture,
        perTopic: [],
        totals: {
          meanFactualScore: 0,
          trueTotal: 0,
          falseTotal: 0,
        },
      };

      arg.perTopic.forEach((topicArg, topicIndex) => {
        const topicCheck: TopicFactCheck = {
          topic: topicArg.topic,
          checkedClaims: [],
          topicVerdict: {
            trueCount: 0,
            falseCount: 0,
            uncertainCount: 0,
            verifiableCount: 0,
            factualScore: 0,
          },
        };

        // Find evaluations for this topic
        const topicEvals = evaluations.filter(
          e => e.debaterIndex === debaterIndex && e.topicIndex === topicIndex
        );

        if (topicEvals.length === 0) {
          // No claims to check for this topic
          topicCheck.checkedClaims.push({
            claim: topicArg.claim.slice(0, 200),
            verifiable: false,
            status: "NotApplicable",
            evidence: [],
            notes: "Claim is supported by paper or is theoretical/opinion-based",
          });
        } else {
          topicEvals.forEach(evaluation => {
            topicCheck.checkedClaims.push({
              claim: evaluation.claim.slice(0, 200),
              verifiable: evaluation.verifiable,
              status: evaluation.status,
              evidence: evaluation.evidence,
              notes: evaluation.notes,
            });

            if (evaluation.verifiable) {
              topicCheck.topicVerdict.verifiableCount++;
              if (evaluation.status === "True") {
                topicCheck.topicVerdict.trueCount++;
              } else if (evaluation.status === "False") {
                topicCheck.topicVerdict.falseCount++;
              } else {
                topicCheck.topicVerdict.uncertainCount++;
              }
            }
          });
        }

        if (topicCheck.topicVerdict.verifiableCount > 0) {
          topicCheck.topicVerdict.factualScore =
            (topicCheck.topicVerdict.trueCount + topicCheck.topicVerdict.uncertainCount * 0.5) /
            topicCheck.topicVerdict.verifiableCount;
        }

        debaterCheck.perTopic.push(topicCheck);
      });

      // Calculate debater totals
      const totalVerifiable = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.verifiableCount, 0);
      const totalTrue = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.trueCount, 0);
      const totalFalse = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.falseCount, 0);

      debaterCheck.totals.trueTotal = totalTrue;
      debaterCheck.totals.falseTotal = totalFalse;
      if (totalVerifiable > 0) {
        const totalUncertain = debaterCheck.perTopic.reduce((sum, tc) => sum + tc.topicVerdict.uncertainCount, 0);
        debaterCheck.totals.meanFactualScore = (totalTrue + totalUncertain * 0.5) / totalVerifiable;
      }

      return debaterCheck;
    });

    console.log(`[FactChecker] Fact-check complete!`);
    
    return { factCheckSummary };
  }

  /**
   * STAGE 1: Identify claims that need fact-checking (pattern matching)
   */
  private identifyClaimsToCheck(
    debaterArguments: DebaterArgument[]
  ): Array<{
    debaterIndex: number;
    topicIndex: number;
    claim: string;
    searchQuery: string;
  }> {
    const claims: Array<{
      debaterIndex: number;
      topicIndex: number;
      claim: string;
      searchQuery: string;
    }> = [];

    debaterArguments.forEach((arg, debaterIdx) => {
      arg.perTopic.forEach((topic, topicIdx) => {
        const text = `${topic.claim} ${topic.reasoning}`.toLowerCase();
        
        // Pattern matching for verifiable claims
        const needsCheck = 
          // Statistics and numbers
          /\d+%|\d+\.\d+|\d+ score|\d+ percent|\d+ point/i.test(text) ||
          // Research references
          /(empirical|studies show|research indicates?|experiments? (show|demonstrate)|findings|evidence)/i.test(text) ||
          // Performance/comparative claims
          /(outperform|superior|better than|improve|increase|decrease|gain|loss|enhance)/i.test(text) ||
          // External references
          /(according to|cite|reference|demonstrates?|shows? that)/i.test(text);

        if (needsCheck) {
          // Create a focused search query from the claim
          const searchQuery = topic.claim
            .replace(/["']/g, '')
            .replace(/\s+/g, ' ')
            .slice(0, 120)
            .trim();
          
          claims.push({
            debaterIndex: debaterIdx,
            topicIndex: topicIdx,
            claim: topic.claim,
            searchQuery: searchQuery || topic.claim.slice(0, 100),
          });
        }
      });
    });

    return claims;
  }

  /**
   * STAGE 3: Evaluate evidence with LLM analysis
   */
  private async evaluateEvidence(
    searchResults: Array<{
      debaterIndex: number;
      topicIndex: number;
      claim: string;
      searchQuery: string;
      results: WebSearchResult[];
    }>
  ): Promise<Array<{
    debaterIndex: number;
    topicIndex: number;
    claim: string;
    verifiable: boolean;
    status: FactCheckStatus;
    evidence: WebSearchResult[];
    notes: string;
  }>> {
    if (searchResults.length === 0) {
      return [];
    }

    // Filter to only claims with real search results
    const verifiableClaims = searchResults.filter(sr => 
      sr.results.length > 0 && sr.results[0].url !== ""
    );

    if (verifiableClaims.length === 0) {
      // No verifiable claims, return all as NotApplicable
      return searchResults.map(sr => ({
        debaterIndex: sr.debaterIndex,
        topicIndex: sr.topicIndex,
        claim: sr.claim,
        verifiable: false,
        status: "NotApplicable" as FactCheckStatus,
        evidence: [],
        notes: "No external sources found",
      }));
    }

    // Evaluate claims in batches to avoid prompt length issues
    const batchSize = 5;
    const evaluations: Array<{
      debaterIndex: number;
      topicIndex: number;
      claim: string;
      verifiable: boolean;
      status: FactCheckStatus;
      evidence: WebSearchResult[];
      notes: string;
    }> = [];

    for (let i = 0; i < verifiableClaims.length; i += batchSize) {
      const batch = verifiableClaims.slice(i, i + batchSize);
      const batchEvaluations = await this.evaluateBatch(batch);
      evaluations.push(...batchEvaluations);
    }

    // Map evaluations back to all search results
    const evaluationMap = new Map<string, typeof evaluations[0]>();
    evaluations.forEach(e => {
      const key = `${e.debaterIndex}-${e.topicIndex}`;
      evaluationMap.set(key, e);
    });

    return searchResults.map(sr => {
      const key = `${sr.debaterIndex}-${sr.topicIndex}`;
      const evaluation = evaluationMap.get(key);
      
      if (evaluation) {
        return evaluation;
      }

      // No evaluation found (no real results)
      return {
        debaterIndex: sr.debaterIndex,
        topicIndex: sr.topicIndex,
        claim: sr.claim,
        verifiable: false,
        status: "NotApplicable" as FactCheckStatus,
        evidence: [],
        notes: "No external sources found",
      };
    });
  }

  /**
   * Evaluate a batch of claims with their evidence
   */
  private async evaluateBatch(
    batch: Array<{
      debaterIndex: number;
      topicIndex: number;
      claim: string;
      searchQuery: string;
      results: WebSearchResult[];
    }>
  ): Promise<Array<{
    debaterIndex: number;
    topicIndex: number;
    claim: string;
    verifiable: boolean;
    status: FactCheckStatus;
    evidence: WebSearchResult[];
    notes: string;
  }>> {
    const prompt = `You are a fact-checker evaluating debate claims against web search evidence.

For each claim below, analyze the provided search results and determine if the claim is:
- "True": 2+ sources clearly support the claim
- "False": 2+ sources clearly contradict the claim
- "Uncertain": Mixed evidence, unclear, or insufficient sources

CLAIMS TO EVALUATE:
${batch.map((sr, idx) => `
${idx + 1}. CLAIM: "${sr.claim}"
   Search Query: "${sr.searchQuery}"
   Search Results (${sr.results.length}):
${sr.results.map((r, j) => `   ${j + 1}. "${r.title}"
      ${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? "..." : ""}
      ${r.url}`).join('\n')}
`).join('\n')}

Return JSON:
{
  "evaluations": [
    {
      "claimIndex": 0,
      "status": "True" | "False" | "Uncertain",
      "notes": "Brief explanation citing which sources support/contradict and why"
    },
    ...
  ]
}`;

    try {
      const response = await this.callOpenAIWithJsonResponse<{
        evaluations: Array<{
          claimIndex: number;
          status: FactCheckStatus;
          notes: string;
        }>;
      }>([{ role: "user", content: prompt }], this.getSystemPrompt());

      if (!response?.evaluations || response.evaluations.length !== batch.length) {
        throw new Error("Invalid evaluation response");
      }

      return batch.map((sr, idx) => {
        const evalResult = response.evaluations[idx];
        return {
          debaterIndex: sr.debaterIndex,
          topicIndex: sr.topicIndex,
          claim: sr.claim,
          verifiable: true,
          status: evalResult?.status || "Uncertain",
          evidence: sr.results.slice(0, 2),
          notes: evalResult?.notes || "Evaluation incomplete",
        };
      });
    } catch (error) {
      console.error(`[FactChecker] Error evaluating batch:`, error);
      // Return uncertain for all in batch on error
      return batch.map(sr => ({
        debaterIndex: sr.debaterIndex,
        topicIndex: sr.topicIndex,
        claim: sr.claim,
        verifiable: true,
        status: "Uncertain" as FactCheckStatus,
        evidence: sr.results.slice(0, 2),
        notes: `Error during evaluation: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }

}


