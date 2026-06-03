import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="vinza-button fixed bottom-20 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#1a1212] text-rose-400 shadow-lg shadow-black/40 transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 hover:shadow-xl hover:shadow-rose-500/10 md:bottom-6 md:right-6"
    >
      <ArrowUp size={18} />
    </button>
  );
};
