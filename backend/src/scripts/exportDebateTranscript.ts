/**
 * Export Full Debate Transcript
 *
 * Exports the complete debate with all exchanges to a readable markdown file
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

async function exportDebateTranscript() {
  console.log('='.repeat(80));
  console.log('EXPORTING FULL DEBATE TRANSCRIPT');
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

    console.log(`\n✅ Found session: ${session.id}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Rounds: ${session.transcript?.rounds?.length || 0}`);

    // Build markdown content
    let markdown = '';

    // Header
    markdown += `# Complete Debate Transcript\n\n`;
    markdown += `**Session ID**: \`${session.id}\`\n`;
    markdown += `**Status**: ${session.status}\n`;
    markdown += `**Created**: ${session.createdAt.toISOString()}\n`;
    markdown += `**Updated**: ${session.updatedAt.toISOString()}\n\n`;
    markdown += `---\n\n`;

    // Research Analysis
    markdown += `## Original Research Analysis\n\n`;
    markdown += `\`\`\`\n${session.researchAnalysis.substring(0, 2000)}...\n\`\`\`\n\n`;
    markdown += `---\n\n`;

    // Postures
    markdown += `## Debate Postures\n\n`;
    session.postures.forEach((posture, i) => {
      markdown += `### ${i + 1}. ${posture.perspectiveTemplate} (${posture.debaterId})\n\n`;
      markdown += `**Topics**:\n`;
      const topics = posture.topics as string[];
      topics.forEach((topic) => {
        markdown += `- ${topic}\n`;
      });
      markdown += `\n`;
      markdown += `**Initial Position**:\n`;
      markdown += `> ${posture.initialPosition}\n\n`;
      markdown += `**Guiding Questions**:\n`;
      const questions = posture.guidingQuestions as string[];
      questions.forEach((q, idx) => {
        markdown += `${idx + 1}. ${q}\n`;
      });
      markdown += `\n`;
    });

    markdown += `---\n\n`;

    // Transcript
    if (session.transcript && session.transcript.rounds) {
      const metadata = session.transcript.metadata as any;
      markdown += `## Debate Transcript\n\n`;
      markdown += `**Start Time**: ${metadata.startTime}\n`;
      markdown += `**End Time**: ${metadata.endTime}\n`;
      markdown += `**Total Exchanges**: ${metadata.totalExchanges}\n`;
      markdown += `**Duration**: ${Math.round((new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime()) / 1000)}s\n\n`;

      // Each round
      session.transcript.rounds.forEach((round) => {
        markdown += `### Round ${round.roundNumber}: ${round.roundType.replace('_', ' ').toUpperCase()}\n\n`;
        markdown += `**Started**: ${round.startTime.toISOString()}\n`;
        if (round.endTime) {
          markdown += `**Ended**: ${round.endTime.toISOString()}\n`;
          const duration = Math.round((round.endTime.getTime() - round.startTime.getTime()) / 1000);
          markdown += `**Duration**: ${duration}s\n`;
        }
        markdown += `**Exchanges**: ${round.exchanges?.length || 0}\n\n`;

        // Each exchange
        if (round.exchanges) {
          round.exchanges.forEach((exchange, idx) => {
            markdown += `#### Exchange ${idx + 1}: ${exchange.type.toUpperCase()}\n\n`;
            markdown += `**From**: ${exchange.from}\n`;
            if (exchange.to) {
              markdown += `**To**: ${exchange.to}\n`;
            }
            markdown += `**Timestamp**: ${exchange.timestamp.toISOString()}\n`;

            const topics = exchange.topics as string[];
            if (topics && topics.length > 0) {
              markdown += `**Topics**: ${topics.join(', ')}\n`;
            }

            markdown += `\n**Content**:\n\n`;
            markdown += `${exchange.content}\n\n`;
            markdown += `---\n\n`;
          });
        }
      });
    }

    // Judge Verdict
    if (session.verdict) {
      markdown += `## Judge Verdict\n\n`;
      markdown += `**Judge**: ${session.verdict.judgeId}\n`;
      markdown += `**Confidence**: ${(session.verdict.confidence * 100).toFixed(0)}%\n`;
      markdown += `**Timestamp**: ${session.verdict.timestamp.toISOString()}\n\n`;

      // Criteria
      markdown += `### Evaluation Criteria\n\n`;
      const criteriaData = session.verdict.criteria as any;
      const criteria = Array.isArray(criteriaData) ? criteriaData : [];

      if (criteria.length > 0) {
        criteria.forEach((c) => {
          markdown += `- **${c.name}**: ${(c.weight * 100).toFixed(0)}% weight\n`;
        });
      } else {
        markdown += `*No criteria data available*\n`;
      }
      markdown += `\n`;

      // Scores
      markdown += `### Scores by Debater\n\n`;
      const scores = session.verdict.scores as any;

      // Calculate weighted scores for ranking
      const debaterScores: { debater: string; weighted: number; breakdown: any }[] = [];
      Object.entries(scores).forEach(([debater, scoreBreakdown]: [string, any]) => {
        let weightedScore = 0;
        if (criteria.length > 0) {
          criteria.forEach((c) => {
            const score = scoreBreakdown[c.name] || 0;
            weightedScore += score * c.weight;
          });
        }
        debaterScores.push({ debater, weighted: weightedScore, breakdown: scoreBreakdown });
      });

      // Sort by weighted score
      debaterScores.sort((a, b) => b.weighted - a.weighted);

      debaterScores.forEach((ds, rank) => {
        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉';
        markdown += `#### ${medal} ${rank + 1}. ${ds.debater} - ${Math.round(ds.weighted)}/100\n\n`;
        markdown += `**Breakdown**:\n`;
        if (criteria.length > 0) {
          criteria.forEach((c) => {
            const score = ds.breakdown[c.name] || 0;
            markdown += `- ${c.name}: ${score}/100 (weighted: ${(score * c.weight).toFixed(1)})\n`;
          });
        } else {
          // Show raw scores if no criteria
          Object.entries(ds.breakdown).forEach(([key, value]: [string, any]) => {
            markdown += `- ${key}: ${value}\n`;
          });
        }
        markdown += `\n`;
      });

      // Reasoning
      markdown += `### Judge's Reasoning\n\n`;
      markdown += `${session.verdict.reasoning}\n\n`;

      // Final Verdict
      markdown += `### Final Verdict\n\n`;
      markdown += `${session.verdict.verdict}\n\n`;
    }

    // Footer
    markdown += `---\n\n`;
    markdown += `*Debate transcript generated on ${new Date().toISOString()}*\n`;

    // Write to file
    const outputPath = path.join(__dirname, '../../../FULL_DEBATE_TRANSCRIPT.md');
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    console.log(`\n✅ Full transcript exported to: ${outputPath}`);
    console.log(`   File size: ${(markdown.length / 1024).toFixed(1)} KB`);
    console.log(`   Total lines: ${markdown.split('\n').length}`);

    // Also print stats
    console.log('\n📊 Transcript Statistics:');
    console.log(`   Postures: ${session.postures.length}`);
    console.log(`   Rounds: ${session.transcript?.rounds?.length || 0}`);

    const totalExchanges = session.transcript?.rounds?.reduce((sum, r) => sum + (r.exchanges?.length || 0), 0) || 0;
    console.log(`   Total Exchanges: ${totalExchanges}`);

    const totalWords = markdown.split(/\s+/).length;
    console.log(`   Total Words: ${totalWords.toLocaleString()}`);

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportDebateTranscript();
