"use client";

import Link from "next/link";
import { useState } from "react";
import { currentTopic, isUnlocked, useProgress } from "@/lib/progress";

/** Shows a lock screen for topics whose previous topics aren't complete yet. */
export function TopicGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const progress = useProgress();
  const [preview, setPreview] = useState(false);

  if (!progress || preview || isUnlocked(progress, slug)) return <>{children}</>;

  const current = currentTopic(progress);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-4xl">🔒</p>
      <h2 className="mt-3 text-xl font-semibold">This topic is locked</h2>
      <p className="mx-auto mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
        Each topic builds on the previous ones. Complete the earlier topics (lesson, practice problem and quiz) to
        unlock it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {current && (
          <Link
            href={`/learn/${current.slug}`}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Go to your current topic: {current.title}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Preview anyway
        </button>
      </div>
    </div>
  );
}
