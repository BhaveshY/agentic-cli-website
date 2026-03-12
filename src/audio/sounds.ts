type OscType = OscillatorType;

interface SoundDef {
  frequency: number;
  type: OscType;
  duration: number;
  volume: number;
  ramp?: number;
  delay?: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.3;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(def: SoundDef): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = def.type;
    osc.frequency.value = def.frequency;
    if (def.ramp) {
      osc.frequency.exponentialRampToValueAtTime(
        def.ramp,
        ctx.currentTime + (def.delay || 0) + def.duration
      );
    }

    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(def.volume, ctx.currentTime + (def.delay || 0) + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (def.delay || 0) + def.duration
    );

    osc.connect(gain);
    gain.connect(this.masterGain);

    const startTime = ctx.currentTime + (def.delay || 0);
    osc.start(startTime);
    osc.stop(startTime + def.duration);
  }

  private playNoise(duration: number, volume: number): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  playStrike(): void {
    this.playTone({ frequency: 200, type: 'sawtooth', duration: 0.15, volume: 0.4, ramp: 80 });
    this.playNoise(0.1, 0.2);
  }

  playBlast(): void {
    this.playTone({ frequency: 800, type: 'sine', duration: 0.3, volume: 0.3, ramp: 200 });
    this.playTone({ frequency: 600, type: 'square', duration: 0.15, volume: 0.15, delay: 0.05 });
  }

  playShield(): void {
    this.playTone({ frequency: 300, type: 'sine', duration: 0.4, volume: 0.2 });
    this.playTone({ frequency: 450, type: 'sine', duration: 0.3, volume: 0.15, delay: 0.1 });
  }

  playDodge(): void {
    this.playTone({ frequency: 400, type: 'sine', duration: 0.2, volume: 0.2, ramp: 800 });
  }

  playCharge(): void {
    this.playTone({ frequency: 100, type: 'sawtooth', duration: 0.6, volume: 0.2, ramp: 600 });
  }

  playSurge(): void {
    this.playTone({ frequency: 80, type: 'sawtooth', duration: 0.5, volume: 0.5, ramp: 1200 });
    this.playNoise(0.3, 0.3);
    this.playTone({ frequency: 200, type: 'square', duration: 0.3, volume: 0.2, delay: 0.2, ramp: 50 });
  }

  playHit(): void {
    this.playTone({ frequency: 150, type: 'square', duration: 0.1, volume: 0.4, ramp: 40 });
    this.playNoise(0.15, 0.3);
  }

  playSelect(): void {
    this.playTone({ frequency: 600, type: 'sine', duration: 0.08, volume: 0.15 });
  }

  playConfirm(): void {
    this.playTone({ frequency: 500, type: 'sine', duration: 0.1, volume: 0.2 });
    this.playTone({ frequency: 700, type: 'sine', duration: 0.1, volume: 0.2, delay: 0.1 });
  }

  playVictory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.playTone({ frequency: freq, type: 'sine', duration: 0.3, volume: 0.25, delay: i * 0.15 });
    });
  }

  playDefeat(): void {
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      this.playTone({ frequency: freq, type: 'sawtooth', duration: 0.4, volume: 0.2, delay: i * 0.2 });
    });
  }

  playRoundStart(): void {
    this.playTone({ frequency: 440, type: 'sine', duration: 0.15, volume: 0.2 });
    this.playTone({ frequency: 660, type: 'sine', duration: 0.2, volume: 0.2, delay: 0.15 });
  }

  playTick(): void {
    this.playTone({ frequency: 1000, type: 'sine', duration: 0.03, volume: 0.1 });
  }
}
