import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";

// ==========================================
// 🔄 API KEY ROTATION SETUP
// ==========================================
const keysString = import.meta.env.VITE_GEMINI_API_KEYS || "";

const apiKeys = keysString
  .split(',')
  .map((key: string) => key.trim())
  .filter((key: string) => key.length > 0);

let currentKeyIndex = 0;

function getCurrentKey(): string {
  if (apiKeys.length === 0) {
    throw new Error("VITE_GEMINI_API_KEYS is missing! Please check Vercel Environment Variables.");
  }
  return apiKeys[currentKeyIndex];
}

function rotateKey() {
  if (apiKeys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    console.warn(`⚠️ API Key rotated to index ${currentKeyIndex + 1}`);
  }
}

// Utility function to handle API calls with exponential backoff for quota errors
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = Math.max(1, apiKeys.length);
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      
      const errorStr = JSON.stringify(error).toLowerCase();
      const isQuotaError = 
        error?.message?.toLowerCase().includes("quota exceeded") || 
        error?.message?.includes("429") || 
        error?.status === 429 ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.error?.code === 429 ||
        error?.error?.status === "RESOURCE_EXHAUSTED" ||
        errorStr.includes("quota") ||
        errorStr.includes("429") ||
        errorStr.includes("exhausted") ||
        errorStr.includes("resource_exhausted");
                           
      if (isQuotaError && attempt < maxRetries) {
        rotateKey(); // گۆڕینی کلیل لە کاتی تەواوبوونی لیمیت
        // وەستان بۆ ماوەی ٢ چرکە پێش بەکارهێنانی کلیلی نوێ
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        if (isQuotaError) {
          throw new Error("QUOTA_EXHAUSTED: لیمیتی هەموو API Keyـیەکانت تەواو بووە، تکایە دواتر هەوڵ بدەرەوە یان کلیلی ئەکاونتێکی تر دابنێ.");
        }
        throw error;
      }
    }
  }
  throw new Error("بەداخەوە لیمیتی هەموو کلیلەکان تەواو بووە.");
}

// ==========================================
// 🚀 PROMPT GENERATOR FUNCTIONS (TEXT ONLY)
// ==========================================

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
  styleType?: 'graphic' | 'realistic' | 'graphic_realistic' | 'original';
  color1?: string;
  color2?: string;
  bgColor?: string;
  bgPresetImage?: string | null;
  bgPresetName?: string | null;
}

export interface PromptResult {
  title: string;
  prompt: string;
  prompts?: string[];
  seed?: number;
}

