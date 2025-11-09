import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 600000, // 10 minutes for long-running research
});

export async function POST(request: NextRequest) {
  const { query, paperContext, paperId, chatContext } = await request.json();

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Query is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Optionally enrich with paper context (from client or by fetching backend by paperId)
        let contextText = '';
        let contextTitle = '';

        try {
          let ctx = paperContext as any;
          if (!ctx && paperId) {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';
            const resp = await fetch(`${apiBase}/api/papers/${paperId}`);
            if (resp.ok) {
              const json = await resp.json();
              ctx = json?.data;
            }
          }

          if (ctx) {
            contextTitle = ctx.title || '';
            const full = ctx.fullText || '';
            const abstract = ctx.abstract || '';
            // Cap context for prompt size
            const MAX = 16000;
            const merged = (abstract + '\n\n' + full).slice(0, MAX);
            contextText = merged;
          }
        } catch (err) {
          console.warn('[web-search] Failed to attach paper context:', err);
        }

        // Build chat context section
        let chatContextText = '';
        if (chatContext && Array.isArray(chatContext) && chatContext.length > 0) {
          chatContextText = `\n\n## Previous Conversations Context\n\nYou have access to ${chatContext.length} previous conversation${chatContext.length > 1 ? 's' : ''} that provide relevant context:\n\n`;

          chatContext.forEach((conv: any, index: number) => {
            chatContextText += `### Previous Conversation ${index + 1}${conv.paperContext ? ` (about: ${conv.paperContext.title})` : ''}\n`;

            // Include recent messages (limit to avoid token overflow)
            const recentMessages = conv.messages.slice(-4); // Last 4 messages (2 exchanges)
            recentMessages.forEach((msg: any) => {
              const role = msg.role === 'user' ? 'User' : 'Assistant';
              const content = msg.content.substring(0, 400); // Limit message length
              chatContextText += `**${role}:** ${content}${msg.content.length > 400 ? '...' : ''}\n\n`;
            });

            chatContextText += '\n';
          });
        }

        const researchPrompt = `User query: ${query}\n\nPrimary Paper Context${contextTitle ? ` ("${contextTitle}")` : ''}:\n${contextText || '[No paper context provided]'}${chatContextText}\n\nInstructions:\n- Perform web research that is strictly relevant to the ${contextText ? 'paper\'s domain and' : ''} user query${chatContextText ? ' and previous conversations' : ''}.\n${contextText ? '- Prefer sources that corroborate, extend, critique, or contextualize the paper.\n' : ''}${chatContextText ? '- Build upon insights from previous conversations.\n' : ''}- Include recent, authoritative sources with inline links.\n- Extract concrete facts, statistics, methodologies, and contrasting viewpoints.\n${contextText ? '- Explain how each finding relates back to the paper.\n' : ''}- Output in markdown with clear headings (##, ###), bullet points and inline links.`;

        const completion = await openai.responses.create({
          model: 'o4-mini-deep-research-2025-06-26',
          input: researchPrompt,
          stream: true,
          tools: [{ type: 'web_search_preview' }],
        });

        for await (const chunk of completion) {
          console.log('Chunk received:', JSON.stringify(chunk, null, 2));

          // Handle completed items first (OpenAI sends actions/results in .done)
          if (chunk.type === 'response.output_item.done') {
            const item: any = (chunk as any).item;

            // Completed web search actions
            if (item?.type === 'web_search_call' && item?.action) {
              const action = item.action as any;
              let activityMessage = '';
              if (action.type === 'search') activityMessage = `🔍 Searching: "${action.query}"`;
              else if (action.type === 'open_page') activityMessage = `📄 Opening page: ${action.url}`;
              else if (action.type === 'find_in_page') activityMessage = `🔎 Searching in page: "${action.query}"`;
              if (activityMessage) {
                const data = JSON.stringify({ type: 'activity', message: activityMessage, details: action });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            // Final message content
            if (item?.type === 'message' && Array.isArray(item.content)) {
              for (const content of item.content) {
                if (content?.type === 'output_text' && content?.text) {
                  const data = JSON.stringify({ type: 'content', content: content.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
          }

          // Handle different types of output
          if (chunk.type === 'response.output_item.added') {
            const item = chunk.item;

            // Handle web search calls
            if (item.type === 'web_search_call') {
              // Only process if the action is available
              if (item.action) {
                const action = item.action;
                let activityMessage = '';

                if (action.type === 'search') {
                  activityMessage = `🔍 Searching: "${action.query}"`;
                } else if (action.type === 'open_page') {
                  activityMessage = `📄 Opening page: ${action.url}`;
                } else if (action.type === 'find_in_page') {
                  activityMessage = `🔎 Searching in page: "${action.query}"`;
                }

                if (activityMessage) {
                  const data = JSON.stringify({
                    type: 'activity',
                    message: activityMessage,
                    details: action
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } else if (item.status === 'in_progress') {
                // Just notify that research is happening
                const data = JSON.stringify({
                  type: 'activity',
                  message: '🔬 Researching...'
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            // Handle message content
            else if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text' && content.text) {
                  const data = JSON.stringify({
                    type: 'content',
                    content: content.text
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
          }
          // Handle deltas (streaming text)
          else if (chunk.type === 'response.output_item.delta') {
            const delta = chunk.delta;

            if (delta.type === 'output_text' && delta.text) {
              const data = JSON.stringify({
                type: 'content',
                content: delta.text
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          // Handle completion
          else if (chunk.type === 'response.done') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        }

        controller.close();
      } catch (error: any) {
        console.error('Web research streaming error:', error);
        const errorData = JSON.stringify({
          error: 'Research failed',
          message: error.message
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
