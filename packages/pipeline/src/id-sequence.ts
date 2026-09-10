export interface IdCounters {
  requirement: number;
  question: number;
  flashcard: number;
}

/** Assigns stable, monotonic ids - the brief is explicit that ids come from application code, never the model. */
export class IdSequence {
  private counters: IdCounters;

  constructor(initial?: Partial<IdCounters>) {
    this.counters = { requirement: 1, question: 1, flashcard: 1, ...initial };
  }

  nextRequirementId(): string {
    return `r${this.counters.requirement++}`;
  }

  nextQuestionId(): string {
    return `q${this.counters.question++}`;
  }

  nextFlashcardId(): string {
    return `f${this.counters.flashcard++}`;
  }

  snapshot(): IdCounters {
    return { ...this.counters };
  }
}