export async function generateInfographicPrompts(request: PromptRequest, customModel?: string): Promise<PromptResult[]> {
  const model = customModel || "gemini-3-flash-preview";
  
  const presetStyleMap: Record<string, { title: string; desc: string }> = {
    'cyber-map': { title: 'Cyber Map', desc: 'Futuristic tactical UI with glowing lines, data points, and a dark blue/cyan aesthetic.' },
    'futuristic-3d': { title: 'Futuristic 3D', desc: 'Dark 3D presentation style with glowing spheres, deep purple gradients, and high-tech depth.' },
    'tech-landing': { title: 'Tech Landing', desc: 'Modern tech landing page style with glowing blue cards, clean white text, and a professional dark theme.' },
    'ai-analytics': { title: 'AI Analytics', desc: 'Isometric data visualization style with 3D bar charts, world maps, and AI-themed purple/blue accents.' },
    'ai-ecosystem': { title: 'AI Ecosystem', desc: 'Central node network style connecting various AI service logos with glowing lines and a dark, immersive background.' },
    'minimalist': { title: 'Minimalist', desc: 'A clean, minimalist corporate style with a white background and professional blue accents.' },
    'vibrant': { title: 'Vibrant Modern', desc: 'A vibrant, high-energy modern style with bold gradients and dark mode aesthetic.' },
    'editorial': { title: 'Editorial', desc: 'A sophisticated editorial style with serif typography and warm earth tones.' },
    'tech-grid': { title: 'Tech Grid', desc: 'A futuristic tech-focused style with neon highlights and data-grid patterns.' },
    'purple-special': { title: 'Purple Special', desc: 'A professional, easy-to-understand infographic with a slightly dark purple background. The typography and visual elements must strictly use a color palette of white, purple, pink, and blue.' }
  };

  const stylesToGenerate: { title: string; description: string; image?: string }[] = [];

  if (request.selectedStyles && request.selectedStyles.length > 0) {
    request.selectedStyles.forEach(styleId => {
      if (presetStyleMap[styleId]) {
        stylesToGenerate.push({ title: presetStyleMap[styleId].title, description: presetStyleMap[styleId].desc });
      }
    });
  }

  if (request.styleImages && request.styleImages.length > 0) {
    request.styleImages.forEach((img, idx) => {
      stylesToGenerate.push({ title: `Custom Style ${idx + 1}`, description: "Use the provided reference image ONLY for its COLOR PALETTE and LIGHTING. Do NOT use its background or layout.", image: img });
    });
  }

  if (stylesToGenerate.length === 0) {
    stylesToGenerate.push({ title: request.bgPresetName ? `Preset ${request.bgPresetName.toUpperCase()}` : 'General Style', description: 'A professional and clean data visualization style that focuses on clarity and modern aesthetics.' });
  } else if (request.bgPresetName) {
    stylesToGenerate.forEach(style => {
      style.title = `${style.title} + ${request.bgPresetName.toUpperCase()}`;
    });
  }

  let baseStyleInstruction = "";
  if (request.styleType && request.styleType !== 'original') {
    if (request.styleType === 'realistic') {
      baseStyleInstruction = "CRITICAL STYLE REQUIREMENT: The overall visual style MUST be 100% photorealistic, cinematic, and highly detailed. It must look like a real-world photograph taken with a high-end camera. ABSOLUTELY NO 2D graphics, NO flat illustrations, and NO cartoonish elements. ";
    } else if (request.styleType === 'graphic') {
      baseStyleInstruction = `CRITICAL STYLE REQUIREMENT: The overall visual style MUST be a pure 2D/3D graphic illustration, modern, and clean. ABSOLUTELY NO photorealism, NO real-world photography, and NO photographic elements. The main background color MUST be ${request.bgColor}. You MUST STRICTLY restrict the color palette of all graphic elements, charts, and icons to ${request.color1} and ${request.color2}. DO NOT introduce any other colors. `;
    } else {
      baseStyleInstruction = `CRITICAL STYLE REQUIREMENT: The overall visual style MUST be a seamless blend of photorealism AND modern graphic design. It MUST combine real-world photographic elements with graphic overlays. The main background color MUST be ${request.bgColor}. Enhance the realistic elements with delicate, neat graphic elements. You MUST STRICTLY restrict the color palette to ${request.color1} and ${request.color2}. `;
    }
  }

  const results: PromptResult[] = [];

  for (const styleConfig of stylesToGenerate) {
    let imagePart: any = null;
    let bgPresetPart: any = null;
    const styleDescription = styleConfig.description;

    if (styleConfig.image) {
      imagePart = { inlineData: { mimeType: "image/png", data: styleConfig.image.split(",")[1] } };
    }

    if (request.bgPresetImage) {
      bgPresetPart = { inlineData: { mimeType: "image/png", data: request.bgPresetImage.split(",")[1] } };
    }

    const modeInstruction = request.mode === 'map' 
      ? `The image MUST be a highly accurate, realistic geographic map visualization (similar to Google Maps style). Ensure all borders and locations are precise.`
      : `The image MUST be a professional, data-driven infographic layout. Elements should be ordered starting from the right side of the canvas (RTL).`;

    const avaStyleInstruction = request.useAvaStyle 
      ? `\n\nCRITICAL AVA STYLE OVERRIDE: The entire design MUST strictly follow "AVA's Style" with deep purples, neon blues, vibrant magentas, glowing pinks, and high-tech digital overlays.` : "";

    const formattedData = request.data.map((d, i) => `--- SLIDE ${i + 1} DATA ---\n${d}\n`).join('\n');

    const textPart = {
      text: `Act as a world-class AI image prompt engineer for Gemini 3.1 Flash Image. 
      I will provide you with data to be visualized.
      
      Your task is to create a MASTERPIECE-LEVEL visual description that results in a 100% accurate, professional, and error-free infographic or map.
      
      1. PROMPT STYLE: Use descriptive, immersive natural language. Start with: "A stunning, high-definition professional infographic..."
      2. DATA LAYOUT: Use the provided data to determine the exact layout, hierarchy, and number of elements. Explicitly include the text from the data.
      3. LOGICAL LAYOUT (RTL & CENTERED): Organize elements starting from the RIGHT side.
      4. FONTS: Text Font: ${request.textFont}, Number Font: ${request.numberFont}, English Font: ${request.englishFont}.
      5. DIMENSIONS: Aspect ratio is "${request.aspectRatio}".
      6. STYLE: ${baseStyleInstruction}${styleDescription}
      CRITICAL: You MUST also append the exact phrase "Style: ${baseStyleInstruction}${styleDescription}" to the very end of your prompt word-for-word.
      7. MODE: ${modeInstruction}${avaStyleInstruction}
      
      CRITICAL INSTRUCTION FOR MULTIPLE SLIDES:
      The user has provided data for ${request.data.length} distinct slide(s).
      You MUST generate a separate, highly detailed image generation prompt for EACH slide based on its specific data.
      All slides MUST share the EXACT SAME visual style.
      
      Data to visualize (${request.data.length} SLIDES):
      ${formattedData}
      
      Generate the output as a JSON array containing EXACTLY 1 object, where the object has a "title" (e.g., "${styleConfig.title}") and a "prompts" array containing exactly ${request.data.length} strings (one highly detailed image generation prompt for each slide in English).
      
      Generate ONLY the JSON array. No markdown formatting, no meta-talk.`,
    };

    try {
      const contents: any = { parts: [textPart] };
      if (imagePart) contents.parts.unshift(imagePart);
      if (bgPresetPart) contents.parts.unshift(bgPresetPart);

      const response: GenerateContentResponse = await withRetry(() => {
        const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
        return aiInstance.models.generateContent({
          model: model,
          contents: contents,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        });
      });

      if (response.text) {
        let text = response.text.trim();
        if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        
        try {
          const parsed = JSON.parse(text);
          let promptsArray: string[] = [];
          const exactStyle = `Style: ${baseStyleInstruction}${styleDescription}`;
          
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].prompts && Array.isArray(parsed[0].prompts)) {
            promptsArray = parsed[0].prompts.map((p: string) => {
              let slidePrompt = p.trim();
              if (!slidePrompt.includes(exactStyle)) slidePrompt += `\n\n${exactStyle}`;
              return slidePrompt;
            });
          } else {
            let finalPrompt = text;
            if (!finalPrompt.includes(exactStyle)) finalPrompt += `\n\n${exactStyle}`;
            promptsArray = [finalPrompt];
          }
          
          results.push({
            title: styleConfig.title,
            prompt: promptsArray.join('\n\n'),
            prompts: promptsArray,
            seed: Math.floor(Math.random() * 1000000)
          });
        } catch (e) {
          results.push({
            title: styleConfig.title,
            prompt: text,
            prompts: [text],
            seed: Math.floor(Math.random() * 1000000)
          });
        }
      }
    } catch (error: any) {
      results.push({
        title: styleConfig.title,
        prompt: `API Error: ${error.message}`,
        prompts: [`API Error: ${error.message}`],
        seed: Math.floor(Math.random() * 1000000)
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  return results;
}

export interface ImageToPromptRequest {
  image: string;
  selectedStyles?: string[];
  styleType?: 'graphic' | 'realistic' | 'graphic_realistic' | 'original';
  color1?: string;
  color2?: string;
  bgColor?: string;
  styleImages?: string[];
  customInstructions?: string;
  aspectRatio?: string;
  textFont?: string;
  numberFont?: string;
  englishFont?: string;
}

export async function generateImageToPromptPrompts(request: ImageToPromptRequest, customModel?: string): Promise<PromptResult[]> {
  const model = customModel || "gemini-3-flash-preview";

  let styleInstruction = "";
  if (request.selectedStyles && request.selectedStyles.length > 0) {
    styleInstruction = `\n\nCRITICAL STYLE OVERRIDE: While describing the image, you MUST adapt the description so that the final prompt will generate an image in the style requested.`;
  }

  const textPart = {
    text: `Act as a world-class AI image prompt engineer. I have provided a main image. 
    Your task is to analyze this main image in EXTREME detail and write a highly descriptive, professional prompt (in English) that could be used in an AI image generator to recreate this image with 100% accuracy.${styleInstruction}
    
    Generate the output as a JSON array containing EXACTLY 1 object, where the object has a "title" (e.g., "Extracted Prompt") and a "prompt" (the highly detailed image generation prompt in English).
    Generate ONLY the JSON array. No markdown formatting, no meta-talk.`
  };

  const mainImagePart = {
    inlineData: { mimeType: "image/png", data: request.image.split(",")[1] },
  };

  try {
    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: { parts: [mainImagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
    });

    if (!response.text) return [{ title: "Error", prompt: "Failed to generate prompt from image." }];

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    return [{ title: "Error", prompt: `API Error: ${error.message}` }];
  }
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
}

export async function generateFHDPrompts(request: FHDPromptRequest, customModel?: string): Promise<PromptResult[]> {
  const model = customModel || "gemini-3-flash-preview";

  let imageParts: any[] = [];
  if (request.images && request.images.length > 0) {
    request.images.forEach((img) => {
      imageParts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
    });
  }

  const textPart = {
    text: `Act as a world-class AI image prompt engineer.
    User Request: "${request.prompt || 'A beautiful scene.'}"
    
    Your task is to create distinct, MASTERPIECE-LEVEL visual descriptions (prompts) based on the user's request.
    Aspect ratio is "${request.aspectRatio}".
    
    Generate the output as a JSON array of objects, where each object has a "title" and a "prompt" (the highly detailed image generation prompt in English).
    Generate ONLY the JSON array. No markdown formatting, no meta-talk.`,
  };

  try {
    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
    });

    if (!response.text) return [{ title: "Error", prompt: "Failed to generate prompts." }];

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    return [{ title: "Error", prompt: `API Error: ${error.message}` }];
  }
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

export async function generateBackgroundPrompts(request: BackgroundPromptRequest, customModel?: string): Promise<PromptResult[]> {
  const model = customModel || "gemini-3-flash-preview";

  let imageParts: any[] = [];
  if (request.images && request.images.length > 0) {
    request.images.forEach((img) => {
      imageParts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
    });
  }

  const textPart = {
    text: `Act as a world-class AI image prompt engineer.
    User Request: "${request.request || 'Blend the provided images seamlessly.'}"
    
    Your task is to create 3 distinct, MASTERPIECE-LEVEL visual descriptions (prompts) based on the user's request with EXTREME DETAIL.
    Aspect ratio is "${request.aspectRatio}".
    
    Generate the output as a JSON array of objects, where each object has a "title" and a "prompt".
    Generate ONLY the JSON array. No markdown formatting, no meta-talk.`,
  };

  try {
    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
    });

    if (!response.text) return [{ title: "Error", prompt: "Failed to generate prompts." }];

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    return [{ title: "Error", prompt: `API Error: ${error.message}` }];
  }
}
