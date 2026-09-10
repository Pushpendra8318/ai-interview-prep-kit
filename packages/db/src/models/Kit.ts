import { Schema, model, Types } from 'mongoose';
import type { Kit } from '@prepkit/schema';

export const KitStatus = ['draft', 'researching', 'generating', 'ready', 'failed'] as const;
export type KitStatusT = (typeof KitStatus)[number];

export interface KitDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fingerprint: string;
  status: KitStatusT;
  revision: number;
  /** Raw pasted job description - kept alongside the generated kit since regeneration needs the original text. */
  jd: string;
  days: number;
  nextIdSeq: { requirement: number; question: number; flashcard: number };
  /**
   * The Appendix A kit payload. Kept as Mixed rather than a duplicated
   * Mongoose sub-schema: `@prepkit/schema`'s Zod KitSchema is the single
   * source of truth and is enforced at every write boundary in the kits
   * module, so re-declaring the same shape here would just be a second
   * copy of the contract to keep in sync.
   */
  kit: Kit;
  createdAt: Date;
  updatedAt: Date;
}

const kitSchema = new Schema<KitDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    fingerprint: { type: String, required: true },
    status: { type: String, enum: KitStatus, required: true, default: 'draft' },
    revision: { type: Number, required: true, default: 1 },
    jd: { type: String, required: true },
    days: { type: Number, required: true },
    nextIdSeq: {
      requirement: { type: Number, default: 1 },
      question: { type: Number, default: 1 },
      flashcard: { type: Number, default: 1 },
    },
    kit: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// Dashboard "my kits" list, most recent first - the highest-frequency query.
kitSchema.index({ userId: 1, updatedAt: -1 });
// Duplicate-submission detection, scoped per user so two users can legitimately
// submit the same JD+company without colliding.
kitSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
// In-process job runner scans for kits stuck in researching/generating.
kitSchema.index({ status: 1 });

export const KitModel = model<KitDoc>('Kit', kitSchema);
