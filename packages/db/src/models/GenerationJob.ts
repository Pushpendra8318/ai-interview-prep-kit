import { Schema, model, Types } from 'mongoose';
import {
  PIPELINE_STAGES,
  StageStatus,
  JobStatus,
  type PipelineStage,
  type StageStatusT,
  type JobStatusT,
} from '@prepkit/schema';

export interface StageRecord {
  name: PipelineStage;
  status: StageStatusT;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

export interface GenerationJobDoc {
  _id: Types.ObjectId;
  kitId: Types.ObjectId;
  userId: Types.ObjectId;
  status: JobStatusT;
  currentStage: PipelineStage | null;
  stages: StageRecord[];
  attempts: number;
  error: { code: string; message: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const stageRecordSchema = new Schema<StageRecord>(
  {
    name: { type: String, enum: PIPELINE_STAGES, required: true },
    status: { type: String, enum: StageStatus, required: true, default: 'pending' },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    error: { type: String },
  },
  { _id: false },
);

const generationJobSchema = new Schema<GenerationJobDoc>(
  {
    kitId: { type: Schema.Types.ObjectId, required: true, ref: 'Kit' },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: { type: String, enum: JobStatus, required: true, default: 'queued' },
    currentStage: { type: String, enum: PIPELINE_STAGES, default: null },
    stages: { type: [stageRecordSchema], default: [] },
    attempts: { type: Number, default: 0 },
    error: {
      type: new Schema({ code: String, message: String }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);

// Poll-for-progress: fetching the job belonging to a specific kit.
generationJobSchema.index({ kitId: 1 });
// In-process job runner claims the oldest queued job first (FIFO).
generationJobSchema.index({ status: 1, createdAt: 1 });
// A user's job history / "is anything of mine still running" checks.
generationJobSchema.index({ userId: 1, status: 1 });

export const GenerationJobModel = model<GenerationJobDoc>('GenerationJob', generationJobSchema);
