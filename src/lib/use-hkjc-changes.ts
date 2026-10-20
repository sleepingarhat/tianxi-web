import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getHkjcChanges, getChangeProgress } from './hkjc-changes.functions';
import { CHANGES_POLL_MS } from './live-racing-changes';

export function useHkjcChanges(date?: string) {
  const read = useServerFn(getHkjcChanges);
  return useQuery({
    queryKey: ['hkjc-changes', date],
    queryFn: () => {
      if (!date) throw new Error('未有賽日日期');
      return read({ data: { date } });
    },
    enabled: !!date,
    staleTime: 0,
    refetchInterval: CHANGES_POLL_MS,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: 1,
  });
}

export function useChangeProgress(date?: string) {
  const read = useServerFn(getChangeProgress);
  return useQuery({ queryKey:['racing-change-progress',date], queryFn:() => {
    if(!date) throw new Error('未有賽日日期');
    return read({data:{date}});
  }, enabled:!!date, staleTime:0, refetchInterval:CHANGES_POLL_MS, refetchOnWindowFocus:'always', retry:1 });
}