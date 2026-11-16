import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Download, RefreshCw, Type, Loader2, XCircle, Layers } from 'lucide-react';
import { PromptResult } from '../services/geminiService';

interface OutputPanelProps {
  prompts: PromptResult[];
  activeSlide: Record<number, number>;
  copiedKeys: string[];
  isLoading: boolean;
  progress: { completed: number; total: number; label: string } | null;
  labels: {
    promptsPlaceholder: string;
    copy: string;
    copied: string;
    copyAllSlides: string;
    exportTxt: string;
    regenerate: string;
    generating: string;
    cancel: string;
  };
  onSelectSlide: (groupIdx: number, slideIdx: number) => void;
  onCopy: (text: string, key: string) => void;
  onExportAll: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  prompts,
  activeSlide,
  copiedKeys,
  isLoading,
  progress,
  labels,
  onSelectSlide,
  onCopy,
  onExportAll,
  onRegenerate,
  onCancel,
}) => {
  return (
    <section className="lg:col-span-7 space-y-4">
      {(prompts.length > 0 || isLoading) && (
        <div className="liquid-panel rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {isLoading ? (
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <Loader2 size={18} className="animate-spin text-[#00f0ff] shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">
                  {progress
                    ? `${labels.generating} (${progress.completed}/${progress.total}) — ${progress.label}`
                    : labels.generating}
                </p>
                {progress && progress.total > 0 && (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00f0ff] to-[#b026ff] transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((progress.completed / progress.total) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 flex items-center gap-1.5 transition-colors"
              >
                <XCircle size={14} />
                {labels.cancel}
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs font-semibold text-white/70">
                {prompts.length} {prompts.length === 1 ? 'Prompt Group' : 'Prompt Groups'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/15 border border-white/10 flex items-center gap-1.5 transition-colors text-[#00f0ff]"
                >
                  <RefreshCw size={13} />
                  {labels.regenerate}
                </button>
                <button
                  type="button"
                  onClick={onExportAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/15 border border-white/10 flex items-center gap-1.5 transition-colors text-white"
                >
                  <Download size={13} />
                  {labels.exportTxt}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {prompts.length > 0 ? (
            prompts.map((promptGroup, groupIdx) => {
              const slidePrompts =
                promptGroup.prompts && promptGroup.prompts.length > 0
                  ? promptGroup.prompts
                  : [promptGroup.prompt];
              const safeSlideIdx = Math.min(
                activeSlide[groupIdx] || 0,
                Math.max(0, slidePrompts.length - 1)
              );
              const promptText = slidePrompts[safeSlideIdx] || '';
              const copyKey = `${groupIdx}-${safeSlideIdx}`;
              const copyAllKey = `${groupIdx}-all`;
              const isMultiSlide = slidePrompts.length > 1;
              const isCopied = copiedKeys.includes(copyKey);
              const isAllCopied = copiedKeys.includes(copyAllKey);

              return (
                <motion.div
                  key={`${promptGroup.title}-${groupIdx}`}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ delay: Math.min(groupIdx * 0.06, 0.3) }}
                  className={`liquid-panel rounded-[28px] p-5 flex flex-col h-full transition-all duration-300 ${
                    promptGroup.isError
                      ? 'border-red-500/50'
                      : isCopied
                        ? 'border-emerald-500/60 shadow-[0_0_20px_rgba(34,197,94,0.22)]'
                        : ''
                  } ${groupIdx === 4 ? 'md:col-span-2 xl:col-span-1' : ''}`}
                >
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                        promptGroup.isError
                          ? 'text-red-400'
                          : isCopied
                            ? 'text-emerald-400'
                            : 'text-white/70'
                      }`}
                      title={promptGroup.title}
                    >
                      {promptGroup.title}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {isMultiSlide && (
                        <button
                          type="button"
                          onClick={() => onCopy(promptGroup.prompt, copyAllKey)}
                          title={labels.copyAllSlides}
                          aria-label={labels.copyAllSlides}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors border ${
                            isAllCopied
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-white/5 hover:bg-white/15 text-white/70 border-white/10'
                          }`}
                        >
                          <Layers size={11} />
                          {isAllCopied ? labels.copied : 'All'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCopy(promptText, copyKey)}
                        aria-label={labels.copy}
                        title={labels.copy}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors ${
                          isCopied ? 'text-emerald-400' : 'text-[#00f0ff]'
                        }`}
                      >
                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  {isMultiSlide && (
                    <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
                      {slidePrompts.map((_, sIdx) => (
                        <button
                          type="button"
                          key={sIdx}
                          onClick={() => onSelectSlide(groupIdx, sIdx)}
                          className={`px-3.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
                            safeSlideIdx === sIdx
                              ? 'bg-[#00f0ff] text-black font-bold'
                              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          {sIdx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex-grow overflow-y-auto max-h-64 custom-scrollbar pr-1 relative">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`text-${copyKey}`}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.16 }}
                        className={`text-xs sm:text-sm leading-relaxed font-mono whitespace-pre-wrap ${
                          promptGroup.isError ? 'text-red-300' : 'text-white/85'
                        }`}
                      >
                        {promptText}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full h-96 flex flex-col items-center justify-center placeholder-empty border-2 border-dashed border-white/15 rounded-[36px]">
              <Type size={48} strokeWidth={1.25} />
              <p className="mt-4 font-serif italic text-center px-6 text-base">
                {labels.promptsPlaceholder}
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
