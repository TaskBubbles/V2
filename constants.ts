

// Kuro Glass Palette 4.8
// 18 Distinct Colors arranged in a 6x3 Grid

export interface ColorGroup {
    name: string;
    shades: [string, string, string]; // Top (Alt), Base (Primary), Bottom (Deep/Alt)
}

export const COLOR_GROUPS: ColorGroup[] = [
    {
        name: 'Red',
        shades: ['#f87171', '#ef4444', '#b91c1c'] 
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
 * Optimized for readability with multi-line support.
 */
export const calculateFontSize = (radius: number, text: string): number => {
  if (!text) return radius / 3;

  // Effective container dimensions (bubbles are round, text flows in a square-ish shape inside)
  const containerWidth = radius * 1.65; 
  
  const lines = text.split('\n');
  const totalChars = text.length;

  // 1. Line Length Constraint:
  // Find the longest visual line to ensure it doesn't overflow horizontally.
  // We assume an average character width ratio relative to font size.
  const longestLineChars = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const charWidthRatio = 0.55; // Average aspect ratio of a font character
  const sizeToFitWidth = containerWidth / (Math.max(longestLineChars, 2) * charWidthRatio);

  // 2. Area Constraint:
  // Ensure total text volume fits within the circle area.
  // We model this by comparing total characters to available square area.
  // We use a looser density factor for short text to make it pop, tighter for long text.
  const densityFactor = totalChars > 50 ? 0.7 : 0.85; 
  const availableArea = (radius * 1.5) * (radius * 1.5);
  const sizeToFitArea = Math.sqrt(availableArea / (totalChars * densityFactor));

  // 3. Radius Constraint:
  // Cap the maximum size based on the bubble radius so short words don't look comically large.
  const sizeToFitRadius = radius * 0.5;

  // Calculate final font size taking the most restrictive constraint
  let fontSize = Math.min(sizeToFitWidth, sizeToFitArea, sizeToFitRadius);

  // Hard clamp for legibility
  // Min size increases slightly with radius to prevent tiny text in huge bubbles, 
  // but has a hard floor of 9px for absolute readability.
  const minReadable = Math.max(9, radius * 0.15); 
  const maxCap = 48;

  return Math.max(minReadable, Math.min(fontSize, maxCap));
};
