"use client";

import Link from "next/link";
import { allTopics } from "@/lib/curriculum";
import { completedCount, currentTopic, useProgress } from "@/lib/progress";

export function HeaderProgress() {
  const progress = useProgress();
  if (!progress) return <div className="h-8" />;

  const done = completedCount(progress);
  const pct = Math.round((done / allTopics.length) * 100);
  const next = currentTopic(progress);

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden items-center gap-2 sm:flex" title={`${done} of ${allTopics.length} topics completed`}>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums text-zinc-500">{pct}%</span>
      </div>
      {next && (
        <Link
          href={`/learn/${next.slug}`}
          className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500"
        >
          Continue
        </Link>
      )}
    </div>
  );
}
