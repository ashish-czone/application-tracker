import { useParams } from 'react-router';

export default function WorkflowEditorPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Workflow: {slug}</h1>
        <p className="text-sm text-muted-foreground">Visual workflow editor</p>
      </div>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  );
}
