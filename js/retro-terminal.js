/* ============================================================
   RETRO TERMINAL — Web Component <retro-terminal>
   Encapsula toda la lógica: motor, audio, renderizado y CRT.
   ============================================================ */

import { TerminalEngine } from './engine.js';
import { TerminalAudio } from './audio.js';
import { CRTEffects } from './crt-effects.js';

class RetroTerminal extends HTMLElement {
  /* ----------------------------------------------------------
     Atributos observados
     ---------------------------------------------------------- */
  static get observedAttributes() {
    return ['src', 'typing-speed', 'crt-effects', 'sound'];
  }

  constructor() {
    super();

    // --- Estado interno ---
    /** Índice de opción seleccionada con teclado */
    this._selectedIndex = -1;
    /** ¿Está el efecto de escritura en curso? */
    this._typing = false;
    /** ID del interval de escritura */
    this._typeTimer = null;
    /** ¿Se ha activado audio? (requiere gesto) */
    this._audioActivated = false;
    /** Referencia a elementos internos */
    this._els = {};
    /** Resolve para skip de escritura */
    this._typeResolve = null;
    /** Nodo actual siendo renderizado */
    this._currentNode = null;
    /** Textos pendientes de la animación */
    this._pendingChars = [];
    /** Índice del carácter actual */
    this._charIndex = 0;

    // --- Módulos ---
    this.engine = null;
    this.audio = new TerminalAudio();
    this.crt = null;
  }

  /* ----------------------------------------------------------
     Lifecycle: connectedCallback
     ---------------------------------------------------------- */
  connectedCallback() {
    // Construir DOM interno
    this._buildDOM();

    // Vincular eventos
    this._bindEvents();

    // Configurar e iniciar el motor
    const src = this.getAttribute('src') || 'data/content.json';
    this.engine = new TerminalEngine({
      src,
      onRender: (node) => this._renderNode(node),
      onClear: () => this._clearScreen(),
    });

    // Iniciar CRT si está habilitado
    if (this.getAttribute('crt-effects') !== 'false') {
      this.crt = new CRTEffects(this._els.canvas);
      this.crt.start();
    }

    // Cargar contenido e iniciar
    this.engine.load().then(() => {
      // Aplicar animación de encendido
      this._els.screen.classList.add('power-on');
      setTimeout(() => {
        this.engine.start();
      }, 700);
    });
  }

  /* ----------------------------------------------------------
     Lifecycle: disconnectedCallback
     ---------------------------------------------------------- */
  disconnectedCallback() {
    this._stopTyping();
    if (this.crt) this.crt.destroy();
    this.audio.destroy();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  /* ----------------------------------------------------------
     Lifecycle: attributeChangedCallback
     ---------------------------------------------------------- */
  attributeChangedCallback(name, oldVal, newVal) {
    // Se podría reaccionar a cambios dinámicos de atributos
  }

  /* ----------------------------------------------------------
     Construcción del DOM interno
     ---------------------------------------------------------- */
  _buildDOM() {
    this.innerHTML = `
      <div class="terminal-screen">
        <div class="terminal-output"></div>
        <div class="vignette"></div>
        <div class="scanlines"></div>
        <canvas class="crt-canvas"></canvas>
      </div>
    `;

    this._els = {
      screen: this.querySelector('.terminal-screen'),
      output: this.querySelector('.terminal-output'),
      canvas: this.querySelector('.crt-canvas'),
    };
  }

  /* ----------------------------------------------------------
     Eventos
     ---------------------------------------------------------- */
  _bindEvents() {
    // Teclado (global para capturar flechas)
    this._onKeyDown = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._onKeyDown);

    // Primer gesto para activar audio
    const activateAudio = () => {
      if (!this._audioActivated) {
        this.audio.init();
        this.audio.startHum();
        this._audioActivated = true;
      }
    };
    this.addEventListener('click', activateAudio, { once: false });
    document.addEventListener('keydown', activateAudio, { once: false });
  }

