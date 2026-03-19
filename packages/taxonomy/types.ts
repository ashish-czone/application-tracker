export interface TagGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allowMultiple: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  tagGroupId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Tag with its group context — returned by tag loader */
export interface TagWithGroup extends Tag {
  groupName: string;
  groupSlug: string;
}

export interface EntityTag {
  entityType: string;
  entityId: string;
  tagId: string;
  createdAt: Date;
}
