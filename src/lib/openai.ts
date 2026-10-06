import OpenAI from "openai";
import type { FlatTopic } from "./curriculum";
import type { TopicContent } from "./content";

export const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const AI_NOT_CONFIGURED =
  "AI features are not configured. Add OPENAI_API_KEY to .env.local and restart `npm run dev`.";

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Shared persona + the topic context every AI call gets. */
export function mentorInstructions(topic: FlatTopic, content: TopicContent) {
  return `You are "Backend Mentor", a senior Node.js/Express engineer who teaches beginners to become production-ready backend developers.

Teaching style:
- Explain from first principles with simple analogies, then go deep into how it works in production.
- Use modern Node.js (ES modules, async/await) and Express 5 in code examples.
- Prefer concrete code over abstract talk. Keep examples small and runnable.
- Point out common beginner mistakes and how real companies handle the topic at scale.
- When mentioning real incidents or companies, only state facts you are confident are accurate; never invent numbers.
- Format answers in GitHub-flavored Markdown with headings, short paragraphs, and fenced code blocks.

The student is currently studying:
Module: ${topic.moduleTitle}
Topic: ${topic.title}: ${topic.summary}

Practice problem they must solve: ${content.problem.title}
${content.problem.task}

Do not hand them a complete solution to the practice problem unless they explicitly ask for it; guide them with hints and partial snippets instead.`;
}

/** Turn an OpenAI streaming response into a plain-text stream for the browser. */
export function textStream(
  stream: AsyncIterable<{ type: string; delta?: unknown }>,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            controller.enqueue(encoder.encode(event.delta));
          }
        }
      } catch (err) {
        console.error("OpenAI stream failed", err);
        controller.enqueue(encoder.encode("\n\n_⚠️ The AI response was interrupted. Please try again._"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function describeOpenAIError(err: unknown): { status: number; message: string } {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) return { status: 502, message: "OpenAI rejected the API key. Check OPENAI_API_KEY." };
    if (err.status === 429) return { status: 429, message: "OpenAI rate limit or quota reached. Try again shortly." };
    if (err.status === 404) return { status: 502, message: `Model "${MODEL}" is not available to your key. Set OPENAI_MODEL.` };
    return { status: 502, message: `OpenAI error: ${err.message}` };
  }
  return { status: 500, message: "Unexpected error talking to OpenAI." };
}
