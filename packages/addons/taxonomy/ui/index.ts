export { TaxonomyProvider, useTaxonomyApi } from './TaxonomyProvider';

export {
  useTagGroupsList,
  useCreateTagGroup,
  useUpdateTagGroup,
  useDeleteTagGroup,
  useTagsByGroup,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useCategoryGroupsList,
  useCreateCategoryGroup,
  useUpdateCategoryGroup,
  useDeleteCategoryGroup,
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useMoveCategory,
  useDeleteCategory,
} from './hooks';

export { TagGroupsListPage } from './pages/TagGroupsListPage';
export { TagsList } from './components/TagsList';
export { AddTagGroupForm } from './components/AddTagGroupForm';
export { EditTagGroupForm } from './components/EditTagGroupForm';
export { DeleteTagGroupDialog } from './components/DeleteTagGroupDialog';
export { AddTagForm } from './components/AddTagForm';
export { EditTagForm } from './components/EditTagForm';
export { DeleteTagDialog } from './components/DeleteTagDialog';

export { CategoryGroupsListPage } from './pages/CategoryGroupsListPage';
export { CategoryTree } from './components/CategoryTree';
export { AddCategoryGroupForm } from './components/AddCategoryGroupForm';
export { EditCategoryGroupForm } from './components/EditCategoryGroupForm';
export { DeleteCategoryGroupDialog } from './components/DeleteCategoryGroupDialog';
export { AddCategoryForm } from './components/AddCategoryForm';
export { EditCategoryForm } from './components/EditCategoryForm';
export { DeleteCategoryDialog } from './components/DeleteCategoryDialog';

export { EntityTagsChipRow } from './components/EntityTagsChipRow';
export { useEntityTags, useSetEntityTags } from './hooks';
export { createEntityTaxonomyApi, type EntityTaxonomyApi } from './services';
export type { EntityTag, TagOption, ApiFn } from './types';

// Feature contract + header plugin
export { TAGS_FEATURE_KEY, readTagsFeature } from './feature';
export type { TagsFeatureValue } from './feature';
export { tagsHeaderPlugin } from './plugins';

// WebFeatureManifest entry — apps pass to WebShell.features
export { taxonomyWeb } from './manifest';

export type {
  TaxonomyApiFn,
  TagGroup,
  Tag,
  CreateTagGroupRequest,
  UpdateTagGroupRequest,
  ListTagGroupsParams,
  CreateTagRequest,
  UpdateTagRequest,
  CategoryGroup,
  CategoryTreeNode,
  Category,
  CreateCategoryGroupRequest,
  UpdateCategoryGroupRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  MoveCategoryRequest,
} from './types';
