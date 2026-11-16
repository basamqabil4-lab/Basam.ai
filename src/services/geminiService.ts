import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { DEFAULT_MODEL, StyleType, ThinkingPreset } from '../constants/options';
import { dataUrlToInlinePart, InlineImagePart } from '../utils/imageUtils';

// ==========================================
// API KEY ROTATION & ENV RESOLUTION
// ==========================================

function resolveApiKeys(): string[] {
  let rawKeys = '';

  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      rawKeys = (import.meta as any).env.VITE_GEMINI_API_KEYS || '';
    }
  } catch {
    // Ignore env read failure
  }

  if (!rawKeys) {
    try {
      const legacyKey = process.env.GEMINI_API_KEY || '';
      if (legacyKey && legacyKey !== 'MY_GEMINI_API_KEY') {
        rawKeys = legacyKey;
      }
    } catch {
      // Ignore process.env unavailability in browser
    }
  }

  return rawKeys
    .split(',')
    .map((key: string) => key.trim())
    .filter((key: string) => key.length > 0 && key !== 'MY_GEMINI_API_KEY');
}

let currentKeyIndex = 0;
const keyCooldownUntil = new Map<number, number>();
const KEY_COOLDOWN_MS = 60_000;

function getApiKeys(): string[] {
  return resolveApiKeys();
}

function selectActiveKey(keys: string[]): { key: string; index: number } {
  const now = Date.now();
  for (let offset = 0; offset < keys.length; offset++) {
    const idx = (currentKeyIndex + offset) % keys.length;
    const cooldown = keyCooldownUntil.get(idx) || 0;
    if (now >= cooldown) {
      currentKeyIndex = idx;
      return { key: keys[idx], index: idx };
    }
  }
  const idx = currentKeyIndex % keys.length;
  return { key: keys[idx], index: idx };
}

function markKeyCooldown(failedIndex: number, totalKeys: number) {
  keyCooldownUntil.set(failedIndex, Date.now() + KEY_COOLDOWN_MS);
  if (totalKeys > 1) {
    currentKeyIndex = (failedIndex + 1) % totalKeys;
    console.warn(`API Key ${failedIndex + 1} hit quota; rotated to index ${currentKeyIndex + 1}`);
  }
}

function safeErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const err = error as Record<string, any>;
  const parts: string[] = [];
  if (err.message) parts.push(String(err.message));
  if (err.status) parts.push(String(err.status));
  if (err.code) parts.push(String(err.code));
  if (err.error?.message) parts.push(String(err.error.message));
  if (err.error?.status) parts.push(String(err.error.status));
  if (parts.length > 0) return parts.join(' ').toLowerCase();
  try {
    return JSON.stringify(error).toLowerCase();
  } catch {
    return String(error).toLowerCase();
  }
}

function isQuotaExceededError(error: unknown): boolean {
  const text = safeErrorText(error);
  return (
    text.includes('quota') ||
    text.includes('429') ||
    text.includes('exhausted') ||
    text.includes('resource_exhausted')
  );
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function withRetry<T>(
  operation: (apiKey: string) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error(
      'API_KEY_MISSING: VITE_GEMINI_API_KEYS (or GEMINI_API_KEY) is missing in your .env.local file.'
    );
  }

  const maxRetries = keys.length;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    checkAborted(signal);
    const { key, index } = selectActiveKey(keys);
    try {
      return await operation(key);
    } catch (error: unknown) {
      if ((error as Error)?.name === 'AbortError' || signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (isQuotaExceededError(error)) {
        markKeyCooldown(index, keys.length);
        if (attempt < maxRetries) {
          await sleep(600, signal);
          continue;
        }
        throw new Error(
          'QUOTA_EXHAUSTED: All configured API keys have reached their quota limit. Please try again later or add another key.'
        );
      }
      throw error;
    }
  }

  throw new Error('QUOTA_EXHAUSTED: All configured API keys have reached their quota limit.');
}

// ==========================================
// SHARED PROMPT HELPERS
// ==========================================

