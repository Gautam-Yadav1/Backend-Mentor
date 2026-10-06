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

const MODES = {
  "deep-dive": `Write an in-depth lesson on this topic that goes beyond the basics: how it works under the hood, production patterns, trade-offs, performance and security considerations, and a realistic code example. Finish with a "Interview questions" section of 5 questions with short answers.`,
  simpler: `Explain this topic again for a complete beginner who found the lesson confusing. Use an everyday analogy, the smallest possible code example, and a step-by-step walkthrough. Avoid jargon or define every term you use.`,
  examples: `Show 3 real-world scenarios from well-known production systems (e.g. e-commerce, payments, social media, ride-sharing) where this topic matters. For each: the problem, how it is typically solved, and a short Node.js/Express code sketch. Only cite company specifics you are confident are accurate; otherwise describe them as typical industry practice.`,
} as const;

type Mode = keyof typeof MODES;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: unknown; mode?: unknown } | null;
  if (!body || typeof body.slug !== "string" || typeof body.mode !== "string" || !(body.mode in MODES)) {
    return jsonError(400, "Expected { slug, mode } with mode one of: " + Object.keys(MODES).join(", "));
  }

  const topic = getTopic(body.slug);
  const content = getContent(body.slug);
  if (!topic || !content) return jsonError(404, "Unknown topic");

  const openai = getOpenAI();
  if (!openai) return jsonError(503, AI_NOT_CONFIGURED);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      instructions: mentorInstructions(topic, content),
      input: MODES[body.mode as Mode],
      stream: true,
    });
    return textStream(stream);
  } catch (err) {
    console.error("explain failed", err);
    const { status, message } = describeOpenAIError(err);
    return jsonError(status, message);
  }
}
