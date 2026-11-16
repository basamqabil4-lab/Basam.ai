export type MainMode = 'infographic' | 'background' | 'fhd';
export type InfographicSubMode = 'infographic' | 'map' | 'image-to-prompt';
export type StyleType = 'graphic' | 'realistic' | 'graphic_realistic' | 'original';
export type ThinkingPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ModelOption {
  id: string;
  label: string;
  badge: string;
  descriptionKu: string;
  descriptionEn: string;
}

export const DEFAULT_MODEL = 'gemini-3.8-flash';

export const AI_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'Free Tier • Fast Flash',
    descriptionKu: 'خێرا و کارا بۆ پرۆمپت و شیکردنەوەی وێنە و دیزاین (پاڵپشتی پلانی خۆڕایی دەکات)',
    descriptionEn: 'High-speed multimodal Gemini 3.8 Flash model (Free Tier friendly)',
  },
];

export const TEXT_FONTS = [
  'IBM Plex Sans Arabic',
  'Vazirmatn',
  'Noto Kufi Arabic',
  'Cairo',
  'Tajawal',
  'Noto Naskh Arabic',
  'Readex Pro',
  'Almarai',
];

export const NUMBER_FONTS = [
  'Bahnschrift',
  'JetBrains Mono',
  'Roboto Mono',
  'Montserrat Bold',
  'Inter ExtraBold',
  'Space Grotesk',
  'Outfit Semibold',
  'Lexend',
  'Bebas Neue',
  'Archivo Black',
  'Helix',
];

export const ENGLISH_FONTS = [
  'Bahnschrift',
  'Inter',
  'SF Pro Display',
  'Montserrat',
  'Roboto',
  'Open Sans',
  'Playfair Display',
  'Space Grotesk',
  'JetBrains Mono',
  'Helix',
];

export interface SizePreset {
  id: string;
  label: string;
  w: string;
  h: string;
}

export const INFOGRAPHIC_SIZE_PRESETS: SizePreset[] = [
  { id: 'VW1', label: 'VW1 (5760×1620)', w: '5760', h: '1620' },
  { id: 'VW2', label: 'VW2 (6080×1620)', w: '6080', h: '1620' },
  { id: 'HD', label: 'HD (1920×1080)', w: '1920', h: '1080' },
  { id: '1:1', label: 'Post (1080×1080)', w: '1080', h: '1080' },
  { id: '9:16', label: 'Reels (1080×1920)', w: '1080', h: '1920' },
  { id: '3:4', label: 'Portrait (1080×1350)', w: '1080', h: '1350' },
];

export const FHD_SIZE_PRESETS: SizePreset[] = [
  { id: 'VW1', label: 'VW1 (5760×1620)', w: '5760', h: '1620' },
  { id: 'VW2', label: 'VW2 (6080×1620)', w: '6080', h: '1620' },
  { id: '4K', label: '4K (3840×2160)', w: '3840', h: '2160' },
  { id: 'HD', label: 'HD (1920×1080)', w: '1920', h: '1080' },
  { id: '1:1', label: 'Square (1080×1080)', w: '1080', h: '1080' },
  { id: '9:16', label: 'Vertical (1080×1920)', w: '1080', h: '1920' },
];

export const PRESET_STYLES = [
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

export const MAX_UPLOAD_IMAGES = 8;

export const DEFAULT_B1_SVG =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzFlM2E4YSIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1MCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5CMTwvdGV4dD4KPC9zdmc+';

export const DEFAULT_ENHANCE_PROMPT = `Ultra-premium professional image enhancement.
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
Keep everything exactly the same only enhance quality.`;

export function calculateAspectRatio(w: string, h: string): { ratio: string; isValid: boolean } {
  const wNum = Number(w);
  const hNum = Number(h);
  if (!Number.isFinite(wNum) || !Number.isFinite(hNum) || wNum <= 0 || hNum <= 0) {
    return { ratio: '16:9', isValid: false };
  }

  const targetRatio = wNum / hNum;
  const validAspectRatios = [
    { str: '1:1', val: 1 },
    { str: '3:4', val: 3 / 4 },
    { str: '4:3', val: 4 / 3 },
    { str: '9:16', val: 9 / 16 },
    { str: '16:9', val: 16 / 9 },
    { str: '1:4', val: 1 / 4 },
    { str: '1:8', val: 1 / 8 },
    { str: '4:1', val: 4 / 1 },
    { str: '8:1', val: 8 / 1 },
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

  return { ratio: closest.str, isValid: true };
}