const PRESET_STYLE_MAP: Record<string, { title: string; desc: string }> = {
  'cyber-map': {
    title: 'Cyber Map',
    desc: 'Futuristic tactical UI with glowing lines, data points, and a dark blue/cyan aesthetic.',
  },
  'futuristic-3d': {
    title: 'Futuristic 3D',
    desc: 'Dark 3D presentation style with glowing spheres, deep purple gradients, and high-tech depth.',
  },
  'tech-landing': {
    title: 'Tech Landing',
    desc: 'Modern tech landing page style with glowing blue cards, clean white text, and a professional dark theme.',
  },
  'ai-analytics': {
    title: 'AI Analytics',
    desc: 'Isometric data visualization style with 3D bar charts, world maps, and AI-themed purple/blue accents.',
  },
  'ai-ecosystem': {
    title: 'AI Ecosystem',
    desc: 'Central node network style connecting various AI service logos with glowing lines and a dark, immersive background.',
  },
  minimalist: {
    title: 'Minimalist',
    desc: 'Clean, minimalist corporate style with a crisp light background and professional blue accents.',
  },
  vibrant: {
    title: 'Vibrant Modern',
    desc: 'Vibrant, high-energy modern style with bold gradients and dark mode aesthetic.',
  },
  editorial: {
    title: 'Editorial',
    desc: 'Sophisticated editorial style with refined typography and warm earth tones.',
  },
  'tech-grid': {
    title: 'Tech Grid',
    desc: 'Futuristic tech-focused style with neon highlights and subtle data-grid patterns.',
  },
  'purple-special': {
    title: 'Purple Special',
    desc: 'Professional, clear infographic with a rich dark purple background using a strict palette of white, purple, pink, and blue.',
  },
};

function buildVisualStyleGuidance(
  styleType?: StyleType,
  color1?: string,
  color2?: string,
  bgColor?: string
): { instruction: string; enforceColors: boolean } {
  if (!styleType || styleType === 'original') {
    return { instruction: '', enforceColors: false };
  }

  if (styleType === 'realistic') {
    return {
      instruction:
        'Visual Medium: 100% authentic, editorial-grade photorealistic photography with natural studio or environmental lighting, genuine material textures, and balanced depth of field. Avoid flat 2D illustrations, CGI plastic sheen, or decorative overlays.',
      enforceColors: false,
    };
  }

  const hasColors = Boolean(color1 && color2 && bgColor);
  const paletteClause = hasColors
    ? ` Use ${bgColor} as the primary canvas background and strictly limit accent elements, icons, charts, and highlights to ${color1} and ${color2}.`
    : '';

  if (styleType === 'graphic') {
    return {
      instruction: `Visual Medium: High-end, disciplined modern 2D/3D editorial graphic design built on a clean grid with generous negative space, crisp vector/matte-3D forms, and purposeful minimalism. Avoid photorealistic photography and avoid decorative clutter.${paletteClause}`,
      enforceColors: hasColors,
    };
  }

  return {
    instruction: `Visual Medium: Sophisticated hybrid of authentic photography and clean modern editorial graphic design (structured cards, crisp typographic framing, clean geometric dividers, subtle ambient depth). Keep graphics restrained and purposeful without floating particles or ornamental noise.${paletteClause}`,
    enforceColors: hasColors,
  };
}

const DESIGNER_RESTRAINT_RULE = `SENIOR ART DIRECTOR STANDARDS:
- Think and compose like a top-tier broadcast & editorial graphic designer: strict visual grid, intentional negative space, balanced focal hierarchy, refined lighting, and cohesive restraint.
- STRICT ANTI-CLUTTER RULE: NEVER invent or add unrequested decorative clichés (such as mandalas, floral/arabesque ornaments, random swirling patterns, floating dust/sparkle particles, cheesy lens flares, chaotic neon lines, or arbitrary filler shapes) — and do NOT write negative mentions of those banned items in the output prompt itself; simply focus purely on clean surfaces, intentional negative space, and elements that directly serve the user's topic and data.
- Write pure, polished, visual description prose inside each output prompt. NEVER include meta-instructions like "CRITICAL REQUIREMENT" or "You MUST" inside the generated prompt string itself.`;

