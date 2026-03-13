export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceActive = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, type: OscillatorType, dur: number, vol: number, ramp?: number, delay = 0): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (ramp) osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + delay + dur);
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur);
  }

  playClick(): void { this.tone(800, 'sine', 0.06, 0.15); }
  playBuild(): void {
    this.tone(200, 'square', 0.1, 0.2);
    this.tone(300, 'square', 0.1, 0.15, undefined, 0.1);
  }
  playTrain(): void {
    this.tone(400, 'sine', 0.1, 0.2);
    this.tone(600, 'sine', 0.15, 0.2, undefined, 0.1);
  }
  playSword(): void { this.tone(200, 'sawtooth', 0.12, 0.3, 80); }
  playArrow(): void { this.tone(500, 'sine', 0.15, 0.2, 900); }
  playHit(): void { this.tone(120, 'square', 0.08, 0.3, 40); }
  playVictory(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'sine', 0.3, 0.25, undefined, i * 0.15));
  }
  playDefeat(): void {
    [400, 350, 300, 200].forEach((f, i) => this.tone(f, 'sawtooth', 0.4, 0.2, undefined, i * 0.2));
  }
  playAgeUp(): void {
    this.tone(440, 'sine', 0.2, 0.3);
    this.tone(660, 'sine', 0.2, 0.3, undefined, 0.2);
    this.tone(880, 'sine', 0.4, 0.3, undefined, 0.4);
  }

  startAmbience(): void {
    if (this.ambienceActive) return;
    this.ambienceActive = true;
    const ctx = this.ensure();
    if (!this.master) return;

    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    const gain = ctx.createGain();
    gain.gain.value = 0.03;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start();

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80;
    windLfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    windLfo.start();
  }

  playGather(): void {
    this.tone(300, 'square', 0.08, 0.12);
    this.tone(250, 'square', 0.06, 0.1, undefined, 0.08);
  }
}
