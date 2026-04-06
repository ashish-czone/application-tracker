import { useParams, useNavigate } from 'react-router';
import { cn } from '@packages/ui/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useTenant, useUpdateTenant } from './hooks';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  provisioning: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', statusColors[status] ?? 'bg-muted text-muted-foreground border-border')}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <dt className="w-40 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground min-w-0 break-all">{value ?? '—'}</dd>
    </div>
  );
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading } = useTenant(id ?? null);
  const updateMutation = useUpdateTenant();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Tenant not found
      </div>
    );
  }

  const handleStatusChange = (newStatus: 'active' | 'suspended' | 'provisioning') => {
    if (tenant.status === newStatus) return;
    updateMutation.mutate({ id: tenant.id, data: { status: newStatus } });
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tenants')}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{tenant.name}</h2>
          <p className="text-sm text-muted-foreground font-mono">{tenant.slug}</p>
        </div>
        <StatusBadge status={tenant.status} />
      </div>

      {/* Details */}
      <div className="rounded-lg border border-border bg-white p-6">
        <h3 className="text-sm font-semibold mb-4">Tenant Details</h3>
        <dl>
          <InfoRow label="ID" value={<span className="font-mono text-xs">{tenant.id}</span>} />
          <InfoRow label="Name" value={tenant.name} />
          <InfoRow label="Slug" value={<span className="font-mono text-xs">{tenant.slug}</span>} />
          <InfoRow label="Status" value={<StatusBadge status={tenant.status} />} />
          <InfoRow label="Database URL" value={<span className="font-mono text-xs">{tenant.databaseUrl}</span>} />
          <InfoRow label="Plan" value={tenant.plan} />
          <InfoRow
            label="Capabilities"
            value={
              tenant.capabilities && tenant.capabilities.length > 0
                ? (
                  <div className="flex flex-wrap gap-1">
                    {tenant.capabilities.map((cap) => (
                      <span key={cap} className="inline-flex px-2 py-0.5 rounded bg-muted text-xs font-medium">
                        {cap}
                      </span>
                    ))}
                  </div>
                )
                : undefined
            }
          />
          <InfoRow label="Plan Expiry" value={tenant.planExpiry ? new Date(tenant.planExpiry).toLocaleDateString() : undefined} />
          <InfoRow label="Client ID" value={tenant.clientId ? <span className="font-mono text-xs">{tenant.clientId}</span> : undefined} />
          <InfoRow label="Created" value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleString() : undefined} />
          <InfoRow label="Updated" value={tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleString() : undefined} />
        </dl>
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-border bg-white p-6">
        <h3 className="text-sm font-semibold mb-4">Actions</h3>
        <div className="flex gap-2">
          {tenant.status === 'provisioning' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Activate
            </button>
          )}
          {tenant.status === 'active' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Suspend
            </button>
          )}
          {tenant.status === 'suspended' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
