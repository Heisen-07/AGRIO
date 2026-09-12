import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, X } from 'lucide-react';

/**
 * MobileNavDrawer — a reusable, professional slide-in navigation drawer.
 *
 * Presentational only: the caller passes `items` (each already bound to its own
 * onClick + active flag) plus an optional `footer` slot, so the SAME component
 * powers both the public navbar drawer and the dashboard drawer.
 *
 * Robustness notes:
 *  - Rendered through a portal into <body> so no transformed ancestor (framer-motion
 *    animated parents, etc.) can ever break the viewport-fixed overlay.
 *  - `md:hidden` — never present on desktop, where the sidebar / navbar take over.
 *  - Locks body scroll and closes on Escape / overlay click / item tap.
 */
export default function MobileNavDrawer({
  open,
  onClose,
  title = 'AGRIO',
  subtitle,
  items = [],
  footer,
}) {
  // Lock the underlying page + wire the Escape key while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true">
          {/* Overlay — subtle darkened blur, tap to dismiss */}
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-emerald-950/40 backdrop-blur-sm"
          />

          {/* Sliding panel */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col bg-white shadow-2xl rounded-r-3xl"
          >
            {/* Branded header */}
            <div className="flex h-16 items-center justify-between gap-3 rounded-tr-3xl bg-emerald-950 px-5 text-white shrink-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 shrink-0">
                  <Sprout className="h-5 w-5 text-emerald-300" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-extrabold leading-tight tracking-tight">{title}</p>
                  {subtitle && (
                    <p className="truncate text-[10px] uppercase tracking-wider text-emerald-300/70">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all hover:bg-white/10 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav list */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick?.();
                      onClose?.();
                    }}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      item.active
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    {Icon && (
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          item.active ? 'text-emerald-700' : 'text-emerald-500'
                        }`}
                      />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.active && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  </button>
                );
              })}
            </nav>

            {/* Optional footer slot (farm selector, language, auth actions…) */}
            {footer && (
              <div className="shrink-0 border-t border-emerald-100/60 p-3">{footer}</div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
