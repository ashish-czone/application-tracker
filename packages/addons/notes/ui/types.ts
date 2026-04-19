export interface NoteAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface NoteWithAuthor {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  author: NoteAuthor;
}

export interface CreateNoteRequest {
  entityType: string;
  entityId: string;
  content: string;
  isInternal?: boolean;
}

export interface UpdateNoteRequest {
  content?: string;
  isInternal?: boolean;
}
