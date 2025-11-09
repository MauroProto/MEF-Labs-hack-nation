/**
 * Chat API Route
 *
 * Handles LLM chat requests with paper context and conversation memory
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, paperContext, debateContext, chatContext } = await request.json();

    // Debug logging
    console.log('[Chat API] Request received');
    console.log('[Chat API] Has paperContext:', !!paperContext);
    console.log('[Chat API] Has debateContext:', !!debateContext);
    if (debateContext) {
      console.log('[Chat API] Debate questions:', debateContext.questions?.length);
      console.log('[Chat API] Markdown length:', debateContext.markdown?.length);
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Build system message with paper context and/or debate context and/or chat context
    let systemContent = 'You are a helpful research assistant.';

    // Add paper context if available
    if (paperContext) {
      systemContent = `You are a helpful research assistant analyzing the following paper:

Title: ${paperContext.title}
Authors: ${paperContext.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}
${paperContext.abstract ? `Abstract: ${paperContext.abstract}` : ''}

Full text excerpt:
${paperContext.fullText?.substring(0, 3000) || ''}`;
    }

    // Add debate context if available (takes priority over paper context for specificity)
    if (debateContext) {
      systemContent = `You are a helpful research assistant with access to a complete multi-agent debate about a research paper.

The debate covered the following questions:
${debateContext.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

## Full Debate Transcript

${debateContext.markdown}

---

Use this debate transcript to answer questions. You have access to:
- All arguments from multiple AI agents with different perspectives
- Q&A rounds between the debaters
- Judge evaluations and scores
- Final rankings and consensus findings

Provide comprehensive answers based on the debate content. Reference specific arguments, counterarguments, and evidence from the transcript when relevant.`;
    }

    // Add chat context from upstream conversations if available
    if (chatContext && Array.isArray(chatContext) && chatContext.length > 0) {
      systemContent += `\n\n## Previous Conversations Context

You have access to ${chatContext.length} previous conversation${chatContext.length > 1 ? 's' : ''} that provide relevant context. Use this information to build upon previous discussions and provide more informed responses.

`;

      // Add each upstream conversation
      chatContext.forEach((conv: any, index: number) => {
        systemContent += `### Previous Conversation ${index + 1}${conv.paperContext ? ` (about: ${conv.paperContext.title})` : ''}\n`;

        // Include the last few messages from each conversation (limit to avoid token overflow)
        const recentMessages = conv.messages.slice(-6); // Last 6 messages (3 exchanges)
        recentMessages.forEach((msg: any) => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          const content = msg.content.substring(0, 500); // Limit message length
          systemContent += `**${role}:** ${content}${msg.content.length > 500 ? '...' : ''}\n\n`;
        });

        systemContent += '\n';
      });
    }

    systemContent += '\n\nPlease answer questions accurately and helpfully, building upon the context provided. Format your responses in markdown.';

    const systemMessage = {
      role: 'system' as const,
      content: systemContent,
    };

    // Call OpenAI with streaming enabled
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error.message
      },
      { status: 500 }
    );
  }
}
