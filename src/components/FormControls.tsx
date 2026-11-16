import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Plus, Upload, X } from 'lucide-react';
import { MAX_UPLOAD_IMAGES } from '../constants/options';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 ${
      checked ? 'bg-[#00f0ff]' : 'bg-white/15'
    }`}
  >
    <motion.div
      animate={{ x: checked ? 26 : 4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
    />
  </button>
);

interface ColorPaletteInputsProps {
  color1: string;
  color2: string;
  bgColor: string;
  onColor1Change: (val: string) => void;
  onColor2Change: (val: string) => void;
  onBgColorChange: (val: string) => void;
  labels: {
    color1: string;
    color2: string;
    bgColor: string;
  };
}

export const ColorPaletteInputs: React.FC<ColorPaletteInputsProps> = ({
  color1,
  color2,
  bgColor,
  onColor1Change,
  onColor2Change,
  onBgColorChange,
  labels,
}) => {
  const items = [
    { label: labels.color1, value: color1, onChange: onColor1Change },
    { label: labels.color2, value: color2, onChange: onColor2Change },
    { label: labels.bgColor, value: bgColor, onChange: onBgColorChange },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-hidden"
    >
      {items.map((item) => (
        <div key={item.label}>
          <label className="text-[10px] text-white/70 block uppercase tracking-wider mb-1.5">
            {item.label}
          </label>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
            <input
              type="color"
              value={item.value}
              onChange={(e) => item.onChange(e.target.value)}
              aria-label={item.label}
              className="w-8 h-8 rounded cursor-pointer border-none bg-transparent shrink-0"
            />
            <span className="text-xs font-mono uppercase">{item.value}</span>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

interface ImageUploadGridProps {
  title: string;
  hint?: string;
  uploadLabel: string;
  maxImagesHint: string;
  images: string[];
  icon: React.ReactNode;
  onAddFiles: (files: FileList) => void;
  onRemoveImage: (index: number) => void;
}

export const ImageUploadGrid: React.FC<ImageUploadGridProps> = ({
  title,
  hint,
  uploadLabel,
  maxImagesHint,
  images,
  icon,
  onAddFiles,
  onRemoveImage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="liquid-panel rounded-[32px] p-6">
      <div className="flex justify-between items-center mb-2">
        <label className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#00f0ff]">
          {icon}
          <span>{title}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/55">
            {images.length}/{MAX_UPLOAD_IMAGES} ({maxImagesHint})
          </span>
          {images.length < MAX_UPLOAD_IMAGES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={uploadLabel}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#00f0ff]"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      {hint && <p className="text-xs text-white/60 mb-4">{hint}</p>}

      <input
        type="file"
        ref={inputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAddFiles(e.target.files);
            e.target.value = '';
          }
        }}
        multiple
        accept="image/*"
        className="hidden"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative group aspect-square">
            <img
              src={img}
              alt={`${title} ${idx + 1}`}
              className="w-full h-full object-cover rounded-xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => onRemoveImage(idx)}
              aria-label={`Remove image ${idx + 1}`}
              className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full p-1 shadow-md opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {images.length < MAX_UPLOAD_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-white/25 rounded-xl text-white/60 hover:bg-white/5 hover:border-[#00f0ff]/50 hover:text-[#00f0ff] transition-colors"
          >
            <Upload size={20} />
            <span className="text-[11px] mt-1 font-medium">{uploadLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
