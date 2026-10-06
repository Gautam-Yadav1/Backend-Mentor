import { allTopics } from "../curriculum";
import { architecture } from "./architecture";
import { authSecurity } from "./auth-security";
import { databases } from "./databases";
import { expressCore } from "./express-core";
import { foundations } from "./foundations";
import { performance } from "./performance";
import { production } from "./production";
import type { TopicContent } from "./types";

export type { Problem, RealWorldCase, TopicContent } from "./types";

const content: Record<string, TopicContent> = {
  ...foundations,
  ...expressCore,
  ...databases,
  ...authSecurity,
  ...performance,
  ...production,
  ...architecture,
};

// Fail loudly during build if a topic is added to the curriculum without content.
const missing = allTopics.filter((t) => !content[t.slug]).map((t) => t.slug);
if (missing.length > 0) {
  throw new Error(`Missing lesson content for topics: ${missing.join(", ")}`);
}

export function getContent(slug: string): TopicContent | undefined {
  return content[slug];
}
