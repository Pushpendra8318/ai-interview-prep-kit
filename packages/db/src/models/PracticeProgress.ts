import { Schema, model, Types } from 'mongoose';

export const Confidence = ['low', 'medium', 'high'] as const;
export type ConfidenceT = (typeof Confidence)[number];

export interface PracticeProgressDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kitId: Types.ObjectId;
  flashcardId: string;
  confidence: ConfidenceT;
  reviewCount: number;
  covered: boolean;
  lastReviewedAt: Date;
}

const practiceProgressSchema = new Schema<PracticeProgressDoc>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  kitId: { type: Schema.Types.ObjectId, required: true, ref: 'Kit' },
  flashcardId: { type: String, required: true },
  confidence: { type: String, enum: Confidence, required: true, default: 'low' },
  reviewCount: { type: Number, default: 0 },
  covered: { type: Boolean, default: false },
  lastReviewedAt: { type: Date, default: () => new Date() },
});

// One progress row per (user, kit, flashcard) - practicing a card upserts this row.
practiceProgressSchema.index({ userId: 1, kitId: 1, flashcardId: 1 }, { unique: true });
// Weak-spots aggregation: pull the least-confident cards for a kit.
practiceProgressSchema.index({ kitId: 1, confidence: 1 });

export const PracticeProgressModel = model<PracticeProgressDoc>(
  'PracticeProgress',
  practiceProgressSchema,
);
