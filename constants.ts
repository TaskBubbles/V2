
// Kuro Glass Palette 4.8
// 18 Distinct Colors arranged in a 6x3 Grid

export interface ColorGroup {
    name: string;
    shades: [string, string, string]; // Top (Alt), Base (Primary), Bottom (Deep/Alt)
}

export const COLOR_GROUPS: ColorGroup[] = [
    {
        name: 'Red',
        shades: ['#f472b6', '#ef4444', '#be123c'] 
    },
    {
        name: 'Orange', 
        shades: ['#fb923c', '#f97316', '#c2410c']
    },
    {
        name: 'Yellow', 
        shades: ['#ffca28', '#ffb300', '#ff8f00']
    },
    {
        name: 'Green', 
        shades: ['#10b981', '#22c55e', '#15803d']
    },
    {
        name: 'Blue', 
        shades: ['#38bdf8', '#3b82f6', '#1e40af']
    },
    {
        name: 'Purple',
        shades: ['#d946ef', '#a855f7', '#6b21a8']
    }
];

export const BASE_COLORS = COLOR_GROUPS.map(g => g.shades[1]);
export const ALL_COLORS = COLOR_GROUPS.flatMap(g => g.shades);
export const COLORS = BASE_COLORS;

export const MIN_BUBBLE_SIZE = 20; 
export const MAX_BUBBLE_SIZE = 220; 
export const CENTER_RADIUS = 50; 
export const POP_THRESHOLD_MS = 600;

// --- Unified Design System Classes ---

// FABs (Floating Action Buttons)
export const FAB_BASE_CLASS = "p-3 rounded-2xl transition-all shadow-lg active:scale-95 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:scale-105 hover:text-slate-900 dark:hover:text-white";

// Panels & Drawers
export const GLASS_PANEL_CLASS = "bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-2xl";

// Tooltips
export const TOOLTIP_BASE_CLASS = "px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-bold tracking-wide uppercase whitespace-nowrap";

// Menu Items (within panels)
export const MENU_ITEM_CLASS = "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200";
export const MENU_ITEM_ACTIVE_CLASS = "bg-white/50 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5";
export const MENU_ITEM_INACTIVE_CLASS = "text-slate-600 dark:text-white/60 hover:bg-white/30 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white";

/**
 * Calculates a dynamic font size to fit text within the bubble.
 */
export const calculateFontSize = (radius: number, text: string): number => {
  if (!text) return radius / 3;
  const containerWidth = radius * 1.3;
  const words = text.split(/\s+/);
  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");
  const maxWordLen = Math.max(longestWord.length, 1);
  const totalChars = text.length;
  const charWidthRatio = 0.75;
  const lineHeight = 1.1;
  const sizeToFitWidth = containerWidth / (maxWordLen * charWidthRatio);
  const sizeToFitArea = Math.sqrt(areaCalculation(containerWidth, totalChars, charWidthRatio, lineHeight));
  const sizeToFitRadius = radius * 0.45;
  let fontSize = Math.min(sizeToFitWidth, sizeToFitArea, sizeToFitRadius);
  return Math.max(4, Math.min(fontSize, 50));
};

const areaCalculation = (w: number, chars: number, ratio: number, line: number) => (w * w) / (chars * ratio * line);
