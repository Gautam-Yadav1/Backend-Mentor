"use client";

import Link from "next/link";
import { allTopics } from "@/lib/curriculum";
import {
  completedCount,
  currentTopic,
  isCompleted,
  isUnlocked,
  resetProgress,
  useProgress,
  type Progress,
} from "@/lib/progress";

export type RoadmapModule = {
  id: string;
  title: string;
  description: string;
  topics: { slug: string; title: string; summary: string; minutes: number }[];
};

const topicNumbers = new Map(allTopics.map((t) => [t.slug, t.index + 1]));

type Status = "done" | "current" | "locked" | "unknown";

function statusOf(progress: Progress | null, slug: string, currentSlug?: string): Status {
  if (!progress) return "unknown";
  if (isCompleted(progress, slug)) return "done";
  if (slug === currentSlug) return "current";
  return isUnlocked(progress, slug) ? "current" : "locked";
}

export function Roadmap({ modules }: { modules: RoadmapModule[] }) {
  const progress = useProgress();
  const current = progress ? currentTopic(progress) : undefined;
  const done = progress ? completedCount(progress) : 0;
  const finished = progress !== null && !current;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm text-zinc-500">Your progress</p>
          <p className="text-2xl font-semibold tabular-nums">
            {done} / {allTopics.length} topics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {finished ? (
            <span className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              🎉 Course complete. You&apos;re production-ready!
            </span>
          ) : (
            <Link
              href={`/learn/${(current ?? allTopics[0]).slug}`}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {done === 0 ? "Start learning" : `Continue: ${(current ?? allTopics[0]).title}`} →
            </Link>
          )}
          {done > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset all progress? This cannot be undone.")) resetProgress();
              }}
              className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Reset progress
            </button>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {modules.map((m, moduleIndex) => {
          const moduleDone = progress ? m.topics.filter((t) => isCompleted(progress, t.slug)).length : 0;
          return (
            <section key={m.id}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold">
                    <span className="mr-2 font-mono text-sm text-zinc-400">Module {moduleIndex + 1}</span>
                    {m.title}
                  </h2>
                  <p className="text-sm text-zinc-500">{m.description}</p>
                </div>
                <span className="text-sm tabular-nums text-zinc-500">
                  {moduleDone}/{m.topics.length}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {m.topics.map((t) => {
                  const status = statusOf(progress, t.slug, current?.slug);
                  const isNext = t.slug === current?.slug;
                  return (
                    <li key={t.slug}>
                      <Link
                        href={`/learn/${t.slug}`}
                        className={`group flex h-full flex-col rounded-lg border p-4 transition ${
                          isNext
                            ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/40"
                            : status === "locked"
                              ? "border-zinc-200 bg-zinc-50 opacity-70 hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-900/40"
                              : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                          <span className="font-mono">#{topicNumbers.get(t.slug)}</span>
                          <span>
                            {status === "done" && <span className="text-emerald-600 dark:text-emerald-400">✓ Done</span>}
                            {status === "locked" && "🔒 Locked"}
                            {isNext && <span className="font-medium text-emerald-700 dark:text-emerald-300">Up next</span>}
                            {status !== "done" && status !== "locked" && !isNext && `${t.minutes} min`}
                          </span>
                        </div>
                        <h3 className="font-medium leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {t.title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">{t.summary}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
