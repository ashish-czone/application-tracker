import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2, MoreHorizontal, Eye } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
} from '@packages/ui';
import type { NoteWithAuthor } from '../types';
import { NoteEditor } from './NoteEditor';

interface NoteItemProps {
  note: NoteWithAuthor;
  currentUserId: string;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  searchUsers: (query: string) => Promise<{ id: string; label: string }[]>;
}

export function NoteItem({ note, currentUserId, onUpdate, onDelete, isUpdating, searchUsers }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = note.authorId === currentUserId;
  const initials = `${note.author.firstName?.[0] ?? ''}${note.author.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const authorName = `${note.author.firstName} ${note.author.lastName}`.trim();
  const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });

  const handleUpdate = (html: string) => {
    onUpdate(note.id, html);
    setIsEditing(false);
  };

  return (
    <div className="flex gap-3 py-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {initials}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">{authorName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {note.isInternal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              Internal
            </span>
          )}
        </div>

        {isEditing ? (
          <NoteEditor
            initialContent={note.content}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={isUpdating}
            searchUsers={searchUsers}
          />
        ) : (
          <div
            className="prose prose-sm max-w-none text-foreground [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:font-medium"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        )}
      </div>

      {/* Actions */}
      {isAuthor && !isEditing && (
        <div className="flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          onDelete(note.id);
          setShowDeleteConfirm(false);
        }}
      />
    </div>
  );
}
