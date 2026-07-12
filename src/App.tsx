/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Type, Hash, Maximize, Send, Copy, Check, Loader2, Plus, Map as MapIcon, BarChart3, Palette, Layers, Wand2, Monitor, Home, Sun, Moon, X, Cpu, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateInfographicPrompts, generateBackgroundPrompts, generateFHDPrompts, generateImageToPromptPrompts, PromptResult } from './services/geminiService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const TEXT_FONTS = [
  "IBM Plex Sans Arabic"
];

const NUMBER_FONTS = [
  "Bahnschrift",
  "JetBrains Mono",
  "Roboto Mono",
  "Montserrat Bold",
  "Inter ExtraBold",
  "Space Grotesk",
  "Outfit Semibold",
  "Lexend",
  "Bebas Neue",
  "Archivo Black",
  "Helix"
];

const ENGLISH_FONTS = [
  "Bahnschrift",
  "Inter",
  "SF Pro Display",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Playfair Display",
  "Space Grotesk",
  "JetBrains Mono",
  "Helix"
];

const SIZE_PRESETS = [
  { id: 'VW1', label: 'VW1 (5760x1620)', w: '5760', h: '1620' },
  { id: 'VW2', label: 'VW2 (6080x1620)', w: '6080', h: '1620' },
  { id: 'HD', label: 'HD (1920x1080)', w: '1920', h: '1080' },
];

