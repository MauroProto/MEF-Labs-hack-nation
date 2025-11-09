/**
 * Test script for the MAS Debate System
 * 
 * Usage: tsx src/scripts/testMasDebate.ts
 */

import dotenv from 'dotenv';
import { DebateCoordinator } from '../services/debate/DebateCoordinator';
import { Paper } from '../types/debate.types';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

dotenv.config();

async function testMasDebate() {
  console.log('🚀 Testing MAS Debate System\n');

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Load the actual paper.pdf
  console.log('📄 Loading paper.pdf...');
  const pdfPath = path.join(process.cwd(), '..', 'paper.pdf');
  
  let paperText: string;
  let paperTitle: string;
  
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);
    paperText = pdfData.text;
    paperTitle = 'Research Paper from paper.pdf';
    console.log(`✅ Loaded paper: ${Math.round(paperText.length / 1000)}k characters\n`);
  } catch (error) {
    console.error('❌ Error loading paper.pdf:', error);
    console.log('📝 Using fallback sample paper instead\n');
    
    // Fallback to sample paper if PDF loading fails
    paperTitle = 'Attention Is All You Need';
    paperText = `
Abstract:
The dominant sequence transduction models are based on complex recurrent or convolutional neural networks 
that include an encoder and a decoder. The best performing models also connect the encoder and decoder 
through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely 
on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine 
translation tasks show these models to be superior in quality while being more parallelizable and requiring 
significantly less time to train.

Introduction:
Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have 
been firmly established as state of the art approaches in sequence modeling and transduction problems such 
as language modeling and machine translation. Numerous efforts have since continued to push the boundaries 
of recurrent language models and encoder-decoder architectures.

Recurrent models typically factor computation along the symbol positions of the input and output sequences. 
Aligning the positions to steps in computation time, they generate a sequence of hidden states ht, as a 
function of the previous hidden state ht−1 and the input for position t. This inherently sequential nature 
precludes parallelization within training examples, which becomes critical at longer sequence lengths, as 
memory constraints limit batching across examples.

The Transformer Model:
The Transformer follows this overall architecture using stacked self-attention and point-wise, fully 
connected layers for both the encoder and decoder. The encoder is composed of a stack of N = 6 identical 
layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second 
is a simple, position-wise fully connected feed-forward network.

Results:
On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best 
previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art 
BLEU score of 28.4. On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score 
of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost.

Conclusion:
In this work, we presented the Transformer, the first sequence transduction model based entirely on 
attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with 
multi-headed self-attention. For translation tasks, the Transformer can be trained significantly faster 
than architectures based on recurrent or convolutional layers.
    `.trim();
  }

  // Create paper object
  const samplePaper: Paper = {
    id: 'test-paper-1',
    title: paperTitle,
    text: paperText,
  };

  const coordinator = new DebateCoordinator();

  try {
    // Test 1: Generate Questions
    console.log('📝 Step 1: Generating questions from paper...');
    const questions = await coordinator.generateQuestions(samplePaper);
    console.log(`✅ Generated ${questions.length} questions:\n`);
    questions.forEach((q, i) => {
      console.log(`${i + 1}. ${q}`);
    });
    console.log();

    // Select first question for debate
    const selectedQuestion = questions[0] || "What are the key limitations of the Transformer architecture?";
    console.log(`🎯 Selected question for debate: "${selectedQuestion}"\n`);

    // Test 2: Generate Postures and Topics
    console.log('🎭 Step 2: Generating postures and topics...');
    const { postures, topics } = await coordinator.generatePosturesAndTopics(
      samplePaper,
      selectedQuestion,
      3
    );
    console.log(`✅ Generated ${postures.length} postures:`);
    postures.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
    console.log(`\n✅ Generated ${topics.length} topics:`);
    topics.forEach((t, i) => {
      console.log(`${i + 1}. ${t}`);
    });
    console.log();

    // Test 3: Run Debate
    console.log('⚔️  Step 3: Running debate with 3 debaters...');
    const debaterArguments = await coordinator.runDebate(
      samplePaper,
      selectedQuestion,
      topics,
      postures
    );
    console.log(`✅ Debate complete! Received ${debaterArguments.length} arguments\n`);

    // Display debate arguments
    console.log('='.repeat(80));
    console.log('DEBATE ARGUMENTS');
    console.log('='.repeat(80));
    debaterArguments.forEach((arg, i) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`DEBATER ${i + 1}: ${arg.posture}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`\nOverall Position: ${arg.overallPosition}\n`);
      
      arg.perTopic.forEach((topicArg, j) => {
        console.log(`\n📌 Topic ${j + 1}: ${topicArg.topic}`);
        console.log(`   Claim: ${topicArg.claim}`);
        console.log(`   Reasoning: ${topicArg.reasoning}`);
        
        // Show paper citations
        if (topicArg.cites.paper && topicArg.cites.paper.length > 0) {
          console.log(`\n   📚 Paper Citations (${topicArg.cites.paper.length}):`);
          topicArg.cites.paper.forEach((cite, k) => {
            console.log(`      ${k + 1}. [${cite.chunkId}] (score: ${cite.score.toFixed(2)})`);
            console.log(`         "${cite.text.slice(0, 150)}${cite.text.length > 150 ? '...' : ''}"`);
          });
        }
        
        // Show web citations
        if (topicArg.cites.web && topicArg.cites.web.length > 0) {
          console.log(`\n   🌐 Web Citations (${topicArg.cites.web.length}):`);
          topicArg.cites.web.forEach((cite, k) => {
            console.log(`      ${k + 1}. ${cite.title}`);
            console.log(`         URL: ${cite.url}`);
            console.log(`         Snippet: "${cite.snippet.slice(0, 150)}${cite.snippet.length > 150 ? '...' : ''}"`);
          });
        }
      });
      console.log();
    });
    console.log('='.repeat(80) + '\n');

    // Test 4: Judge Debate
    console.log('⚖️  Step 4: Judging arguments...');
    const verdict = await coordinator.judgeDebate(
      selectedQuestion,
      topics,
      debaterArguments
    );
    console.log(`✅ Judging complete!`);
    console.log(`   Best posture: ${verdict.bestOverall}`);
    console.log(`   Insights: ${verdict.insights.length}\n`);

    // Display judge's detailed verdict
    console.log('='.repeat(80));
    console.log('JUDGE\'S VERDICT');
    console.log('='.repeat(80));
    
    verdict.perDebater.forEach((debaterScore, i) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`DEBATER: ${debaterScore.posture}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`\nWeighted Total Score: ${debaterScore.totals.weighted.toFixed(3)}`);
      console.log(`\nScores by Criterion:`);
      Object.entries(debaterScore.totals.byCriterion).forEach(([criterion, score]) => {
        console.log(`  - ${criterion}: ${score.toFixed(3)}`);
      });
      
      console.log(`\nPer-Topic Scores:`);
      debaterScore.perTopic.forEach((topicScore, j) => {
        console.log(`\n  📌 Topic: ${topicScore.topic}`);
        console.log(`     Scores:`);
        Object.entries(topicScore.scores).forEach(([criterion, score]) => {
          console.log(`       - ${criterion}: ${score.toFixed(2)}`);
        });
        console.log(`     Notes: ${topicScore.notes}`);
      });
      console.log();
    });

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🏆 BEST OVERALL POSTURE: ${verdict.bestOverall}`);
    console.log(`${'─'.repeat(80)}`);
    
    console.log(`\n💡 KEY INSIGHTS:`);
    verdict.insights.forEach((insight, i) => {
      console.log(`${i + 1}. ${insight}`);
    });
    
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 5: Generate Report
    console.log('📊 Step 5: Generating final report...');
    const report = await coordinator.generateReport(
      selectedQuestion,
      topics,
      postures,
      debaterArguments,
      verdict
    );
    console.log(`✅ Report generated!\n`);

    // Display report summary
    console.log('=' .repeat(80));
    console.log('DEBATE REPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nQuestion: ${report.question}`);
    console.log(`\nSummary:\n${report.summary}`);
    console.log(`\nRanked Postures:`);
    report.rankedPostures.forEach((rp, i) => {
      console.log(`${i + 1}. ${rp.posture} (Score: ${rp.score.toFixed(3)})`);
    });
    console.log(`\nValidated Insights:`);
    report.validatedInsights.forEach((insight, i) => {
      console.log(`${i + 1}. ${insight}`);
    });
    console.log(`\nControversial Points:`);
    report.controversialPoints.forEach((point, i) => {
      console.log(`${i + 1}. ${point}`);
    });
    console.log('\n' + '='.repeat(80));

    // Save report to file
    const outputPath = path.join(process.cwd(), 'test-debate-report.json');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);

    // Save markdown version
    const markdownPath = path.join(process.cwd(), 'test-debate-report.md');
    await fs.writeFile(markdownPath, report.markdown);
    console.log(`💾 Markdown report saved to: ${markdownPath}`);

    console.log('\n✅ All tests passed successfully!');
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testMasDebate();