function buildAvaStyleGuidance(useAvaStyle?: boolean): string {
  if (!useAvaStyle) return '';
  return `
AVA SIGNATURE BROADCAST STYLE:
- Color Palette: Rich deep violet-indigo and dark slate base accented cleanly with refined electric blue and vibrant magenta highlights.
- Aesthetic: High-end modern TV broadcast & executive newsroom motion-design aesthetic—crisp glassmorphic cards, clean architectural light beams, subtle linear depth, disciplined geometric framing, and polished studio lighting.
- Restraint: Keep surfaces sleek, architectural, and uncluttered without ornamental patterns, busy network webs, or decorative particles.`;
}

function buildTypographyHierarchy(
  textFont?: string,
  numberFont?: string,
  englishFont?: string
): string {
  const primary = textFont || 'IBM Plex Sans Arabic';
  const extras = [
    numberFont ? `Number Font: "${numberFont}"` : '',
    englishFont ? `English Font: "${englishFont}"` : '',
  ]
    .filter(Boolean)
    .join(', ');

  if (primary === 'IBM Plex Sans Arabic') {
    return `Act as a senior graphic designer assigning typographic weight hierarchy automatically using the "IBM Plex Sans Arabic" font family: use IBM Plex Sans Arabic Bold (700) for main headlines and hero titles, IBM Plex Sans Arabic SemiBold (600) or Medium (500) for subheadings and section headers, IBM Plex Sans Arabic Regular (400) for body text and data descriptions, and IBM Plex Sans Arabic Light (300), ExtraLight (200), or Thin (100) for slogans, taglines, captions, and subtle metadata.${extras ? ` Also apply ${extras}.` : ''}`;
  }

  return `Act as a senior graphic designer applying clean typographic weight hierarchy with "${primary}" (Bold for main headlines, SemiBold/Medium for subheadings, Regular for body text, Light/Thin for slogans and captions).${extras ? ` Also apply ${extras}.` : ''}`;
}

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    text = fenced[1].trim();
  }
  return text;
}

function parseJsonSafe(raw: string): unknown {
  const cleaned = stripMarkdownFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt extracting JSON array or object if surrounded by extra text
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    }
    throw new Error('Invalid JSON response from model');
  }
}

function resolveThinkingConfig(level?: ThinkingPreset) {
  const map: Record<ThinkingPreset, ThinkingLevel> = {
    LOW: ThinkingLevel.LOW,
    MEDIUM: ThinkingLevel.MEDIUM,
    HIGH: ThinkingLevel.HIGH,
  };
  return { thinkingLevel: map[level || 'LOW'] };
}

function buildInlineParts(images?: string[]): InlineImagePart[] {
  if (!images || images.length === 0) return [];
  return images.map(dataUrlToInlinePart).filter((p): p is InlineImagePart => p !== null);
}

// ==========================================
// EXPORTED TYPES & GENERATORS
// ==========================================

export interface PromptResult {
  title: string;
  prompt: string;
  prompts?: string[];
  isError?: boolean;
}

export interface GenerateOptions {
  model?: string;
  thinkingLevel?: ThinkingPreset;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number, label: string) => void;
}

export interface PromptRequest {
  data: string[];
  textFont: string;
  numberFont: string;
  englishFont: string;
  aspectRatio: string;
  styleImages: string[];
  selectedStyles?: string[];
  mode: 'infographic' | 'map';
  useAvaStyle?: boolean;
  styleType?: StyleType;
  color1?: string;
  color2?: string;
  bgColor?: string;
}

