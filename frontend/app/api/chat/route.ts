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
    const { messages, paperContext } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Build system message with paper context
    const systemMessage = {
      role: 'system' as const,
      content: paperContext
        ? `You are a helpful research assistant analyzing the following paper:

Title: ${paperContext.title}
Authors: ${paperContext.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}
${paperContext.abstract ? `Abstract: ${paperContext.abstract}` : ''}

Full text excerpt:
${paperContext.fullText?.substring(0, 3000) || ''}

Please answer questions about this paper accurately and helpfully. Format your responses in markdown.`
        : 'You are a helpful research assistant. Format your responses in markdown.',
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
