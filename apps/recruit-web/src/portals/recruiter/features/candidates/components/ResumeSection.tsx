import { useRef } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, Button } from '@packages/ui';
import { uploadResume } from '../services';
import type { Candidate } from '../types';

interface ResumeSectionProps {
  candidate: Candidate;
}

export function ResumeSection({ candidate }: ResumeSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadResume(candidate.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      toast.success('Resume uploaded');
    },
    onError: () => toast.error('Failed to upload resume'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDownload() {
    if (!candidate.resumeFile) return;
    const url = `/api/v1/candidates/${candidate.id}/resume/download`;
    window.open(url, '_blank');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <span className="text-sm font-medium text-foreground">Resume</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="h-7 px-2 text-xs"
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          {candidate.resumeFile ? 'Replace' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="px-4 py-3">
        {uploadMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        ) : candidate.resumeFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">{candidate.resumeFile.originalName}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(candidate.resumeFile.size)}</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-7 px-2 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No resume uploaded</p>
        )}
      </div>
    </div>
  );
}