export async function generateInfographicPrompts(
  request: PromptRequest,
  options: GenerateOptions = {}
): Promise<PromptResult[]> {
  const model = options.model || DEFAULT_MODEL;
  const stylesToGenerate: { title: string; description: string; image?: string }[] = [];

  if (request.selectedStyles && request.selectedStyles.length > 0) {
    request.selectedStyles.forEach((styleId) => {
      if (PRESET_STYLE_MAP[styleId]) {
        stylesToGenerate.push({
          title: PRESET_STYLE_MAP[styleId].title,
          description: PRESET_STYLE_MAP[styleId].desc,
        });
      }
    });
  }

  if (request.styleImages && request.styleImages.length > 0) {
    request.styleImages.forEach((img, idx) => {
      stylesToGenerate.push({
        title: `Custom Style ${idx + 1}`,
        description:
          'Extract ONLY the color palette, atmosphere, and lighting mood from the provided reference image; do NOT copy its layout or unrelated objects.',
        image: img,
      });
    });
  }

  if (stylesToGenerate.length === 0) {
    stylesToGenerate.push({
      title: 'General Style',
      description: 'A clean, modern, high-clarity visual layout focused on data readability.',
    });
  }

  const { instruction: visualGuidance, enforceColors } = buildVisualStyleGuidance(
    request.styleType,
    request.color1,
    request.color2,
    request.bgColor
  );
  const avaGuidance = buildAvaStyleGuidance(request.useAvaStyle);

  const modeInstruction =
    request.mode === 'map'
      ? `The image MUST be a highly accurate, realistic geographic map visualization. Ensure borders and terrain are precise.
         If specific locations (e.g., Erbil, Qatar, cities, countries) are mentioned, place callouts, labels, and pins on their accurate geographic positions.
         If country names are mentioned, include accurate national flags beside their labels.`
      : `The image MUST be a professional, data-driven infographic layout (charts, icons, cards, structured timelines) clearly representing all provided data.
         Convert percentages into clear visual charts (bar, pie, or progress rings) and sequences into clean timelines.
         LAYOUT DIRECTION: Organize the visual flow Right-to-Left (RTL) suitable for Kurdish/Arabic reading order, while keeping the overall composition centered and balanced.`;

  const colorRule = enforceColors
    ? `Strict Color Palette: Background ${request.bgColor}; graphic elements restricted to ${request.color1} and ${request.color2}.`
    : 'Color Palette: Cohesive, well-balanced colors matching the chosen visual style.';

  const formattedData = request.data
    .map((d, i) => `--- SLIDE ${i + 1} DATA ---\n${d}\n`)
    .join('\n');

  const totalStyles = stylesToGenerate.length;
  checkAborted(options.signal);
  options.onProgress?.(
    0,
    1,
    totalStyles === 1 ? stylesToGenerate[0].title : `${totalStyles} styles (1 request)`
  );

  const parts: any[] = [];
  stylesToGenerate.forEach((styleConfig) => {
    if (styleConfig.image) {
      const imgPart = dataUrlToInlinePart(styleConfig.image);
      if (imgPart) {
        parts.push({
          text: `[REFERENCE IMAGE FOR "${styleConfig.title}": Extract ONLY color palette, lighting, and visual atmosphere for the style "${styleConfig.title}". Do NOT blend this image into other preset styles.]`,
        });
        parts.push(imgPart);
      }
    }
  });

  const stylesRosterText = stylesToGenerate
    .map(
      (s, i) =>
        `${i + 1}. Title: "${s.title}"\n   Style Direction: ${visualGuidance ? `${visualGuidance} ` : ''}${s.description}`
    )
    .join('\n');

  const exampleJson = JSON.stringify(
    stylesToGenerate.map((s) => ({
      title: s.title,
      prompts: request.data.map((_, sIdx) => `prompt for slide ${sIdx + 1} in ${s.title} style`),
    })),
    null,
    2
  );

  parts.push({
    text: `Act as a world-class senior art director and AI image prompt engineer writing production-ready visual prompts for Gemini Image and Midjourney v6.

${DESIGNER_RESTRAINT_RULE}

TASK:
In THIS SINGLE RESPONSE, generate prompts for ALL ${totalStyles} requested visual style(s) listed below, each covering all ${request.data.length} slide(s).

REQUESTED STYLES (${totalStyles} distinct style groups):
${stylesRosterText}

SHARED SPECIFICATIONS FOR EVERY STYLE GROUP:
1. Opening & Tone: Start naturally (e.g., "A clean, executive editorial infographic..." or "A precise, studio-grade geographic map visualization...") with balanced lighting, intentional negative space, and crisp rendering.
2. Exact Data Fidelity: Explicitly incorporate the exact text, Kurdish/Arabic/English labels, numbers, and statistics from each slide.
3. Composition & RTL Flow: Structured grid with clean alignment and Right-to-Left visual hierarchy where applicable, leaving generous breathing room around cards and text.
4. Typography Style: ${buildTypographyHierarchy(request.textFont, request.numberFont, request.englishFont)}
5. Aspect Ratio: Frame for "${request.aspectRatio}".
6. Mode Rules: ${modeInstruction}
7. ${colorRule}${avaGuidance}
8. Multi-Slide Consistency WITHIN Each Style: Within any single style group, all ${request.data.length} slide prompts MUST share that style's identical visual language, grid discipline, lighting, and color palette, changing only the specific slide content and relevant subject icons.
9. Distinctness ACROSS Styles: Each of the ${totalStyles} style groups MUST faithfully reflect its own distinct aesthetic and title without blending unrelated presets together.

Data (${request.data.length} slide(s)):
${formattedData}

Return ONLY a valid JSON array of EXACTLY ${totalStyles} object(s) in the exact same order:
${exampleJson}`,
  });

  const response: GenerateContentResponse = await withRetry(
    (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      return ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: resolveThinkingConfig(options.thinkingLevel),
        },
      });
    },
    options.signal
  );

  options.onProgress?.(1, 1, totalStyles === 1 ? stylesToGenerate[0].title : `${totalStyles} styles`);

  if (!response.text) {
    throw new Error('The AI returned an empty response (possibly due to safety filters). Try simplifying your input.');
  }

  try {
    const parsed = parseJsonSafe(response.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const results: PromptResult[] = parsed.map((group: any, idx: number) => {
        const fallbackTitle = stylesToGenerate[idx]?.title || `Style ${idx + 1}`;
        const title = String(group?.title || fallbackTitle);

        let promptsArray: string[] = [];
        if (Array.isArray(group?.prompts) && group.prompts.length > 0) {
          promptsArray = group.prompts.map((item: unknown) =>
            typeof item === 'string' ? item.trim() : JSON.stringify(item)
          );
        } else if (group?.prompt) {
          promptsArray = [String(group.prompt).trim()];
        } else {
          promptsArray = [stripMarkdownFences(JSON.stringify(group))];
        }

        const combined = promptsArray
          .map((p, sIdx) => (promptsArray.length > 1 ? `[ SLIDE ${sIdx + 1} ]\n${p}` : p))
          .join('\n\n');

        return {
          title,
          prompt: combined,
          prompts: promptsArray,
        };
      });
      return results;
    }
  } catch {
    // Fallback if non-array returned
  }

  const fallbackText = stripMarkdownFences(response.text);
  return [
    {
      title: stylesToGenerate.map((s) => s.title).join(' + '),
      prompt: fallbackText,
      prompts: [fallbackText],
    },
  ];
}

