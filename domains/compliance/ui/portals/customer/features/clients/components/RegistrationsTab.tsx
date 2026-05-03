import { useEffect, useState } from 'react';
import { DataTable, Pagination, SearchInput } from '@packages/ui';
import { useClientRegistrationsList } from '../../../../../hooks/useClientDetailData';
import { useDebouncedValue } from '../../../../../hooks/useDebouncedValue';
import { CLIENT_DETAIL_REGISTRATION_COLUMNS } from './clientDetailRegistrationColumns';

const PAGE_LIMIT = 25;

export interface RegistrationsTabProps {
  clientId: string;
}

/**
 * Full registrations grid for the client detail page. Pagination + search +
 * sort all round-trip to the server via {@link useClientRegistrationsList}.
 *
 * Lives in the domain UI as a component (not a page) — the route + tab
 * wiring lives in `ClientDetailPage`. The component takes `clientId` as a
 * prop so the same code composes into any app that hosts the compliance
 * domain (per `frontend-conventions.md`).
 */
export function RegistrationsTab({ clientId }: RegistrationsTabProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [sort] = useState<string>('registeredAt:desc');

  // Reset to page 1 whenever the filter shape changes — otherwise switching
  // search terms can land the user on an empty page index from a wider
  // result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const query = useClientRegistrationsList(clientId, {
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch || undefined,
    sort,
  });

  return (
    <div className="bg-paper-raised border border-rule">
      <div className="px-3 py-3 border-b border-rule">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registration number…"
          wrapperClassName="min-w-[220px] max-w-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <DataTable
          columns={CLIENT_DETAIL_REGISTRATION_COLUMNS}
          visibleColumns={CLIENT_DETAIL_REGISTRATION_COLUMNS.map((c) => c.key)}
          rows={query.rows}
          getRowKey={(r) => r.id}
          onRowClick={() => {}}
        />
      </div>

      {query.meta && query.meta.total > 0 && (
        <Pagination
          page={page}
          pageSize={PAGE_LIMIT}
          pageCount={query.meta.totalPages}
          totalRows={query.meta.total}
          onPageChange={setPage}
          onPageSizeChange={() => {
            setPage(1);
          }}
        />
      )}

      {!query.loading && query.rows.length === 0 && (
        <div className="px-6 py-10 text-center">
          <p className="font-serif italic text-ink-soft text-sm">
            {debouncedSearch
              ? 'No registrations match your search.'
              : 'No registrations for this client yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
