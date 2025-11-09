# Fact-Checker Agent Improvements

## Overview
The FactCheckerAgent has been significantly improved to be more intelligent and efficient in its fact-checking process.

## Key Improvements

### 1. Intelligent Claim Filtering
The fact-checker now uses an LLM to analyze each claim and determine if it actually needs verification.

**Claims that ARE checked:**
- Specific factual assertions that could be false (statistics, dates, events)
- References to external sources, studies, or real-world data not from the paper
- Claims about what "research shows" or "studies indicate" without paper citations
- Potentially verifiable facts about the real world

**Claims that are SKIPPED:**
- Purely theoretical, philosophical, or opinion-based statements
- Claims directly supported by paper citations (already verified)
- Hedging language like "may", "could", "suggests", "likely"
- Claims about the paper's own methodology or findings (internal to paper)
- Common knowledge or definitional statements

### 2. Two-Stage Verification Process

#### Stage 1: Should This Be Checked?
```typescript
shouldFactCheck(claim, reasoning) → {
  shouldCheck: boolean,
  reason: string,
  extractedClaim?: string
}
```

The LLM analyzes the claim and reasoning to determine:
- Is this verifiable?
- Does it need external verification?
- What specific claim should be verified?

#### Stage 2: Verify Against Evidence
```typescript
verifyClaimWithEvidence(claim, evidence) → {
  status: "True" | "False" | "Uncertain",
  notes: string
}
```

If verification is needed, the LLM:
- Searches the web for evidence
- Analyzes if sources support or refute the claim
- Provides a verdict with explanation

### 3. Performance Benefits

**Before:**
- Checked every single claim (24+ web searches)
- Got stuck in complex tool-calling loops
- Took 5+ minutes or timed out
- Wasted API calls on obvious claims

**After:**
- Only checks suspicious/verifiable claims (~3-5 searches)
- Completes in ~30-60 seconds
- Focused on claims that actually matter
- Provides meaningful fact-check insights

### 4. Better Logging

The fact-checker now provides clear logging:
```
[FactChecker] Skipping topic "X": Claim is theoretical/opinion-based
[FactChecker] Checking topic "Y": References empirical studies without citation
```

This makes it easy to understand what's being checked and why.

## Example Output

```
Topic: "Impact of Prompt Design on Performance"
Reason: The claim references empirical studies indicating that prompt 
        optimization enhances agent performance, which requires 
        verification of such studies and their findings.
Extracted Claim: "Empirical studies indicate that well-designed prompts 
                  yield better agent performance compared to mere 
                  topology adjustments."
Status: Uncertain
Notes: Found 3 sources. Evidence is mixed - some support prompt 
       optimization benefits, but comparative claims need more support.
```

## Technical Implementation

### Shared Web Search Service
Created `webSearchService.ts` to centralize Tavily API integration:
- Used by both `DebaterAgent` and `FactCheckerAgent`
- Handles fallback when API key is not configured
- Provides consistent logging

### LLM-Powered Analysis
Uses OpenAI's GPT-4o to:
- Understand claim context and intent
- Distinguish factual vs. opinion claims
- Extract verifiable assertions
- Analyze evidence relevance

## Future Enhancements

1. **Citation Cross-Reference**: Check if debater's paper citations actually support their claims
2. **Confidence Scoring**: Add numerical confidence scores (0-1) for each verification
3. **Source Quality Assessment**: Rank sources by reliability (.edu, .gov, peer-reviewed)
4. **Contradiction Detection**: Flag when debaters make contradictory factual claims
5. **Real-time Fact Database**: Cache verified facts to avoid redundant searches

## Configuration

Set `TAVILY_API_KEY` environment variable to enable real web search:
```bash
export TAVILY_API_KEY=your_api_key_here
```

Without it, the system will use fallback messages indicating search is not configured.