  /**
   * Manejo de teclas.
   * @param {KeyboardEvent} e
   */
  _handleKey(e) {
    // Si se está escribiendo, Space o Enter saltan la animación
    if (this._typing) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._skipTyping();
      }
      return;
    }

    const options = this._els.output.querySelectorAll('.terminal-option');
    if (options.length === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this._moveSelection(-1, options);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._moveSelection(1, options);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._selectedIndex >= 0) {
          this._confirmSelection();
        }
        break;
    }
  }

  /**
   * Mueve la selección arriba o abajo.
   */
  _moveSelection(dir, options) {
    const len = options.length;
    if (len === 0) return;

    // Desseleccionar anterior
    if (this._selectedIndex >= 0 && this._selectedIndex < len) {
      options[this._selectedIndex].classList.remove('selected');
    }

    // Calcular nuevo índice
    if (this._selectedIndex < 0) {
      this._selectedIndex = dir > 0 ? 0 : len - 1;
    } else {
      this._selectedIndex = (this._selectedIndex + dir + len) % len;
    }

    options[this._selectedIndex].classList.add('selected');
    options[this._selectedIndex].scrollIntoView({ block: 'nearest' });

    // Sonido
    this.audio.playSelect();
  }

  /**
   * Confirma la opción seleccionada.
   */
  _confirmSelection() {
    if (this._selectedIndex < 0) return;
    this.audio.playConfirm();
    const idx = this._selectedIndex;
    this._selectedIndex = -1;
    this.engine.selectOption(idx);
  }

  /* ----------------------------------------------------------
     Renderizado de nodos
     ---------------------------------------------------------- */

  /**
   * Renderiza un nodo: texto + opciones con efecto máquina de escribir.
   * @param {object} node  Nodo del JSON
   */
  async _renderNode(node) {
    this._currentNode = node;
    this._selectedIndex = -1;

    // Sonido del nodo (si tiene)
    if (node.sound) {
      this.audio.play(node.sound);
    }

    const output = this._els.output;
    output.classList.remove('clearing');
    output.classList.add('appearing');
    setTimeout(() => output.classList.remove('appearing'), 200);

    // Normalizar texto
    const lines = TerminalEngine.normalizeText(node.text);

    // Velocidad de escritura
    const speed = parseInt(this.getAttribute('typing-speed'))
      || this.engine.config.typingSpeed
      || 18;

    const soundInterval = this.engine.config.typingSoundInterval || 2;

    // Escribir texto línea a línea con efecto de máquina de escribir
    await this._typeLines(lines, speed, soundInterval);

    // Mostrar opciones
    if (node.options && node.options.length > 0) {
      await this._showOptions(node.options, speed);
    }

    // Auto-avance (si existe)
    if (node.autoAdvance) {
      const delay = node.autoAdvanceDelay || 2000;
      setTimeout(() => {
        if (this._currentNode === node) {
          this.engine.navigateTo(node.autoAdvance);
        }
      }, delay);
    }

    // Scroll al final
    this._scrollToBottom();
  }

  /**
   * Escribe líneas con efecto de máquina de escribir.
   * @param {string[]} lines       Líneas de texto
   * @param {number}   speed       ms entre caracteres
   * @param {number}   soundEvery  Emitir sonido cada N caracteres
   * @returns {Promise<void>}
   */
  _typeLines(lines, speed, soundEvery) {
    return new Promise((resolve) => {
      this._typeResolve = resolve;
      this._typing = true;

      const output = this._els.output;
      const fullText = lines.join('\n');
      let charIdx = 0;

      // Crear contenedor de texto
      const textEl = document.createElement('div');
      textEl.className = 'terminal-text';
      output.appendChild(textEl);

      // Cursor
      const cursorEl = document.createElement('span');
      cursorEl.className = 'terminal-cursor';
      cursorEl.textContent = this.engine.config.cursorChar || '█';

      const tick = () => {
        if (charIdx < fullText.length) {
          const char = fullText[charIdx];

          // Añadir carácter
          textEl.textContent = fullText.substring(0, charIdx + 1);
          textEl.appendChild(cursorEl);

          // Sonido de tecleo
          if (charIdx % soundEvery === 0 && char !== ' ' && char !== '\n') {
            this.audio.playTyping();
          }

          charIdx++;
          this._scrollToBottom();
          this._typeTimer = setTimeout(tick, char === '\n' ? speed * 2 : speed);
        } else {
          // Finalizado
          cursorEl.remove();
          this._typing = false;
          this._typeTimer = null;
          resolve();
        }
      };

      tick();
    });
  }

  /**
   * Salta la animación de escritura mostrando todo el texto de golpe.
   */
  _skipTyping() {
    if (!this._typing) return;

    // Detener timer
    if (this._typeTimer) {
      clearTimeout(this._typeTimer);
      this._typeTimer = null;
    }

    // Mostrar todo el texto del nodo actual
    const node = this._currentNode;
    if (!node) return;

    const output = this._els.output;
    output.innerHTML = '';

    // Texto completo
    const lines = TerminalEngine.normalizeText(node.text);
    const textEl = document.createElement('div');
    textEl.className = 'terminal-text';
    textEl.textContent = lines.join('\n');
    output.appendChild(textEl);

    this._typing = false;

    // Mostrar opciones inmediatamente
    if (node.options && node.options.length > 0) {
      this._showOptionsImmediate(node.options);
    }

    // Auto-avance
    if (node.autoAdvance) {
      const delay = node.autoAdvanceDelay || 2000;
      setTimeout(() => {
        if (this._currentNode === node) {
          this.engine.navigateTo(node.autoAdvance);
        }
      }, delay);
    }

    this._scrollToBottom();

    if (this._typeResolve) {
      this._typeResolve();
      this._typeResolve = null;
    }
  }

  /**
   * Muestra las opciones con efecto de escritura.
   * @param {object[]} options  Array de opciones
   * @param {number}   speed   ms entre caracteres
   * @returns {Promise<void>}
   */
  async _showOptions(options, speed) {
    const output = this._els.output;
    const prefix = this.engine.config.promptPrefix || '> ';

    const listEl = document.createElement('ul');
    listEl.className = 'terminal-options';
    output.appendChild(listEl);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const li = document.createElement('li');
      li.className = 'terminal-option';
      li.dataset.index = i;
      li.setAttribute('tabindex', '0');
      li.setAttribute('role', 'button');

      // Efecto de escritura para cada opción (más rápido)
      const full = `${prefix}${opt.label}`;
      await this._typeOption(li, full, Math.max(speed * 0.6, 8));

      // Evento de clic
      li.addEventListener('click', () => {
        this._selectedIndex = i;
        // Resaltar
        listEl.querySelectorAll('.terminal-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this.audio.playConfirm();
        // Pequeño retardo visual antes de navegar
        setTimeout(() => {
          this._selectedIndex = -1;
          this.engine.selectOption(i);
        }, 150);
      });

      // Hover
      li.addEventListener('mouseenter', () => {
        listEl.querySelectorAll('.terminal-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this._selectedIndex = i;
      });

      listEl.appendChild(li);
    }

    // Cursor parpadeante al final
    const cursorEl = document.createElement('span');
    cursorEl.className = 'terminal-cursor';
    cursorEl.textContent = this.engine.config.cursorChar || '█';

    const cursorLine = document.createElement('div');
    cursorLine.className = 'terminal-line';
    cursorLine.style.marginTop = '0.5em';
    cursorLine.appendChild(cursorEl);
    output.appendChild(cursorLine);

    this._scrollToBottom();
  }

  /**
   * Escribe una opción carácter a carácter.
   * @param {HTMLElement} el    Elemento donde escribir
   * @param {string}      text  Texto completo
   * @param {number}      speed ms entre caracteres
   * @returns {Promise<void>}
   */
  _typeOption(el, text, speed) {
    return new Promise((resolve) => {
      let i = 0;
      const prefix = this.engine.config.promptPrefix || '> ';
      const prefixLen = prefix.length;

      const tick = () => {
        if (this._typing === false && i === 0) {
          // Se ha saltado la escritura, mostrar completo
          el.innerHTML = `<span class="terminal-option-prefix">${this._escapeHTML(prefix)}</span>${this._escapeHTML(text.substring(prefixLen))}`;
          resolve();
          return;
        }

        if (i < text.length) {
          if (i < prefixLen) {
            // Escribiendo el prefijo
            el.innerHTML = `<span class="terminal-option-prefix">${this._escapeHTML(text.substring(0, i + 1))}</span>`;
          } else {
            el.innerHTML = `<span class="terminal-option-prefix">${this._escapeHTML(prefix)}</span>${this._escapeHTML(text.substring(prefixLen, i + 1))}`;
          }
          i++;
          this._typeTimer = setTimeout(tick, speed);
        } else {
          resolve();
        }
      };

      tick();
    });
  }

  /**
   * Muestra todas las opciones de golpe (tras skip).
   * @param {object[]} options
   */
  _showOptionsImmediate(options) {
    const output = this._els.output;
    const prefix = this.engine.config.promptPrefix || '> ';

    const listEl = document.createElement('ul');
    listEl.className = 'terminal-options';
    output.appendChild(listEl);

    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'terminal-option';
      li.dataset.index = i;
      li.setAttribute('tabindex', '0');
      li.setAttribute('role', 'button');
      li.innerHTML = `<span class="terminal-option-prefix">${this._escapeHTML(prefix)}</span>${this._escapeHTML(opt.label)}`;

      li.addEventListener('click', () => {
        this._selectedIndex = i;
        listEl.querySelectorAll('.terminal-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this.audio.playConfirm();
        setTimeout(() => {
          this._selectedIndex = -1;
          this.engine.selectOption(i);
        }, 150);
      });

      li.addEventListener('mouseenter', () => {
        listEl.querySelectorAll('.terminal-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this._selectedIndex = i;
      });

      listEl.appendChild(li);
    });

    // Cursor
    const cursorEl = document.createElement('span');
    cursorEl.className = 'terminal-cursor';
    cursorEl.textContent = this.engine.config.cursorChar || '█';

    const cursorLine = document.createElement('div');
    cursorLine.className = 'terminal-line';
    cursorLine.style.marginTop = '0.5em';
    cursorLine.appendChild(cursorEl);
    output.appendChild(cursorLine);
  }

  /* ----------------------------------------------------------
     Limpieza de pantalla
     ---------------------------------------------------------- */

  /**
   * Limpia la pantalla con una pequeña animación.
   */
  _clearScreen() {
    return new Promise((resolve) => {
      this._stopTyping();
      const output = this._els.output;

      output.classList.add('clearing');
      setTimeout(() => {
        output.innerHTML = '';
        output.classList.remove('clearing');
        resolve();
      }, 250);
    });
  }

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */

  /**
   * Detiene cualquier animación de escritura en curso.
   */
  _stopTyping() {
    if (this._typeTimer) {
      clearTimeout(this._typeTimer);
      this._typeTimer = null;
    }
    this._typing = false;
  }

  /**
   * Hace scroll al final del contenido.
   */
  _scrollToBottom() {
    const output = this._els.output;
    requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
    });
  }

  /**
   * Escapa HTML para prevenir inyección.
   * @param {string} str
   * @returns {string}
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/* ----------------------------------------------------------
   Registro del Web Component
   ---------------------------------------------------------- */
customElements.define('retro-terminal', RetroTerminal);
