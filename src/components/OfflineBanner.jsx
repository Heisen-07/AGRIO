import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useLanguage } from '../context/LanguageContext';

/**
 * Persistent pill shown whenever the device loses connectivity.
 * The app shell keeps working from the service-worker cache; this just
 * tells the farmer that live features (e.g. AI crop scan) are paused.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-white text-xs font-bold shadow-neumorphic"
        >
          <WifiOff className="w-4 h-4" />
          <span>{t.offlineBanner}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
