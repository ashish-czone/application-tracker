import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../api/settingsApi';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });
}
