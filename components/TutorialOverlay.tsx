import React, { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2, MousePointer2, Hand, Zap, ArrowRight } from 'lucide-react';

export type TutorialStepType = 'WELCOME' | 'ADD_TASK' | 'DRAG' | 'POP' | 'FINISH';

interface TutorialOverlayProps {
  step: TutorialStepType | null;
  onClose: () => void;
  onNext: () => void;
}

interface StepConfig {
  label: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  showButton: boolean;
  buttonText?: string;
}

const STEPS_CONFIG: Record<TutorialStepType, StepConfig> = {
  'WELCOME': {
    label: "Welcome to Task Bubbles",
    title: "Think in Circles",
    subtitle: "A physics-based workspace where tasks float, bounce, and organize naturally.",
    icon: <Sparkles className="text-amber-400" size={32} />,
    showButton: true,
    buttonText: "Start Tour"
  },
  'ADD_TASK': {
    label: "Step 1 of 3",
    title: "Create a Task",
    subtitle: "Tap the glowing + button in the center to spawn your first bubble.",
    icon: <MousePointer2 className="text-blue-400" size={32} />,
    showButton: false
  },
  'DRAG': {
    label: "Step 2 of 3",
    title: "Move it Around",
    subtitle: "Grab any bubble and throw it across the screen. Physics creates order from chaos.",
    icon: <Hand className="text-purple-400" size={32} />,
    showButton: false
  },
  'POP': {
    label: "Step 3 of 3",
    title: "Pop to Complete",
    subtitle: "Click and Hold a task bubble until it bursts to mark it as done.",
    icon: <Zap className="text-red-400" size={32} />,
    showButton: false
  },
  'FINISH': {
    label: "Tutorial Complete",
    title: "You're All Set",
    subtitle: "Explore the sidebar for boards, settings, and themes. Enjoy your flow.",
    icon: <CheckCircle2 className="text-emerald-400" size={32} />,
    showButton: true,
    buttonText: "Let's Go"
  }
};

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ step, onClose, onNext }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [displayStep, setDisplayStep] = useState<TutorialStepType | null>(step);

  useEffect(() => {
      if (step) {
          setDisplayStep(step);
          setIsExiting(false);
      } else {
          setIsExiting(true);
          const t = setTimeout(() => setDisplayStep(null), 500);
          return () => clearTimeout(t);
      }
  }, [step]);

  if (!displayStep) return null;

  const config = STEPS_CONFIG[displayStep];

  return (
    <div className={`fixed bottom-0 left-0 w-full flex justify-center pointer-events-none z-[80] pb-12 transition-all duration-500 ease-out transform ${isExiting ? 'translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
      
      {/* Main Glass Card */}
      <div className="pointer-events-auto relative w-[90%] max-w-xl bg-slate-900/90 dark:bg-black/80 backdrop-blur-3xl rounded-3xl p-1 shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/10 overflow-hidden">
        
        {/* Decorative Background Gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative bg-white/5 dark:bg-white/5 rounded-[1.25rem] p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center text-center sm:text-left">
            
            {/* Large Icon Container */}
            <div className="shrink-0 relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 shadow-inner flex items-center justify-center relative z-10">
                    {config.icon}
                </div>
                {/* Glow behind icon */}
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full transform scale-110 z-0" />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <span className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-1">
                    {config.label}
                </span>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                    {config.title}
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                    {config.subtitle}
                </p>

                {/* Optional Action Button embedded in content area for better flow */}
                {config.showButton && (
                    <div className="mt-5 flex justify-center sm:justify-start">
                        <button 
                            onClick={onNext}
                            className="group flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-white/10"
                        >
                            {config.buttonText}
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}
            </div>

            {/* Skip Button (Top Right Absolute) */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/30 hover:text-white/80 hover:bg-white/10 rounded-full transition-colors"
                title="Skip Tutorial"
            >
                <X size={18} />
            </button>
        </div>
        
        {/* Progress Bar Line */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
             {(() => {
                 const steps: TutorialStepType[] = ['WELCOME', 'ADD_TASK', 'DRAG', 'POP', 'FINISH'];
                 const idx = steps.indexOf(displayStep);
                 const pct = ((idx + 1) / steps.length) * 100;
                 return <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />;
             })()}
        </div>

      </div>
    </div>
  );
};