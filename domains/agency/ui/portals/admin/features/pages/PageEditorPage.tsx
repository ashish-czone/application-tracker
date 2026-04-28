import { useParams, useNavigate } from 'react-router';
import { PageEditor } from './PageEditor';

/**
 * Router-aware wrapper around <PageEditor>. Extracts :id from the URL,
 * navigates back to the pages list on save. Mount at /pages/:id/edit.
 */
export function PageEditorPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pageId = params.id;

  if (!pageId) {
    return <div className="p-6 text-sm text-muted-foreground">Missing page id.</div>;
  }

  return (
    <PageEditor
      pageId={pageId}
      onSaved={() => navigate('/pages')}
    />
  );
}
