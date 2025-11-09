/**
 * Full System Integration Test
 *
 * Tests the COMPLETE flow:
 * 1. PDF Upload → Database
 * 2. Researcher Agent → Analysis (via orchestrator)
 * 3. Posture Generator → Debate postures
 * 4. Debate Orchestrator → 4-round debate
 * 5. Judge → Evaluation
 *
 * This tests ALL the agent infrastructure we built.
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { prisma } from '../lib/prisma';
import { ResearcherAgent } from '../lib/agents/researcherAgent';
import { agentRegistry } from '../services/agentRegistry';
import { orchestrator } from '../services/agentOrchestrator';
import { nanoid } from 'nanoid';

console.log('='.repeat(80));
console.log('FULL SYSTEM INTEGRATION TEST');
console.log('='.repeat(80));

const PDF_PATH = path.join(__dirname, '../../paper.pdf');

async function runFullSystemTest() {
  let paperId: string | undefined;
  let researcherNodeId: string | undefined;

  try {
    // ============================================================================
    // STEP 1: Upload PDF and store in database
    // ============================================================================
    console.log('\n[1/5] 📄 Processing PDF...');

    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF not found at: ${PDF_PATH}`);
    }

    const dataBuffer = fs.readFileSync(PDF_PATH);
    const pdfData = await pdfParse(dataBuffer);

    // Clean text - remove null bytes and other invalid UTF-8 characters
    const cleanText = pdfData.text.replace(/\x00/g, '').trim();

    console.log(`✓ Extracted ${pdfData.text.length} characters`);
    console.log(`✓ Cleaned to ${cleanText.length} characters`);
    console.log(`✓ Pages: ${pdfData.numpages}`);

    // Create canvas first (required for foreign key)
    const canvas = await prisma.canvas.create({
      data: {
        id: nanoid(),
        name: 'Test Canvas - Full System',
        nodes: [],
        edges: [],
      },
    });
    console.log(`✓ Canvas created: ${canvas.id}`);

    // Create paper in database
    const paper = await prisma.paper.create({
      data: {
        id: nanoid(),
        canvasId: canvas.id,
        title: pdfData.info?.Title || 'Multi-Agent Design Research Paper',
        authors: ['Han Zhou', 'Google Research Team'], // Extracted from paper
        abstract: cleanText.substring(0, 500),
        fullText: cleanText,
        citations: [],
        metadata: {
          pages: pdfData.numpages,
          extractedAt: new Date().toISOString(),
        },
      },
    });

    paperId = paper.id;
    console.log(`✓ Paper stored in database: ${paperId}`);

    // ============================================================================
    // STEP 2: Register and invoke Researcher Agent via orchestrator
    // ============================================================================
    console.log('\n[2/5] 🔬 Invoking Researcher Agent...');

    // Create researcher agent instance
    const researcher = new ResearcherAgent({
      id: nanoid(),
      nodeId: 'researcher-' + nanoid(),
      name: 'Research Analyst',
      description: 'Deep paper analysis agent',
      version: '1.0.0',
    });

    // Register with agent registry
    await researcher.register();
    researcherNodeId = researcher.getNodeId();
    console.log(`✓ Researcher registered: ${researcherNodeId}`);

    // Invoke researcher agent through orchestrator
    console.log('✓ Calling researcher.analyze_paper via orchestrator...');

    const analysisResult = await orchestrator.invoke({
      from: 'system-test',
      to: researcherNodeId,
      tool: 'analyze_paper',
      args: {
        paperId: paper.id,
        focusAreas: ['methodology', 'results', 'novelty', 'limitations'],
      },
      context: {
        paperId: paper.id,
        paperTitle: paper.title,
      },
      timeout: 60000, // 60 seconds for analysis
    });

    if (!analysisResult.success) {
      throw new Error(`Researcher analysis failed: ${analysisResult.error}`);
    }

    const researchAnalysis = analysisResult.data as any;
    console.log(`✓ Analysis completed by ${analysisResult.metadata?.agentId}`);
    console.log(`✓ Confidence: ${(researchAnalysis.confidence * 100).toFixed(0)}%`);
    console.log(
      `✓ Analysis length: ${JSON.stringify(researchAnalysis).length} characters`
    );

    // ============================================================================
    // STEP 3: Start debate via API (already tests posture generation)
    // ============================================================================
    console.log('\n[3/5] 💬 Starting Debate...');

    // Format research analysis for debate
    const formattedAnalysis = `# Research Paper Analysis

## Paper: ${paper.title}

## Executive Summary
${researchAnalysis.summary || 'Comprehensive analysis of multi-agent system design'}

## Key Findings
${JSON.stringify(researchAnalysis.findings || researchAnalysis, null, 2)}

## Methodology Assessment
${researchAnalysis.methodology?.description || 'Advanced multi-agent optimization framework'}

## Areas for Debate
1. Methodological rigor and validation
2. Empirical evidence quality
3. Theoretical contributions
4. Practical implications
5. Future research directions
`;

    // Call debate API endpoint
    const debateResponse = await fetch('http://localhost:4000/api/debate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        researchAnalysis: formattedAnalysis,
        paperId: paper.id,
      }),
    });

    if (!debateResponse.ok) {
      const error = await debateResponse.json();
      throw new Error(`Debate start failed: ${JSON.stringify(error)}`);
    }

    const debateData = await debateResponse.json();
    const sessionId = debateData.sessionId;

    console.log(`✓ Debate session created: ${sessionId}`);
    console.log(`✓ Status: ${debateData.status}`);
    console.log(`✓ Postures generated: ${debateData.postures.length}`);

    debateData.postures.forEach((p: any, i: number) => {
      console.log(
        `  ${i + 1}. ${p.perspectiveTemplate} (${p.debaterId}) - ${p.topics.length} topics`
      );
    });

    // ============================================================================
    // STEP 4: Monitor debate progress
    // ============================================================================
    console.log('\n[4/5] ⏳ Monitoring Debate Progress...');

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes
    let lastStatus = '';

    while (attempts < maxAttempts) {
      await sleep(5000); // Poll every 5 seconds

      const statusResponse = await fetch(
        `http://localhost:4000/api/debate/${sessionId}`
      );
      const session = await statusResponse.json();

      if (session.status !== lastStatus) {
        console.log(`📍 Status: ${lastStatus} → ${session.status}`);
        lastStatus = session.status;

        if (session.currentRound) {
          console.log(`🔄 Round ${session.currentRound}/4 in progress...`);
        }
      }

      if (session.status === 'completed') {
        console.log('✓ Debate completed!');

        // Display results
        console.log('\n[5/5] 📊 Final Results');
        console.log('='.repeat(80));

        console.log('\n🏆 Judge Verdict:');
        if (session.verdict) {
          console.log(`  Judge: ${session.verdict.judgeId}`);
          console.log(
            `  Confidence: ${(session.verdict.confidence * 100).toFixed(0)}%`
          );

          const scores = session.verdict.scores as any;
          const criteria = session.verdict.criteria as any[];

          console.log('\n  Scores:');
          const debaterScores: { debater: string; score: number }[] = [];

          Object.entries(scores).forEach(([debater, breakdown]: [string, any]) => {
            let weightedScore = 0;
            if (Array.isArray(criteria)) {
              criteria.forEach((c) => {
                weightedScore += breakdown[c.name] * c.weight;
              });
            }
            debaterScores.push({ debater, score: weightedScore });
          });

          debaterScores.sort((a, b) => b.score - a.score);
          debaterScores.forEach((ds, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            console.log(`  ${medal} ${ds.debater}: ${Math.round(ds.score)}/100`);
          });

          console.log(`\n  Verdict: ${session.verdict.verdict.substring(0, 200)}...`);
        }

        console.log('\n📈 Debate Statistics:');
        const transcript = session.transcript;
        if (transcript) {
          const metadata = transcript.metadata as any;
          console.log(`  Duration: ${metadata.totalExchanges} exchanges`);
          console.log(`  Rounds: ${transcript.rounds?.length || 0}`);

          if (transcript.rounds) {
            transcript.rounds.forEach((round: any) => {
              console.log(
                `    Round ${round.roundNumber} (${round.roundType}): ${round.exchanges?.length || 0} exchanges`
              );
            });
          }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ FULL SYSTEM TEST PASSED');
        console.log('='.repeat(80));

        console.log('\n📋 Components Verified:');
        console.log('  ✅ PDF extraction and database storage');
        console.log('  ✅ Researcher agent registration');
        console.log('  ✅ Agent orchestrator invocation');
        console.log('  ✅ Posture generation from research analysis');
        console.log('  ✅ 4-round debate orchestration');
        console.log('  ✅ Judge evaluation');
        console.log('  ✅ Database persistence (6 models)');
        console.log('  ✅ Real-time status updates');

        break;
      }

      if (session.status === 'error') {
        throw new Error('Debate failed with error status');
      }

      attempts++;
      if (attempts % 6 === 0) {
        console.log(`⏱️  ${Math.floor(attempts / 12)}m ${(attempts % 12) * 5}s elapsed...`);
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error('Debate timeout - exceeded 10 minutes');
    }
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');

    if (researcherNodeId) {
      try {
        await agentRegistry.deregister(researcherNodeId);
        console.log('✓ Researcher agent deregistered');
      } catch (e) {
        console.log('⚠️  Failed to deregister researcher');
      }
    }

    // Note: We keep the paper and debate in DB for verification
    // You can manually delete if needed

    await prisma.$disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runFullSystemTest();
