import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";

// ==========================================
// 🔄 API KEY ROTATION SETUP
// ==========================================
function getEnvKeys(): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const env = (import.meta as any).env;
      if (env.VITE_GEMINI_API_KEYS) return env.VITE_GEMINI_API_KEYS;
      if (env.VITE_GEMINI_API_KEY) return env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_GEMINI_API_KEYS) return process.env.VITE_GEMINI_API_KEYS;
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      if (process.env.API_KEY) return process.env.API_KEY;
    }
  } catch (e) {}
  return "";
}

const keysString = getEnvKeys();
const apiKeys = keysString
  .split(',')
  .map((key: string) => key.trim())
  .filter((key: string) => key.length > 0);

let currentKeyIndex = 0;

function getCurrentKey(): string {
  if (apiKeys.length === 0) return "";
  return apiKeys[currentKeyIndex];
}

function rotateKey() {
  if (apiKeys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    console.warn(`⚠️ API Key rotated to index ${currentKeyIndex + 1}`);
  }
}

// Utility function to handle API calls with exponential backoff for quota errors
async function withRetry<T>(operation: () => Promise<T>, maxRetries = apiKeys.length > 0 ? apiKeys.length * 2 : 6, baseDelay = 2000): Promise<T> {
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
        rotateKey(); // Rotate key on quota error!
        const delay = baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 1000;
        console.warn(`Quota exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        if (isQuotaError) {
          throw new Error("QUOTA_EXHAUSTED: You have reached the API rate limit. Please wait a moment before trying again.");
        }
        throw error;
      }
    }
  }
  throw new Error("Max retries reached or Quota fully exhausted");
}

export interface PromptRequest {
  data: string[];
  textFont: string;
  numberFont: string;
  englishFont: string;
  aspectRatio: string;
  styleImages: string[]; // base64 strings
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
        stylesToGenerate.push({ 
          title: presetStyleMap[styleId].title, 
          description: presetStyleMap[styleId].desc 
        });
      }
    });
  }

  if (request.styleImages && request.styleImages.length > 0) {
    request.styleImages.forEach((img, idx) => {
      stylesToGenerate.push({ 
        title: `Custom Style ${idx + 1}`,
        description: "Use the provided reference image ONLY for its COLOR PALETTE and LIGHTING. Do NOT use its background or layout.",
        image: img
      });
    });
  }

  if (stylesToGenerate.length === 0) {
    stylesToGenerate.push({ 
      title: request.bgPresetName ? `Preset ${request.bgPresetName.toUpperCase()}` : 'General Style', 
      description: 'A professional and clean data visualization style that focuses on clarity and modern aesthetics.' 
    });
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
      baseStyleInstruction = `CRITICAL STYLE REQUIREMENT: The overall visual style MUST be a seamless blend of photorealism AND modern graphic design. It MUST combine real-world photographic elements with graphic overlays. The main background color MUST be ${request.bgColor}. Enhance the realistic elements with delicate, neat graphic elements (e.g., charts, glowing lights, rounded shapes, particles). You MUST STRICTLY restrict the color palette of these graphic elements to ${request.color1} and ${request.color2}. DO NOT introduce any other colors for the graphics. `;
    }
  }

  const results: PromptResult[] = [];

  for (const styleConfig of stylesToGenerate) {
    let imagePart: any = null;
    let bgPresetPart: any = null;
    const styleDescription = styleConfig.description;

    if (styleConfig.image) {
      imagePart = {
        inlineData: {
          mimeType: "image/png",
          data: styleConfig.image.split(",")[1],
        },
      };
    }

    if (request.bgPresetImage) {
      bgPresetPart = {
        inlineData: {
          mimeType: "image/png",
          data: request.bgPresetImage.split(",")[1],
        },
      };
    }

    const modeInstruction = request.mode === 'map' 
      ? `The image MUST be a highly accurate, realistic geographic map visualization (similar to Google Maps style). Ensure all borders and locations are precise. 
         CRITICAL: If specific locations (e.g., Qatar, Erbil, etc.) are mentioned, place the callouts, labels, and icons EXACTLY on their correct geographic coordinates on the map. Do not place them randomly. 
         If country names are mentioned, include their correct national flags next to the names without any errors.`
      : `The image MUST be a professional, data-driven infographic layout (charts, icons, lists) that clearly represents the provided data. If percentages are present, convert them into clear visual charts (pie charts, bar charts, or progress rings). If dates or sequences are present, implement a clear vertical or horizontal timeline. The focus is on clarity and professional data visualization.
         CRITICAL: The visual flow and data organization MUST be from Right-to-Left (RTL), following the reading direction of Arabic/Kurdish. Elements should be ordered starting from the right side of the canvas.
         COMPOSITION: The main data elements and graphics MUST be centered in the composition for a balanced look.`;

    const avaStyleInstruction = request.useAvaStyle 
      ? `\n\nCRITICAL AVA STYLE OVERRIDE: The entire design MUST strictly follow "AVA's Style". This means:
         - Color Palette: Deep purples, neon blues, vibrant magentas, and glowing pinks on a dark background.
         - Visual Elements: Incorporate high-tech digital overlays, glowing neon lines, light streaks, network nodes, data grids, and subtle mandala or abstract geometric patterns in the background.
         - Lighting: Cinematic, luminous, with lens flares and glowing gradients.
         - Aesthetic: A premium, modern broadcast/news graphic style that blends real-world elements with futuristic 3D digital graphics.`
      : "";

    const isBPreset = request.bgPresetName?.toLowerCase().startsWith('b');

    const formattedData = request.data.map((d, i) => `--- SLIDE ${i + 1} DATA ---\n${d}\n`).join('\n');

    const textPart = {
      text: isBPreset ? 
      `Act as a world-class AI image prompt engineer.
      
      CRITICAL INSTRUCTION: I have provided a BACKGROUND PRESET image (${request.bgPresetName?.toUpperCase()}). Your prompt MUST explicitly instruct the image generator to use this image EXACTLY as the background. 
      If there are people or characters in the provided reference images, they MUST be placed on this ${request.bgPresetName?.toUpperCase()} background EXACTLY as they appear (100% identical faces, features, and poses, with NO distortion). 
      The blending MUST be flawless, hyper-realistic, and highly accurate. Adjust the lighting, shadows, reflections, and color balance of the characters so they look like they naturally belong in the ${request.bgPresetName?.toUpperCase()} background preset. Ensure perfect perspective and scale.
      Do NOT add any other complex elements, infographics, charts, or extra graphics. Keep the focus EXCLUSIVELY on the ${request.bgPresetName?.toUpperCase()} background and the characters.
      
      Aspect ratio is "${request.aspectRatio}".
      
      Generate ONLY the final prompt text in English. No meta-talk.`
      : `Act as a world-class AI image prompt engineer for high-end models like Gemini 3.1 Flash Image and Midjourney v6. 
      I will provide you with data to be visualized.
      
      Your task is to create a MASTERPIECE-LEVEL visual description that results in a 100% accurate, professional, and error-free infographic or map.
      
      ${request.bgPresetImage ? "CRITICAL INSTRUCTION: I have provided a BACKGROUND PRESET image. Your prompt MUST explicitly instruct the image generator to use this image EXACTLY as the background. If there are people or characters in the other provided reference images, they MUST be placed on this background EXACTLY as they appear (100% identical faces, features, and poses, with NO distortion). The blending MUST be flawless, hyper-realistic, and highly accurate. Adjust the lighting, shadows, reflections, and color balance of the characters so they look like they naturally belong in the background preset. Ensure perfect perspective and scale. Do not add any other complex elements; keep the focus on the background and the characters." : ""}
      
      CRITICAL REQUIREMENTS FOR GEMINI 3.1 FLASH IMAGE (NANO BANANA 2):
      1. PROMPT STYLE: Use descriptive, immersive natural language. Start with: "A stunning, high-definition professional infographic..." or "A precise, photorealistic geographic map visualization...".
      2. DATA LAYOUT: Use the provided data to determine the exact layout, hierarchy, and number of elements. Explicitly include the text, numbers, and labels from the data in your prompt description.
      3. LOGICAL LAYOUT (RTL & CENTERED): Organize elements in a logical, balanced flow starting from the RIGHT side and moving to the LEFT (Right-to-Left direction). The overall composition MUST be centered and balanced on the canvas. Use "symmetrical composition," "golden ratio alignment," and "clear visual hierarchy."
      4. ICONS & GRAPHICS: Specify "high-end vector graphics," "photorealistic 3D icons," and "clean UI elements" to represent the data points visually.
      5. FONTS & TYPOGRAPHY STYLE: Specify the typography style using the requested fonts: Text Font: ${request.textFont}, Number Font: ${request.numberFont}, English Font: ${request.englishFont}.
      6. DIMENSIONS: Aspect ratio is "${request.aspectRatio}".
      7. STYLE: ${baseStyleInstruction}${styleDescription}
      CRITICAL: You MUST also append the exact phrase "Style: ${baseStyleInstruction}${styleDescription}" to the very end of your prompt word-for-word to guarantee consistency.
      8. MODE: ${modeInstruction}${avaStyleInstruction}
      9. ACCURACY: "The layout must be 100% accurate to the structure of the provided data. Every element must correspond to a specific data point."
      10. AESTHETIC: Aim for a "Midjourney-level aesthetic" with "cinematic lighting," "premium textures," "professional color grading," and "ultra-realistic rendering."
      11. COLOR PALETTE: You MUST strictly adhere to the requested colors. The background must be exactly the requested background color, and the graphic elements must only use the requested accent colors. Do NOT hallucinate or add random colors.
      12. EXTREME DETAIL: Provide an EXTREMELY detailed description of every visual element, texture, and lighting effect to ensure the highest possible quality.
      
      CRITICAL INSTRUCTION FOR MULTIPLE SLIDES:
      The user has provided data for ${request.data.length} distinct slide(s).
      You MUST generate a separate, highly detailed image generation prompt for EACH slide based on its specific data.
      CRITICAL: All slides MUST share the EXACT SAME visual style, color palette, lighting, camera angles, and aesthetic. To achieve this, the style-related keywords and descriptions MUST BE IDENTICAL across all slide prompts. ONLY change the specific subject/content (text, data points, central icon) of the slide. Do not introduce new colors or stylistic elements in different slides.
      
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
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          }
        });
      });

      if (!response.text) {
        results.push({
          title: styleConfig.title,
          prompt: "The AI refused to generate a prompt for this content. It might be due to safety filters or complex data. Please try simplifying your input.",
          prompts: ["The AI refused to generate a prompt for this content. It might be due to safety filters or complex data. Please try simplifying your input."],
          seed: Math.floor(Math.random() * 1000000)
        });
      } else {
        let text = response.text.trim();
        if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        
        try {
          const parsed = JSON.parse(text);
          let finalPrompt = "";
          let promptsArray: string[] = [];
          const exactStyle = `Style: ${baseStyleInstruction}${styleDescription}`;
          
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].prompts && Array.isArray(parsed[0].prompts)) {
            promptsArray = parsed[0].prompts.map((p: string, i: number) => {
              let slidePrompt = p.trim();
              if (!slidePrompt.includes(exactStyle)) slidePrompt += `\n\n${exactStyle}`;
              return slidePrompt;
            });
            finalPrompt = promptsArray.map((p, i) => `[ SLIDE ${i + 1} ]\n${p}`).join('\n\n');
          } else {
            finalPrompt = text;
            if (!finalPrompt.includes(exactStyle)) finalPrompt += `\n\n${exactStyle}`;
            promptsArray = [finalPrompt];
          }
          
          results.push({
            title: styleConfig.title,
            prompt: finalPrompt,
            prompts: promptsArray,
            seed: Math.floor(Math.random() * 1000000)
          });
        } catch (e) {
          console.error("Failed to parse JSON in infographic prompts", e);
          let finalPrompt = text;
          const exactStyle = `Style: ${baseStyleInstruction}${styleDescription}`;
          if (!finalPrompt.includes(exactStyle)) finalPrompt += `\n\n${exactStyle}`;
          results.push({
            title: styleConfig.title,
            prompt: finalPrompt,
            prompts: [finalPrompt],
            seed: Math.floor(Math.random() * 1000000)
          });
        }
      }
    } catch (error: any) {
      console.error(`Error generating prompt for style ${styleConfig.title}:`, error);
      let errorMessage = "Error generating prompt for this style.";
      
      if (error?.message?.includes("API_KEY_INVALID")) {
        errorMessage = "Invalid API Key. Please check your configuration.";
      } else if (error?.message?.includes("Quota exceeded") || error?.message?.includes("429")) {
        errorMessage = "Quota exceeded (Free Tier). Please wait a moment and try again.";
      } else if (error?.message?.includes("safety")) {
        errorMessage = "The content was flagged by safety filters. Please try more neutral language.";
      } else if (error?.message) {
        errorMessage = `API Error: ${error.message}`;
      }
      
      results.push({
        title: styleConfig.title,
        prompt: errorMessage,
        prompts: [errorMessage],
        seed: Math.floor(Math.random() * 1000000)
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
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

  const presetStyleMap: Record<string, { title: string; desc: string }> = {
    'cyber-map': { title: 'Cyber Map', desc: 'Futuristic tactical UI with glowing lines, data points, and a dark blue/cyan aesthetic.' },
    'futuristic-3d': { title: 'Futuristic 3D', desc: 'Dark 3D presentation style with glowing spheres, deep purple gradients, and high-tech depth.' },
    'tech-landing': { title: 'Tech Landing', desc: 'Modern tech landing page style with glowing blue cards, clean white text, and a professional dark theme.' },
    'ai-analytics': { title: 'AI Analytics', desc: 'Isometric data visualization style with 3D bar charts, world maps, and AI-themed purple/blue accents.' },
    'ai-ecosystem': { title: 'AI Ecosystem', desc: 'Central node network style connecting various AI service logos with glowing lines and a dark, immersive background.' },
    'minimalist': { title: 'Minimalist', desc: 'A clean, minimalist corporate style with a white background and professional blue accents.' },
    'vibrant': { title: 'Vibrant Modern', desc: 'A vibrant, high-energy modern style with bold gradients and dark mode aesthetic.' },
    'editorial': { title: 'Editorial', desc: 'A sophisticated editorial style with serif typography and warm earth tones.' },
    'tech-grid': { title: 'Tech Grid', desc: 'A futuristic tech-grid style with neon highlights and data-grid patterns.' },
    'purple-special': { title: 'Purple Special', desc: 'A professional, easy-to-understand infographic with a slightly dark purple background. The typography and visual elements must strictly use a color palette of white, purple, pink, and blue.' }
  };

  let styleInstruction = "";
  let exactStyleKeywords = "";
  if (request.selectedStyles && request.selectedStyles.length > 0) {
    const styles = request.selectedStyles.map(s => presetStyleMap[s]?.desc).filter(Boolean).join(" AND ");
    exactStyleKeywords += styles;
    styleInstruction = `\n\nCRITICAL STYLE OVERRIDE: While describing the image, you MUST adapt the description so that the final prompt will generate an image in the following style(s): ${styles}.`;
  }

  if (request.styleType && request.styleType !== 'original') {
    if (request.styleType === 'realistic') {
      const s = "CRITICAL STYLE REQUIREMENT: The overall visual style MUST be described as 100% photorealistic, cinematic, and highly detailed. It must look like a real-world photograph taken with a high-end camera. ABSOLUTELY NO 2D graphics, NO flat illustrations, and NO cartoonish elements.";
      styleInstruction += ` ${s}`;
      exactStyleKeywords += ` ${s}`;
    } else if (request.styleType === 'graphic') {
      const s = `CRITICAL STYLE REQUIREMENT: The overall visual style MUST be described as a pure 2D/3D graphic illustration, modern, and clean. ABSOLUTELY NO photorealism, NO real-world photography, and NO photographic elements. The main background color MUST be ${request.bgColor}. You MUST STRICTLY restrict the color palette of all graphic elements to ${request.color1} and ${request.color2}. DO NOT introduce any other colors.`;
      styleInstruction += ` ${s}`;
      exactStyleKeywords += ` ${s}`;
    } else {
      const s = `CRITICAL STYLE REQUIREMENT: The overall visual style MUST be described as a seamless blend of photorealism AND modern graphic design. It MUST combine real-world photographic elements with graphic overlays. The main background color MUST be ${request.bgColor}. Enhance the realistic elements with delicate, neat graphic elements. You MUST STRICTLY restrict the color palette of these graphic elements to ${request.color1} and ${request.color2}. DO NOT introduce any other colors for the graphics.`;
      styleInstruction += ` ${s}`;
      exactStyleKeywords += ` ${s}`;
    }
  }

  let imageParts: any[] = [];
  if (request.styleImages && request.styleImages.length > 0) {
    styleInstruction += " I have also provided additional reference images. You MUST incorporate their visual style, color palette, and lighting into your final prompt description.";
    request.styleImages.forEach((img) => {
      imageParts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
    });
  }

  const textPart = {
    text: `Act as a world-class AI image prompt engineer. I have provided a main image. 
    Your task is to analyze this main image in EXTREME detail and write a highly descriptive, professional prompt (in English) that could be used in an AI image generator (like Midjourney v6 or Gemini 3.1 Flash Image) to recreate this image with 100% accuracy.${styleInstruction}
    
    Describe the subjects, composition, lighting, colors, mood, textures, and any specific details or text visible with EXTREME PRECISION.
    Make it a single, cohesive, highly detailed prompt paragraph.
    
    ${request.aspectRatio ? `CRITICAL: Aspect ratio is "${request.aspectRatio}".` : ''}
    ${request.textFont ? `FONTS & TYPOGRAPHY STYLE: Specify the typography style using the requested fonts: Text Font: ${request.textFont}, Number Font: ${request.numberFont}, English Font: ${request.englishFont}.` : ''}
    ${request.bgColor ? `CRITICAL COLOR PALETTE: You MUST strictly adhere to the requested colors. The background must be exactly ${request.bgColor}, and the graphic elements must only use ${request.color1} and ${request.color2}. Do NOT hallucinate or add random colors.` : ''}
    
    ${request.customInstructions ? `CRITICAL USER INSTRUCTIONS / MODIFICATIONS:\nThe user has provided the following specific instructions or modifications to apply to the generated prompt. You MUST incorporate these changes into the final prompt description with EXTREME DETAIL:\n"${request.customInstructions}"\n` : ''}
    
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
        contents: { parts: [mainImagePart, ...imageParts, textPart] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
    });

    if (!response.text) return [{ title: "Error", prompt: "Failed to generate prompt from image." }];

    try {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(item => {
          if (exactStyleKeywords && !item.prompt.includes(exactStyleKeywords)) {
            item.prompt += `\n\nStyle: ${exactStyleKeywords}`;
          }
        });
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse JSON", e);
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    console.error("Error generating image-to-prompt:", error);
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

  let imageInstruction = "";
  let imageParts: any[] = [];
  if (request.images && request.images.length > 0) {
    const numImages = request.images.length;
    const distanceText = request.subjectDistance && request.subjectDistance > 0
      ? `place them approximately ${request.subjectDistance}% apart from each other`
      : `place them EXTREMELY CLOSE together (e.g., standing shoulder-to-shoulder, forming a tight group)`;
      
    if (request.keepOriginal) {
      imageInstruction = `I have provided ${numImages} reference image(s) of characters/people. Your prompt MUST explicitly instruct the image generator to act as a BACKGROUND REPLACEMENT tool. The persons/subjects from the reference images MUST NOT BE CHANGED, REDRAWN, OR ALTERED IN ANY WAY. Keep their exact faces, exact clothing, exact poses, exact proportions, and exact lighting 100% identical to the originals. ${distanceText.charAt(0).toUpperCase() + distanceText.slice(1)} and replace the background.`;
    } else {
      imageInstruction = `I have provided ${numImages} reference image(s). Your prompt MUST explicitly instruct the image generator to combine ALL ${numImages} subjects/elements into ONE SINGLE cohesive scene, ${distanceText}. Use them as inspiration for the style and subjects, but you have creative freedom to alter poses, faces, or details as needed to make them fit naturally and closely together in one image.`;
    }
    request.images.forEach((img) => {
      imageParts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
    });
  }

  const B1_PROMPT = "A high-quality, clean digital background with a professional broadcast aesthetic. The design features a smooth deep navy blue gradient, with a soft purple glow on the far left and a bright cyan light on the right. In the center, there is a very faint, minimalist world map composed of tiny dots (dotted map style). On the far right, there are vertical blue bars with diagonal stripes and a glossy finish. NO grid lines, NO checkered pattern, NO mesh. Smooth surface, high-tech corporate style, 8k resolution, cinematic lighting.";

  let bgInstruction = "";
  if (request.bgPresetName === 'B1') {
    bgInstruction = `CRITICAL INSTRUCTION: You MUST use the following exact description for the background of the image: "${B1_PROMPT}". Place the subjects/characters directly into this background, matching the lighting and perspective seamlessly.`;
  } else if (request.bgPresetImage) {
    bgInstruction = "CRITICAL INSTRUCTION: I have provided a BACKGROUND PRESET image. You MUST use this exact image as the actual background of the final generated image. Place the subjects/characters directly into this background, matching the lighting and perspective seamlessly. DO NOT use a black or plain background.";
    imageParts.push({ inlineData: { mimeType: "image/png", data: request.bgPresetImage.split(",")[1] } });
  }

  let safeZoneInstruction = "";
  if ((request.safeZoneLeft && request.safeZoneLeft > 0) || 
      (request.safeZoneRight && request.safeZoneRight > 0) || 
      (request.safeZoneTop && request.safeZoneTop > 0)) {
    safeZoneInstruction = `\n\nCRITICAL INSTRUCTION: Your prompt MUST explicitly instruct the image generator to position all persons/subjects with specific padding from the edges: approximately ${request.safeZoneLeft || 0}% away from the left edge, ${request.safeZoneRight || 0}% away from the right edge, and ${request.safeZoneTop || 0}% away from the top edge. Do not place subjects near these edges.`;
  }

  const isBPreset = request.bgPresetName?.toLowerCase().startsWith('b');
  const hasImages = request.images && request.images.length > 0;
  const numPrompts = hasImages ? 1 : 3;

  const textPart = {
    text: isBPreset ?
    `Act as a world-class AI image prompt engineer.
    
    User Request: "${request.prompt || 'A beautiful scene.'}"
    
    CRITICAL INSTRUCTION: You MUST rely COMPLETELY and STRICTLY on the information provided in the User Request. DO NOT hallucinate, invent, or add any extra elements, subjects, objects, or environments that the user did not explicitly ask for. Your prompt must be a highly detailed version of ONLY what the user requested.
    
    ${request.bgPresetName === 'B1' ? `You MUST explicitly instruct the image generator to use the following exact description for the background: "${B1_PROMPT}".` : `I have provided a BACKGROUND PRESET image (${request.bgPresetName?.toUpperCase()}). Your prompt MUST explicitly instruct the image generator to use this exact image as the actual background.`}
    If there are people or characters in the provided reference images, they MUST be placed on this background EXACTLY as they appear (100% identical faces, features, and poses, with NO distortion). 
    The blending MUST be flawless, hyper-realistic, and highly accurate. Adjust the lighting, shadows, reflections, and color balance of the characters so they look like they naturally belong in the ${request.bgPresetName?.toUpperCase()} background preset. Ensure perfect perspective and scale.
    Do NOT add any other complex elements, text, or extra graphics.${safeZoneInstruction}
    
    Aspect ratio is "${request.aspectRatio}".
    
    Generate the output as a JSON array containing EXACTLY ${numPrompts} object(s), where each object has a "title" (e.g., "${hasImages ? 'Combined Scene' : 'Option 1'} + ${request.bgPresetName?.toUpperCase()}") and a "prompt" (the prompt in English).
    
    Generate ONLY the JSON array. No markdown formatting, no meta-talk.`
    : `Act as a world-class AI image prompt engineer for high-end models like Gemini 3.1 Flash Image and Midjourney v6.
    
    User Request: "${request.prompt || 'A beautiful scene.'}"
    
    CRITICAL INSTRUCTION: You MUST rely COMPLETELY and STRICTLY on the information provided in the User Request. DO NOT hallucinate, invent, or add any extra elements, subjects, objects, or environments that the user did not explicitly ask for. Your prompt must be a highly detailed version of ONLY what the user requested.
    
    Your task is to create ${hasImages ? 'EXACTLY 1 MASTERPIECE-LEVEL visual description (prompt) that flawlessly combines all the provided subjects into a single cohesive scene' : '3 distinct, MASTERPIECE-LEVEL visual descriptions (prompts)'} based on the user's request.
    
    ${bgInstruction}${safeZoneInstruction}
    
    CRITICAL REQUIREMENTS:
    1. CHARACTER CONSISTENCY: ${imageInstruction}
    2. FLAWLESS ANATOMY: You MUST explicitly instruct the image generator to ensure perfect human anatomy, flawless symmetrical faces, realistic proportions, and no deformations or extra limbs. The subjects must look perfectly aligned, highly detailed, and professional.
    3. EXACT DIMENSIONS: Aspect ratio is "${request.aspectRatio}". The prompt MUST instruct the generator to perfectly frame the composition to fit this exact aspect ratio without cropping important elements.
    4. AESTHETIC: Aim for a "Midjourney-level aesthetic" with "cinematic lighting," "premium textures," "professional color grading," and "ultra-realistic rendering."
    5. ${request.textOverlay ? `TEXT/TYPOGRAPHY: The user wants the exact text "${request.textOverlay}" written beautifully and prominently. Ensure the prompt explicitly instructs the image generator to render this exact text flawlessly.` : `NO TEXT: The final image should not contain any text, words, or letters.`}
    6. STRICT ADHERENCE: You must incorporate EVERY SINGLE DETAIL provided by the user in their request. Do not ignore any settings, colors, or descriptions.
    
    Generate the output as a JSON array of objects, where each object has a "title" (a short, catchy title) and a "prompt" (the highly detailed image generation prompt in English).
    ${request.bgPresetName ? `\n    IMPORTANT: Since the user selected the background preset "${request.bgPresetName.toUpperCase()}", you MUST include "${request.bgPresetName.toUpperCase()}" in the title of each generated prompt.` : ""}
    
    Example output format:
    ${hasImages ? `[ { "title": "Combined Scene${request.bgPresetName ? ` + ${request.bgPresetName.toUpperCase()}` : ""}", "prompt": "A stunning..." } ]` : `[ { "title": "Option 1", "prompt": "A stunning..." }, { "title": "Option 2", "prompt": "A breathtaking..." } ]`}
    
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
      console.error("Failed to parse JSON", e);
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    console.error("Error generating FHD prompts:", error);
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

  let styleInstruction = "";
  if (request.style === 'realistic') {
    styleInstruction = "CRITICAL STYLE REQUIREMENT: The style MUST be 100% photorealistic, cinematic, and highly detailed. It must look like a real-world photograph taken with a high-end camera. ABSOLUTELY NO 2D graphics, NO flat illustrations, and NO cartoonish elements. If specific locations or landmarks are mentioned, they must be depicted exactly as they appear in reality.";
  } else if (request.style === 'graphic') {
    styleInstruction = `CRITICAL STYLE REQUIREMENT: The style MUST be a pure 2D/3D graphic illustration, modern, and delicate. ABSOLUTELY NO photorealism, NO real-world photography, and NO photographic elements. The main background color MUST be ${request.bgColor}. You MUST STRICTLY restrict the color palette of all graphic elements (e.g., glowing lights, rounded shapes, particles, abstract geometry) to ${request.color1} and ${request.color2}. DO NOT introduce any other colors.`;
  } else {
    styleInstruction = `CRITICAL STYLE REQUIREMENT: The style MUST be a seamless blend of photorealism AND modern graphic design. It MUST combine real-world photographic elements with graphic overlays. The overall background color or atmosphere MUST be ${request.bgColor}. If real locations are mentioned, depict them realistically but enhance them with delicate, neat graphic elements (e.g., glowing lights, rounded shapes, particles). You MUST STRICTLY restrict the color palette of these graphic elements to ${request.color1} and ${request.color2}. DO NOT introduce any other colors for the graphics.`;
  }

  let imageInstruction = "";
  let imageParts: any[] = [];
  if (request.images && request.images.length > 0) {
    imageInstruction = "I have provided reference images. Your prompt MUST describe how to seamlessly blend these images together while maintaining their realistic forms and features. Provide an incredibly detailed description of the elements in these images so the image generator can recreate and blend them perfectly.";
    request.images.forEach((img) => {
      imageParts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
    });
  }

  const avaStyleInstruction = request.useAvaStyle 
    ? `\n\nCRITICAL AVA STYLE OVERRIDE: The entire design MUST strictly follow "AVA's Style". This means:
       - Color Palette: Deep purples, neon blues, vibrant magentas, and glowing pinks on a dark background.
       - Visual Elements: Incorporate high-tech digital overlays, glowing neon lines, light streaks, network nodes, data grids, and subtle mandala or abstract geometric patterns in the background.
       - Lighting: Cinematic, luminous, with lens flares and glowing gradients.
       - Aesthetic: A premium, modern broadcast/news graphic style that blends real-world elements with futuristic 3D digital graphics.`
    : "";

  const textPart = {
    text: `Act as a world-class AI image prompt engineer for high-end models like Gemini 3.1 Flash Image and Midjourney v6.
    
    User Request: "${request.request || 'Blend the provided images seamlessly.'}"
    
    Your task is to create 5 distinct, MASTERPIECE-LEVEL visual descriptions (prompts) based on the user's request and provided images with EXTREME DETAIL.
    
    CRITICAL REQUIREMENTS:
    1. REALISM FOR LOCATIONS: If the user mentions a specific city, landmark, or location (e.g., Tehran, Erbil Citadel, Empire World), you MUST use your knowledge (or search) to describe its EXACT real-world appearance with EXTREME PRECISION. Do not invent generic buildings.
    2. STYLE: ${styleInstruction}${avaStyleInstruction}
    3. IMAGE BLENDING: ${imageInstruction}
    4. DIMENSIONS: Aspect ratio is "${request.aspectRatio}".
    5. AESTHETIC: Aim for a "Midjourney-level aesthetic" with "cinematic lighting," "premium textures," "professional color grading," and "ultra-realistic rendering."
    6. COLOR PALETTE: You MUST strictly adhere to the requested colors (${request.bgColor}, ${request.color1}, ${request.color2}). Do NOT hallucinate or add random colors.
    7. ${request.customText ? `TEXT/TYPOGRAPHY: The user wants the exact text "${request.customText}" written beautifully and prominently on the background. Ensure the prompt explicitly instructs the image generator to render this exact text flawlessly, integrating it into the design. The typography style should match the font "${request.textFont || 'IBM Plex Sans Arabic'}".` : `NO TEXT: The final image should not contain any text, words, or letters.`}
    8. EXTREME DETAIL: Provide an EXTREMELY detailed description of every visual element, texture, and lighting effect to ensure the highest possible quality.
    
    Generate the output as a JSON array of objects, where each object has a "title" (a short, catchy title) and a "prompt" (the highly detailed image generation prompt in English).
    
    Generate ONLY the JSON array. No markdown formatting, no meta-talk.`,
  };

  try {
    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: { parts: [...imageParts, textPart] },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
    });

    if (!response.text) return [{ title: "Error", prompt: "Failed to generate prompts." }];

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse JSON", e);
      return [{ title: "Raw Output", prompt: response.text }];
    }
  } catch (error: any) {
    console.error("Error generating background prompts:", error);
    return [{ title: "Error", prompt: `API Error: ${error.message}` }];
  }
}

