# Backend Mentor

A guided learning app that takes you from beginner to production-ready backend engineer with **Node.js and Express**.

There are 26 topics in 7 modules: Foundations → Express Core → Databases → Auth & Security → Performance & Scaling → Production Readiness → Architecture & System Design. Each topic has four steps:

1. **Lesson**: an in-depth built-in explanation with code. You can also have the AI mentor go deeper, explain more simply, or show more real-world examples.
2. **Real-world case**: a real incident or engineering story (Amazon, Stripe, Netflix, GitHub, Facebook, Equifax, Knight Capital...) and what it teaches.
3. **Practice**: a production-style problem with progressive hints and acceptance criteria. Submit your code for an **AI code review** with a score, per-criterion feedback and a senior-engineer tip.
4. **Quiz**: pass it (2/3 or better) to finish the topic.

Completing a topic unlocks the next one. Progress is saved in your browser (localStorage). An **"Ask the mentor"** chat is available on every topic.

## Getting started

```bash
npm install
cp .env.example .env.local   # then put your OpenAI key in .env.local
npm run dev
```

Open http://localhost:3000.

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | for AI features | Key from https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | no | Model for explanations, chat and reviews (default `gpt-5-mini`) |

**Without an API key** the app still works. Lessons, case studies, problems, hints and quizzes are all built in. To complete a practice problem without AI, tick every acceptance criterion and choose "Mark as done (self-checked)".

## Project structure

```
src/
  app/
    page.tsx                 Roadmap / dashboard
    learn/[slug]/page.tsx    Topic page (prerendered for every topic)
    api/explain/route.ts     Streams AI explanations (deep dive / simpler / examples)
    api/chat/route.ts        Streams the mentor chat
    api/review/route.ts      AI code review with structured JSON output
  components/                UI (tabs, quiz, practice workbench, chat, ...)
  lib/
    curriculum.ts            Modules, topics, hints, acceptance criteria, quizzes
    content/                 Lessons, practice problems and real-world cases per module
    progress.ts              Progress tracking + topic unlocking (localStorage)
    openai.ts                OpenAI client, mentor persona, streaming helpers
```

To add a topic, add it to `src/lib/curriculum.ts` and its content to the matching file in `src/lib/content/`. The build fails if a topic has no content.
