/* ============================================================
   RETRO TERMINAL — Efectos CRT avanzados (canvas)
   Curvatura, ghosting, aberración cromática y distorsión.
   Módulo completamente opcional.
   ============================================================ */

export class CRTEffects {
  /**
   * @param {HTMLCanvasElement} canvas  Elemento canvas superpuesto
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
    this.enabled = true;
    this._animFrame = null;
    this._time = 0;
    /** Intensidad de flicker aleatorio (varía con el tiempo) */
    this._flickerTarget = 0;
    this._flickerCurrent = 0;
  }

  /* ----------------------------------------------------------
     Inicialización y tamaño
     ---------------------------------------------------------- */

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  start() {
    if (!this.enabled) return;
    this.resize();
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this._loop();
  }

  stop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }

  /* ----------------------------------------------------------
     Bucle de renderizado
     ---------------------------------------------------------- */

  _loop() {
    this._animFrame = requestAnimationFrame(() => this._loop());
    this._time += 0.016;
    this._render();
  }

  _render() {
    const { ctx2d: ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Aberración cromática en los bordes
    this._drawEdgeAberration(ctx, w, h);

    // 2. Líneas de interferencia horizontales (ocasionales)
    this._drawInterference(ctx, w, h);

    // 3. Distorsión de borde (oscurecimiento radial pulsante)
    this._drawEdgeDistortion(ctx, w, h);

    // 4. Micro-flicker aleatorio (parpadeo muy breve)
    this._drawFlicker(ctx, w, h);
  }

  /* ----------------------------------------------------------
     Aberración cromática en bordes
     ---------------------------------------------------------- */

  _drawEdgeAberration(ctx, w, h) {
    const edgeWidth = 3;

    ctx.save();
    ctx.globalAlpha = 0.025;

    // Borde izquierdo — tinte rojo
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, edgeWidth, h);

    // Borde derecho — tinte cian
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(w - edgeWidth, 0, edgeWidth, h);

    // Aberración horizontal ondulante (se mueve suavemente)
    const y = (Math.sin(this._time * 0.5) * 0.5 + 0.5) * h;
    ctx.globalAlpha = 0.018;
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(0, y - 1, w, 2);
    ctx.fillStyle = '#0044ff';
    ctx.fillRect(0, y + 30, w, 2);

    ctx.restore();
  }

  /* ----------------------------------------------------------
     Interferencia horizontal
     ---------------------------------------------------------- */

  _drawInterference(ctx, w, h) {
    // Franjas de ruido horizontales (probabilísticas)
    if (Math.random() > 0.985) {
      const y = Math.random() * h;
      const height = 1 + Math.random() * 4;
      const shift = (Math.random() - 0.5) * 6; // Desplazamiento horizontal

      ctx.save();
      ctx.globalAlpha = 0.05 + Math.random() * 0.04;
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(shift, y, w, height);
      ctx.restore();
    }

    // Grupo de líneas finas (glitch)
    if (Math.random() > 0.997) {
      const baseY = Math.random() * h;
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#00ff66';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(0, baseY + i * 3, w, 1);
      }
      ctx.restore();
    }

    // Flash sutil de pantalla (muy raro)
    if (Math.random() > 0.998) {
      ctx.save();
      ctx.globalAlpha = 0.02 + Math.random() * 0.015;
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /* ----------------------------------------------------------
     Distorsión de bordes (oscurecimiento pulsante)
     ---------------------------------------------------------- */

  _drawEdgeDistortion(ctx, w, h) {
    // Pulso suave en la intensidad del viñeteado
    const pulse = Math.sin(this._time * 1.2) * 0.008 + 0.008;

    ctx.save();
    ctx.globalAlpha = pulse;

    // Esquinas más oscuras
    const cornerSize = Math.min(w, h) * 0.3;

    // Top-left
    const gTL = ctx.createRadialGradient(0, 0, 0, 0, 0, cornerSize);
    gTL.addColorStop(0, 'rgba(0,0,0,0.6)');
    gTL.addColorStop(1, 'transparent');
    ctx.fillStyle = gTL;
    ctx.fillRect(0, 0, cornerSize, cornerSize);

    // Top-right
    const gTR = ctx.createRadialGradient(w, 0, 0, w, 0, cornerSize);
    gTR.addColorStop(0, 'rgba(0,0,0,0.6)');
    gTR.addColorStop(1, 'transparent');
    ctx.fillStyle = gTR;
    ctx.fillRect(w - cornerSize, 0, cornerSize, cornerSize);

    // Bottom-left
    const gBL = ctx.createRadialGradient(0, h, 0, 0, h, cornerSize);
    gBL.addColorStop(0, 'rgba(0,0,0,0.6)');
    gBL.addColorStop(1, 'transparent');
    ctx.fillStyle = gBL;
    ctx.fillRect(0, h - cornerSize, cornerSize, cornerSize);

    // Bottom-right
    const gBR = ctx.createRadialGradient(w, h, 0, w, h, cornerSize);
    gBR.addColorStop(0, 'rgba(0,0,0,0.6)');
    gBR.addColorStop(1, 'transparent');
    ctx.fillStyle = gBR;
    ctx.fillRect(w - cornerSize, h - cornerSize, cornerSize, cornerSize);

    ctx.restore();
  }

  /* ----------------------------------------------------------
     Micro-flicker aleatorio
     ---------------------------------------------------------- */

  _drawFlicker(ctx, w, h) {
    // Cambiar objetivo de flicker ocasionalmente
    if (Math.random() > 0.97) {
      this._flickerTarget = Math.random() * 0.04;
    }

    // Suavizar la transición
    this._flickerCurrent += (this._flickerTarget - this._flickerCurrent) * 0.15;
    this._flickerTarget *= 0.95; // Decay natural

    if (this._flickerCurrent > 0.003) {
      ctx.save();
      ctx.globalAlpha = this._flickerCurrent;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /* ----------------------------------------------------------
     Limpieza
     ---------------------------------------------------------- */

  destroy() {
    this.stop();
    this.enabled = false;
  }
}
