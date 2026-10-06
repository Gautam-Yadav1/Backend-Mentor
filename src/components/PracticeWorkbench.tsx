"use client";

import { useRef, useState } from "react";
import { PASS_SCORE, type Review } from "@/lib/review";
import { loadDraft, saveDraft, updateTopic, useProgress } from "@/lib/progress";

type Props = { slug: string; hints: string[]; criteria: string[] };

export function PracticeWorkbench(props: Props) {
  // Drafts live in localStorage, so render the workbench only once we're in the browser.
  const progress = useProgress();
  if (!progress) return <div className="mt-10 h-96 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />;
  return <Workbench {...props} />;
}

function Workbench({ slug, hints, criteria }: Props) {
  const topic = useProgress()?.topics[slug];
  const [hintsShown, setHintsShown] = useState(0);
  const [solution, setSolution] = useState(() => loadDraft(slug));
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => criteria.map(() => false));
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function onChange(value: string) {
    setSolution(value);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(slug, value), 400);
  }

  // Let Tab insert spaces instead of leaving the editor.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = solution.slice(0, start) + "  " + solution.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
  }

  async function requestReview() {
    setReviewing(true);
    setError(null);
    setReview(null);
    saveDraft(slug, solution);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, solution }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Review failed (${res.status})`);
      const result = data as Review;
      setReview(result);
      if (result.passed) {
        updateTopic(slug, { practiceDone: true, practiceMethod: "ai", reviewScore: result.score });
      } else if (!topic?.practiceDone) {
        updateTopic(slug, { reviewScore: result.score });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReviewing(false);
    }
  }

  const allChecked = checked.every(Boolean);

  return (
    <div className="mt-10 space-y-8">
      {/* Hints */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">💡 Hints</h3>
          {hintsShown < hints.length && (
            <button
              type="button"
              onClick={() => setHintsShown((n) => n + 1)}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Reveal hint {hintsShown + 1} of {hints.length}
            </button>
          )}
        </div>
        {hintsShown === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Try it on your own first. Reveal hints one at a time if you get stuck.</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {hints.slice(0, hintsShown).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        )}
      </div>

      {/* Acceptance criteria */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="font-semibold">✅ Acceptance criteria</h3>
        <p className="mt-1 text-sm text-zinc-500">
          This is what a reviewer will check. Build it locally in your editor, run it, then submit below.
        </p>
        <ul className="mt-3 space-y-2">
          {criteria.map((c, i) => (
            <li key={c}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Submission */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">🧑‍💻 Submit your solution for AI code review</h3>
          {topic?.practiceDone && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ Practice complete{topic.practiceMethod === "ai" && topic.reviewScore ? ` · ${topic.reviewScore}/100` : " (self-checked)"}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Paste your code (several files are fine, just label them with a comment like <code>{"// app.js"}</code>), plus
          any written answers the task asks for. Score {PASS_SCORE}+ to pass. Your draft is saved automatically.
        </p>
        <textarea
          value={solution}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder={"// app.js\nimport express from \"express\";\n..."}
          className="mt-4 h-80 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={requestReview}
            disabled={reviewing || solution.trim().length < 20}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reviewing ? "Reviewing your code…" : "Get AI code review"}
          </button>
          {!topic?.practiceDone && (
            <button
              type="button"
              disabled={!allChecked}
              onClick={() => updateTopic(slug, { practiceDone: true, practiceMethod: "self" })}
              title={allChecked ? "" : "Tick every acceptance criterion first"}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              No API key? Mark as done (self-checked)
            </button>
          )}
        </div>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
        {review && <ReviewResult review={review} />}
      </div>
    </div>
  );
}

function ReviewResult({ review }: { review: Review }) {
  return (
    <div className="mt-6 space-y-5 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div className="flex items-center gap-4">
        <div
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold tabular-nums ${
            review.passed
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {review.score}
        </div>
        <div>
          <p className="font-semibold">{review.passed ? "Passed: nice work! 🎉" : "Not quite there yet. Keep going! 💪"}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{review.summary}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {review.criteria.map((c) => (
          <li key={c.criterion} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="font-medium">
              {c.met ? "✅" : "❌"} {c.criterion}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{c.feedback}</p>
          </li>
        ))}
      </ul>

      {review.strengths.length > 0 && (
        <div>
          <p className="text-sm font-semibold">What you did well</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {review.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {review.improvements.length > 0 && (
        <div>
          <p className="text-sm font-semibold">What to improve</p>
          <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {review.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/40">
        <p className="font-semibold text-sky-800 dark:text-sky-300">🏭 Senior engineer tip</p>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">{review.productionTip}</p>
      </div>
    </div>
  );
}
