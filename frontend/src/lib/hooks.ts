'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type { GenerationJobDTO, KitDocDTO, KitListItemDTO } from './types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ id: string; name: string; email: string }>('/api/v1/auth/me'),
    retry: false,
  });
}

export function useKits(page = 1) {
  return useQuery({
    queryKey: ['kits', page],
    queryFn: () =>
      api.get<{
        items: KitListItemDTO[];
        total: number;
        stats: { totalKits: number; byStatus: Record<string, number>; needsAttention: number };
      }>(`/api/v1/kits?page=${page}&limit=20`),
  });
}

const IN_PROGRESS_STATUSES = new Set(['draft', 'researching', 'generating']);

export function useKit(kitId: string | undefined) {
  return useQuery({
    queryKey: ['kit', kitId],
    queryFn: () => api.get<KitDocDTO>(`/api/v1/kits/${kitId}`),
    enabled: !!kitId,
    // Keep polling the kit itself (not just the job) while generation is in
    // flight, so the page notices the moment status flips to ready/failed
    // instead of being stuck showing the progress screen forever.
    refetchInterval: (query) => {
      const data = query.state.data as KitDocDTO | undefined;
      return data && IN_PROGRESS_STATUSES.has(data.status) ? 2000 : false;
    },
  });
}

export function useGenerationStatus(kitId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['generation-status', kitId],
    queryFn: () => api.get<GenerationJobDTO>(`/api/v1/kits/${kitId}/generation-status`),
    enabled: !!kitId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as GenerationJobDTO | undefined;
      if (!data) return 1500;
      return data.status === 'succeeded' || data.status === 'failed' ? false : 1500;
    },
  });
}

export function useCreateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { jd: string; company_url: string; days: number }) =>
      api.post<{ kitId: string; duplicate: boolean }>('/api/v1/kits', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kits'] }),
  });
}

function useKitMutation(kitId: string) {
  const qc = useQueryClient();
  return {
    invalidate: () => qc.invalidateQueries({ queryKey: ['kit', kitId] }),
  };
}

export function useAddQuestion(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post(`/api/v1/kits/${kitId}/questions`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateQuestion(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: ({ questionId, patch }: { questionId: string; patch: Record<string, unknown> }) =>
      api.patch(`/api/v1/kits/${kitId}/questions/${questionId}`, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteQuestion(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (questionId: string) => api.delete(`/api/v1/kits/${kitId}/questions/${questionId}`),
    onSuccess: invalidate,
  });
}

export function usePinQuestion(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: ({ questionId, isPinned }: { questionId: string; isPinned: boolean }) =>
      api.post(`/api/v1/kits/${kitId}/questions/${questionId}/pin`, { isPinned }),
    onSuccess: invalidate,
  });
}

export function useMoveQuestionCategory(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: ({ questionId, category }: { questionId: string; category: string }) =>
      api.post(`/api/v1/kits/${kitId}/questions/${questionId}/move-category`, { category }),
    onSuccess: invalidate,
  });
}

export function useReorderQuestions(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (input: { category: string; question_ids: string[] }) =>
      api.post(`/api/v1/kits/${kitId}/questions/reorder`, input),
    onSuccess: invalidate,
  });
}

export function useRegenerateCategory(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (category: string) =>
      api.post(`/api/v1/kits/${kitId}/regenerate/questions/${category}`),
    onSuccess: invalidate,
  });
}

export function useRegenerateBrief(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: () => api.post(`/api/v1/kits/${kitId}/regenerate/company-brief`),
    onSuccess: invalidate,
  });
}

export function useRegenerateSchedule(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (days?: number) =>
      api.post(`/api/v1/kits/${kitId}/regenerate/schedule`, days ? { days } : undefined),
    onSuccess: invalidate,
  });
}

export function useAddFlashcard(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post(`/api/v1/kits/${kitId}/flashcards`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateFlashcard(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: ({ flashcardId, patch }: { flashcardId: string; patch: Record<string, unknown> }) =>
      api.patch(`/api/v1/kits/${kitId}/flashcards/${flashcardId}`, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteFlashcard(kitId: string) {
  const { invalidate } = useKitMutation(kitId);
  return useMutation({
    mutationFn: (flashcardId: string) =>
      api.delete(`/api/v1/kits/${kitId}/flashcards/${flashcardId}`),
    onSuccess: invalidate,
  });
}

export interface PracticeProgressDTO {
  flashcardId: string;
  confidence: 'low' | 'medium' | 'high';
  reviewCount: number;
  covered: boolean;
}

export function usePracticeProgress(kitId: string | undefined) {
  return useQuery({
    queryKey: ['practice-progress', kitId],
    queryFn: () => api.get<PracticeProgressDTO[]>(`/api/v1/kits/${kitId}/practice`),
    enabled: !!kitId,
  });
}

export function useRecordPractice(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      flashcardId,
      confidence,
    }: {
      flashcardId: string;
      confidence: 'low' | 'medium' | 'high';
    }) => api.post(`/api/v1/kits/${kitId}/practice/${flashcardId}`, { confidence }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice-progress', kitId] }),
  });
}

export function useWeakSpots(kitId: string | undefined) {
  return useQuery({
    queryKey: ['weak-spots', kitId],
    queryFn: () => api.get(`/api/v1/kits/${kitId}/weak-spots`),
    enabled: !!kitId,
  });
}
