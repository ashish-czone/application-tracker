import { Paperclip } from 'lucide-react';
import type { AttachmentWithUploader } from '../types';
import { AttachmentItem } from './AttachmentItem';

interface AttachmentsListProps {
  attachments: AttachmentWithUploader[];
  currentUserId: string;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  isDeleting: boolean;
}

export function AttachmentsList({ attachments, currentUserId, onDelete, onDownload, isDeleting }: AttachmentsListProps) {
  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Paperclip className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No attachments yet</p>
        <p className="text-xs text-muted-foreground mt-1">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onDownload={onDownload}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}
