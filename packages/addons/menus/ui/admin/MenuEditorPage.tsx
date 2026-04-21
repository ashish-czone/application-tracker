import { useParams, useNavigate } from 'react-router';
import { MenuEditor } from './MenuEditor';

/**
 * Router-aware wrapper around <MenuEditor>. Mount at /menus/:id/edit.
 */
export function MenuEditorPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const menuId = params.id;

  if (!menuId) {
    return <div className="p-6 text-sm text-muted-foreground">Missing menu id.</div>;
  }

  return (
    <MenuEditor
      menuId={menuId}
      onBack={() => navigate('/menus')}
    />
  );
}
