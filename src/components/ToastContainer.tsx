import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: number;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2.5 max-w-sm w-[calc(100%-2.5rem)] pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const styleMap = {
            error: 'border-red-500/50 bg-red-950/90 text-red-100 toast-error',
            success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100 toast-success',
            info: 'border-[#00f0ff]/40 bg-slate-900/95 text-slate-100 toast-info',
          };

          const Icon =
            toast.type === 'error'
              ? AlertCircle
              : toast.type === 'success'
                ? CheckCircle2
                : Info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${styleMap[toast.type]}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="text-xs sm:text-sm leading-relaxed flex-1" dir="auto">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Close notification"
                className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
