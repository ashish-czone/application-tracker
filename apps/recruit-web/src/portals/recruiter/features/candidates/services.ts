import { api } from '../../../../lib/api';
import type { PaginatedResponse } from '@packages/common';
import type { Candidate, ListCandidatesParams } from './types';

export function listCandidates(params: ListCandidatesParams): Promise<PaginatedResponse<Candidate>> {
  const searchParams = new URLSearchParams();

  if (params.page && params.page > 1) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);
  if (params.source) searchParams.set('source', params.source);
  if (params.country) searchParams.set('country', params.country);
  if (params.qualification) searchParams.set('qualification', params.qualification);
  if (params.includeDeleted) searchParams.set('includeDeleted', 'true');

  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Candidate>>(`/candidates${qs ? `?${qs}` : ''}`);
}

export function getCandidate(id: string): Promise<Candidate> {
  return api.get<Candidate>(`/candidates/${id}`);
}

export function createCandidate(data: Record<string, unknown>): Promise<Candidate> {
  return api.post<Candidate>('/candidates', data);
}

export function updateCandidate(id: string, data: Record<string, unknown>): Promise<Candidate> {
  return api.patch<Candidate>(`/candidates/${id}`, data);
}

export function deleteCandidate(id: string): Promise<void> {
  return api.delete<void>(`/candidates/${id}`);
}

export function restoreCandidate(id: string): Promise<Candidate> {
  return api.post<Candidate>(`/candidates/${id}/restore`);
}

export function uploadResume(id: string, file: File): Promise<Candidate> {
  const formData = new FormData();
  formData.append('file', file);

  return fetch(`/api/v1/candidates/${id}/resume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
    },
    body: formData,
  }).then((res) => {
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  });
}

export function attachSkill(candidateId: string, tagId: string): Promise<void> {
  return api.post<void>(`/candidates/${candidateId}/skills/${tagId}`);
}

export function detachSkill(candidateId: string, tagId: string): Promise<void> {
  return api.delete<void>(`/candidates/${candidateId}/skills/${tagId}`);
}
