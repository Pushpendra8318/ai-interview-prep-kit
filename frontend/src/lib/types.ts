import type { Kit } from '@prepkit/schema';

export interface KitDocDTO {
  _id: string;
  userId: string;
  fingerprint: string;
  status: 'draft' | 'researching' | 'generating' | 'ready' | 'failed';
  revision: number;
  jd: string;
  days: number;
  kit: Kit;
  createdAt: string;
  updatedAt: string;
}

export interface KitListItemDTO {
  _id: string;
  status: KitDocDTO['status'];
  updatedAt: string;
  createdAt: string;
  kit: { source?: { company?: string; role?: string }; coverage?: Kit['coverage'] };
  questionCount: number;
  flashcardCount: number;
}

export interface GenerationJobDTO {
  _id: string;
  kitId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  currentStage: string | null;
  stages: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    error?: string;
  }[];
  error: { code: string; message: string } | null;
}
