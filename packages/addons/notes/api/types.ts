export interface Note {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface NoteMention {
  id: string;
  noteId: string;
  userId: string;
  createdAt: Date;
}

export interface NoteAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Note with joined author info — returned by list/detail endpoints */
export interface NoteWithAuthor extends Note {
  author: NoteAuthor;
}
