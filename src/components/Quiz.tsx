"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/curriculum";
import { updateTopic, useProgress } from "@/lib/progress";

/** Passing needs at least two thirds of the answers right. */
const passMark = (total: number) => Math.ceil((total * 2) / 3);

export function Quiz({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
  const topic = useProgress()?.topics[slug];
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const score = answers.filter((a, i) => a === questions[i].answer).length;
  const needed = passMark(questions.length);
  const passed = score >= needed;

  function submit() {
    setSubmitted(true);
    updateTopic(slug, {
      quizBest: Math.max(score, topic?.quizBest ?? 0),
      ...(passed ? { quizPassed: true } : {}),
    });
  }

  function retry() {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold">Check your understanding</h2>
        <p className="text-sm text-zinc-500">
          Get {needed} of {questions.length} right to pass
          {topic?.quizPassed && <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓ Passed</span>}
        </p>
      </div>

      <ol className="space-y-6">
        {questions.map((q, qi) => (
          <li key={q.question} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-medium">
              <span className="mr-2 font-mono text-zinc-400">{qi + 1}.</span>
              {q.question}
            </p>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const isCorrect = oi === q.answer;
                let style =
                  "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500";
                if (submitted && isCorrect) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40";
                else if (submitted && selected) style = "border-red-400 bg-red-50 dark:bg-red-950/40";
                else if (selected) style = "border-emerald-500 ring-1 ring-emerald-500";
                return (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${style} ${submitted ? "cursor-default" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      checked={selected}
                      disabled={submitted}
                      onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {submitted && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">{answers[qi] === q.answer ? "Correct. " : "Explanation: "}</span>
                {q.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!submitted ? (
          <button
            type="button"
            onClick={submit}
            disabled={answers.some((a) => a === null)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit answers
          </button>
        ) : (
          <>
            <p className={`font-semibold ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              You scored {score}/{questions.length}. {passed ? "Passed! 🎉" : "Review the explanations and try again."}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Retake quiz
            </button>
          </>
        )}
      </div>
    </div>
  );
}