export interface ImageToPromptRequest {
  image: string;
  selectedStyles?: string[];
  styleType?: StyleType;
  color1?: string;
  color2?: string;
  bgColor?: string;
  styleImages?: string[];
  customInstructions?: string;
  aspectRatio?: string;
  textFont?: string;
  numberFont?: string;
  englishFont?: string;
  useAvaStyle?: boolean;
}

export async function generateImageToPromptPrompts(
  request: ImageToPromptRequest,
  options: GenerateOptions = {}
): Promise<PromptResult[]> {
  const model = options.model || DEFAULT_MODEL;
  const mainImagePart = dataUrlToInlinePart(request.image);
  if (!mainImagePart) {
    throw new Error('Could not parse the uploaded image format.');
  }

  let styleGuidance = '';
  if (request.selectedStyles && request.selectedStyles.length > 0) {
    const styleDescriptions = request.selectedStyles
      .map((s) => PRESET_STYLE_MAP[s]?.desc)
      .filter(Boolean)
      .join(' ');
    if (styleDescriptions) {
      styleGuidance += `\nTarget Style Adaptation: Adapt the visual description into this aesthetic: ${styleDescriptions}`;
    }
  }

  const { instruction: visualGuidance, enforceColors } = buildVisualStyleGuidance(
    request.styleType,
    request.color1,
    request.color2,
    request.bgColor
  );
  if (visualGuidance) {
    styleGuidance += `\n${visualGuidance}`;
  }

  const extraImageParts = buildInlineParts(request.styleImages);
  if (extraImageParts.length > 0) {
    styleGuidance +=
      '\nReference Style Images: Incorporate the color palette, atmosphere, and lighting from the additional reference images.';
  }

  const avaGuidance = buildAvaStyleGuidance(request.useAvaStyle);

  const textPart = {
    text: `Act as a world-class senior art director and AI image prompt engineer. Analyze the primary image with extreme precision and craft a cohesive, production-ready English prompt suitable for Gemini Image or Midjourney v6.

${DESIGNER_RESTRAINT_RULE}

Describe ONLY what is genuinely present in the reference image (subjects, composition, camera lens/angle, lighting, materials, typography, color harmony) plus any explicit style adaptations below.${styleGuidance}${avaGuidance}
${request.aspectRatio ? `Aspect Ratio: "${request.aspectRatio}".` : ''}
${request.textFont ? `Typography Reference (if text appears): ${buildTypographyHierarchy(request.textFont, request.numberFont, request.englishFont)}` : ''}
${enforceColors ? `Strict Color Palette: Background ${request.bgColor}; graphic elements restricted to ${request.color1} and ${request.color2}.` : ''}
${request.customInstructions ? `User Requested Modifications (apply carefully): "${request.customInstructions}"` : ''}

Return ONLY a valid JSON array containing EXACTLY 1 object:
[
  {
    "title": "Extracted Prompt",
    "prompt": "the detailed visual prompt in English"
  }
]`,
  };

  const response = await withRetry(
    (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      return ai.models.generateContent({
        model,
        contents: { parts: [mainImagePart, ...extraImageParts, textPart] },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: resolveThinkingConfig(options.thinkingLevel),
        },
      });
    },
    options.signal
  );

  if (!response.text) {
    throw new Error('The AI returned an empty response for this image.');
  }

  try {
    const parsed = parseJsonSafe(response.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => ({
        title: String(item?.title || `Extracted Prompt ${idx + 1}`),
        prompt: String(item?.prompt || '').trim(),
      }));
    }
  } catch {
    // Fallback to raw cleaned text
  }

  return [{ title: 'Extracted Prompt', prompt: stripMarkdownFences(response.text) }];
}

