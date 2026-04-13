export { TemplatesListPage } from './pages/TemplatesListPage';
export { TemplateFormModal } from './components/TemplateFormModal';
export {
  useTemplates, useTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from './hooks';
export { createNotificationsApi, type NotificationsApi } from './services';
export type {
  NotificationTemplate, NotificationChannel,
  CreateTemplateRequest, UpdateTemplateRequest, ListTemplatesParams,
} from './types';
