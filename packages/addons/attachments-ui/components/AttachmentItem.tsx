import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Download, Trash2, FileText, Image, FileSpreadsheet, FileArchive, File } from 'lucide-react';
import { Button, ConfirmDialog, cn } from '@packages/ui';
import type { AttachmentWithUploader } from '../types';

interface AttachmentItemProps {
  attachment: AttachmentWithUploader;
  currentUserId: string;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  isDeleting: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('gzip')) return FileArchive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentItem({ attachment, currentUserId, onDelete, onDownload, isDeleting }: AttachmentItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isUploader = attachment.uploadedBy === currentUserId;
  const uploaderName = `${attachment.uploader.firstName} ${attachment.uploader.lastName}`.trim();
  const timeAgo = formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true });
  const FileIcon = getFileIcon(attachment.mimeType);

  return (
    <div className="flex items-center gap-3 py-3 px-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* File icon */}
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{attachment.originalName}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)} &middot; {uploaderName} &middot; {timeAgo}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onDownload(attachment.id)}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        {isUploader && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete attachment"
        description={`Are you sure you want to delete "${attachment.originalName}"?`}
        confirmLabel="Delete"
        onConfirm={() => {
          onDelete(attachment.id);
          setShowDeleteConfirm(false);
        }}
      />
    </div>
  );
}
