"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateTopic, useProgress } from "@/lib/progress";

type Props = { slug: string; next?: { slug: string; title: string } };

export function CompletionPanel({ slug, next }: Props) {
  const router = useRouter();
  const progress = useProgress();
  if (!progress) return null;

  const topic = progress.topics[slug] ?? {};
  const ready = Boolean(topic.quizPassed && topic.practiceDone);

  function complete() {
    updateTopic(slug, { completedAt: new Date().toISOString() });
    router.push(next ? `/learn/${next.slug}` : "/");
  }

  if (topic.completedAt) {
    return (
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">✓ You completed this topic.</p>
        <Link
          href={next ? `/learn/${next.slug}` : "/"}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {next ? `Next topic: ${next.title} →` : "Back to the roadmap"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">Finish this topic</h3>
      <ul className="mt-3 space-y-1 text-sm">
        <li className={topic.practiceDone ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
          {topic.practiceDone ? "✓" : "○"} Solve the practice problem (AI review score passes, or self-check every criterion)
        </li>
        <li className={topic.quizPassed ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
          {topic.quizPassed ? "✓" : "○"} Pass the quiz
        </li>
      </ul>
      <button
        type="button"
        onClick={complete}
        disabled={!ready}
        className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {next ? `Complete & unlock: ${next.title} →` : "Complete the course 🎓"}
      </button>
    </div>
  );
}
