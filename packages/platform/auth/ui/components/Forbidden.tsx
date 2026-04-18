import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';

interface ForbiddenProps {
  permission?: string;
}

export function Forbidden({ permission }: ForbiddenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-semibold text-foreground">You don't have access to this page</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ask an administrator to grant you the required permission
        {permission ? <> (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{permission}</code>)</> : null}
        .
      </p>
      <Link to="/" className="mt-6 text-sm font-medium text-primary hover:underline">
        Return to home
      </Link>
    </div>
  );
}