export interface FHDPromptRequest {
  prompt: string;
  textOverlay?: string;
  aspectRatio: string;
  images: string[];
  keepOriginal?: boolean;
  bgPresetImage?: string | null;
  bgPresetName?: string | null;
  safeZoneLeft?: number;
  safeZoneRight?: number;
  safeZoneTop?: number;
  subjectDistance?: number;
  useAvaStyle?: boolean;
}

const B1_PROMPT =
  'A high-quality, clean digital background with a professional broadcast aesthetic. The design features a smooth deep navy blue gradient, with a soft purple glow on the far left and a bright cyan light on the right. In the center, there is a very faint, minimalist world map composed of tiny dots (dotted map style). On the far right, there are vertical blue bars with diagonal stripes and a glossy finish. Smooth surface, high-tech corporate style, 8k resolution, cinematic lighting, no checkered grid or mesh.';

export async function generateFHDPrompts(
  request: FHDPromptRequest,
  options: GenerateOptions = {}
): Promise<PromptResult[]> {
  const model = options.model || DEFAULT_MODEL;
  const imageParts = buildInlineParts(request.images);

  let imageInstruction = '';
  if (imageParts.length > 0) {
    const numImages = imageParts.length;
    const distanceText =
      request.subjectDistance && request.subjectDistance > 0
        ? `positioned approximately ${request.subjectDistance}% apart from each other`
        : 'standing very close together, shoulder-to-shoulder, forming a tight cohesive group';

    if (request.keepOriginal) {
      imageInstruction = `Reference Character Preservation (${numImages} image(s)): Instruct the image generator to keep the exact faces, expressions, clothing, poses, and proportions of the reference person(s) 100% unchanged, ${distanceText}, seamlessly integrated into the new scene/background.`;
    } else {
      imageInstruction = `Reference Subjects (${numImages} image(s)): Combine all ${numImages} subjects naturally into ONE cohesive scene, ${distanceText}, adapting poses and lighting harmoniously.`;
    }
  }

  let bgInstruction = '';
  if (request.bgPresetName === 'B1') {
    bgInstruction = `Background Preset (B1): Use this exact broadcast background description: "${B1_PROMPT}". Integrate subjects naturally with matching perspective and lighting.`;
  } else if (request.bgPresetImage) {
    const presetPart = dataUrlToInlinePart(request.bgPresetImage);
    if (presetPart) {
      imageParts.push(presetPart);
      bgInstruction = `Background Preset (${request.bgPresetName?.toUpperCase() || 'Custom'}): Use the provided background preset image as the exact scene backdrop, matching subject shadows, reflections, perspective, and color grading naturally.`;
    }
  }

  let safeZoneInstruction = '';
  if (
    (request.safeZoneLeft && request.safeZoneLeft > 0) ||
    (request.safeZoneRight && request.safeZoneRight > 0) ||
    (request.safeZoneTop && request.safeZoneTop > 0)
  ) {
    safeZoneInstruction = `\nComposition Safe Zone: Keep all main subjects padded approximately ${request.safeZoneLeft || 0}% from the left edge, ${request.safeZoneRight || 0}% from the right edge, and ${request.safeZoneTop || 0}% from the top edge.`;
  }

  const avaGuidance = buildAvaStyleGuidance(request.useAvaStyle);
  const isBPreset = Boolean(request.bgPresetName?.toLowerCase().startsWith('b'));
  const hasImages = imageParts.length > 0 && request.images.length > 0;
  const numPrompts = hasImages ? 1 : 3;
  const titleSuffix = request.bgPresetName ? ` + ${request.bgPresetName.toUpperCase()}` : '';

  const textPart = {
    text: `Act as a world-class senior art director and AI image prompt engineer writing clean, production-ready English visual prompts for Gemini Image and Midjourney v6.

${DESIGNER_RESTRAINT_RULE}

User Request: "${request.prompt || 'A clean, balanced visual scene.'}"
${isBPreset ? 'Stay strictly faithful to the User Request and the selected background preset without adding unrelated extra objects or decorative motifs.' : 'Stay strictly faithful to the User Request without inventing unrelated objects, patterns, or clutter.'}

Create EXACTLY ${numPrompts} prompt(s)${hasImages ? ' combining all provided subjects into a single cohesive scene' : ''}.
${bgInstruction ? `\n${bgInstruction}` : ''}
${imageInstruction ? `\n${imageInstruction}` : ''}${safeZoneInstruction}${avaGuidance}
- Framing & Anatomy: Ensure realistic human anatomy, natural proportions, balanced lighting, and clean framing for aspect ratio "${request.aspectRatio}".
- Typography: ${request.textOverlay ? `Integrate the exact text "${request.textOverlay}" cleanly and prominently into the design.` : 'Do not include any text, watermarks, or letters.'}

Return ONLY a valid JSON array of EXACTLY ${numPrompts} object(s):
[
  { "title": "${hasImages ? `Combined Scene${titleSuffix}` : `Option 1${titleSuffix}`}", "prompt": "..." }
]`,
  };

  const response = await withRetry(
    (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      return ai.models.generateContent({
        model,
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: resolveThinkingConfig(options.thinkingLevel),
        },
      });
    },
    options.signal
  );

  if (!response.text) {
    throw new Error('The AI returned an empty response for FHD generation.');
  }

  try {
    const parsed = parseJsonSafe(response.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => ({
        title: String(item?.title || `Option ${idx + 1}${titleSuffix}`),
        prompt: String(item?.prompt || '').trim(),
      }));
    }
  } catch {
    // Fallback
  }

  return [{ title: `Generated Prompt${titleSuffix}`, prompt: stripMarkdownFences(response.text) }];
}

