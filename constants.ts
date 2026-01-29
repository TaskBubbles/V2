
// Kuro Glass Palette - Simplified Base 6

export const COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#ffb300', // Yellow
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#a855f7'  // Purple
];

export const MIN_BUBBLE_SIZE = 20; 
export const MAX_BUBBLE_SIZE = 220; 
export const CENTER_RADIUS = 50; 
export const POP_THRESHOLD_MS = 600;

// --- Unified Design System Classes ---

export const BTN_TRANSITION = "transition-all duration-200 active:scale-95";

// FABs (Floating Action Buttons)
export const FAB_BASE_CLASS = `p-3 rounded-2xl shadow-lg ${BTN_TRANSITION} bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:scale-105 hover:text-slate-900 dark:hover:text-white flex items-center justify-center`;

// Panels & Drawers
export const GLASS_PANEL_CLASS = "bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-2xl";

// Tooltips
export const TOOLTIP_BASE_CLASS = "px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-bold tracking-wide uppercase whitespace-nowrap";

// Button Variants
export const GLASS_BTN_BASE = `relative rounded-xl border flex items-center justify-center shrink-0 group outline-none overflow-hidden ${BTN_TRANSITION}`;

// 1. Secondary/Icon Buttons
export const GLASS_BTN_INACTIVE = `${GLASS_BTN_BASE} bg-white/30 dark:bg-white/5 border-white/40 dark:border-white/10 text-slate-600 dark:text-white/60 hover:bg-white/50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-white/60 dark:hover:border-white/20`;

export const GLASS_BTN_ACTIVE = `${GLASS_BTN_BASE} bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] backdrop-blur-md`;

// 2. Primary Action Buttons (e.g. Done, Create)
export const GLASS_BTN_PRIMARY = `${GLASS_BTN_BASE} bg-slate-900/80 dark:bg-white/90 text-white dark:text-slate-900 border-white/20 dark:border-white/10 shadow-lg hover:bg-slate-800 dark:hover:bg-white/100 backdrop-blur-xl font-bold tracking-wide`;

// 3. Danger Buttons (e.g. Delete)
export const GLASS_BTN_DANGER = `${GLASS_BTN_BASE} bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:border-red-500/30`;

// Menu Items (Sidebar / Dropdowns)
export const GLASS_MENU_ITEM = "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border flex items-center gap-3";
export const GLASS_MENU_ITEM_ACTIVE = "bg-white/40 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm border-white/40 dark:border-white/10 backdrop-blur-md";
export const GLASS_MENU_ITEM_INACTIVE = "border-transparent text-slate-500 dark:text-white/60 hover:bg-white/20 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:border-white/20 dark:hover:border-white/5";

/**
 * Calculates a dynamic font size to fit text within the bubble.
 * Optimized for aesthetic fill and readability.
 */
export const calculateFontSize = (radius: number, text: string): number => {
  if (!text) return radius / 3;

  const words = text.split(/\s+/);
  const totalChars = text.length;
  
  // Safe area dimension (square inside circle)
  // sqrt(2) * r is the max square side, approx 1.414. 
  // We go slightly smaller (1.35) for visual breathing room.
  const containerSize = radius * 1.35; 

  // Heuristic 1: Length of the longest word vs Container Width
  const longestWord = words.reduce((a, b) => a.length > b.length ? a : b, "");
  // Assume avg char aspect ratio 0.6 (font width / font height)
  // We allow words to be slightly wider than container if they wrap, but we want to avoid it.
  const maxFontSizeByWidth = containerSize / (longestWord.length * 0.55);

  // Heuristic 2: Total Area fill
  // Total Area available ~= containerSize * containerSize
  // Text Area ~= totalChars * (fontSize^2 * charConstant)
  // Rearranged: fontSize = sqrt(Area / totalChars)
  // We adjust the density factor: lower means bigger text allowed
  const densityFactor = totalChars < 10 ? 0.9 : 1.2; 
  const maxFontSizeByArea = Math.sqrt((containerSize * containerSize) / (totalChars * densityFactor));

  // Pick the limiting factor
  let fontSize = Math.min(maxFontSizeByWidth, maxFontSizeByArea);

  // Boost for very short text (1-3 chars, e.g., "Hi", "1")
  if (totalChars <= 3) {
      fontSize = radius * 0.8; 
  }

  // Clamps
  // Min size: grows slightly with bubble size so large bubbles don't have microscopic text
  const minReadable = Math.max(10, radius * 0.15); 
  const maxCap = radius * 0.65; // Never take up more than ~65% of vertical height per line roughly

  return Math.max(minReadable, Math.min(fontSize, maxCap));
};
