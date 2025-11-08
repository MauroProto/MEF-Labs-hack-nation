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

    // Call OpenAI with conversation history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'No response generated.';

    return NextResponse.json({
      message: assistantMessage,
      usage: completion.usage,
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
