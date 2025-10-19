import React, { useEffect } from 'react'; import type { ToastType } from '../types';
export default function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }){
  useEffect(()=>{ const t=setTimeout(onClose,2300); return ()=>clearTimeout(t); },[onClose]);
  return <div className={type==='success'?'fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border bg-green-100 border-green-300 text-green-800':'fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border bg-red-100 border-red-300 text-red-700'}>{message}</div>;
}
