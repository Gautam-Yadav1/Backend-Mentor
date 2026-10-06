import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiExplain } from "@/components/AiExplain";
import { CompletionPanel } from "@/components/CompletionPanel";
import { Markdown } from "@/components/Markdown";
import { MentorChat } from "@/components/MentorChat";
import { PracticeWorkbench } from "@/components/PracticeWorkbench";
import { Quiz } from "@/components/Quiz";
import { TopicGate } from "@/components/TopicGate";
import { TopicTabs } from "@/components/TopicTabs";
import { getContent } from "@/lib/content";
import { allTopics, getNeighbors, getTopic } from "@/lib/curriculum";

export function generateStaticParams() {
  return allTopics.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  return topic ? { title: topic.title, description: topic.summary } : {};
}

export default async function TopicPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const topic = getTopic(slug);
  const content = getContent(slug);
  if (!topic || !content) notFound();

  const { prev, next } = getNeighbors(slug);
  const { problem, realWorld } = content;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Roadmap
        </Link>
        <span className="mx-2">/</span>
        {topic.moduleTitle}
      </nav>

      <header className="mb-8">
        <p className="mb-2 font-mono text-sm text-emerald-600 dark:text-emerald-400">
          Topic {topic.index + 1} of {allTopics.length} · ~{topic.minutes} min
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{topic.title}</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">{topic.summary}</p>
      </header>

      <TopicGate key={slug} slug={slug}>
        <TopicTabs
          slug={slug}
          lesson={
            <>
              <Markdown>{content.lesson}</Markdown>
              <AiExplain slug={slug} />
            </>
          }
          realWorld={
            <article>
              <p className="text-sm font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Real-world case · {realWorld.company}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{realWorld.title}</h2>
              <Markdown className="mt-4">{realWorld.story}</Markdown>
              <div className="mt-6 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950/40">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Takeaway for your code</p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">{realWorld.takeaway}</p>
              </div>
            </article>
          }
          practice={
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Practice problem
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{problem.title}</h2>
              <h3 className="mt-6 font-semibold">📋 The situation</h3>
              <Markdown className="mt-2">{problem.scenario}</Markdown>
              {problem.starterCode && (
                <>
                  <h3 className="mt-6 font-semibold">🧩 Starter code</h3>
                  <Markdown className="mt-2">{"```js\n" + problem.starterCode + "\n```"}</Markdown>
                </>
              )}
              <h3 className="mt-6 font-semibold">🛠️ Your task</h3>
              <Markdown className="mt-2">{problem.task}</Markdown>
              <PracticeWorkbench slug={slug} hints={topic.hints} criteria={topic.criteria} />
            </div>
          }
          quiz={<Quiz slug={slug} questions={topic.quiz} />}
        />

        <CompletionPanel slug={slug} next={next ? { slug: next.slug, title: next.title } : undefined} />

        <div className="mt-10 flex justify-between gap-4 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800">
          {prev ? (
            <Link href={`/learn/${prev.slug}`} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/learn/${next.slug}`} className="text-right text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              {next.title} →
            </Link>
          )}
        </div>
      </TopicGate>

      <MentorChat key={slug} slug={slug} topicTitle={topic.title} />
    </main>
  );
}
