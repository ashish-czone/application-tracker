import { StickyNote } from 'lucide-react';
import type { NoteWithAuthor } from '../types';
import { NoteItem } from './NoteItem';

interface NotesListProps {
  notes: NoteWithAuthor[];
  currentUserId: string;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  searchUsers: (query: string) => Promise<{ id: string; label: string }[]>;
}

export function NotesList({ notes, currentUserId, onUpdate, onDelete, isUpdating, searchUsers }: NotesListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <StickyNote className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No notes yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add a note to start the conversation</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          currentUserId={currentUserId}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isUpdating={isUpdating}
          searchUsers={searchUsers}
        />
      ))}
    </div>
  );
}
