import { BONUS_SKILLS, CORE_SKILLS, TITLE_MEDIUM, TITLE_STRONG, config } from './config.js';
import type { Job } from './parsers.js';

export interface ScoredJob extends Job {
  score: number;
  matched: string[];
  missing: string[];
}

const matchSkills = (text: string, skills: Record<string, RegExp>) =>
  Object.entries(skills)
    .filter(([, re]) => re.test(text))
    .map(([name]) => name);

// Returns null for jobs that should be dropped entirely.
export function scoreJob(job: Job): ScoredJob | null {
  if (config.exclude.test(job.title)) return null;

  const text = `${job.title} ${job.snippet}`;
  const core = matchSkills(text, CORE_SKILLS);
  const bonus = matchSkills(text, BONUS_SKILLS);

  // Alert emails only carry short snippets, so 3 matched core skills = full marks.
  const coreScore = Math.min(1, core.length / 3);
  const bonusScore = Math.min(1, bonus.length / 2);
  const titleScore = TITLE_STRONG.test(job.title) ? 1 : TITLE_MEDIUM.test(job.title) ? 0.7 : 0.2;
  const locText = `${job.location} ${job.title}`;
  const locScore = config.locationOk.test(locText) ? 1 : job.location ? 0.3 : 0.5;

  const score = 0.5 * coreScore + 0.25 * titleScore + 0.15 * locScore + 0.1 * bonusScore;

  return {
    ...job,
    score: Math.round(score * 100) / 100,
    matched: [...core, ...bonus],
    missing: Object.keys(CORE_SKILLS).filter((s) => !core.includes(s)),
  };
}
