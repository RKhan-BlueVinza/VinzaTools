import React, { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'vinza_cookie_consent';

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-2xl animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1212] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] md:flex-row md:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400">
          <Cookie size={22} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">We use cookies</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-400">
            We use essential cookies to keep the site working smoothly.{' '}
            <button
              type="button"
              onClick={decline}
              className="underline underline-offset-2 text-rose-400 hover:text-rose-300 transition-colors"
            >
              Cookie Policy
            </button>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={decline}
            className="vinza-button rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="vinza-button rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-600"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={decline}
            aria-label="Close"
            className="vinza-button rounded-xl p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
