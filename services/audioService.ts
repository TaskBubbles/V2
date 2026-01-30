

class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    try {
        const saved = localStorage.getItem('soundEnabled');
        if (saved === 'false') {
            this.isMuted = true;
        }
    } catch (e) {}
  }

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
      this.isMuted = muted;
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
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 200 + Math.random() * 400;
    const endFreq = baseFreq * (2.2 + Math.random() * 1.5);
    const startTime = t + 0.005;

    osc.frequency.setValueAtTime(baseFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.12); 

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.6, startTime + 0.004); 
    gain.gain.setTargetAtTime(0.0001, startTime + 0.05, 0.03);

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
    const startTime = ctx.currentTime + 0.002;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.015, startTime + 0.002);
    gain.gain.setTargetAtTime(0.0001, startTime + 0.005, 0.01);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  playAlert() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    
    const t = ctx.currentTime;
    
    // G4 Major Chord of Pops: G4, B4, D5
    // Frequencies: 392.00, 493.88, 587.33
    const freqs = [392.00, 493.88, 587.33];

    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + (i * 0.08); // 80ms delay between notes

        osc.type = 'sine';
        // Pop effect: pitch sweeps up quickly
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 2.2, start + 0.15); 
        
        // Amplitude envelope: sharp attack, quick decay
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.01); 
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + 0.2);
    });
  }
}

export const audioService = new AudioService();