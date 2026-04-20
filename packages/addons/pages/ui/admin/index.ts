export {
  buildPuckConfig,
  sectionsToPuckData,
  puckDataToSections,
} from './puck-adapter';
export type {
  PuckConfig,
  PuckComponentConfig,
  PuckContentItem,
  PuckData,
  PuckField,
  SectionDraft,
} from './puck-adapter';

export { createPagesApi } from './services';
export type { PagesUiApi } from './services';
export {
  usePagesList,
  usePage,
  useCreatePage,
  useUpdatePage,
  useDeletePage,
  useSectionsForPage,
  useSavePageSections,
} from './hooks';
export type {
  PageRecord,
  SectionRecord,
  CreatePageInput,
  UpdatePageInput,
  CreateSectionInput,
  Paginated,
} from './types';

export { PageEditor } from './PageEditor';
export type { PageEditorProps } from './PageEditor';
