import { Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatWithPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { messages, paperContext } = req.body as {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      paperContext?: {
        id: string;
        title: string;
        abstract?: string | null;
        fullText?: string;
        metadata?: { fileBase64?: string; fileMime?: string; fileSize?: number };
      } | null;
    };

    let contextText = paperContext?.fullText || '';

    // If we don't have enough text and a file was provided, parse it server-side
    if ((!contextText || contextText.length < 500) && paperContext?.metadata?.fileBase64) {
      try {
        const pdfBuffer = Buffer.from(paperContext.metadata.fileBase64, 'base64');
        const parsed = await pdfParse(pdfBuffer);
        contextText = parsed.text || contextText;
      } catch (err) {
        console.warn('[chatWithPaper] Failed to parse base64 PDF:', err);
      }
    }

    // Cap context to avoid overlong prompts (approx chars)
    const MAX_CHARS = 16000;
    if (contextText.length > MAX_CHARS) {
      contextText = contextText.slice(0, MAX_CHARS);
    }

    const systemPrompt = `You are a helpful research assistant. Use the provided paper context to answer.
If the question cannot be answered from the context, say so. Provide citations to sections when possible.`;

    const userQuestion = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';

    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Paper Title: ${paperContext?.title || 'Unknown'}\n\nContext:\n${contextText}\n\nQuestion:\n${userQuestion}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.2,
      max_tokens: 800,
    });

    const message = completion.choices?.[0]?.message?.content || 'No response';
    res.json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

