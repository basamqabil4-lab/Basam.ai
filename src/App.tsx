/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Type,
  Hash,
  Maximize,
  Send,
  Copy,
  Loader2,
  Plus,
  Map as MapIcon,
  BarChart3,
  Palette,
  Layers,
  Wand2,
  Monitor,
  Home,
  Sun,
  Moon,
  X,
  FileText,
  Cpu,
  Languages,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  generateInfographicPrompts,
  generateBackgroundPrompts,
  generateFHDPrompts,
  generateImageToPromptPrompts,
  PromptResult,
} from './services/geminiService';
import {
  AI_MODELS,
  DEFAULT_B1_SVG,
  DEFAULT_ENHANCE_PROMPT,
  DEFAULT_MODEL,
  ENGLISH_FONTS,
  FHD_SIZE_PRESETS,
  INFOGRAPHIC_SIZE_PRESETS,
  InfographicSubMode,
  MainMode,
  MAX_UPLOAD_IMAGES,
  NUMBER_FONTS,
  PRESET_STYLES,
  StyleType,
  TEXT_FONTS,
  ThinkingPreset,
  calculateAspectRatio,
} from './constants/options';
import { Language, UI_TEXT } from './constants/i18n';
import { processUploadedImage } from './utils/imageUtils';
import { buildRequestCacheKey, getCachedPrompts, setCachedPrompts } from './utils/ramCache';
import { IntroOverlay, IntroPhase } from './components/IntroOverlay';
import { ToastContainer, ToastItem } from './components/ToastContainer';
import { OutputPanel } from './components/OutputPanel';
import { ColorPaletteInputs, ImageUploadGrid, ToggleSwitch } from './components/FormControls';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('en');
  const [mainMode, setMainMode] = useState<MainMode>('infographic');
  const [introPhase, setIntroPhase] = useState<IntroPhase>('welcome');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const t = UI_TEXT[lang];

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4500);
    },
    []
  );

  // AI Engine State
  const [selectedModel] = useState<string>(DEFAULT_MODEL);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingPreset>('LOW');

  // Infographic State
  const [slidesData, setSlidesData] = useState<string[]>(['']);
  const [textFont, setTextFont] = useState(TEXT_FONTS[0]);
  const [numberFont, setNumberFont] = useState(NUMBER_FONTS[0]);
  const [englishFont, setEnglishFont] = useState(ENGLISH_FONTS[0]);
  const [mode, setMode] = useState<InfographicSubMode>('infographic');
  const [imageToPromptFile, setImageToPromptFile] = useState<string | null>(null);
  const [useImageToPromptStyles, setUseImageToPromptStyles] = useState(false);
  const [imageToPromptInstructions, setImageToPromptInstructions] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [styleImages, setStyleImages] = useState<string[]>([]);
  const [infoStyle, setInfoStyle] = useState<StyleType>('graphic_realistic');
  const [infoColor1, setInfoColor1] = useState('#8b5cf6');
  const [infoColor2, setInfoColor2] = useState('#3b82f6');
  const [infoBackgroundColor, setInfoBackgroundColor] = useState('#390075');

  // Background State
  const [bgRequest, setBgRequest] = useState('');
  const [bgCustomText, setBgCustomText] = useState('');
  const [bgTextFont, setBgTextFont] = useState(TEXT_FONTS[0]);
  const [bgStyle, setBgStyle] = useState<'graphic' | 'realistic' | 'graphic_realistic'>(
    'graphic_realistic'
  );
  const [bgColor1, setBgColor1] = useState('#8b5cf6');
  const [bgColor2, setBgColor2] = useState('#3b82f6');
  const [bgBackgroundColor, setBgBackgroundColor] = useState('#390075');
  const [bgImages, setBgImages] = useState<string[]>([]);

  // FHD State
  const [selectedBgPreset, setSelectedBgPreset] = useState<string | null>('B1');
  const [customBgPresets, setCustomBgPresets] = useState<{ id: string; image: string }[]>([
    { id: 'B1', image: DEFAULT_B1_SVG },
  ]);
  const [fhdImages, setFhdImages] = useState<string[]>([]);
  const [fhdPrompt, setFhdPrompt] = useState('');
  const [fhdTextOverlay, setFhdTextOverlay] = useState('');
  const [keepOriginalCharacters, setKeepOriginalCharacters] = useState(true);
  const [useEnhancePrompt, setUseEnhancePrompt] = useState(false);
  const [enhancePromptText, setEnhancePromptText] = useState(DEFAULT_ENHANCE_PROMPT);
  const [safeZoneLeft, setSafeZoneLeft] = useState<number>(0);
  const [safeZoneRight, setSafeZoneRight] = useState<number>(0);
  const [safeZoneTop, setSafeZoneTop] = useState<number>(0);
  const [subjectDistance, setSubjectDistance] = useState<number>(0);

  // Shared Output & Request State
  const [useAvaStyle, setUseAvaStyle] = useState(false);
  const [width, setWidth] = useState('5760');
  const [height, setHeight] = useState('1620');
  const [prompts, setPrompts] = useState<PromptResult[]>([]);
  const [activeSlide, setActiveSlide] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    label: string;
  } | null>(null);
  const [copiedKeys, setCopiedKeys] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addSlide = () => setSlidesData((prev) => [...prev, '']);

  const removeSlide = (index: number) => {
    setSlidesData((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const updateSlide = (index: number, value: string) => {
    setSlidesData((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleMultiImageUpload = async (
    files: FileList,
    currentCount: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    maxDimension: number = 768
  ) => {
    const remainingSlots = MAX_UPLOAD_IMAGES - currentCount;
    if (remainingSlots <= 0) {
      addToast('info', t.maxImagesToast);
      return;
    }

    const fileArray = Array.from(files);
    if (fileArray.length > remainingSlots) {
      addToast('info', t.maxImagesToast);
    }

    const toProcess = fileArray.slice(0, remainingSlots);
    try {
      const processed = await Promise.all(
        toProcess.map((f) => processUploadedImage(f, maxDimension))
      );
      setter((prev) => [...prev, ...processed].slice(0, MAX_UPLOAD_IMAGES));
    } catch {
      addToast('error', t.imageUploadError);
    }
  };

  const handleSingleImageUpload = async (
    file: File,
    setter: (dataUrl: string) => void,
    maxDimension: number = 768
  ) => {
    try {
      const processed = await processUploadedImage(file, maxDimension);
      setter(processed);
    } catch {
      addToast('error', t.imageUploadError);
    }
  };

  const handleBgPresetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const processed = await processUploadedImage(file);
      const nextNum =
        customBgPresets.reduce((max, item) => {
          const parsed = Number(item.id.replace(/\D/g, ''));
          return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 1) + 1;
      const nextId = `B${nextNum}`;
      setCustomBgPresets((prev) => [...prev, { id: nextId, image: processed }]);
      setSelectedBgPreset(nextId);
      addToast('success', t.presetAdded);
    } catch {
      addToast('error', t.imageUploadError);
    }
  };

  const removeBgPreset = (id: string) => {
    if (id === 'B1') return;
    setCustomBgPresets((prev) => prev.filter((p) => p.id !== id));
    if (selectedBgPreset === id) setSelectedBgPreset(null);
  };

  const { ratio: calculatedRatio, isValid: isValidDimensions } = calculateAspectRatio(
    width,
    height
  );

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleGenerate = async (forceRefresh: boolean = false) => {
    if (mainMode === 'infographic' && mode !== 'image-to-prompt' && slidesData.every((s) => !s.trim())) {
      addToast('error', t.validationEmptySlide);
      return;
    }
    if (mainMode === 'infographic' && mode === 'image-to-prompt' && !imageToPromptFile) {
      addToast('error', t.validationNoImage);
      return;
    }
    if (mainMode === 'background' && !bgRequest.trim() && bgImages.length === 0) {
      addToast('error', t.validationEmptyBg);
      return;
    }
    if (mainMode === 'fhd' && !fhdPrompt.trim() && fhdImages.length === 0) {
      addToast('error', t.validationEmptyFhd);
      return;
    }
    if (!isValidDimensions) {
      addToast('info', t.validationInvalidDimensions);
    }

    const infoHasColors = infoStyle === 'graphic' || infoStyle === 'graphic_realistic';
    const applyImageStyles = useImageToPromptStyles;
    const applyImageColors =
      applyImageStyles && (infoStyle === 'graphic' || infoStyle === 'graphic_realistic');
    const bgHasColors = bgStyle === 'graphic' || bgStyle === 'graphic_realistic';

    const imageToPromptReq = {
      image: imageToPromptFile || '',
      selectedStyles: applyImageStyles ? selectedStyles : undefined,
      styleType: applyImageStyles ? infoStyle : undefined,
      color1: applyImageColors ? infoColor1 : undefined,
      color2: applyImageColors ? infoColor2 : undefined,
      bgColor: applyImageColors ? infoBackgroundColor : undefined,
      styleImages: applyImageStyles ? styleImages : undefined,
      customInstructions: imageToPromptInstructions,
      aspectRatio: calculatedRatio,
      textFont,
      numberFont,
      englishFont,
      useAvaStyle,
    };

    const infographicReq = {
      data: slidesData,
      textFont,
      numberFont,
      englishFont,
      aspectRatio: calculatedRatio,
      mode: mode === 'map' ? ('map' as const) : ('infographic' as const),
      styleImages,
      selectedStyles,
      useAvaStyle,
      styleType: infoStyle,
      color1: infoHasColors ? infoColor1 : undefined,
      color2: infoHasColors ? infoColor2 : undefined,
      bgColor: infoHasColors ? infoBackgroundColor : undefined,
    };

    const backgroundReq = {
      request: bgRequest,
      style: bgStyle,
      color1: bgHasColors ? bgColor1 : '',
      color2: bgHasColors ? bgColor2 : '',
      bgColor: bgHasColors ? bgBackgroundColor : '',
      aspectRatio: calculatedRatio,
      images: bgImages,
      useAvaStyle,
      customText: bgCustomText,
      textFont: bgTextFont,
    };

    const finalFhdPrompt = useEnhancePrompt
      ? `${fhdPrompt}\n\n${enhancePromptText}`.trim()
      : fhdPrompt;

    const fhdReq = {
      prompt: finalFhdPrompt,
      textOverlay: fhdTextOverlay,
      aspectRatio: calculatedRatio,
      images: fhdImages,
      keepOriginal: keepOriginalCharacters,
      bgPresetImage: selectedBgPreset
        ? customBgPresets.find((p) => p.id === selectedBgPreset)?.image || null
        : null,
      bgPresetName: selectedBgPreset,
      safeZoneLeft,
      safeZoneRight,
      safeZoneTop,
      subjectDistance,
      useAvaStyle,
    };

    const activePayload =
      mainMode === 'infographic'
        ? mode === 'image-to-prompt'
          ? imageToPromptReq
          : infographicReq
        : mainMode === 'background'
          ? backgroundReq
          : fhdReq;

    const cacheKey = buildRequestCacheKey({
      mainMode,
      subMode: mainMode === 'infographic' ? mode : mainMode,
      model: selectedModel,
      thinkingLevel,
      payload: activePayload,
    });

    if (!forceRefresh) {
      const cached = getCachedPrompts(cacheKey);
      if (cached) {
        setPrompts(cached);
        setCopiedKeys([]);
        setActiveSlide({});
        addToast('info', t.ramCacheHit);
        return;
      }
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setProgress(null);
    setCopiedKeys([]);
    setActiveSlide({});

    const options = {
      model: selectedModel,
      thinkingLevel,
      signal: controller.signal,
      onProgress: (completed: number, total: number, label: string) => {
        setProgress({ completed, total, label });
      },
    };

    try {
      let result: PromptResult[];

      if (mainMode === 'infographic') {
        if (mode === 'image-to-prompt') {
          result = await generateImageToPromptPrompts(imageToPromptReq, options);
        } else {
          result = await generateInfographicPrompts(infographicReq, options);
        }
      } else if (mainMode === 'background') {
        result = await generateBackgroundPrompts(backgroundReq, options);
      } else {
        result = await generateFHDPrompts(fhdReq, options);
      }

      setCachedPrompts(cacheKey, result);
      setPrompts(result);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        addToast('info', t.cancelledMsg);
        return;
      }

      const message = error?.message || 'An error occurred while generating prompts.';
      if (message.includes('QUOTA_EXHAUSTED') && window.aistudio?.openSelectKey) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await window.aistudio.openSelectKey();
          }
        } catch {
          // Ignore AI Studio bridge error outside iframe
        }
      }
      addToast('error', message);
    } finally {
      setIsLoading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      addToast('success', t.copiedToast);
    } catch {
      addToast('error', t.clipboardError);
    }
  };

  const handleExportAll = () => {
    if (prompts.length === 0) return;
    const content = prompts
      .map((group) => `=== ${group.title} ===\n\n${group.prompt}`)
      .join('\n\n' + '-'.repeat(48) + '\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `basam-ai-prompts-${mainMode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const advanceIntro = useCallback(() => {
    setIntroPhase((prev) => (prev === 'welcome' ? 'creator' : 'hidden'));
  }, []);

  const skipIntro = useCallback(() => {
    setIntroPhase('hidden');
  }, []);

  const activeSizePresets = mainMode === 'fhd' ? FHD_SIZE_PRESETS : INFOGRAPHIC_SIZE_PRESETS;
  const activeModelMeta = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  return (
    <div className="relative min-h-screen text-white font-sans selection:bg-[#00f0ff] selection:text-black overflow-x-hidden">
      <IntroOverlay
        phase={introPhase}
        theme={theme}
        skipLabel={t.skipIntro}
        hintLabel={t.clickToContinue}
        onAdvance={advanceIntro}
        onSkip={skipIntro}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Animated Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0E14] ambient-blobs transition-opacity duration-500">
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -50, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#00f0ff]/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 100, -60, 0],
            scale: [1, 0.8, 1.1, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#b026ff]/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 50, -80, 0], y: [0, 120, -40, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-[#00f0ff]/15 blur-[100px]"
        />
      </div>

      <div
        className={`relative z-10 p-4 md:p-8 transition-all duration-700 ${
          introPhase !== 'hidden'
            ? 'blur-xl scale-95 opacity-0 pointer-events-none'
            : 'blur-0 scale-100 opacity-100'
        }`}
      >
        {/* Top Control Bar: Theme + Language */}
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all border ${
                theme === 'light'
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/15'
              }`}
            >
              <Sun size={14} /> {t.light}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all border ${
                theme === 'dark'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/50 shadow-md'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/15'
              }`}
            >
              <Moon size={14} /> {t.dark}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'ku' : 'en'))}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 transition-all"
            >
              <Languages size={14} className="text-[#00f0ff]" />
              <span>{lang === 'en' ? 'کوردی' : 'English'}</span>
            </button>
          </div>
        </div>

        <header className="max-w-6xl mx-auto mb-8 text-center" dir={lang === 'ku' ? 'rtl' : 'ltr'}>
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="liquid-panel px-5 py-2 rounded-full flex items-center gap-3 shadow-lg"
            >
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase text-white/70">
                {t.systemActive} • {activeModelMeta.label}
              </span>
            </motion.div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-sans font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#b026ff]"
            style={{ filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.25))' }}
          >
            {t.appTitle}
          </motion.h1>

          <p
            className="text-base md:text-lg tracking-wide font-medium uppercase text-white/70"
            style={{ fontFamily: "'IBM Plex Sans Arabic', 'Bahnschrift', 'Segoe UI', sans-serif" }}
          >
            {t.createdBy}
          </p>

          <div className="flex flex-col md:flex-row justify-center mt-7 items-center gap-4">
            <button
              type="button"
              onClick={() => setIntroPhase('welcome')}
              className="liquid-panel p-3 rounded-full text-[#00f0ff] hover:bg-white/10 transition-all shadow-lg flex items-center justify-center"
              title={t.homeTitle}
              aria-label={t.homeTitle}
            >
              <Home size={20} />
            </button>

            <div className="liquid-panel p-1 rounded-full flex shadow-lg w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setMainMode('infographic');
                  setWidth('5760');
                  setHeight('1620');
                }}
                className={`px-5 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'infographic'
                    ? 'liquid-btn-cyan'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 size={18} />
                {t.tabInfographic}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMainMode('background');
                  setWidth('5760');
                  setHeight('1620');
                }}
                className={`px-5 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'background'
                    ? 'liquid-btn-cyan'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers size={18} />
                {t.tabBackground}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMainMode('fhd');
                  setWidth('1920');
                  setHeight('1080');
                }}
                className={`px-5 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'fhd'
                    ? 'liquid-btn-cyan'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Monitor size={18} />
                {t.tabFhd}
              </button>
            </div>
          </div>
        </header>

        <main
          className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8"
          dir={lang === 'ku' ? 'rtl' : 'ltr'}
        >
          {/* Input Section */}
          <section className="lg:col-span-5 space-y-6">
            {/* AI Engine & Thinking Card */}
            <div className="liquid-panel rounded-[28px] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#00f0ff]">
                  <Cpu size={15} /> {t.aiEngine}
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00f0ff]/15 text-[#00f0ff] font-semibold">
                  {activeModelMeta.badge}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                <div className="sm:col-span-2 w-full px-3 py-2.5 liquid-input rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                  <span>{activeModelMeta.label}</span>
                  <span className="text-[10px] font-mono text-[#00f0ff] opacity-80">
                    {activeModelMeta.id}
                  </span>
                </div>
                <select
                  value={thinkingLevel}
                  onChange={(e) => setThinkingLevel(e.target.value as ThinkingPreset)}
                  aria-label={t.thinkingLevel}
                  className="w-full p-2.5 liquid-input rounded-xl text-xs font-medium cursor-pointer"
                >
                  <option value="LOW">{t.thinkingLevel}: Low</option>
                  <option value="MEDIUM">{t.thinkingLevel}: Medium</option>
                  <option value="HIGH">{t.thinkingLevel}: High</option>
                </select>
              </div>
              <p className="text-[11px] text-white/60">
                {lang === 'ku' ? activeModelMeta.descriptionKu : activeModelMeta.descriptionEn}
              </p>
            </div>

            {mainMode === 'infographic' && (
              <>
                <div className="liquid-panel rounded-[32px] p-6">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                    <BarChart3 size={16} /> {t.infographicType}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('infographic')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all text-xs font-bold ${
                        mode === 'infographic'
                          ? 'liquid-btn-cyan'
                          : 'liquid-input hover:bg-white/10'
                      }`}
                    >
                      <BarChart3 size={16} />
                      <span>{t.subInfographic}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('map')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all text-xs font-bold ${
                        mode === 'map' ? 'liquid-btn-cyan' : 'liquid-input hover:bg-white/10'
                      }`}
                    >
                      <MapIcon size={16} />
                      <span>{t.subMap}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('image-to-prompt')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all text-xs font-bold ${
                        mode === 'image-to-prompt'
                          ? 'liquid-btn-cyan'
                          : 'liquid-input hover:bg-white/10'
                      }`}
                    >
                      <ImageIcon size={16} />
                      <span>{t.subImageToPrompt}</span>
                    </button>
                  </div>
                </div>

                {mode === 'image-to-prompt' ? (
                  <div className="liquid-panel rounded-[32px] p-6">
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                      <ImageIcon size={16} /> {t.uploadImage}
                    </label>
                    <div className="flex flex-col items-center justify-center">
                      {imageToPromptFile ? (
                        <div className="relative group w-full aspect-video">
                          <img
                            src={imageToPromptFile}
                            alt="Uploaded reference"
                            className="w-full h-full object-contain rounded-xl border border-white/20 bg-black/50"
                          />
                          <button
                            type="button"
                            onClick={() => setImageToPromptFile(null)}
                            aria-label={t.remove}
                            className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white rounded-full p-2 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full aspect-video flex flex-col items-center justify-center border-2 border-dashed border-white/25 rounded-xl text-white/60 hover:bg-white/5 hover:border-[#00f0ff]/50 transition-colors cursor-pointer">
                          <Upload size={32} className="mb-2" />
                          <span className="text-sm">{t.clickToUpload}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) handleSingleImageUpload(file, setImageToPromptFile);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="mt-6">
                      <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                        <FileText size={16} /> {t.customInstructions}
                      </label>
                      <textarea
                        dir="auto"
                        value={imageToPromptInstructions}
                        onChange={(e) => setImageToPromptInstructions(e.target.value)}
                        placeholder={t.customInstructionsPlaceholder}
                        className="w-full h-24 liquid-input rounded-2xl p-4 text-sm resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {slidesData.map((slide, index) => (
                        <div key={index} className="liquid-panel rounded-[32px] p-6 relative group">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                              <Type size={16} /> {t.dataInfoSlide} {index + 1}
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const clipText = await navigator.clipboard.readText();
                                    updateSlide(index, clipText);
                                    addToast('info', t.pastedToast);
                                  } catch {
                                    addToast('error', t.clipboardError);
                                  }
                                }}
                                className="text-[11px] bg-white/10 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Copy size={11} /> {t.paste}
                              </button>
                              {slidesData.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSlide(index)}
                                  className="text-[11px] bg-red-500/20 hover:bg-red-500/35 text-red-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <X size={11} /> {t.remove}
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea
                            dir="auto"
                            value={slide}
                            onChange={(e) => updateSlide(index, e.target.value)}
                            placeholder={`${t.slidePlaceholder} ${index + 1}...`}
                            style={{
                              fontFamily: `'${textFont}', 'IBM Plex Sans Arabic', sans-serif`,
                            }}
                            className="w-full h-40 p-4 liquid-input rounded-2xl resize-none custom-scrollbar text-sm leading-relaxed"
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addSlide}
                        className="w-full py-4 liquid-panel rounded-[32px] flex items-center justify-center gap-2 text-[#00f0ff] hover:bg-white/5 transition-colors border border-dashed border-[#00f0ff]/35"
                      >
                        <Plus size={20} />
                        <span className="font-medium tracking-wider uppercase text-sm">
                          {t.addAnotherSlide}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="liquid-panel rounded-[24px] p-4">
                        <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                          <Type size={12} /> {t.textFont}
                        </label>
                        <select
                          value={textFont}
                          onChange={(e) => setTextFont(e.target.value)}
                          className="w-full p-2.5 liquid-input rounded-xl text-xs cursor-pointer"
                        >
                          {TEXT_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="liquid-panel rounded-[24px] p-4">
                        <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                          <Type size={12} /> {t.englishFont}
                        </label>
                        <select
                          value={englishFont}
                          onChange={(e) => setEnglishFont(e.target.value)}
                          className="w-full p-2.5 liquid-input rounded-xl text-xs cursor-pointer"
                        >
                          {ENGLISH_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="liquid-panel rounded-[24px] p-4">
                        <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                          <Hash size={12} /> {t.numFont}
                        </label>
                        <select
                          value={numberFont}
                          onChange={(e) => setNumberFont(e.target.value)}
                          className="w-full p-2.5 liquid-input rounded-xl text-xs cursor-pointer"
                        >
                          {NUMBER_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="liquid-panel rounded-[32px] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                      <Palette size={16} /> {t.styleType}
                    </label>
                    {mode === 'image-to-prompt' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/70 uppercase tracking-wider">
                          {t.useStyles}
                        </span>
                        <ToggleSwitch
                          checked={useImageToPromptStyles}
                          onChange={setUseImageToPromptStyles}
                          ariaLabel={t.useStyles}
                        />
                      </div>
                    )}
                  </div>

                  {(mode !== 'image-to-prompt' || useImageToPromptStyles) && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'original', label: t.original },
                            { id: 'realistic', label: t.realistic },
                            { id: 'graphic', label: t.graphic },
                            { id: 'graphic_realistic', label: t.graphicRealistic },
                          ] as const
                        ).map((opt) => (
                          <button
                            type="button"
                            key={opt.id}
                            onClick={() => setInfoStyle(opt.id)}
                            className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                              infoStyle === opt.id
                                ? 'liquid-btn-cyan'
                                : 'liquid-input hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <AnimatePresence>
                        {infoStyle !== 'realistic' && infoStyle !== 'original' && (
                          <ColorPaletteInputs
                            color1={infoColor1}
                            color2={infoColor2}
                            bgColor={infoBackgroundColor}
                            onColor1Change={setInfoColor1}
                            onColor2Change={setInfoColor2}
                            onBgColorChange={setInfoBackgroundColor}
                            labels={{
                              color1: t.color1,
                              color2: t.color2,
                              bgColor: t.bgColor,
                            }}
                          />
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                {(mode !== 'image-to-prompt' || useImageToPromptStyles) && (
                  <>
                    <div className="liquid-panel rounded-[32px] p-6">
                      <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                        <ImageIcon size={16} /> {t.presetStyles}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStyles([])}
                          className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all border ${
                            selectedStyles.length === 0
                              ? 'liquid-btn-cyan'
                              : 'liquid-input hover:bg-white/10'
                          }`}
                        >
                          {t.original}
                        </button>
                        {PRESET_STYLES.map((style) => (
                          <button
                            type="button"
                            key={style.id}
                            onClick={() =>
                              setSelectedStyles((prev) =>
                                prev.includes(style.id)
                                  ? prev.filter((s) => s !== style.id)
                                  : [...prev, style.id]
                              )
                            }
                            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all border ${
                              selectedStyles.includes(style.id)
                                ? 'liquid-btn-cyan'
                                : 'liquid-input hover:bg-white/10'
                            }`}
                          >
                            {style.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ImageUploadGrid
                      title={t.styleImages}
                      uploadLabel={t.upload}
                      maxImagesHint={t.maxImagesHint}
                      images={styleImages}
                      icon={<ImageIcon size={16} />}
                      onAddFiles={(files) =>
                        handleMultiImageUpload(files, styleImages.length, setStyleImages, 512)
                      }
                      onRemoveImage={(idx) =>
                        setStyleImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                    />
                  </>
                )}
              </>
            )}

            {mainMode === 'background' && (
              <>
                <div className="liquid-panel rounded-[32px] p-6">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                    <Type size={16} /> {t.backgroundRequest}
                  </label>
                  <textarea
                    dir="auto"
                    value={bgRequest}
                    onChange={(e) => setBgRequest(e.target.value)}
                    placeholder={t.backgroundRequestPlaceholder}
                    className="w-full h-32 p-4 liquid-input rounded-2xl resize-none custom-scrollbar text-sm"
                  />
                </div>

                <div className="liquid-panel rounded-[32px] p-6">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                    <Type size={16} /> {t.customTextOnImage}
                  </label>
                  <textarea
                    dir="auto"
                    value={bgCustomText}
                    onChange={(e) => setBgCustomText(e.target.value)}
                    placeholder={t.customTextPlaceholder}
                    style={{
                      fontFamily: `'${bgTextFont}', 'IBM Plex Sans Arabic', sans-serif`,
                    }}
                    className="w-full h-20 p-4 liquid-input rounded-2xl resize-none custom-scrollbar mb-4 text-sm"
                  />

                  <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                    <Type size={12} /> {t.textFont}
                  </label>
                  <select
                    value={bgTextFont}
                    onChange={(e) => setBgTextFont(e.target.value)}
                    className="w-full p-3 liquid-input rounded-xl text-sm cursor-pointer"
                  >
                    {TEXT_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="liquid-panel rounded-[32px] p-6">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                    <Palette size={16} /> {t.styleType}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'realistic', label: t.realistic },
                        { id: 'graphic', label: t.graphic },
                        { id: 'graphic_realistic', label: t.graphicRealistic },
                      ] as const
                    ).map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setBgStyle(opt.id)}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          bgStyle === opt.id ? 'liquid-btn-cyan' : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {bgStyle !== 'realistic' && (
                      <ColorPaletteInputs
                        color1={bgColor1}
                        color2={bgColor2}
                        bgColor={bgBackgroundColor}
                        onColor1Change={setBgColor1}
                        onColor2Change={setBgColor2}
                        onBgColorChange={setBgBackgroundColor}
                        labels={{
                          color1: t.color1,
                          color2: t.color2,
                          bgColor: t.bgColor,
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <ImageUploadGrid
                  title={t.imagesToBlend}
                  uploadLabel={t.upload}
                  maxImagesHint={t.maxImagesHint}
                  images={bgImages}
                  icon={<ImageIcon size={16} />}
                  onAddFiles={(files) =>
                    handleMultiImageUpload(files, bgImages.length, setBgImages)
                  }
                  onRemoveImage={(idx) => setBgImages((prev) => prev.filter((_, i) => i !== idx))}
                />
              </>
            )}

            {mainMode === 'fhd' && (
              <>
                <div className="liquid-panel rounded-[32px] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                      <Layers size={16} /> {t.bgPresets}
                    </label>
                    <label className="cursor-pointer text-xs bg-[#00f0ff]/10 text-[#00f0ff] px-3 py-1.5 rounded-xl hover:bg-[#00f0ff]/20 transition-all flex items-center gap-1.5 border border-[#00f0ff]/20">
                      <Plus size={14} /> {t.addPreset}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBgPresetUpload}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBgPreset(null)}
                      className={`py-2 px-5 rounded-xl text-xs font-bold transition-all border ${
                        selectedBgPreset === null
                          ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                          : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t.none}
                    </button>
                    {customBgPresets.map((preset) => (
                      <div key={preset.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => setSelectedBgPreset(preset.id)}
                          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                            selectedBgPreset === preset.id
                              ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <img
                            src={preset.image}
                            alt={preset.id}
                            className="w-5 h-5 rounded object-cover"
                          />
                          {preset.id}
                        </button>
                        {preset.id !== 'B1' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBgPreset(preset.id);
                            }}
                            aria-label={`Remove ${preset.id}`}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <ImageUploadGrid
                  title={t.characterRefImages}
                  hint={t.characterRefHint}
                  uploadLabel={t.add}
                  maxImagesHint={t.maxImagesHint}
                  images={fhdImages}
                  icon={<ImageIcon size={16} />}
                  onAddFiles={(files) =>
                    handleMultiImageUpload(files, fhdImages.length, setFhdImages)
                  }
                  onRemoveImage={(idx) =>
                    setFhdImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                />

                <div className="liquid-panel rounded-[32px] p-6 space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                      <Wand2 size={16} /> {t.promptInstructions}
                    </label>
                    <textarea
                      dir="auto"
                      value={fhdPrompt}
                      onChange={(e) => setFhdPrompt(e.target.value)}
                      placeholder={t.fhdPromptPlaceholder}
                      className="w-full h-32 liquid-input rounded-2xl p-4 text-sm resize-none"
                    />
                  </div>

                  <div className="liquid-input rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${
                            useEnhancePrompt
                              ? 'bg-white/10 text-[#00f0ff]'
                              : 'bg-white/5 text-white/55'
                          }`}
                        >
                          <Wand2 size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{t.autoEnhance}</span>
                          <span className="text-[10px] text-white/60 uppercase tracking-wider">
                            {t.autoEnhanceHint}
                          </span>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useEnhancePrompt}
                        onChange={setUseEnhancePrompt}
                        ariaLabel={t.autoEnhance}
                      />
                    </div>

                    <AnimatePresence>
                      {useEnhancePrompt && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <textarea
                            dir="ltr"
                            value={enhancePromptText}
                            onChange={(e) => setEnhancePromptText(e.target.value)}
                            className="w-full h-40 bg-black/40 border border-white/20 rounded-xl p-3 text-xs text-blue-100/80 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/50 resize-y mt-2"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                      <Type size={16} /> {t.specificTextToAdd}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      value={fhdTextOverlay}
                      onChange={(e) => setFhdTextOverlay(e.target.value)}
                      placeholder={t.specificTextPlaceholder}
                      className="w-full liquid-input rounded-xl p-4 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 liquid-input rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl ${
                          keepOriginalCharacters
                            ? 'bg-white/10 text-[#00f0ff]'
                            : 'bg-white/5 text-white/55'
                        }`}
                      >
                        <ImageIcon size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">
                          {t.keepOriginalChars}
                        </span>
                        <span className="text-[10px] text-white/60 uppercase tracking-wider">
                          {t.keepOriginalCharsHint}
                        </span>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={keepOriginalCharacters}
                      onChange={setKeepOriginalCharacters}
                      ariaLabel={t.keepOriginalChars}
                    />
                  </div>

                  <div className="liquid-input rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[#00f0ff]/10 text-[#00f0ff]">
                        <Maximize size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">{t.safeZone}</span>
                        <span className="text-[10px] text-white/60 uppercase tracking-wider">
                          {t.safeZoneHint}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: t.leftPct, value: safeZoneLeft, setter: setSafeZoneLeft },
                        { label: t.topPct, value: safeZoneTop, setter: setSafeZoneTop },
                        { label: t.rightPct, value: safeZoneRight, setter: setSafeZoneRight },
                      ].map((pad) => (
                        <div key={pad.label} className="flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider">
                            {pad.label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={pad.value}
                            onChange={(e) =>
                              pad.setter(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                            }
                            className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="liquid-input rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[#00f0ff]/10 text-[#00f0ff]">
                        <Maximize size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">{t.subjectDistance}</span>
                        <span className="text-[10px] text-white/60 uppercase tracking-wider">
                          {t.subjectDistanceHint}
                        </span>
                      </div>
                    </div>

                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={subjectDistance}
                      onChange={(e) =>
                        setSubjectDistance(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Shared Size Options */}
            <div className="liquid-panel rounded-[32px] p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                  <Maximize size={16} /> {t.sizePixels}
                </label>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/25">
                  {t.mappedRatio}: {calculatedRatio}
                </span>
              </div>

              <div className="mb-4">
                <span className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">
                  {t.presets}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {activeSizePresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      title={preset.label}
                      onClick={() => {
                        setWidth(preset.w);
                        setHeight(preset.h);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                        width === preset.w && height === preset.h
                          ? 'liquid-btn-cyan'
                          : 'liquid-input hover:bg-white/10'
                      }`}
                    >
                      {preset.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60 block uppercase tracking-wider">
                    {t.width}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="e.g. 1920"
                    className="w-full p-2.5 liquid-input rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60 block uppercase tracking-wider">
                    {t.height}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 1080"
                    className="w-full p-2.5 liquid-input rounded-xl text-sm"
                  />
                </div>
              </div>

              {!isValidDimensions && (
                <p className="mt-2.5 text-xs text-red-400">{t.invalidSizeWarning}</p>
              )}
            </div>

            {/* AVA Style Card */}
            <div className="liquid-panel rounded-[32px] p-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    useAvaStyle ? 'bg-white/10 text-[#00f0ff]' : 'bg-white/5 text-white/55'
                  }`}
                >
                  <Wand2 size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{t.avaStyle}</span>
                  <span className="text-[10px] text-white/60 uppercase tracking-wider">
                    {t.avaStyleHint}
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={useAvaStyle}
                onChange={setUseAvaStyle}
                ariaLabel={t.avaStyle}
              />
            </div>

            <button
              type="button"
              onClick={() => handleGenerate(false)}
              disabled={isLoading}
              className="w-full liquid-btn-cyan py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              <span>{isLoading ? t.generating : t.generatePrompts}</span>
            </button>
          </section>

          {/* Output Section */}
          <OutputPanel
            prompts={prompts}
            activeSlide={activeSlide}
            copiedKeys={copiedKeys}
            isLoading={isLoading}
            progress={progress}
            labels={{
              promptsPlaceholder: t.promptsPlaceholder,
              copy: t.copy,
              copied: t.copied,
              copyAllSlides: t.copyAllSlides,
              exportTxt: t.exportTxt,
              regenerate: t.regenerate,
              generating: t.generating,
              cancel: t.cancel,
            }}
            onSelectSlide={(groupIdx, slideIdx) =>
              setActiveSlide((prev) => ({ ...prev, [groupIdx]: slideIdx }))
            }
            onCopy={handleCopy}
            onExportAll={handleExportAll}
            onRegenerate={() => handleGenerate(true)}
            onCancel={handleCancelGeneration}
          />
        </main>
      </div>
    </div>
  );
}
