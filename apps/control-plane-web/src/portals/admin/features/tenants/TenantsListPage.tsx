import { useNavigate } from 'react-router';
import { cn } from '@packages/ui/lib/utils';
import { useTenants } from './hooks';
import type { Tenant } from './types';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  provisioning: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', statusColors[status] ?? 'bg-muted text-muted-foreground border-border')}>
      {status}
    </span>
  );
}

export function TenantsListPage() {
  const { data: tenants, isLoading } = useTenants();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenants</h2>
        <span className="text-sm text-muted-foreground">{tenants?.length ?? 0} total</span>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {(!tenants || tenants.length === 0) ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No tenants yet. Tenants are created when subscriptions are activated.
                </td>
              </tr>
            ) : (
              tenants.map((tenant: Tenant) => (
                <tr
                  key={tenant.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/tenants/${tenant.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{tenant.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{tenant.slug}</td>
                  <td className="px-4 py-3"><StatusBadge status={tenant.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{tenant.plan ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
