import { useEffect } from 'react';
export function useDropdownClose(refs: React.RefObject<HTMLElement>[], onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (refs.every(ref => ref.current && !ref.current.contains(e.target as Node))) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [refs, onClose]);
}
