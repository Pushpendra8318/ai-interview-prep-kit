import type {
  Question,
  QuestionCategory,
  Requirement,
  Schedule,
  ScheduleDay,
} from '@prepkit/schema';

/** Fixed, deterministic per-difficulty time budgets (minutes). No floats anywhere. */
const DIFFICULTY_MINUTES: Record<1 | 2 | 3, number> = { 1: 15, 2: 25, 3: 40 };
const REVIEW_MINUTES = 20;

const FOCUS_LABELS: Record<QuestionCategory, string> = {
  technical: 'Technical deep-dive',
  behavioural: 'Behavioural & culture fit',
  'system-design': 'System design',
  'company-fit': 'Company fit & culture',
};

const DIFFICULTY_SCORE: Record<1 | 2 | 3, number> = { 1: 10, 2: 20, 3: 30 };

export function scoreQuestion(question: Question, mustIds: ReadonlySet<string>): number {
  const difficulty = question.difficulty as 1 | 2 | 3;
  let score = question.requirement_ids.some((id) => mustIds.has(id)) ? 100 : 0;
  score += DIFFICULTY_SCORE[difficulty] ?? DIFFICULTY_SCORE[2];
  if (question.category === 'system-design') score += 15;
  if (question.category === 'company-fit') score += 10;
  return score;
}

export function estimateMinutes(question: Question): number {
  return DIFFICULTY_MINUTES[question.difficulty as 1 | 2 | 3] ?? DIFFICULTY_MINUTES[2];
}

function deriveFocusLabel(counts: Partial<Record<QuestionCategory, number>>): string {
  const entries = Object.entries(counts) as [QuestionCategory, number][];
  if (entries.length === 0) return 'Mixed review';
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0]!;
  const runnerUp = entries[1];
  if (runnerUp && runnerUp[1] === top[1]) return 'Mixed review';
  return FOCUS_LABELS[top[0]] ?? 'Mixed review';
}

interface ScoredItem {
  question: Question;
  index: number;
  score: number;
  minutes: number;
}

/**
 * Deterministic schedule allocation - never delegated to the LLM (brief
 * §8/§17). Produces exactly `daysAvailable` days. Highest-scoring (must-have,
 * harder, system-design) questions are placed on earlier days by construction:
 * the sorted-by-score list is walked in order and each day is filled to its
 * proportional time budget before moving to the next one.
 */
export function allocateSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number,
): Schedule {
  const activeQuestions = questions.filter((q) => !q.deleted);
  const mustIds = new Set(
    requirements.filter((r) => r.priority === 'must' && !r.deleted).map((r) => r.id),
  );

  const scored: ScoredItem[] = activeQuestions
    .map((question, index) => ({
      question,
      index,
      score: scoreQuestion(question, mustIds),
      minutes: estimateMinutes(question),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const days: ScheduleDay[] = Array.from({ length: daysAvailable }, (_, i) => ({
    day: i + 1,
    focus: '',
    question_ids: [] as string[],
    minutes: 0,
  }));
  const categoryCounts: Partial<Record<QuestionCategory, number>>[] = days.map(() => ({}));

  if (scored.length > 0 && daysAvailable > 0) {
    const totalMinutes = scored.reduce((sum, item) => sum + item.minutes, 0);
    const perDayTarget = Math.max(1, Math.floor(totalMinutes / daysAvailable));

    let dayIndex = 0;
    const overflow: ScoredItem[] = [];

    for (const item of scored) {
      if (dayIndex < daysAvailable - 1 && days[dayIndex]!.minutes >= perDayTarget) {
        dayIndex++;
      }
      const day = days[dayIndex]!;
      if (
        dayIndex === daysAvailable - 1 &&
        day.minutes >= perDayTarget &&
        day.question_ids.length > 0
      ) {
        overflow.push(item);
        continue;
      }
      day.question_ids.push(item.question.id);
      day.minutes += item.minutes;
      categoryCounts[dayIndex]![item.question.category] =
        (categoryCounts[dayIndex]![item.question.category] ?? 0) + 1;
    }

    // Distribute anything that didn't fit the proportional pass round-robin,
    // instead of piling all overflow onto the final day.
    let rr = 0;
    for (const item of overflow) {
      const day = days[rr]!;
      day.question_ids.push(item.question.id);
      day.minutes += item.minutes;
      categoryCounts[rr]![item.question.category] =
        (categoryCounts[rr]![item.question.category] ?? 0) + 1;
      rr = (rr + 1) % daysAvailable;
    }
  }

  // More days than material (e.g. a 60-day schedule for a handful of
  // requirements): remaining empty days become deterministic spaced-repetition
  // review days over the most recently introduced content, never fabricated
  // new material.
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    if (day.question_ids.length === 0) {
      const previous = [...days.slice(0, i)].reverse().find((d) => d.question_ids.length > 0);
      if (previous) {
        day.question_ids = [...previous.question_ids];
        day.minutes = REVIEW_MINUTES;
        day.focus = 'Review & reinforce';
      } else {
        day.minutes = 0;
        day.focus = 'No material available yet';
      }
    } else {
      day.focus = deriveFocusLabel(categoryCounts[i]!);
    }
  }

  return { days_available: daysAvailable, days };
}
