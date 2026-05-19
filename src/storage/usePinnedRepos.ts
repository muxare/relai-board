import { useEffect, useState } from 'react';
import { getPinnedRepos, subscribePinned } from './pinnedRepos';

export function usePinnedRepos(): string[] {
  const [pinned, setPinned] = useState<string[]>(() => getPinnedRepos());
  useEffect(() => {
    setPinned(getPinnedRepos());
    return subscribePinned(setPinned);
  }, []);
  return pinned;
}
