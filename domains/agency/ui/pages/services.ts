import type { ApiFn } from '@packages/platform-ui';
import type {
  CreatePageInput,
  CreateSectionInput,
  PageRecord,
  Paginated,
  SectionRecord,
  UpdatePageInput,
} from './types';

export function createPagesApi(api: ApiFn) {
  return {
    listPages(params: { page?: number; limit?: number; search?: string } = {}): Promise<Paginated<PageRecord>> {
      const qs = new URLSearchParams();
      if (params.page && params.page > 1) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.search) qs.set('search', params.search);
      const suffix = qs.toString() ? `?${qs}` : '';
      return api.get(`/pages${suffix}`);
    },

    getPage(id: string): Promise<PageRecord> {
      return api.get(`/pages/${id}`);
    },

    createPage(input: CreatePageInput): Promise<PageRecord> {
      return api.post('/pages', input);
    },

    updatePage(id: string, input: UpdatePageInput): Promise<PageRecord> {
      return api.patch(`/pages/${id}`, input);
    },

    deletePage(id: string): Promise<void> {
      return api.delete(`/pages/${id}`);
    },

    listSections(pageId: string): Promise<Paginated<SectionRecord>> {
      const qs = new URLSearchParams({ pageId, _sort: 'order', limit: '500' });
      return api.get(`/sections?${qs}`);
    },

    createSection(input: CreateSectionInput): Promise<SectionRecord> {
      return api.post('/sections', input);
    },

    deleteSection(id: string): Promise<void> {
      return api.delete(`/sections/${id}`);
    },

    reorderSections(pageId: string, orders: { id: string; order: number }[]): Promise<void> {
      return api.put(`/pages/${pageId}/sections:reorder`, { orders });
    },
  };
}

export type PagesUiApi = ReturnType<typeof createPagesApi>;
