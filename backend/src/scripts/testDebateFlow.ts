/**
 * Test Debate Flow Script
 *
 * Tests the full debate system with a real PDF:
 * 1. Extract PDF text
 * 2. Generate research analysis (simulated)
 * 3. Start debate
 * 4. Monitor progress
 * 5. Display results
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

console.log('='.repeat(80));
console.log('DEBATE SYSTEM TEST');
console.log('='.repeat(80));

const PDF_PATH = path.join(__dirname, '../../paper.pdf');
const API_BASE = 'http://localhost:4000/api';

// Step 1: Extract PDF text
async function extractPdfText(): Promise<string> {
  console.log('\n[1/5] Extracting PDF text...');

  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at: ${PDF_PATH}`);
  }

  const dataBuffer = fs.readFileSync(PDF_PATH);
  const data = await pdfParse(dataBuffer);

  const text = data.text.substring(0, 5000); // First 5000 chars for testing

  console.log(`✓ Extracted ${data.text.length} characters from PDF`);
  console.log(`✓ Using first 5000 chars for analysis`);
  console.log(`✓ Title: ${data.info?.Title || 'Unknown'}`);
  console.log(`✓ Pages: ${data.numpages}`);

  return text;
}

// Step 2: Simulate researcher analysis
function generateResearchAnalysis(pdfText: string): string {
  console.log('\n[2/5] Generating research analysis (simulated)...');

  // In production, this would call the researcher agent
  // For testing, we create a structured analysis
  const analysis = `# Research Paper Analysis

## Paper Overview
This document analyzes a research paper extracted from the provided PDF.

## Key Content Extract
${pdfText.substring(0, 1500)}...

## Preliminary Assessment

### Methodology
The paper appears to present research findings with structured methodology. Analysis of the full document would reveal specific research methods, data collection approaches, and analytical frameworks employed.

### Main Claims
Based on the excerpt, the paper makes several key claims that warrant detailed examination through multi-perspective debate.

### Areas for Discussion
1. **Methodological Rigor**: Evaluation of research design and implementation
2. **Evidence Quality**: Assessment of data sources and analytical validity
3. **Theoretical Contribution**: Integration with existing scholarly work
4. **Practical Implications**: Real-world applicability and impact

This analysis provides the foundation for structured academic debate examining the paper's contributions, limitations, and broader significance.`;

  console.log('✓ Research analysis generated');
  console.log(`✓ Analysis length: ${analysis.length} characters`);

  return analysis;
}

// Step 3: Start debate
async function startDebate(researchAnalysis: string): Promise<string> {
  console.log('\n[3/5] Starting debate...');

  const response = await fetch(`${API_BASE}/debate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      researchAnalysis,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Debate start failed: ${error}`);
  }

  const result = await response.json();

  console.log('✓ Debate session created');
  console.log(`✓ Session ID: ${result.sessionId}`);
  console.log(`✓ Status: ${result.status}`);
  console.log('\n📋 Generated Postures:');

  result.postures.forEach((p: any, i: number) => {
    console.log(`\n  Posture ${i + 1}: ${p.perspectiveTemplate}`);
    console.log(`  Debater: ${p.debaterId}`);
    console.log(`  Topics: ${p.topics.join(', ')}`);
    console.log(`  Position: ${p.initialPosition.substring(0, 100)}...`);
  });

  return result.sessionId;
}

// Step 4: Monitor debate progress
async function monitorDebate(sessionId: string): Promise<void> {
  console.log('\n[4/5] Monitoring debate progress...');
  console.log('⏳ Debate is running asynchronously...\n');

  let lastStatus = '';
  let lastRound = 0;
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (5 sec intervals)

  while (attempts < maxAttempts) {
    await sleep(5000); // Poll every 5 seconds
    attempts++;

    const response = await fetch(`${API_BASE}/debate/${sessionId}`);
    const session = await response.json();

    // Status change
    if (session.status !== lastStatus) {
      console.log(`\n📍 Status: ${lastStatus} → ${session.status}`);
      lastStatus = session.status;
    }

    // Round progress
    if (session.currentRound && session.currentRound !== lastRound) {
      console.log(`🔄 Round ${session.currentRound}/4 in progress...`);
      lastRound = session.currentRound;
    }

    // Check if complete
    if (session.status === 'completed') {
      console.log('\n✓ Debate completed!');
      displayResults(session);
      break;
    }

    // Check if error
    if (session.status === 'error') {
      console.error('\n❌ Debate failed!');
      if (session.transcript?.metadata?.errorMessage) {
        console.error(`Error: ${session.transcript.metadata.errorMessage}`);
      }
      break;
    }

    // Progress indicator
    if (attempts % 6 === 0) { // Every 30 seconds
      console.log(`⏱️  ${Math.floor(attempts * 5 / 60)}m ${(attempts * 5) % 60}s elapsed...`);
    }
  }

  if (attempts >= maxAttempts) {
    console.warn('\n⚠️  Timeout reached. Debate may still be running.');
  }
}

// Step 5: Display results
function displayResults(session: any): void {
  console.log('\n[5/5] Debate Results');
  console.log('='.repeat(80));

  if (session.transcript) {
    const { transcript } = session;

    console.log(`\n📊 Debate Statistics:`);
    console.log(`  Duration: ${getDebateDuration(transcript)}`);
    console.log(`  Total Exchanges: ${transcript.metadata.totalExchanges}`);
    console.log(`  Rounds Completed: ${transcript.rounds?.length || 0}`);

    // Show exchanges per round
    console.log(`\n📝 Exchange Breakdown:`);
    transcript.rounds?.forEach((round: any) => {
      console.log(`  Round ${round.roundNumber} (${round.roundType}): ${round.exchanges?.length || 0} exchanges`);
    });

    // Sample exchanges
    console.log(`\n💬 Sample Exchanges (First 3):`);
    const allExchanges = transcript.rounds?.flatMap((r: any) => r.exchanges) || [];
    allExchanges.slice(0, 3).forEach((ex: any, i: number) => {
      console.log(`\n  Exchange ${i + 1} [${ex.type.toUpperCase()}]`);
      console.log(`  From: ${ex.from} ${ex.to ? `→ ${ex.to}` : ''}`);
      console.log(`  Content: ${ex.content.substring(0, 200)}...`);
    });
  }

  if (session.verdict) {
    const { verdict } = session;

    console.log(`\n⚖️  Judge Verdict:`);
    console.log(`  Judge: ${verdict.judgeId}`);
    console.log(`  Confidence: ${(verdict.confidence * 100).toFixed(0)}%`);

    console.log(`\n🏆 Scores:`);
    const weightedScores = calculateWeightedScores(verdict);
    Object.entries(weightedScores).forEach(([debater, score]) => {
      console.log(`  ${debater}: ${score}/100`);
    });

    // Determine winner
    const winner = Object.entries(weightedScores).reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    );
    console.log(`\n🥇 Winner: ${winner[0]} (${winner[1]}/100)`);

    console.log(`\n📜 Verdict Summary:`);
    console.log(`  ${verdict.verdict.substring(0, 300)}...`);

    if (verdict.reasoning) {
      console.log(`\n💭 Reasoning (excerpt):`);
      console.log(`  ${verdict.reasoning.substring(0, 400)}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE ✓');
  console.log('='.repeat(80));
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDebateDuration(transcript: any): string {
  if (!transcript.metadata?.startTime || !transcript.metadata?.endTime) {
    return 'Unknown';
  }

  const start = new Date(transcript.metadata.startTime);
  const end = new Date(transcript.metadata.endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  return `${diffMins}m ${diffSecs}s`;
}

function calculateWeightedScores(verdict: any): Record<string, number> {
  const criteria = [
    { name: 'Evidence Quality', weight: 0.3 },
    { name: 'Logical Coherence', weight: 0.25 },
    { name: 'Topic Coverage', weight: 0.25 },
    { name: 'Response Quality', weight: 0.2 },
  ];

  const weightedScores: Record<string, number> = {};

  for (const [debaterId, scores] of Object.entries(verdict.scores)) {
    let totalScore = 0;

    for (const criterion of criteria) {
      const score = (scores as any)[criterion.name] || 0;
      totalScore += score * criterion.weight;
    }

    weightedScores[debaterId] = Math.round(totalScore);
  }

  return weightedScores;
}

// Main execution
async function main() {
  try {
    // Step 1: Extract PDF
    const pdfText = await extractPdfText();

    // Step 2: Generate analysis
    const researchAnalysis = generateResearchAnalysis(pdfText);

    // Step 3: Start debate
    const sessionId = await startDebate(researchAnalysis);

    // Step 4: Monitor progress
    await monitorDebate(sessionId);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };
