import { getContent } from "@/lib/content";
import { getTopic } from "@/lib/curriculum";
import {
  AI_NOT_CONFIGURED,
  MODEL,
  describeOpenAIError,
  getOpenAI,
  jsonError,
  mentorInstructions,
  textStream,
} from "@/lib/openai";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_CHARS = 8_000;

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const messages = value.slice(-MAX_MESSAGES);
  for (const m of messages) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      m.content.length === 0 ||
      m.content.length > MAX_CHARS
    ) {
      return null;
    }
  }
  if (messages[messages.length - 1].role !== "user") return null;
  return messages as ChatMessage[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: unknown; messages?: unknown } | null;
  const messages = parseMessages(body?.messages);
  if (!body || typeof body.slug !== "string" || !messages) {
    return jsonError(400, `Expected { slug, messages } with up to ${MAX_MESSAGES} messages ending in a user message.`);
  }

  const topic = getTopic(body.slug);
  const content = getContent(body.slug);
  if (!topic || !content) return jsonError(404, "Unknown topic");

  const openai = getOpenAI();
  if (!openai) return jsonError(503, AI_NOT_CONFIGURED);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      instructions:
        mentorInstructions(topic, content) +
        "\n\nYou are now in a 1:1 chat. Answer the student's questions concisely and precisely. If a question is off-topic for backend development, gently steer back.",
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });
    return textStream(stream);
  } catch (err) {
    console.error("chat failed", err);
    const { status, message } = describeOpenAIError(err);
    return jsonError(status, message);
  }
}
