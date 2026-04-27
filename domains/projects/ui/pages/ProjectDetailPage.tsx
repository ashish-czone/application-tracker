import { useParams } from 'react-router';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="container mx-auto py-6">
      <p className="text-sm text-muted-foreground">Project detail (id: {id}) — coming next.</p>
    </div>
  );
}
