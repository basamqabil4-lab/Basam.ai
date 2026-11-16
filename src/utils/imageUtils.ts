export interface InlineImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

/**
 * Parses a Data URL into Gemini `inlineData` with its true MIME type.
 */
export function dataUrlToInlinePart(dataUrl: string): InlineImagePart | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;

  const [, rawMime, base64Data] = match;
  // Gemini inlineData expects raster MIME types; normalize fallback cleanly.
  const mimeType = rawMime && rawMime !== 'image/svg+xml' ? rawMime : 'image/png';
  return {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function canvasHasTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    // Stride across pixels for fast alpha check
    const step = Math.max(4, Math.floor(data.length / 4096) * 4);
    for (let i = 3; i < data.length; i += step) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resizes and compresses uploaded image files client-side to minimize Gemini vision
 * token usage (768px fits Gemini's single-tile boundary; 512px is ideal for style cues)
 * while preserving transparency when genuinely present.
 */
export async function processUploadedImage(
  file: File,
  maxDimension: number = 768,
  jpegQuality: number = 0.78
): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const isSvg = file.type === 'image/svg+xml' || rawDataUrl.startsWith('data:image/svg+xml');

  try {
    const img = await loadImage(rawDataUrl);
    const naturalW = img.naturalWidth || img.width || maxDimension;
    const naturalH = img.naturalHeight || img.height || maxDimension;

    if (!isSvg && naturalW <= maxDimension && naturalH <= maxDimension && file.size < 140 * 1024) {
      return rawDataUrl;
    }

    const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const potentiallyTransparent =
      isSvg || file.type === 'image/png' || file.type === 'image/webp';
    const hasAlpha = potentiallyTransparent && canvasHasTransparency(ctx, targetW, targetH);

    if (hasAlpha) {
      const outputMime = file.type === 'image/webp' ? 'image/webp' : 'image/png';
      return canvas.toDataURL(outputMime, jpegQuality);
    }

    return canvas.toDataURL('image/jpeg', jpegQuality);
  } catch {
    return rawDataUrl;
  }
}
