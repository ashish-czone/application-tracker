import { api } from '../../../../lib/api';
import type { Candidate } from './types';

// Domain-specific services only — generic CRUD is handled by the entity engine

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
