/**
 * Procedural Web Audio Engine for Scrap Metal: Demolition Dash
 * Synthesizes heavy diesel rumbles, high-pressure steam releases, metal crunches, and alarms.
 */

class ScrapAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Engine sounds
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineModulator: OscillatorNode | null = null;
  private engineModGain: GainNode | null = null;

  // Persistent shield hum
  private shieldOsc: OscillatorNode | null = null;
  private shieldGain: GainNode | null = null;

  private isMuted: boolean = false;
  private initialized: boolean = false;
  private lastAlarmTime: number = 0;

  constructor() {
    // Lazy initialize to avoid browser console warnings about un-interacted AudioContext
  }

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API not supported in this browser.');
        return;
      }

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngine();
      this.setupShieldHum();

      this.initialized = true;
      console.log('Procedural Audio Engine Initialized.');
    } catch (e) {
      console.error('Failed to initialize Audio Engine:', e);
    }
  }

  private setupEngine() {
    if (!this.ctx || !this.masterGain) return;

    // Diesel Engine Growl: Combines two low sawtooths with filtering
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime); // low rumble

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime); // higher overtone

    // Filter to suppress high-ends and make it muddy/gritty
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(4, this.ctx.currentTime);

    // Amplitudinal modulation to simulate physical piston firing strokes (heavy chugging)
    this.engineModulator = this.ctx.createOscillator();
    this.engineModulator.type = 'sine';
    this.engineModulator.frequency.setValueAtTime(12, this.ctx.currentTime); // cylinder revs rate

    this.engineModGain = this.ctx.createGain();
    this.engineModGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime); // start quiet

    // Connect mod chain
    this.engineModulator.connect(this.engineModGain);
    this.engineModGain.connect(this.engineGain.gain);

    // Main engine graph
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    // Start oscillators safely
    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineModulator.start();
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx?.resume();
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
    }
  }

  private setupShieldHum() {
    if (!this.ctx || !this.masterGain) return;

    // Deep energetic energy hum for the cowcatcher shield
    this.shieldOsc = this.ctx.createOscillator();
    this.shieldOsc.type = 'sawtooth';
    this.shieldOsc.frequency.setValueAtTime(80, this.ctx.currentTime);

    const shieldFilter = this.ctx.createBiquadFilter();
    shieldFilter.type = 'bandpass';
    shieldFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    shieldFilter.Q.setValueAtTime(2, this.ctx.currentTime);

    this.shieldGain = this.ctx.createGain();
    this.shieldGain.gain.setValueAtTime(0, this.ctx.currentTime); // silent by default

    this.shieldOsc.connect(shieldFilter);
    shieldFilter.connect(this.shieldGain);
    this.shieldGain.connect(this.masterGain);

    this.shieldOsc.start();
  }

  /**
   * Updates state of continuous background sounds (engine growl, shield hum)
   */
  public updateEngine(speedRatio: number, overheatRatio: number, isBraking: boolean, hasShield: boolean) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const baseFrequency = 35 + speedRatio * 35 + overheatRatio * 15; // 35Hz to 85Hz range
    const filterFreq = 110 + speedRatio * 140 + overheatRatio * 180; // 110Hz to 430Hz
    const gainValue = isBraking ? 0.28 : 0.4 + speedRatio * 0.35 + overheatRatio * 0.15; // engine works harder
    const chugRate = 8 + speedRatio * 18 + overheatRatio * 10; // piston cycle speeds up

    const t = this.ctx.currentTime;

    // Smooth transition parameters to prevent crackling
    this.engineOsc1?.frequency.setTargetAtTime(baseFrequency, t, 0.1);
    this.engineOsc2?.frequency.setTargetAtTime(baseFrequency * 2.1, t, 0.1);
    this.engineFilter?.frequency.setTargetAtTime(filterFreq, t, 0.15);
    this.engineModulator?.frequency.setTargetAtTime(chugRate, t, 0.15);
    this.engineGain?.gain.setTargetAtTime(gainValue * 0.25, t, 0.2);

    // Update Cowcatcher Shield volume
    if (hasShield) {
      this.shieldGain?.gain.setTargetAtTime(0.2, t, 0.2);
      this.shieldOsc?.frequency.setTargetAtTime(75 + Math.sin(t * 8) * 15, t, 0.1);
    } else {
      this.shieldGain?.gain.setTargetAtTime(0, t, 0.15);
    }

    // High Heat Warning alarm (overheat at >80%)
    if (overheatRatio > 0.8 && !isBraking) {
      if (t - this.lastAlarmTime > 0.5) {
        this.playBeep(880, 0.15, 0.1); // alarm beep tone
        this.lastAlarmTime = t;
      }
    }
  }

  /**
   * Basic beep node generator
   */
  private playBeep(freq: number, duration: number, volume: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * Sound: Heavy Metal Scrap Impact
   */
  public playMetalCrash() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Part 1: Explosive White Noise Burst
    const bufferSize = this.ctx.sampleRate * 0.4; // 0.4 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(320, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    noiseFilter.Q.setValueAtTime(3, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseNode.start(t);

    // Part 2: Metallic ringing tone (iron clank)
    const clankOsc = this.ctx.createOscillator();
    clankOsc.type = 'sawtooth';
    clankOsc.frequency.setValueAtTime(140, t);
    clankOsc.frequency.linearRampToValueAtTime(80, t + 0.15);

    const clankFilter = this.ctx.createBiquadFilter();
    clankFilter.type = 'lowpass';
    clankFilter.frequency.setValueAtTime(500, t);

    const clankGain = this.ctx.createGain();
    clankGain.gain.setValueAtTime(0.6, t);
    clankGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    clankOsc.connect(clankFilter);
    clankFilter.connect(clankGain);
    clankGain.connect(this.masterGain);

    clankOsc.start(t);
    clankOsc.stop(t + 0.3);
  }

  /**
   * Sound: Valve Steam Let-off and Brake Squeal
   */
  public playSteamVent() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Steam escape hiss using White Noise
    const bufferSize = this.ctx.sampleRate * 0.5; // half second
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const hiss = this.ctx.createBufferSource();
    hiss.buffer = buffer;

    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(1800, t);
    hissFilter.frequency.linearRampToValueAtTime(1400, t + 0.5);
    hissFilter.Q.setValueAtTime(2.5, t);

    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0.7, t);
    hissGain.gain.linearRampToValueAtTime(0.001, t + 0.45);

    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.masterGain);
    hiss.start(t);

    // Brake squeal overlay
    const squeal = this.ctx.createOscillator();
    squeal.type = 'sine';
    squeal.frequency.setValueAtTime(2800, t);
    squeal.frequency.exponentialRampToValueAtTime(2600, t + 0.25);

    const squealGain = this.ctx.createGain();
    squealGain.gain.setValueAtTime(0.04, t);
    squealGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    squeal.connect(squealGain);
    squealGain.connect(this.masterGain);
    
    squeal.start(t);
    squeal.stop(t + 0.3);
  }

  /**
   * Sound: Water cooling (bubbling sizzle)
   */
  public playWaterSizzle() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Liquid sizzle sound
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.linearRampToValueAtTime(1300, t + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(950, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);

    // Add extra chime for collectible notification
    this.playBeep(440, 0.08, 0.15);
    setTimeout(() => this.playBeep(660, 0.14, 0.15), 60);
  }

  /**
   * Sound: Armor lock / cowcatcher charge
   */
  public playPowerupShield() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const pitchStart = 110;
    const pitchEnd = 440;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitchStart, t);
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, t + 0.5);

    const mod = this.ctx.createOscillator();
    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(15, t);

    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(120, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.masterGain);

    mod.start(t);
    osc.start(t);
    mod.stop(t + 0.5);
    osc.stop(t + 0.5);
  }

  /**
   * Sound: Giant Engine Blowout / Catastrophic Exploding crash
   */
  public playExplosion() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Deep heavy explosion rumble using noise
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds wide
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const blast = this.ctx.createBufferSource();
    blast.buffer = buffer;

    const blastFilter = this.ctx.createBiquadFilter();
    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(160, t);
    blastFilter.frequency.exponentialRampToValueAtTime(20, t + 1.2);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(2.2, t);
    blastGain.gain.linearRampToValueAtTime(0.001, t + 1.4);

    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.masterGain);
    blast.start(t);

    // Metallic distortion crackle elements
    const distortOsc = this.ctx.createOscillator();
    distortOsc.type = 'sawtooth';
    distortOsc.frequency.setValueAtTime(60, t);
    distortOsc.frequency.linearRampToValueAtTime(5, t + 0.8);

    const distortGain = this.ctx.createGain();
    distortGain.gain.setValueAtTime(1.0, t);
    distortGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    distortOsc.connect(distortGain);
    distortGain.connect(this.masterGain);
    distortOsc.start(t);
    distortOsc.stop(t + 0.82);
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuteState() {
    return this.isMuted;
  }
}

export const soundEngine = new ScrapAudioEngine();
