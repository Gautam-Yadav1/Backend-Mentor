/** Minimum AI review score needed to count the practice problem as solved. */
export const PASS_SCORE = 70;

export type Review = {
  score: number;
  passed: boolean;
  summary: string;
  criteria: { criterion: string; met: boolean; feedback: string }[];
  strengths: string[];
  improvements: string[];
  productionTip: string;
};
