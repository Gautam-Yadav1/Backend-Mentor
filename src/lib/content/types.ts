export type Problem = {
  title: string;
  /** the production situation you're dropped into (markdown) */
  scenario: string;
  /** exactly what to build (markdown) */
  task: string;
  /** code you start from, when the problem is "fix/refactor this" */
  starterCode?: string;
};

export type RealWorldCase = {
  company: string;
  title: string;
  /** what happened (markdown) */
  story: string;
  /** the lesson to carry into your own code */
  takeaway: string;
};

export type TopicContent = {
  /** the built-in in-depth lesson (markdown). Works without an API key. */
  lesson: string;
  problem: Problem;
  realWorld: RealWorldCase;
};
