import type { Filing, Handler } from '../../../../../../shared/types';

export interface FilingNote {
  id: string;
  author: Handler;
  text: string;
  createdAt: string;
}

export interface FilingAttachment {
  id: string;
  name: string;
  size: string;
  uploadedBy: Handler;
  uploadedAt: string;
}

export interface FilingActivity {
  id: string;
  type: 'status-change' | 'note-added' | 'attachment-added' | 'assigned' | 'created';
  actor: Handler;
  timestamp: string;
  detail: string;
}

export interface FilingRow extends Filing {
  priority: 'critical' | 'high' | 'normal' | 'low';
  filedDate?: string;
  notes: FilingNote[];
  attachments: FilingAttachment[];
  activity: FilingActivity[];
}
