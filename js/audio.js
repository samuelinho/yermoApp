/* ============================================================
   RETRO TERMINAL — Módulo de Audio
   Genera sonidos procedurales con Web Audio API.
   No requiere ficheros de audio externos.
   ============================================================ */

export class TerminalAudio {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** Volumen maestro (0-1) */
    this.masterVolume = 0.3;
    /** ¿Se ha activado el contexto de audio? (requiere gesto del usuario) */
    this.initialized = false;
    /** Nodo de ganancia maestro */
    this.masterGain = null;
    /** Nodo del zumbido de fondo */
    this._humOsc = null;
    this._humGain = null;
  }

  /* ----------------------------------------------------------
     Inicialización (llamar tras un gesto del usuario)
     ---------------------------------------------------------- */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('[TerminalAudio] Web Audio API no disponible:', e);
    }
  }

  /** Asegura que el contexto esté activo (resume tras suspensión) */
  _ensureRunning() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /* ----------------------------------------------------------
     Sonidos individuales
     ---------------------------------------------------------- */

  /**
   * Sonido de tecleo: click suave y corto.
   * Simula el sonido mecánico sutil de una tecla de terminal.
   */
  playTyping() {
    if (!this.initialized) return;
    this._ensureRunning();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Ráfaga de ruido muy corta filtrada (click suave)
    const sampleRate = ctx.sampleRate;
    const duration = 0.012; // 12ms — muy breve
    const samples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      // Ruido con envolvente exponencial decreciente
      const envelope = Math.exp(-i / (samples * 0.2));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Filtro paso bajo para suavizar
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000 + Math.random() * 500;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12 + Math.random() * 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + 0.03);
  }

  /**
   * Sonido de selección: blip suave al cambiar de opción.
   */
  playSelect() {
    if (!this.initialized) return;
    this._ensureRunning();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Sonido de confirmación: doble tono ascendente.
   */
  playConfirm() {
    if (!this.initialized) return;
    this._ensureRunning();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [0, 0.08].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const freq = i === 0 ? 900 : 1350;
      osc.frequency.setValueAtTime(freq, now + offset);

      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  /**
   * Sonido de error: tono descendente grave.
   */
  playError() {
    if (!this.initialized) return;
    this._ensureRunning();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * Sonido de arranque: barrido ascendente + ruido.
   */
  playBoot() {
    if (!this.initialized) return;
    this._ensureRunning();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Barrido ascendente
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.75);

    // Ruido estático corto
    this._playNoiseBurst(0.08, 0.3);
  }

  /**
   * Ráfaga corta de ruido blanco.
   * @param {number} volume  Volumen (0-1)
   * @param {number} duration  Duración en segundos
   */
  _playNoiseBurst(volume = 0.05, duration = 0.15) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const samples = sampleRate * duration;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + duration);
  }

  /* ----------------------------------------------------------
     Zumbido de fondo del monitor (hum)
     ---------------------------------------------------------- */

  /**
   * Inicia un zumbido de fondo muy suave (60 Hz).
   */
  startHum() {
    if (!this.initialized || this._humOsc) return;
    this._ensureRunning();
    const ctx = this.ctx;

    this._humOsc = ctx.createOscillator();
    this._humGain = ctx.createGain();

    this._humOsc.type = 'sine';
    this._humOsc.frequency.value = 60;
    this._humGain.gain.value = 0.015;

    this._humOsc.connect(this._humGain);
    this._humGain.connect(this.masterGain);

    this._humOsc.start();
  }

  /**
   * Detiene el zumbido de fondo.
   */
  stopHum() {
    if (this._humOsc) {
      this._humOsc.stop();
      this._humOsc.disconnect();
      this._humOsc = null;
      this._humGain = null;
    }
  }

  /* ----------------------------------------------------------
     Reproducir sonido por nombre (desde el JSON)
     ---------------------------------------------------------- */

  /**
   * Reproduce un sonido identificado por nombre.
   * @param {string} name  Nombre del sonido: 'typing', 'select', 'confirm', 'error', 'boot'
   */
  play(name) {
    switch (name) {
      case 'typing':  this.playTyping(); break;
      case 'select':  this.playSelect(); break;
      case 'confirm': this.playConfirm(); break;
      case 'error':   this.playError(); break;
      case 'boot':    this.playBoot(); break;
      default:        this.playConfirm(); break;
    }
  }

  /* ----------------------------------------------------------
     Limpieza
     ---------------------------------------------------------- */
  destroy() {
    this.stopHum();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
