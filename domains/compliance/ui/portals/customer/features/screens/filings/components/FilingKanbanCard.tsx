import { AvatarBadge } from '@packages/ui';
import { OrdinalDate, JurisdictionTag } from '../../../../../../components';
import type { FilingRow } from '../data/filingsMock';

export interface FilingKanbanCardProps {
  filing: FilingRow;
  onOpen: (filing: FilingRow) => void;
}

export function FilingKanbanCard({ filing, onOpen }: FilingKanbanCardProps) {
  return (
    <div className="w-full text-left bg-paper-raised border border-rule p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] tracking-tabular uppercase text-ink font-medium">
          {filing.lawCode}
        </span>
        <JurisdictionTag jurisdiction={filing.jurisdiction} />
      </div>
      <button
        type="button"
        onClick={() => onOpen(filing)}
        className="text-sm text-ink font-sans leading-snug truncate hover:underline cursor-pointer"
      >
        {filing.ruleName}
      </button>
      <div className="text-[11px] text-ink-muted font-sans mt-0.5 truncate">
        {filing.clientName}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-rule/50">
        <OrdinalDate date={filing.dueDate} variant="short" className="text-[10px]" />
        {filing.handler && <AvatarBadge initials={filing.handler.initials} size="xs" />}
      </div>
    </div>
  );
}
