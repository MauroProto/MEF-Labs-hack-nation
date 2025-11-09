/**
 * Verify Debate Results
 *
 * Query the database to verify the debate was successfully stored
 */

import { prisma } from '../lib/prisma';

async function verifyDebate() {
  console.log('='.repeat(80));
  console.log('DEBATE DATABASE VERIFICATION');
  console.log('='.repeat(80));

  try {
    // Get most recent debate session
    const session = await prisma.debateSession.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        postures: true,
        transcript: {
          include: {
            rounds: {
              include: {
                exchanges: {
                  orderBy: { timestamp: 'asc' },
                },
              },
              orderBy: { roundNumber: 'asc' },
            },
          },
        },
        verdict: true,
      },
    });

    if (!session) {
      console.log('❌ No debate sessions found in database');
      return;
    }

    console.log('\n📊 Latest Debate Session:');
    console.log(`  ID: ${session.id}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Current Round: ${session.currentRound || 'N/A'}`);
    console.log(`  Created: ${session.createdAt.toISOString()}`);
    console.log(`  Updated: ${session.updatedAt.toISOString()}`);

    console.log('\n📋 Postures:');
    session.postures.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.debaterId} - ${p.perspectiveTemplate}`);
      console.log(`     Topics: ${p.topics.join(', ')}`);
    });

    if (session.transcript) {
      console.log('\n📝 Transcript:');
      console.log(`  Total Rounds: ${session.transcript.rounds?.length || 0}`);

      const metadata = session.transcript.metadata as any;
      console.log(`  Start Time: ${metadata.startTime}`);
      console.log(`  End Time: ${metadata.endTime}`);
      console.log(`  Total Exchanges: ${metadata.totalExchanges}`);

      if (session.transcript.rounds) {
        console.log('\n  Round Breakdown:');
        session.transcript.rounds.forEach((round) => {
          console.log(`    Round ${round.roundNumber} (${round.roundType}): ${round.exchanges?.length || 0} exchanges`);
        });

        console.log('\n  Sample Exchanges:');
        const allExchanges = session.transcript.rounds.flatMap(r => r.exchanges || []);
        allExchanges.slice(0, 3).forEach((ex, i) => {
          console.log(`\n    Exchange ${i + 1}:`);
          console.log(`      Type: ${ex.type}`);
          console.log(`      From: ${ex.from}${ex.to ? ` → ${ex.to}` : ''}`);
          console.log(`      Content: ${ex.content.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('\n⚠️  No transcript found');
    }

    if (session.verdict) {
      console.log('\n⚖️  Judge Verdict:');
      console.log(`  Judge: ${session.verdict.judgeId}`);
      console.log(`  Confidence: ${(session.verdict.confidence * 100).toFixed(0)}%`);

      console.log('\n  Scores:');
      const scores = session.verdict.scores as any;
      Object.entries(scores).forEach(([debater, debaterScores]: [string, any]) => {
        const criteria = session.verdict!.criteria as any[];
        let weightedScore = 0;
        criteria.forEach((c) => {
          const score = debaterScores[c.name] || 0;
          weightedScore += score * c.weight;
        });
        console.log(`    ${debater}: ${Math.round(weightedScore)}/100`);
      });

      console.log(`\n  Verdict: ${session.verdict.verdict.substring(0, 200)}...`);
    } else {
      console.log('\n⚠️  No verdict found');
    }

    console.log('\n' + '='.repeat(80));

    if (session.status === 'completed' && session.transcript && session.verdict) {
      console.log('✅ VERIFICATION PASSED - Debate completed successfully');
    } else {
      console.log(`⚠️  VERIFICATION INCOMPLETE - Status: ${session.status}`);
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyDebate();
