import { Schema, model, Types } from 'mongoose';

export const SourceType = [
  'homepage',
  'careers',
  'engineering',
  'interview-process',
  'about',
  'public-discussion',
  'other',
] as const;
export type SourceTypeT = (typeof SourceType)[number];

export const RetrievalStatus = ['ok', 'failed'] as const;
export type RetrievalStatusT = (typeof RetrievalStatus)[number];

export interface ResearchSourceDoc {
  _id: Types.ObjectId;
  kitId: Types.ObjectId;
  url: string;
  title: string | null;
  sourceType: SourceTypeT;
  retrievalStatus: RetrievalStatusT;
  retrievedAt: Date;
  extractedText: string | null;
  error: string | null;
  createdAt: Date;
}

const researchSourceSchema = new Schema<ResearchSourceDoc>(
  {
    kitId: { type: Schema.Types.ObjectId, required: true, ref: 'Kit' },
    url: { type: String, required: true },
    title: { type: String, default: null },
    sourceType: { type: String, enum: SourceType, required: true },
    retrievalStatus: { type: String, enum: RetrievalStatus, required: true },
    retrievedAt: { type: Date, required: true },
    extractedText: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "Show me what was retrieved / what failed for this kit" (the builder's research panel).
researchSourceSchema.index({ kitId: 1, retrievalStatus: 1 });

export const ResearchSourceModel = model<ResearchSourceDoc>('ResearchSource', researchSourceSchema);
