"use client";

import { useState } from "react";
import { useProgress } from "@/lib/progress";

const TABS = [
  { id: "lesson", label: "1 · Lesson" },
  { id: "realWorld", label: "2 · Real-world case" },
  { id: "practice", label: "3 · Practice" },
  { id: "quiz", label: "4 · Quiz" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TopicTabs({
  slug,
  ...panels
}: { slug: string } & Record<TabId, React.ReactNode>) {
  const [active, setActive] = useState<TabId>("lesson");
  const topic = useProgress()?.topics[slug];
  const done: Partial<Record<TabId, boolean>> = { practice: topic?.practiceDone, quiz: topic?.quizPassed };

  const select = (id: TabId) => {
    setActive(id);
    document.getElementById("topic-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="topic-tabs" className="scroll-mt-16">
      <div
        role="tablist"
        className="sticky top-14 z-20 -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-zinc-200 bg-[var(--background)] px-4 dark:border-zinc-800"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            onClick={() => select(tab.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
              active === tab.id
                ? "border-emerald-500 text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
            {done[tab.id] && <span className="ml-1.5 text-emerald-500">✓</span>}
          </button>
        ))}
      </div>

      {TABS.map((tab, i) => (
        <section key={tab.id} role="tabpanel" hidden={active !== tab.id}>
          {panels[tab.id]}
          {i < TABS.length - 1 && (
            <div className="mt-10 flex justify-end">
              <button
                type="button"
                onClick={() => select(TABS[i + 1].id)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Next: {TABS[i + 1].label.split("· ")[1]} →
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