export interface BackgroundPromptRequest {
  request: string;
  style: 'graphic' | 'realistic' | 'graphic_realistic';
  color1: string;
  color2: string;
  bgColor: string;
  aspectRatio: string;
  images: string[];
  useAvaStyle?: boolean;
  customText?: string;
  textFont?: string;
}

export async function generateBackgroundPrompts(
  request: BackgroundPromptRequest,
  options: GenerateOptions = {}
): Promise<PromptResult[]> {
  const model = options.model || DEFAULT_MODEL;
  const imageParts = buildInlineParts(request.images);

  const { instruction: visualGuidance, enforceColors } = buildVisualStyleGuidance(
    request.style,
    request.color1,
    request.color2,
    request.bgColor
  );
  const avaGuidance = buildAvaStyleGuidance(request.useAvaStyle);

  const imageInstruction =
    imageParts.length > 0
      ? 'Reference Images: Seamlessly blend the key elements, environments, and realistic features of the provided reference images into a unified composition.'
      : '';

  const textPart = {
    text: `Act as a world-class senior art director and AI image prompt engineer writing clean, production-ready English visual prompts for Gemini Image and Midjourney v6.

${DESIGNER_RESTRAINT_RULE}

User Request: "${request.request || 'Blend the provided reference images into a cohesive high-end background.'}"

Task: Create 5 distinct, refined, designer-grade English background prompts.

Guidelines:
1. Landmark Accuracy: If real cities or landmarks are named (e.g., Erbil Citadel, Empire World, Tehran landmarks), describe their authentic architectural features accurately without fictional fantasy additions.
2. ${visualGuidance}${avaGuidance}
3. ${imageInstruction || 'Environment & Composition: Refined depth, intentional clean foreground/negative space for titles or presenters, and authentic architectural or studio materials with clean uncluttered surfaces.'}
4. Aspect Ratio: "${request.aspectRatio}".
5. ${enforceColors ? `Color Palette: Background ${request.bgColor}; graphic elements restricted to ${request.color1} and ${request.color2}.` : 'Color Palette: Restrained, harmonious, executive color grading.'}
6. ${request.customText ? `Typography: Feature the exact text "${request.customText}" integrated cleanly into the design. ${buildTypographyHierarchy(request.textFont)}` : 'No Text: Keep the background completely clean without words or letters.'}

Return ONLY a valid JSON array of 5 objects:
[
  { "title": "Short Catchy Title", "prompt": "Detailed visual prompt in English" }
]`,
  };

  const response = await withRetry(
    (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      return ai.models.generateContent({
        model,
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: resolveThinkingConfig(options.thinkingLevel),
        },
      });
    },
    options.signal
  );

  if (!response.text) {
    throw new Error('The AI returned an empty response for background generation.');
  }

  try {
    const parsed = parseJsonSafe(response.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => ({
        title: String(item?.title || `Background ${idx + 1}`),
        prompt: String(item?.prompt || '').trim(),
      }));
    }
  } catch {
    // Fallback
  }

  return [{ title: 'Background Prompt', prompt: stripMarkdownFences(response.text) }];
}
