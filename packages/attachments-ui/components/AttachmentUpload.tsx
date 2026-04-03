import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@packages/ui';

interface AttachmentUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  acceptedMimeTypes?: string[];
  maxFileSize?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function AttachmentUpload({ onFileSelect, isUploading, acceptedMimeTypes, maxFileSize }: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const acceptAttr = acceptedMimeTypes?.join(',');

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        isUploading && 'opacity-50 pointer-events-none',
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptAttr}
        onChange={handleInputChange}
      />
      <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">
        {isUploading ? 'Uploading...' : 'Drop a file here or click to upload'}
      </p>
      {(acceptedMimeTypes || maxFileSize) && (
        <p className="text-xs text-muted-foreground/70 mt-1">
          {acceptedMimeTypes && acceptedMimeTypes[0] !== '*/*' && (
            <span>Accepted: {acceptedMimeTypes.join(', ')}</span>
          )}
          {acceptedMimeTypes && acceptedMimeTypes[0] !== '*/*' && maxFileSize && <span> &middot; </span>}
          {maxFileSize && <span>Max {formatFileSize(maxFileSize)}</span>}
        </p>
      )}
    </div>
  );
}
