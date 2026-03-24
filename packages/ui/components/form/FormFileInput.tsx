import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Upload, X, FileText } from 'lucide-react';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface FormFileInputProps {
  name: string;
  label: string;
  /** Accepted MIME types (e.g., ['application/pdf', 'image/*']) */
  accept?: string[];
  /** Max file size in bytes */
  maxFileSize?: number;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * File input with drag-and-drop support.
 * Stores the File object in form state. Upload is handled by the parent on submit.
 */
export function FormFileInput({
  name,
  label,
  accept,
  maxFileSize,
  description,
  disabled,
  className,
}: FormFileInputProps) {
  const { control } = useFormContext();
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;
        const describedBy = [
          hasError ? errorId : null,
          description ? descriptionId : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined;

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <FileDropZone
              file={field.value as File | null}
              onChange={field.onChange}
              onBlur={field.onBlur}
              accept={accept}
              maxFileSize={maxFileSize}
              disabled={disabled}
              hasError={hasError}
              inputId={name}
              aria-describedby={describedBy}
            />
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
            {maxFileSize && (
              <p className="text-xs text-muted-foreground">
                Max size: {formatBytes(maxFileSize)}
              </p>
            )}
            {hasError && (
              <p id={errorId} className="text-sm text-destructive" aria-live="polite">
                {fieldState.error?.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

function FileDropZone({
  file,
  onChange,
  onBlur,
  accept,
  maxFileSize,
  disabled,
  hasError,
  inputId,
  ...rest
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onBlur: () => void;
  accept?: string[];
  maxFileSize?: number;
  disabled?: boolean;
  hasError?: boolean;
  inputId: string;
  'aria-describedby'?: string;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const acceptString = accept?.join(',');

  const validateAndSet = (f: File) => {
    setLocalError(null);

    if (accept && accept.length > 0) {
      const matches = accept.some((type) => {
        if (type.endsWith('/*')) {
          return f.type.startsWith(type.replace('/*', '/'));
        }
        return f.type === type;
      });
      if (!matches) {
        setLocalError(`File type not accepted. Allowed: ${accept.join(', ')}`);
        return;
      }
    }

    if (maxFileSize && f.size > maxFileSize) {
      setLocalError(`File too large. Max: ${formatBytes(maxFileSize)}`);
      return;
    }

    onChange(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  if (file) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5',
          disabled && 'opacity-50',
        )}
        {...rest}
      >
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => { onChange(null); setLocalError(null); }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div {...rest}>
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
          hasError && 'border-destructive',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
          </p>
          {accept && (
            <p className="text-xs text-muted-foreground mt-1">
              {accept.map(formatMimeType).join(', ')}
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={acceptString}
        onChange={handleFileChange}
        onBlur={onBlur}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      />

      {localError && (
        <p className="text-sm text-destructive mt-1">{localError}</p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatMimeType(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'image/*': 'Images',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
  };
  return map[mime] ?? mime;
}
