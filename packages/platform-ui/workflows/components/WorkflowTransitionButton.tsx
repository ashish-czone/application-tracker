import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@packages/ui';
import { getAvailableTransitions, type ClientAvailableTransition } from '../helpers/getAvailableTransitions';
import type { WorkflowDefinition } from '../types';

interface WorkflowTransitionButtonProps {
  workflow: WorkflowDefinition;
  currentState: string;
  onTransitionSelect: (toStateName: string, transitionName: string, toStateLabel: string) => void;
}

/**
 * Split button for workflow transitions.
 * Primary section: first forward transition (click triggers it directly).
 * Dropdown chevron: all available transitions (forward first, then sideways).
 */
export function WorkflowTransitionButton({
  workflow,
  currentState,
  onTransitionSelect,
}: WorkflowTransitionButtonProps) {
  const available = useMemo(
    () => getAvailableTransitions(workflow, currentState),
    [workflow, currentState],
  );

  if (available.length === 0) return null;

  const forward = available.filter((t) => t.isForward);
  const sideways = available.filter((t) => !t.isForward);

  // Primary action: first forward transition, or first sideways if no forward
  const primary = forward[0] ?? sideways[0];

  const handlePrimaryClick = () => {
    onTransitionSelect(primary.toState.name, primary.transition.name, primary.toState.label);
  };

  const handleItemClick = (t: ClientAvailableTransition) => {
    onTransitionSelect(t.toState.name, t.transition.name, t.toState.label);
  };

  // Single transition: just a regular button, no dropdown
  if (available.length === 1) {
    return (
      <Button size="sm" onClick={handlePrimaryClick}>
        {primary.transition.name}
      </Button>
    );
  }

  // Multiple transitions: split button
  return (
    <div className="inline-flex rounded-md shadow-sm">
      <Button
        size="sm"
        className="rounded-r-none border-r border-r-primary-foreground/30"
        onClick={handlePrimaryClick}
      >
        {primary.transition.name}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="rounded-l-none px-2">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {forward.map((t) => (
            <DropdownMenuItem key={t.transition.id} onClick={() => handleItemClick(t)}>
              {t.transition.name}
              <span className="ml-2 text-muted-foreground text-xs">{t.toState.label}</span>
            </DropdownMenuItem>
          ))}
          {forward.length > 0 && sideways.length > 0 && <DropdownMenuSeparator />}
          {sideways.map((t) => (
            <DropdownMenuItem key={t.transition.id} onClick={() => handleItemClick(t)}>
              {t.transition.name}
              <span className="ml-2 text-muted-foreground text-xs">{t.toState.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
