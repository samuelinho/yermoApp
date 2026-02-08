/* ============================================================
   RETRO TERMINAL — Efectos CRT avanzados (canvas)
   Curvatura, ghosting y distorsión ligera.
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
    this._ghostFrames = [];
    this._maxGhosts = 3;
    this._time = 0;
  }

  /* ----------------------------------------------------------
     Inicialización y tamaño
     ---------------------------------------------------------- */

  /**
   * Ajusta el canvas al tamaño del contenedor.
   */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  /**
   * Inicia el bucle de renderizado.
   */
  start() {
    if (!this.enabled) return;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._loop();
  }

  /**
   * Detiene el bucle de renderizado.
   */
  stop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  /* ----------------------------------------------------------
     Bucle de renderizado
     ---------------------------------------------------------- */

  _loop() {
    this._animFrame = requestAnimationFrame(() => this._loop());
    this._time += 0.016; // ~60fps
    this._render();
  }

  _render() {
    const { ctx2d: ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // --- Efecto de aberración cromática muy sutil ---
    this._drawAberration(ctx, w, h);

    // --- Línea de interferencia horizontal ocasional ---
    this._drawInterference(ctx, w, h);
  }

  /* ----------------------------------------------------------
     Aberración cromática
     ---------------------------------------------------------- */

  _drawAberration(ctx, w, h) {
    // Líneas horizontales muy finas con ligero desplazamiento de color
    const y = (Math.sin(this._time * 0.7) * 0.5 + 0.5) * h;
    const spread = 30;

    ctx.save();
    ctx.globalAlpha = 0.02;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, y - spread, w, 1);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, y + spread, w, 1);
    ctx.restore();
  }

  /* ----------------------------------------------------------
     Interferencia horizontal
     ---------------------------------------------------------- */

  _drawInterference(ctx, w, h) {
    // Ocasionalmente dibuja una franja horizontal de ruido
    if (Math.random() > 0.993) {
      const y = Math.random() * h;
      const height = 1 + Math.random() * 3;

      ctx.save();
      ctx.globalAlpha = 0.04 + Math.random() * 0.03;
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(0, y, w, height);
      ctx.restore();
    }

    // Muy raro: flash sutil de pantalla
    if (Math.random() > 0.999) {
      ctx.save();
      ctx.globalAlpha = 0.015;
      ctx.fillStyle = '#00ff66';
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
