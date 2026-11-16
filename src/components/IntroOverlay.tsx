import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export type IntroPhase = 'welcome' | 'creator' | 'hidden';

interface IntroOverlayProps {
  phase: IntroPhase;
  theme: 'dark' | 'light';
  skipLabel: string;
  hintLabel: string;
  onAdvance: () => void;
  onSkip: () => void;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({
  phase,
  theme,
  skipLabel,
  hintLabel,
  onAdvance,
  onSkip,
}) => {
  useEffect(() => {
    if (phase === 'hidden') return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAdvance();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [phase, onAdvance, onSkip]);

  const isLight = theme === 'light';

  return (
    <AnimatePresence>
      {phase !== 'hidden' && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          onClick={onAdvance}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center backdrop-blur-2xl cursor-pointer select-none px-4 ${
            isLight ? 'bg-slate-100/85' : 'bg-[#07090e]/85'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className={`absolute top-5 right-5 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isLight
                ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 shadow-sm'
                : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
            }`}
          >
            <span>{skipLabel}</span>
            <ArrowRight size={14} />
          </button>

          <div className="text-center max-w-5xl w-full">
            <AnimatePresence mode="wait">
              {phase === 'welcome' ? (
                <motion.h2
                  key="welcome"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="text-5xl sm:text-7xl md:text-9xl font-bold tracking-tight py-8 font-['IBM_Plex_Sans_Arabic']"
                  dir="rtl"
                >
                  <span
                    className={`bg-clip-text text-transparent ${
                      isLight
                        ? 'bg-gradient-to-r from-sky-600 via-blue-700 to-purple-700 drop-shadow-[0_4px_24px_rgba(2,132,199,0.2)]'
                        : 'bg-gradient-to-r from-white via-cyan-200 to-[#00f0ff] drop-shadow-[0_0_40px_rgba(0,240,255,0.35)]'
                    }`}
                  >
                    بەخێربێیت
                  </span>
                </motion.h2>
              ) : (
                <motion.div
                  key="creator"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4 py-8"
                >
                  <p
                    className={`uppercase tracking-[0.45em] md:tracking-[0.8em] text-base md:text-2xl font-bold ${
                      isLight ? 'text-slate-600' : 'text-white/70'
                    }`}
                  >
                    Created By
                  </p>
                  <h2 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-none">
                    <span
                      className={`bg-clip-text text-transparent ${
                        isLight
                          ? 'bg-gradient-to-r from-slate-900 via-sky-700 to-purple-700 drop-shadow-[0_4px_20px_rgba(0,0,0,0.12)]'
                          : 'bg-gradient-to-r from-white via-cyan-100 to-[#00f0ff] drop-shadow-[0_0_40px_rgba(0,240,255,0.35)]'
                      }`}
                    >
                      BASAM QABIL
                    </span>
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p
            className={`mt-6 text-xs tracking-wider uppercase ${
              isLight ? 'text-slate-500' : 'text-white/50'
            }`}
          >
            {hintLabel}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
