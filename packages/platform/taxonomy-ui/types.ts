export interface EntityTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  tagGroupId: string;
  groupName: string;
  groupSlug: string;
}

export interface TagOption {
  value: string;
  label: string;
  color?: string;
}
