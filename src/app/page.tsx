import { Roadmap, type RoadmapModule } from "@/components/Roadmap";
import { allTopics, modules } from "@/lib/curriculum";

const roadmap: RoadmapModule[] = modules.map((m) => ({
  id: m.id,
  title: m.title,
  description: m.description,
  topics: m.topics.map((t) => ({ slug: t.slug, title: t.title, summary: t.summary, minutes: t.minutes })),
}));

const totalHours = Math.round(allTopics.reduce((sum, t) => sum + t.minutes, 0) / 60);

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <section className="mb-12 max-w-3xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Node.js · Express · Production engineering
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Go from beginner to production-ready backend engineer.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          {allTopics.length} topics across {modules.length} modules, about {totalHours} hours. For every topic you get
          an in-depth lesson, a real incident or story from companies like Amazon, Stripe and Netflix, a
          production-style practice problem with AI code review, and a quiz. Finish a topic to unlock the next one.
        </p>
        <ol className="mt-8 grid gap-3 text-sm sm:grid-cols-4">
          {[
            ["1", "Learn", "Read the lesson, then ask the AI mentor anything"],
            ["2", "See it in the wild", "How real companies got it right, or very wrong"],
            ["3", "Build", "Solve a production-style problem and get a code review"],
            ["4", "Prove it", "Pass the quiz to unlock the next topic"],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{n}.</span>{" "}
              <span className="font-semibold">{title}</span>
              <p className="mt-1 text-zinc-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Roadmap modules={roadmap} />
    </main>
  );
}