const PRESET_STYLES = [
  { id: 'cyber-map', label: 'Cyber Map' },
  { id: 'futuristic-3d', label: 'Futuristic 3D' },
  { id: 'tech-landing', label: 'Tech Landing' },
  { id: 'ai-analytics', label: 'AI Analytics' },
  { id: 'ai-ecosystem', label: 'AI Ecosystem' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'vibrant', label: 'Vibrant Modern' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'tech-grid', label: 'Tech Grid' },
  { id: 'purple-special', label: 'Purple Special' },
];

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mainMode, setMainMode] = useState<'infographic' | 'background' | 'fhd'>('infographic');
  const [introPhase, setIntroPhase] = useState<'welcome' | 'creator' | 'hidden'>('welcome');

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  // Infographic State
  const [slidesData, setSlidesData] = useState<string[]>(['']);
  
  const addSlide = () => {
    setSlidesData([...slidesData, '']);
  };

  const removeSlide = (index: number) => {
    if (slidesData.length > 1) {
      setSlidesData(slidesData.filter((_, i) => i !== index));
    }
  };

  const updateSlide = (index: number, value: string) => {
    const newSlides = [...slidesData];
    newSlides[index] = value;
    setSlidesData(newSlides);
  };

  const [textFont, setTextFont] = useState('IBM Plex Sans Arabic');
  const [numberFont, setNumberFont] = useState('Bahnschrift');
  const [englishFont, setEnglishFont] = useState('Bahnschrift');
  const [mode, setMode] = useState<'infographic' | 'map' | 'image-to-prompt'>('infographic');
  const [imageToPromptFile, setImageToPromptFile] = useState<string | null>(null);
  const [useImageToPromptStyles, setUseImageToPromptStyles] = useState(false);
  const [imageToPromptInstructions, setImageToPromptInstructions] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [styleImages, setStyleImages] = useState<string[]>([]);
  const [infoStyle, setInfoStyle] = useState<'graphic' | 'realistic' | 'graphic_realistic' | 'original'>('graphic_realistic');
  const [infoColor1, setInfoColor1] = useState('#8b5cf6');
  const [infoColor2, setInfoColor2] = useState('#3b82f6');
  const [infoBackgroundColor, setInfoBackgroundColor] = useState('#390075');
  const [selectedBgPreset, setSelectedBgPreset] = useState<string | null>('B1');
  const [customBgPresets, setCustomBgPresets] = useState<{ id: string; image: string }[]>([
    { id: 'B1', image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzFlM2E4YSIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1MCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5CMTwvdGV4dD4KPC9zdmc+' }
  ]);
  
  // Background State
  const [bgRequest, setBgRequest] = useState('');
  const [bgCustomText, setBgCustomText] = useState('');
  const [bgTextFont, setBgTextFont] = useState('IBM Plex Sans Arabic');
  const [bgStyle, setBgStyle] = useState<'graphic' | 'realistic' | 'graphic_realistic'>('graphic_realistic');
  const [bgColor1, setBgColor1] = useState('#8b5cf6');
  const [bgColor2, setBgColor2] = useState('#3b82f6');
  const [bgBackgroundColor, setBgBackgroundColor] = useState('#390075');
  const [bgImages, setBgImages] = useState<string[]>([]);

  // FHD State
  const [fhdImages, setFhdImages] = useState<string[]>([]);
  const [fhdPrompt, setFhdPrompt] = useState('');
  const [fhdTextOverlay, setFhdTextOverlay] = useState('');
  const [keepOriginalCharacters, setKeepOriginalCharacters] = useState(true);
  const [useEnhancePrompt, setUseEnhancePrompt] = useState(false);
  const [enhancePromptText, setEnhancePromptText] = useState(`Ultra-premium professional image enhancement.
Transform the uploaded low-quality, blurry image into extreme high-detail cinematic quality.
Preserve 100% original identity, face structure, expression, pose, clothing, accessories, background, framing, and composition.
Do NOT alter, redesign, replace, or add anything.
Recover micro-details:
sharp facial features
natural skin texture
visible pores
realistic hair strands
crisp eyes
clean refined edges
High-contrast clarity, deep depth, and balanced cinematic lighting. Poster-grade realism with dramatic but accurate detail.
Output in 8K resolution, ProRes quality, studio-level sharpness.
Photorealistic textures only. True-to-source enhancement only.
Keep everything exactly the same only enhance quality.`);
  const [safeZoneLeft, setSafeZoneLeft] = useState<number>(0);
  const [safeZoneRight, setSafeZoneRight] = useState<number>(0);
  const [safeZoneTop, setSafeZoneTop] = useState<number>(0);
  const [subjectDistance, setSubjectDistance] = useState<number>(0);

  // Shared State
  const [useAvaStyle, setUseAvaStyle] = useState(false);
  const [width, setWidth] = useState('5760');
  const [height, setHeight] = useState('1620');
  const [prompts, setPrompts] = useState<PromptResult[]>([]);
  const [activeSlide, setActiveSlide] = useState<Record<number, number>>({});
  const [selectedModel] = useState('gemini-3-flash-preview');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndices, setCopiedIndices] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isBg: boolean = false) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isBg) {
          setBgImages(prev => [...prev, reader.result as string].slice(0, 8));
        } else {
          setStyleImages(prev => [...prev, reader.result as string].slice(0, 8));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number, isBg: boolean = false) => {
    if (isBg) {
      setBgImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setStyleImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleBgPresetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const nextId = `B${customBgPresets.length + 1}`;
        setCustomBgPresets(prev => [...prev, { id: nextId, image: base64String }]);
        setSelectedBgPreset(nextId);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBgPreset = (id: string) => {
    if (id === 'B1') return;
    setCustomBgPresets(prev => prev.filter(p => p.id !== id));
    if (selectedBgPreset === id) setSelectedBgPreset(null);
  };

  const calculateAspectRatio = (w: string, h: string) => {
    const wNum = Number(w);
    const hNum = Number(h);
    if (!wNum || !hNum) return '16:9';
    
    const targetRatio = wNum / hNum;
    const validAspectRatios = [
      { str: "1:1", val: 1 },
      { str: "3:4", val: 3/4 },
      { str: "4:3", val: 4/3 },
      { str: "9:16", val: 9/16 },
      { str: "16:9", val: 16/9 },
      { str: "1:4", val: 1/4 },
      { str: "1:8", val: 1/8 },
      { str: "4:1", val: 4/1 },
      { str: "8:1", val: 8/1 }
    ];
    
    let closest = validAspectRatios[0];
    let minDiff = Math.abs(targetRatio - closest.val);
    
    for (let i = 1; i < validAspectRatios.length; i++) {
      const diff = Math.abs(targetRatio - validAspectRatios[i].val);
      if (diff < minDiff) {
        minDiff = diff;
        closest = validAspectRatios[i];
      }
    }
    
    return closest.str;
  };

  const handleGenerate = async () => {
    if (mainMode === 'infographic' && mode !== 'image-to-prompt' && slidesData.every(s => !s.trim())) {
      alert('Please enter data');
      return;
    }
    if (mainMode === 'infographic' && mode === 'image-to-prompt' && !imageToPromptFile) {
      alert('Please upload an image first');
      return;
    }
    if (mainMode === 'background' && !bgRequest && bgImages.length === 0) {
      alert('Please enter a request or upload images');
      return;
    }
    if (mainMode === 'fhd' && !fhdPrompt.trim() && fhdImages.length === 0) {
      alert('Please provide a prompt or upload an image');
      return;
    }

    setIsLoading(true);
    setCopiedIndices([]);
    try {
      const aspectRatio = calculateAspectRatio(width, height);
      let result;
      
      if (mainMode === 'infographic') {
        if (mode === 'image-to-prompt') {
          result = await generateImageToPromptPrompts({
            image: imageToPromptFile!,
            selectedStyles: useImageToPromptStyles ? selectedStyles : undefined,
            styleType: useImageToPromptStyles ? infoStyle : undefined,
            color1: useImageToPromptStyles ? infoColor1 : undefined,
            color2: useImageToPromptStyles ? infoColor2 : undefined,
            bgColor: useImageToPromptStyles ? infoBackgroundColor : undefined,
            styleImages: useImageToPromptStyles ? styleImages.slice(0, 8) : undefined,
            customInstructions: imageToPromptInstructions,
            aspectRatio: aspectRatio,
            textFont: textFont,
            numberFont: numberFont,
            englishFont: englishFont,
          }, selectedModel);
        } else {
          result = await generateInfographicPrompts({
            data: slidesData,
            textFont,
            numberFont,
            englishFont,
            aspectRatio,
            mode,
            styleImages: styleImages.slice(0, 8),
            selectedStyles,
            useAvaStyle,
            styleType: infoStyle,
            color1: infoColor1,
            color2: infoColor2,
            bgColor: infoBackgroundColor,
            bgPresetImage: null,
            bgPresetName: null,
          }, selectedModel);
        }
      } else if (mainMode === 'background') {
        result = await generateBackgroundPrompts({
          request: bgRequest,
          style: bgStyle,
          color1: bgColor1,
          color2: bgColor2,
          bgColor: bgBackgroundColor,
          aspectRatio,
          images: bgImages.slice(0, 8),
          useAvaStyle,
          customText: bgCustomText,
          textFont: bgTextFont,
        }, selectedModel);
      } else {
        const finalFhdPrompt = useEnhancePrompt ? `${fhdPrompt}\n\n${enhancePromptText}` : fhdPrompt;
        result = await generateFHDPrompts({
          prompt: finalFhdPrompt,
          textOverlay: fhdTextOverlay,
          aspectRatio,
          images: fhdImages.slice(0, 8),
          keepOriginal: keepOriginalCharacters,
          bgPresetImage: selectedBgPreset ? customBgPresets.find(p => p.id === selectedBgPreset)?.image || null : null,
          bgPresetName: selectedBgPreset,
          safeZoneLeft,
          safeZoneRight,
          safeZoneTop,
          subjectDistance,
        }, selectedModel);
      }
      setPrompts(result);
    } catch (error: any) {
      console.error(error);
      const isQuotaError = error?.message?.includes("Quota exceeded") || 
                           error?.message?.includes("429") || 
                           error?.status === "RESOURCE_EXHAUSTED" ||
                           error?.status === 429;
                           
      if (isQuotaError) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await window.aistudio.openSelectKey();
            alert("Please try generating prompts again.");
          } else {
            alert("Your selected API key has exceeded its quota. Please check your billing details or try again later.");
          }
        } catch (e) {
          console.error("API Key selection error:", e);
          alert("Quota exceeded. Please try again later.");
        }
      } else {
        alert(error?.message || "An error occurred while generating prompts.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    if (!copiedIndices.includes(index)) {
      setCopiedIndices(prev => [...prev, index]);
    }
  };

  const handleIntroClick = () => {
    if (introPhase === 'welcome') {
      setIntroPhase('creator');
    } else if (introPhase === 'creator') {
      setIntroPhase('hidden');
    }
  };

  return (
    <div className="relative min-h-screen text-white font-sans selection:bg-[#00f0ff] selection:text-black overflow-hidden">
      <AnimatePresence>
        {introPhase !== 'hidden' && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            onClick={handleIntroClick}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl cursor-pointer"
          >
            <motion.div
              layout
              className="text-center max-w-5xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div onClick={handleIntroClick}>
                <AnimatePresence mode="wait">
                  {introPhase === 'welcome' ? (
                    <motion.h2
                      key="welcome"
                      initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      className="text-5xl sm:text-7xl md:text-[10rem] font-bold tracking-tighter py-10 font-['IBM_Plex_Sans_Arabic']"
                      dir="rtl"
                    >
                      <span className="bg-clip-text text-transparent bg-gradient-to-br from-white via-white/40 to-white/10 drop-shadow-[0_0_50px_rgba(255,255,255,0.3)] select-none">
                        بەخێربێیت
                      </span>
                    </motion.h2>
                  ) : (
                    <motion.div
                      key="creator"
                      initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-6 py-10"
                    >
                      <p className="text-white/40 uppercase tracking-[0.5em] md:tracking-[1em] text-lg md:text-2xl font-bold select-none">Created By</p>
                      <h2 className="text-4xl sm:text-6xl md:text-[8rem] font-black tracking-tighter leading-none">
                        <span className="bg-clip-text text-transparent bg-gradient-to-br from-white via-white/40 to-white/10 drop-shadow-[0_0_60px_rgba(255,255,255,0.4)] select-none">
                          BASAM QABIL
                        </span>
                      </h2>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0E14]">
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -50, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#00f0ff]/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 100, -60, 0],
            scale: [1, 0.8, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#b026ff]/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, 50, -80, 0],
            y: [0, 120, -40, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-[#00f0ff]/15 blur-[100px]"
        />
      </div>

      <div className={`relative z-10 p-4 md:p-8 transition-all duration-1000 ${introPhase !== 'hidden' ? 'blur-2xl scale-95 opacity-0' : 'blur-0 scale-100 opacity-100'}`}>
        <div className="absolute top-4 left-4 flex gap-2 z-50">
          <button 
            onClick={() => setTheme('light')} 
            className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 transition-all ${theme === 'light' ? 'bg-white text-black shadow-lg' : 'bg-black/40 text-white/60 hover:bg-white/10 border border-white/10'}`}
          >
            <Sun size={14} /> Light
          </button>
          <button 
            onClick={() => setTheme('dark')} 
            className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-black text-white shadow-lg border border-white/20' : 'bg-black/40 text-white/60 hover:bg-white/10 border border-white/10'}`}
          >
            <Moon size={14} /> Dark
          </button>
        </div>
        
        <header className="max-w-6xl mx-auto mb-8 text-center">
          <div className="flex justify-center mb-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="liquid-panel px-6 py-2 rounded-full flex items-center gap-3 shadow-lg"
            >
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase text-white/60">
                System Active
              </span>
            </motion.div>
          </div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-sans font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#b026ff]" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.3))' }}
        >
          AI Prompt Generator
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.5 }}
          className="text-xl tracking-tight font-normal uppercase text-white/80"
          style={{ fontFamily: "'Bahnschrift', 'Segoe UI', sans-serif" }}
        >
          Created By BASAM QABIL
        </motion.p>
        
        <div className="flex flex-col md:flex-row justify-center mt-8 items-center gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => setIntroPhase('welcome')}
              className="liquid-panel p-3 rounded-full text-[#00f0ff] hover:bg-white/10 transition-all shadow-lg flex items-center justify-center"
              title="Home"
            >
              <Home size={20} />
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
            <div className="liquid-panel p-1 rounded-full flex shadow-lg w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  setMainMode('infographic');
                  setWidth('5760');
                  setHeight('1620');
                }}
                className={`px-4 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'infographic' 
                    ? 'liquid-btn-cyan' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 size={18} />
                Infographic
              </button>
              <button
                onClick={() => {
                  setMainMode('background');
                  setWidth('5760');
                  setHeight('1620');
                }}
                className={`px-4 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'background' 
                    ? 'liquid-btn-cyan' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers size={18} />
                Background
              </button>
              <button
                onClick={() => {
                  setMainMode('fhd');
                  setWidth('1920');
                  setHeight('1080');
                }}
                className={`px-4 md:px-8 py-3 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  mainMode === 'fhd' 
                    ? 'liquid-btn-cyan' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Monitor size={18} />
                FHD
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <section className="lg:col-span-5 space-y-6">
          
          {mainMode === 'infographic' && (
            <>
              <div className="liquid-panel rounded-[32px] p-6">
                <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                  <BarChart3 size={16} /> Infographic Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => setMode('infographic')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${
                      mode === 'infographic' 
                        ? 'liquid-btn-cyan' 
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    <BarChart3 size={18} />
                    <span>Infographic</span>
                  </button>
                  <button
                    onClick={() => setMode('map')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${
                      mode === 'map' 
                        ? 'liquid-btn-cyan' 
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    <MapIcon size={18} />
                    <span>Map</span>
                  </button>
                  <button
                    onClick={() => setMode('image-to-prompt')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${
                      mode === 'image-to-prompt' 
                        ? 'liquid-btn-cyan' 
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    <ImageIcon size={18} />
                    <span className="text-xs">Image to Prompt</span>
                  </button>
                </div>
              </div>

              {mode === 'image-to-prompt' ? (
                <div className="liquid-panel rounded-[32px] p-6">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                    <ImageIcon size={16} /> Upload Image
                  </label>
                  <div className="flex flex-col items-center justify-center">
                    {imageToPromptFile ? (
                      <div className="relative group w-full aspect-video">
                        <img 
                          src={imageToPromptFile} 
                          alt="To Prompt" 
                          className="w-full h-full object-contain rounded-xl border border-white/20 bg-black/50"
                        />
                        <button
                          onClick={() => setImageToPromptFile(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Hash size={16} className="rotate-45" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full aspect-video flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl text-white/40 hover:bg-white/5 transition-colors cursor-pointer">
                        <Upload size={32} className="mb-2" />
                        <span>Click to upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setImageToPromptFile(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                      <FileText size={16} /> Custom Instructions (Optional)
                    </label>
                    <textarea
                      value={imageToPromptInstructions}
                      onChange={(e) => setImageToPromptInstructions(e.target.value)}
                      placeholder="Add any specific modifications, notes, or changes you want to apply to the generated prompt..."
                      className="w-full h-24 liquid-input rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00f0ff]"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {slidesData.map((slide, index) => (
                      <div key={index} className="liquid-panel rounded-[32px] p-6 relative group">
                        <div className="flex items-center justify-between mb-3">
                          <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                            <Type size={16} /> Data & Information - Slide {index + 1}
                          </label>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  const text = await navigator.clipboard.readText();
                                  updateSlide(index, text);
                                } catch (err) {
                                  console.error('Failed to read clipboard', err);
                                }
                              }}
                              className="text-[10px] bg-white/10 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Copy size={10} /> Paste
                            </button>
                            {slidesData.length > 1 && (
                              <button 
                                onClick={() => removeSlide(index)}
                                className="text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-300 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <X size={10} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                        <textarea
                          value={slide}
                          onChange={(e) => updateSlide(index, e.target.value)}
                          placeholder={`Enter data for slide ${index + 1}...`}
                          className="w-full h-40 p-4 liquid-input rounded-2xl border-none focus:ring-2 focus:ring-blue-600/20 resize-none text-white placeholder:text-white/30 custom-scrollbar font-mono text-sm"
                        />
                      </div>
                    ))}
                    
                    <button
                      onClick={addSlide}
                      className="w-full py-4 liquid-panel rounded-[32px] flex items-center justify-center gap-2 text-[#00f0ff] hover:bg-white/5 transition-colors border border-dashed border-[#00f0ff]/30"
                    >
                      <Plus size={20} />
                      <span className="font-medium tracking-wider uppercase text-sm">Add Another Slide</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="liquid-panel rounded-[24px] p-4">
                      <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                        <Type size={12} /> Text Font
                      </label>
                      <select
                        value={textFont}
                        onChange={(e) => setTextFont(e.target.value)}
                        className="w-full p-2 liquid-input rounded-xl border-none text-xs appearance-none cursor-pointer text-white"
                      >
                        {TEXT_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="liquid-panel rounded-[24px] p-4">
                      <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                        <Type size={12} /> English Font
                      </label>
                      <select
                        value={englishFont}
                        onChange={(e) => setEnglishFont(e.target.value)}
                        className="w-full p-2 liquid-input rounded-xl border-none text-xs appearance-none cursor-pointer text-white"
                      >
                        {ENGLISH_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="liquid-panel rounded-[24px] p-4">
                      <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                        <Hash size={12} /> Num Font
                      </label>
                      <select
                        value={numberFont}
                        onChange={(e) => setNumberFont(e.target.value)}
                        className="w-full p-2 liquid-input rounded-xl border-none text-xs appearance-none cursor-pointer text-white"
                      >
                        {NUMBER_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="liquid-panel rounded-[32px] p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                    <Palette size={16} /> Style Type
                  </label>
                  {mode === 'image-to-prompt' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-white/60 uppercase tracking-wider">Use Styles</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={useImageToPromptStyles}
                          onChange={(e) => setUseImageToPromptStyles(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${useImageToPromptStyles ? 'bg-[#00f0ff]' : 'bg-white/20'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useImageToPromptStyles ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                  )}
                </div>
                
                {(!mode || mode !== 'image-to-prompt' || useImageToPromptStyles) && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setInfoStyle('original')}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          infoStyle === 'original'
                            ? 'liquid-btn-cyan'
                            : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setInfoStyle('realistic')}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          infoStyle === 'realistic'
                            ? 'liquid-btn-cyan'
                            : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        Realistic
                      </button>
                      <button
                        onClick={() => setInfoStyle('graphic')}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          infoStyle === 'graphic'
                            ? 'liquid-btn-cyan'
                            : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        Graphic
                      </button>
                      <button
                        onClick={() => setInfoStyle('graphic_realistic')}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          infoStyle === 'graphic_realistic'
                            ? 'liquid-btn-cyan'
                            : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        Graphic + Realistic
                      </button>
                    </div>

                    <AnimatePresence>
                      {infoStyle !== 'realistic' && infoStyle !== 'original' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 overflow-hidden"
                        >
                          <div>
                            <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">Color 1</label>
                            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                              <input 
                                type="color" 
                                value={infoColor1} 
                                onChange={(e) => setInfoColor1(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                              />
                              <span className="text-xs font-mono">{infoColor1}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">Color 2</label>
                            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                              <input 
                                type="color" 
                                value={infoColor2} 
                                onChange={(e) => setInfoColor2(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                              />
                              <span className="text-xs font-mono">{infoColor2}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">BG Color</label>
                            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                              <input 
                                type="color" 
                                value={infoBackgroundColor} 
                                onChange={(e) => setInfoBackgroundColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                              />
                              <span className="text-xs font-mono">{infoBackgroundColor}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {(!mode || mode !== 'image-to-prompt' || useImageToPromptStyles) && (
                <>
                  <div className="liquid-panel rounded-[32px] p-6">
                    <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                      <ImageIcon size={16} /> Preset Styles
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => setSelectedStyles([])}
                        className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all border ${
                          selectedStyles.length === 0
                            ? 'liquid-btn-cyan'
                            : 'liquid-input hover:bg-white/10'
                        }`}
                      >
                        Original
                      </button>
                      {PRESET_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => {
                            setSelectedStyles(prev => 
                              prev.includes(style.id) 
                                ? prev.filter(s => s !== style.id) 
                                : [...prev, style.id]
                            );
                          }}
                          className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all border ${
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

                  <div className="liquid-panel rounded-[32px] p-6">
                    <div className="flex justify-between items-center mb-4">
                      <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                        <ImageIcon size={16} /> Style Images (Optional)
                      </label>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#00f0ff]"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleImageUpload(e, false)}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {styleImages.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img 
                            src={img} 
                            alt={`Style ${idx}`} 
                            className="w-full h-full object-cover rounded-xl border border-white/20"
                          />
                          <button
                            onClick={() => removeImage(idx, false)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Hash size={10} className="rotate-45" />
                          </button>
                        </div>
                      ))}
                      {styleImages.length < 4 && (
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl text-white/40 hover:bg-white/5 transition-colors"
                        >
                          <Upload size={20} />
                          <span className="text-[10px] mt-1">Upload</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          
          {mainMode === 'background' && (
            <>
              <div className="liquid-panel rounded-[32px] p-6">
                <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                  <Type size={16} /> Background Request
                </label>
                <textarea
                  value={bgRequest}
                  onChange={(e) => setBgRequest(e.target.value)}
                  placeholder="Describe the background you want (e.g., Erbil Citadel, Tehran landmarks, abstract patterns)..."
                  className="w-full h-32 p-4 liquid-input rounded-2xl border-none focus:ring-2 focus:ring-blue-600/20 resize-none text-white placeholder:text-white/30 custom-scrollbar"
                />
              </div>

              <div className="liquid-panel rounded-[32px] p-6">
                <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                  <Type size={16} /> Custom Text on Image (Optional)
                </label>
                <textarea
                  value={bgCustomText}
                  onChange={(e) => setBgCustomText(e.target.value)}
                  placeholder="Type any text you want beautifully written on the background..."
                  className="w-full h-20 p-4 liquid-input rounded-2xl border-none focus:ring-2 focus:ring-blue-600/20 resize-none text-white placeholder:text-white/30 custom-scrollbar mb-4"
                />
                
                <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#00f0ff] mb-2">
                  <Type size={12} /> Text Font
                </label>
                <select
                  value={bgTextFont}
                  onChange={(e) => setBgTextFont(e.target.value)}
                  className="w-full p-3 liquid-input rounded-xl border-none text-sm appearance-none cursor-pointer text-white"
                >
                  {TEXT_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="liquid-panel rounded-[32px] p-6">
                <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
                  <Palette size={16} /> Style Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setBgStyle('realistic')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                      bgStyle === 'realistic'
                        ? 'liquid-btn-cyan'
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    Realistic
                  </button>
                  <button
                    onClick={() => setBgStyle('graphic')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                      bgStyle === 'graphic'
                        ? 'liquid-btn-cyan'
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    Graphic
                  </button>
                  <button
                    onClick={() => setBgStyle('graphic_realistic')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                      bgStyle === 'graphic_realistic'
                        ? 'liquid-btn-cyan'
                        : 'liquid-input hover:bg-white/10'
                    }`}
                  >
                    Graphic + Realistic
                  </button>
                </div>

                <AnimatePresence>
                  {bgStyle !== 'realistic' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 overflow-hidden"
                    >
                      <div>
                        <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">Color 1</label>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                          <input 
                            type="color" 
                            value={bgColor1} 
                            onChange={(e) => setBgColor1(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono">{bgColor1}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">Color 2</label>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                          <input 
                            type="color" 
                            value={bgColor2} 
                            onChange={(e) => setBgColor2(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono">{bgColor2}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">BG Color</label>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                          <input 
                            type="color" 
                            value={bgBackgroundColor} 
                            onChange={(e) => setBgBackgroundColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono">{bgBackgroundColor}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="liquid-panel rounded-[32px] p-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                    <ImageIcon size={16} /> Images to Blend
                  </label>
                  <button 
                    onClick={() => bgFileInputRef.current?.click()}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#00f0ff]"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <input
                  type="file"
                  ref={bgFileInputRef}
                  onChange={(e) => handleImageUpload(e, true)}
                  multiple
                  accept="image/*"
                  className="hidden"
                />
                <div className="grid grid-cols-4 gap-2">
                  {bgImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      <img 
                        src={img} 
                        alt={`Upload ${idx}`} 
                        className="w-full h-full object-cover rounded-xl border border-white/20"
                      />
                      <button
                        onClick={() => removeImage(idx, true)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Hash size={10} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                  {bgImages.length < 4 && (
                    <button 
                      onClick={() => bgFileInputRef.current?.click()}
                      className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl text-white/40 hover:bg-white/5 transition-colors"
                    >
                      <Upload size={20} />
                      <span className="text-[10px] mt-1">Upload</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {mainMode === 'fhd' && (
            <>
              {/* BG Presets Window */}
              <div className="liquid-panel rounded-[32px] p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
                    <Layers size={16} /> Background Presets
                  </label>
                  <label className="cursor-pointer text-xs bg-[#00f0ff]/10 text-[#00f0ff] px-3 py-1.5 rounded-xl hover:bg-[#00f0ff]/20 transition-all flex items-center gap-1.5 border border-[#00f0ff]/20">
                    <Plus size={14} /> Add Preset
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
                    onClick={() => setSelectedBgPreset(null)}
                    className={`py-2 px-5 rounded-xl text-xs font-bold transition-all border ${
                      selectedBgPreset === null
                        ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    None
                  </button>
                  {customBgPresets.map((preset) => (
                    <div key={preset.id} className="relative group">
                      <button
                        onClick={() => setSelectedBgPreset(preset.id)}
                        className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                          selectedBgPreset === preset.id
                            ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <img src={preset.image} alt={preset.id} className="w-5 h-5 rounded object-cover" />
                        {preset.id}
                      </button>
                      {preset.id !== 'B1' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBgPreset(preset.id);
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="liquid-panel rounded-[32px] p-6 space-y-8">
                
                {/* Image Upload */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                    <ImageIcon size={16} /> Character Reference Images
                  </label>
                  <p className="text-xs text-white/40 mb-4">Upload character images to maintain their exact features and poses.</p>
                  <div className="flex flex-wrap gap-4">
                    {fhdImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Reference ${idx + 1}`} className="w-20 h-20 object-cover rounded-2xl border border-white/20 shadow-lg" />
                        <button
                          onClick={() => setFhdImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer transition-all hover:border-[#00f0ff]/50 group">
                      <Upload size={20} className="text-white/30 group-hover:text-[#00f0ff] transition-colors" />
                      <span className="text-[10px] text-white/30 uppercase tracking-widest group-hover:text-[#00f0ff]">Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach((file: File) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFhdImages(prev => [...prev, reader.result as string]);
                            };
                            reader.readAsDataURL(file);
                          });
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Prompt Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                    <Wand2 size={16} /> Prompt & Instructions
                  </label>
                  <textarea
                    value={fhdPrompt}
                    onChange={(e) => setFhdPrompt(e.target.value)}
                    placeholder="Describe the scene, style, character poses, etc. (e.g., Two people standing in a futuristic city...)"
                    className="w-full h-32 liquid-input rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] resize-none"
                  />
                </div>

                {/* Enhancement Prompt Section */}
                <div className="liquid-input rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${useEnhancePrompt ? 'bg-white/10 text-[#00f0ff]' : 'bg-white/5 text-white/40'}`}>
                        <Wand2 size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Auto-Enhance Quality</span>
                        <span className="text-[10px] text-white/60 uppercase tracking-wider">Append enhancement instructions to the prompt</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUseEnhancePrompt(!useEnhancePrompt)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${useEnhancePrompt ? 'bg-[#00f0ff]' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        animate={{ x: useEnhancePrompt ? 26 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                      />
                    </button>
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
                          value={enhancePromptText}
                          onChange={(e) => setEnhancePromptText(e.target.value)}
                          className="w-full h-40 bg-black/40 border border-white/20 rounded-xl p-3 text-xs text-blue-100/80 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/50 resize-y mt-2"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Text Overlay Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-3">
                    <Type size={16} /> Specific Text to Add
                  </label>
                  <input
                    type="text"
                    value={fhdTextOverlay}
                    onChange={(e) => setFhdTextOverlay(e.target.value)}
                    placeholder="Any text written here will be added to the design..."
                    className="w-full liquid-input rounded-xl p-4 w-full"
                  />
                </div>

                {/* Keep Original Characters Toggle */}
                <div className="flex items-center justify-between liquid-input rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${keepOriginalCharacters ? 'bg-white/10 text-[#00f0ff]' : 'bg-white/5 text-white/40'}`}>
                      <ImageIcon size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Keep Original Characters</span>
                      <span className="text-[10px] text-white/60 uppercase tracking-wider">Maintain exact faces and poses from reference images</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setKeepOriginalCharacters(!keepOriginalCharacters)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${keepOriginalCharacters ? 'bg-[#00f0ff]' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: keepOriginalCharacters ? 26 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                    />
                  </button>
                </div>

                {/* FHD Safe Zone Padding */}
                <div className="liquid-input rounded-2xl p-5 mt-4 space-y-5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#00f0ff]/10 text-[#00f0ff]">
                      <Maximize size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Subject Padding (Safe Zone)</span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Distance from edges in percentage</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {/* Left */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Left (%)</label>
                      <input 
                        type="number" 
                        min="0" max="100" 
                        value={safeZoneLeft} 
                        onChange={(e) => setSafeZoneLeft(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/20 transition-all"
                      />
                    </div>
                    {/* Top */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Top (%)</label>
                      <input 
                        type="number" 
                        min="0" max="100" 
                        value={safeZoneTop} 
                        onChange={(e) => setSafeZoneTop(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/20 transition-all"
                      />
                    </div>
                    {/* Right */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Right (%)</label>
                      <input 
                        type="number" 
                        min="0" max="100" 
                        value={safeZoneRight} 
                        onChange={(e) => setSafeZoneRight(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Distance Between Subjects */}
                <div className="liquid-input rounded-2xl p-5 mt-4 space-y-5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#00f0ff]/10 text-[#00f0ff]">
                      <Maximize size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Distance Between Subjects</span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Distance apart in percentage (0 = extremely close)</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <input 
                      type="number" 
                      min="0" max="100" 
                      value={subjectDistance} 
                      onChange={(e) => setSubjectDistance(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/20 transition-all"
                    />
                  </div>
                </div>

              </div>
            </>
          )}

          {/* Shared Size Options */}
          <div className="liquid-panel rounded-[32px] p-6">
            <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff] mb-4">
              <Maximize size={16} /> Size (Pixels)
            </label>
            
            <div className="mb-4">
              <span className="text-[10px] text-white/60 block uppercase tracking-wider mb-2">Presets</span>
              <div className="grid grid-cols-3 gap-2">
                {(mainMode === 'fhd' ? [
                  { id: 'VW1', label: 'VW1 (5760x1620)', w: '5760', h: '1620' },
                  { id: 'VW2', label: 'VW2 (6080x1620)', w: '6080', h: '1620' },
                  { id: '4K', label: '4K (3840x2160)', w: '3840', h: '2160' },
                ] : SIZE_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setWidth(preset.w);
                      setHeight(preset.h);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
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
                <span className="text-[10px] text-white/60 block uppercase tracking-wider">Width</span>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="e.g. 1920"
                  className="w-full p-2 liquid-input rounded-xl border-none text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00f0ff]"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-white/60 block uppercase tracking-wider">Height</span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 1080"
                  className="w-full p-2 liquid-input rounded-xl border-none text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00f0ff]"
                />
              </div>
            </div>
          </div>

          <div className="liquid-panel rounded-[32px] p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${useAvaStyle ? 'bg-white/10 text-[#00f0ff]' : 'bg-white/5 text-white/40'}`}>
                <Wand2 size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">AVA's Style</span>
                <span className="text-[10px] text-white/60 uppercase tracking-wider">Apply signature purple/neon aesthetic</span>
              </div>
            </div>
            <button 
              onClick={() => setUseAvaStyle(!useAvaStyle)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${useAvaStyle ? 'bg-[#00f0ff]' : 'bg-white/5'}`}
            >
              <motion.div 
                animate={{ x: useAvaStyle ? 26 : 4 }}
                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
              />
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full liquid-btn-cyan w-full py-4 rounded-full font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            Generate Prompts
          </button>
        </section>

        {/* Output Section */}
        <section className="lg:col-span-7">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {prompts.length > 0 ? (
                prompts.map((promptGroup, groupIdx) => {
                  const slidePrompts = promptGroup.prompts || [promptGroup.prompt];
                  const currentSlideIdx = activeSlide[groupIdx] || 0;
                  const promptText = slidePrompts[currentSlideIdx];
                  const uniqueIdx = groupIdx * 100 + currentSlideIdx; 
                  const isMultiSlide = slidePrompts.length > 1;
                  
                  return (
                    <motion.div
                      key={groupIdx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: groupIdx * 0.1 }}
                      className={`liquid-panel rounded-[32px] p-6 flex flex-col h-full transition-all duration-500 ${copiedIndices.includes(uniqueIdx) ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''} ${groupIdx === 4 ? 'md:col-span-2 xl:col-span-1 border-white/20' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${copiedIndices.includes(uniqueIdx) ? 'text-green-400' : 'text-white/40'}`}>
                          {promptGroup.title}
                        </span>
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => copyToClipboard(promptText, uniqueIdx)}
                            className={`p-2 hover:bg-white/5 rounded-full transition-colors ${copiedIndices.includes(uniqueIdx) ? 'text-green-400' : 'text-[#00f0ff]'}`}
                          >
                            {copiedIndices.includes(uniqueIdx) ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                      
                      {isMultiSlide && (
                        <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar pb-2">
                          {slidePrompts.map((_, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => setActiveSlide(prev => ({ ...prev, [groupIdx]: sIdx }))}
                              className={`px-4 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${currentSlideIdx === sIdx ? 'bg-[#00f0ff] text-black font-bold' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'}`}
                            >
                              {sIdx + 1}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex-grow overflow-y-auto max-h-60 custom-scrollbar relative">
                        <AnimatePresence mode="wait">
                          <motion.p 
                            key={`text-${uniqueIdx}`}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm leading-relaxed text-white/80 font-mono italic"
                          >
                            {promptText}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                  <div className="col-span-full h-96 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/10 rounded-[40px]">
                    <Type size={48} strokeWidth={1} />
                    <p className="mt-4 font-serif italic text-center px-6">
                      Prompts will appear here.
                    </p>
                  </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}
