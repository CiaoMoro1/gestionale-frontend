import { useEffect } from 'react';
export function useSyncedScroll(a: React.RefObject<HTMLDivElement>, b: React.RefObject<HTMLDivElement>, deps: React.DependencyList = []) {
  useEffect(() => {
    const A = a.current, B = b.current; if (!A || !B) return;
    const handleA = () => { if (B.scrollLeft !== A.scrollLeft) B.scrollLeft = A.scrollLeft; };
    const handleB = () => { if (A.scrollLeft !== B.scrollLeft) A.scrollLeft = B.scrollLeft; };
    A.addEventListener('scroll', handleA); B.addEventListener('scroll', handleB);
    return () => { A.removeEventListener('scroll', handleA); B.removeEventListener('scroll', handleB); };
  }, deps);
}
