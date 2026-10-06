"use client";

import { useSyncExternalStore } from "react";
import { allTopics } from "./curriculum";

export type TopicProgress = {
  quizPassed?: boolean;
  quizBest?: number;
  practiceDone?: boolean;
  practiceMethod?: "ai" | "self";
  reviewScore?: number;
  completedAt?: string;
};

export type Progress = { topics: Record<string, TopicProgress> };

const STORAGE_KEY = "backend-mentor:progress:v1";
const CHANGE_EVENT = "backend-mentor:progress-change";
const EMPTY: Progress = { topics: {} };

let cachedRaw: string | null | undefined;
let cachedValue: Progress = EMPTY;

function read(): Progress {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // storage blocked (private mode etc.): behave like a fresh learner
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Progress) : EMPTY;
    cachedValue = parsed && typeof parsed.topics === "object" ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function write(next: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / blocked storage
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Returns null during server render / hydration, then the learner's saved progress. */
export function useProgress(): Progress | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function updateTopic(slug: string, patch: Partial<TopicProgress>) {
  const current = read();
  write({
    ...current,
    topics: { ...current.topics, [slug]: { ...current.topics[slug], ...patch } },
  });
}

export function resetProgress() {
  write(EMPTY);
}

export function isCompleted(progress: Progress, slug: string) {
  return Boolean(progress.topics[slug]?.completedAt);
}

/** A topic is unlocked when every topic before it is completed. */
export function isUnlocked(progress: Progress, slug: string) {
  const index = allTopics.findIndex((t) => t.slug === slug);
  if (index <= 0) return true;
  return allTopics.slice(0, index).every((t) => isCompleted(progress, t.slug));
}

/** The first topic not yet completed, or undefined when the course is finished. */
export function currentTopic(progress: Progress) {
  return allTopics.find((t) => !isCompleted(progress, t.slug));
}

export function completedCount(progress: Progress) {
  return allTopics.filter((t) => isCompleted(progress, t.slug)).length;
}

/** Per-topic solution drafts live in their own keys so typing doesn't re-render the whole app. */
export function loadDraft(slug: string): string {
  try {
    return window.localStorage.getItem(`backend-mentor:draft:${slug}`) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(slug: string, value: string) {
  try {
    window.localStorage.setItem(`backend-mentor:draft:${slug}`, value);
  } catch {
    // ignore
  }
}
