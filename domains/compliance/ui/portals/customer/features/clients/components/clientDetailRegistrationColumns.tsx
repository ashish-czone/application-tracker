import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate, JurisdictionTag, InactiveSourceMarker } from '../../../../../components';
import type { ClientRegistrationRecord } from '../../../../../hooks/useClientDetailData';

/**
 * Column set for the Registrations tab on the client detail page. Each row
 * is a `ClientRegistrationRecord` already enriched server-side with
 * `lawCode` / `lawName` / `lawJurisdiction` / `lawIssuingAuthority` via
 * the LEFT JOIN in `ClientRegistrationsService.list` — no client-side
 * lookup against `/laws`.
 */
export const CLIENT_DETAIL_REGISTRATION_COLUMNS: DataTableColumn<ClientRegistrationRecord>[] = [
  {
    key: 'lawCode',
    header: 'Law',
    cell: (r) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink tracking-wide">
            {r.lawCode ?? '—'}
          </span>
          {r.lawJurisdiction && (
            <JurisdictionTag
              jurisdiction={r.lawJurisdiction === 'state' ? 'state' : 'central'}
              variant="muted"
            />
          )}
          {r.deactivatedAt && <InactiveSourceMarker kind="deactivated" />}
        </div>
        <span className="text-[11px] font-sans text-ink-muted mt-0.5 block truncate">
          {r.lawName ?? ''}
        </span>
      </div>
    ),
  },
  {
    key: 'lawIssuingAuthority',
    header: 'Regulator',
    width: '160px',
    cell: (r) => (
      <span className="text-[11px] font-sans text-ink-soft">
        {r.lawIssuingAuthority ?? '—'}
      </span>
    ),
  },
  {
    key: 'registrationNumber',
    header: 'Registration #',
    width: '180px',
    cell: (r) => (
      <span className="font-mono text-[11px] text-ink tracking-wide">
        {r.registrationNumber ?? '—'}
      </span>
    ),
  },
  {
    key: 'effectiveFrom',
    header: 'Effective from',
    width: '120px',
    cell: (r) =>
      r.effectiveFrom ? (
        <OrdinalDate date={r.effectiveFrom} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
  {
    key: 'registeredAt',
    header: 'Registered',
    width: '120px',
    cell: (r) =>
      r.registeredAt ? (
        <OrdinalDate
          date={r.registeredAt.slice(0, 10)}
          variant="short"
          className="text-[11px]"
        />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
  {
    key: 'deactivatedAt',
    header: 'Deactivated',
    width: '120px',
    cell: (r) =>
      r.deactivatedAt ? (
        <OrdinalDate
          date={r.deactivatedAt.slice(0, 10)}
          variant="short"
          className="text-[11px] text-ink-muted"
        />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
];
