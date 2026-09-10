import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Validating a session on every authenticated request looks up by tokenHash.
sessionSchema.index({ tokenHash: 1 }, { unique: true });
// TTL index: MongoDB automatically deletes expired sessions, no manual cleanup job needed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };

export const SessionModel = model('Session', sessionSchema);
