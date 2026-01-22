class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check local storage for persistence on init
    try {
        const saved = localStorage.getItem('soundEnabled');
        if (saved === 'false') {
            this.isMuted = true;
        }
    } catch (e) {}
  }

  private getContext() {
    if (!this.ctx) {
      // Use standard AudioContext
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
      this.isMuted = muted;
      // If we are muting, we can suspend the context to save resources
      // If unmuting, we resume
      if (this.ctx) {
          if (muted && this.ctx.state === 'running') {
              this.ctx.suspend();
          } else if (!muted && this.ctx.state === 'suspended') {
              this.ctx.resume();
          }
      }
  }

  resume() {
    if (this.isMuted) return;
    
    const ctx = this.getContext();
    if (ctx.state !== 'running') {
      ctx.resume().catch(e => console.error("Audio resume failed", e));
    }
  }

  playPop() {
    if (this.isMuted) return;

    const ctx = this.getContext();
    
    // Critical: Always try to wake the context.
    // Even if it looks running, some browsers might throttle it.
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    const baseFreq = 200 + Math.random() * 600;
    const endFreq = baseFreq * (2 + Math.random() * 1.5);

    // Lookahead: Add 10ms delay to start time.
    // This prevents "dropped" notes if the main thread is slightly behind the audio thread,
    // which is the #1 cause of "sometimes it doesn't play".
    const startTime = t + 0.01;

    // Frequency Envelope (The "Bloop")
    osc.frequency.setValueAtTime(baseFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.15); 

    // Amplitude Envelope
    gain.gain.setValueAtTime(0, startTime);
    // Fast attack (5ms)
    gain.gain.linearRampToValueAtTime(0.7, startTime + 0.005); 
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }

  playHover() {
    if (this.isMuted) return;

    const ctx = this.getContext();
    if (ctx.state === 'suspended') return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const startTime = ctx.currentTime + 0.005;

    // Subtle high-pitch tick
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.02, startTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, startTime + 0.03);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.035);
  }
}

export const audioService = new AudioService();