export async function generateImageFromPrompt(prompt: string, aspectRatio: string, highQuality: boolean = false, mode: 'infographic' | 'background' | 'fhd' = 'infographic', customText?: string, referenceImages?: string[], keepOriginal?: boolean, bgPresetImage?: string | null, subjectDistance?: number, seed?: number): Promise<string> {
  const model = highQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  
  let finalPrompt = prompt;
  if (mode === 'infographic') {
    finalPrompt += "\n\nCRITICAL INSTRUCTION: The image must be a BLANK TEMPLATE. Do not include any actual text characters, words, letters, or digits. Instead, leave clean, empty placeholder boxes, blank stylized lines, or clear empty spaces exactly where the text and data should be placed. The composition must be perfectly prepared for manual text overlay.";
    if (bgPresetImage) {
      finalPrompt += "\n\nCRITICAL INSTRUCTION: I have provided a BACKGROUND PRESET image. You MUST use this exact image as the actual background of the final generated image. Place the foreground elements directly into this background with FLAWLESS, HYPER-REALISTIC BLENDING. Match the lighting, shadows, reflections, color grading, and perspective perfectly so the subjects look like they naturally exist in that environment. DO NOT use a black or plain background.";
    }
  } else if (mode === 'background') {
    if (customText) {
      finalPrompt += `\n\nCRITICAL INSTRUCTION: You MUST render the exact text "${customText}" prominently and beautifully on the image. Do not add any other random text.`;
    } else {
      finalPrompt += "\n\nCRITICAL INSTRUCTION: DO NOT generate any text, letters, or words on the image. Keep it completely text-free.";
    }
  } else if (mode === 'fhd') {
    const numRefs = referenceImages ? referenceImages.length : 0;
    const distanceText = subjectDistance && subjectDistance > 0
      ? `place them approximately ${subjectDistance}% apart from each other`
      : `place them EXTREMELY CLOSE together (e.g., standing shoulder-to-shoulder, forming a tight group)`;
      
    if (keepOriginal) {
      finalPrompt = `CRITICAL INSTRUCTION: I have provided ${numRefs} reference image(s). You are acting as a BACKGROUND REPLACEMENT and COMPOSITION tool. You MUST NOT alter, redraw, or modify the subjects/persons from the reference images in ANY WAY. Their faces, expressions, clothing, poses, proportions, and lighting MUST REMAIN 100% IDENTICAL to the original images. Your ONLY task is to extract them exactly as they are, ${distanceText}, and place them on a new background matching the following description:\n\n${prompt}`;
      if (bgPresetImage) {
        finalPrompt = `CRITICAL INSTRUCTION: I have provided ${numRefs} reference image(s) of subjects and 1 background preset image. You are acting as a BACKGROUND REPLACEMENT and COMPOSITION tool. You MUST NOT alter, redraw, or modify the subjects/persons from the reference images in ANY WAY. Their faces, expressions, clothing, poses, proportions, and lighting MUST REMAIN 100% IDENTICAL to the original images. Your ONLY task is to extract them exactly as they are, ${distanceText}, AND place them on the provided background preset. Blend them flawlessly into the new background without changing the subjects themselves.\n\nAdditional details: ${prompt}`;
      }
    } else {
      finalPrompt += `\n\nCRITICAL INSTRUCTION: I have provided ${numRefs} reference image(s). You MUST combine ALL subjects/elements from the reference images into ONE SINGLE cohesive image, ${distanceText}. Use the reference images as inspiration, but you may alter the characters, poses, and features to fit the prompt and make them interact naturally and closely. `;
      if (bgPresetImage) {
        finalPrompt += "\n\nCRITICAL INSTRUCTION: I have provided a BACKGROUND PRESET image. You MUST use this exact image as the actual background of the final generated image. Place the foreground elements directly into this background with FLAWLESS, HYPER-REALISTIC BLENDING. Match the lighting, shadows, reflections, color grading, and perspective perfectly so the subjects look like they naturally exist in that environment. DO NOT use a black or plain background.";
      }
    }
    finalPrompt += `\n\nCRITICAL QUALITY INSTRUCTION: Ensure flawless human anatomy, perfect proportions, highly detailed symmetrical faces, and NO deformations. The image must be perfectly framed and aligned for the exact requested aspect ratio (${aspectRatio}) without cropping important elements.`;
    if (customText) {
      finalPrompt += `\n\nYou MUST render the exact text "${customText}" prominently and beautifully on the design. Do not add any other random text.`;
    } else {
      finalPrompt += "\n\nDO NOT generate any text, letters, or words on the image. Keep it completely text-free.";
    }
  }

  try {
    const config: any = { imageConfig: { aspectRatio: aspectRatio as any } };
    if (seed !== undefined) config.seed = seed;
    if (highQuality) config.imageConfig.imageSize = mode === 'fhd' ? "4K" : "1K";

    const parts: any[] = [];
    if (bgPresetImage && (mode === 'infographic' || mode === 'fhd')) {
      parts.push({ inlineData: { mimeType: "image/png", data: bgPresetImage.split(",")[1] } });
    }
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach(img => {
        parts.push({ inlineData: { mimeType: "image/png", data: img.split(",")[1] } });
      });
    }
    parts.push({ text: finalPrompt });

    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: config,
      });
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data returned from Gemini.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export async function enhanceImage(base64Image: string, aspectRatio: string = "1:1", isHighQuality: boolean = true): Promise<string> {
  const model = isHighQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  const prompt = `Ultra-premium professional image enhancement.
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

  try {
    const response = await withRetry(() => {
      const aiInstance = new GoogleGenAI({ apiKey: getCurrentKey() });
      return aiInstance.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/png", data: base64Image.split(",")[1] } },
            { text: prompt }
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: isHighQuality ? "4K" : "1K",
          }
        }
      });
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data returned from Gemini.");
  } catch (error) {
    console.error("Error enhancing image:", error);
    throw error;
  }
}
