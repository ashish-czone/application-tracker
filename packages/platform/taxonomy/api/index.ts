export { TaxonomyModule } from './taxonomy.module';
export { TaxonomyService } from './services/taxonomy.service';
export { CategoryService, normalizeMetadataKeys } from './services/category.service';
export { TAXONOMY_PERMISSIONS } from './permissions';
export type { TagGroup, Tag, TagWithGroup, EntityTag, CategoryGroup, Category, CategoryTreeNode } from './types';
export { tagGroups, tags, entityTags, categoryGroups, categories } from './schema';
