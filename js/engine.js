/* ============================================================
   RETRO TERMINAL — Motor de navegación
   Lee un JSON de contenido y gestiona el flujo entre nodos.
   ============================================================ */

export class TerminalEngine {
  /**
   * @param {object} options
   * @param {string} options.src           Ruta al fichero JSON de contenido
   * @param {Function} options.onRender    Callback al renderizar un nodo
   * @param {Function} options.onClear     Callback al limpiar la pantalla
   */
  constructor(options = {}) {
    /** Ruta al JSON */
    this.src = options.src || 'data/content.json';
    /** Callbacks */
    this.onRender = options.onRender || (() => {});
    this.onClear = options.onClear || (() => {});
    /** Datos del JSON (nodos, config) */
    this.data = null;
    /** Configuración del JSON */
    this.config = {};
    /** Mapa de nodos: id -> nodo */
    this.nodes = {};
    /** ID del nodo actual */
    this.currentNodeId = null;
    /** Historial de navegación */
    this.history = [];
    /** Estado de variables dinámicas */
    this.variables = {};
  }

  /* ----------------------------------------------------------
     Carga del JSON
     ---------------------------------------------------------- */

  /**
   * Carga el fichero JSON y lo parsea.
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const response = await fetch(this.src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.data = await response.json();
      this.config = this.data.config || {};
      this.nodes = this.data.nodes || this.data;
      this._initializeVariables();
      // Si el JSON no tiene wrapper "nodes", se asume que todo son nodos
      if (!this.data.nodes && !this.data.config) {
        this.nodes = this.data;
        this.config = { startNode: 'start' };
      }
    } catch (err) {
      console.error('[TerminalEngine] Error cargando JSON:', err);
      // Nodo de error como fallback
      this.nodes = {
        error: {
          id: 'error',
          text: [
            'ERROR FATAL DEL SISTEMA',
            '',
            `No se pudo cargar: ${this.src}`,
            err.message,
            '',
            'Contacte con el administrador del sistema.'
          ],
          options: []
        }
      };
      this.config = { startNode: 'error' };
      this.variables = {};
    }
  }

  /* ----------------------------------------------------------
     Navegación
     ---------------------------------------------------------- */

  /**
   * Inicia el motor en el nodo inicial.
   */
  start() {
    const startId = this.config.startNode || 'start';
    this.navigateTo(startId);
  }

  /**
   * Navega a un nodo por su ID.
   * @param {string} nodeId  ID del nodo destino
   */
  async navigateTo(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) {
      console.error(`[TerminalEngine] Nodo no encontrado: "${nodeId}"`);
      return;
    }

    // Guardar en historial
    if (this.currentNodeId) {
      this.history.push(this.currentNodeId);
    }
    this.currentNodeId = nodeId;

    // Limpiar pantalla y esperar a que termine la animación
    await this.onClear();
    // Ahora renderizar el nuevo nodo
    this.onRender(this.resolveNode(node));
  }

  /**
   * Obtiene el nodo actual.
   * @returns {object|null}
   */
  getCurrentNode() {
    return this.nodes[this.currentNodeId] || null;
  }

  /**
   * Selecciona una opción del nodo actual.
   * @param {number} index  Índice de la opción
   * @returns {object|null} La opción seleccionada, o null si no es válida
   */
  selectOption(index) {
    const node = this.nodes[this.currentNodeId];
    if (!node || !node.options || index < 0 || index >= node.options.length) {
      return null;
    }

    const option = node.options[index];

    if (option.action && option.action.variable) {
      this.toggleVariable(option.action.variable);
      this.reloadCurrentNode();
      return option;
    }

    if (option.goto) {
      this.navigateTo(option.goto);
    }
    return option;
  }

  /**
   * Recarga el nodo actual sin alterar historial.
   */
  async reloadCurrentNode() {
    const node = this.nodes[this.currentNodeId];
    if (!node) return;
    await this.onClear();
    this.onRender(this.resolveNode(node));
  }

  /**
   * Vuelve al nodo anterior en el historial.
   * @returns {boolean} true si se pudo volver
   */
  goBack() {
    if (this.history.length === 0) return false;
    const prevId = this.history.pop();
    this.currentNodeId = null; // Evitar doble push en navigateTo
    this.navigateTo(prevId);
    return true;
  }

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */

  /**
   * Normaliza el campo "text" a un array de strings.
   * @param {string|string[]} text
   * @returns {string[]}
   */
  static normalizeText(text) {
    if (Array.isArray(text)) return text;
    if (typeof text === 'string') return text.split('\n');
    return [''];
  }

  /**
   * Inicializa variables dinámicas desde config.variables.
   */
  _initializeVariables() {
    const vars = this.config.variables || {};
    this.variables = {};

    Object.entries(vars).forEach(([name, def]) => {
      if (typeof def === 'boolean') {
        this.variables[name] = {
          type: 'boolean',
          value: def,
          activeText: 'ACTIVA',
          inactiveText: 'INACTIVA',
        };
        return;
      }

      this.variables[name] = {
        type: 'boolean',
        value: Boolean(def.value),
        activeText: def.activeText || 'ACTIVA',
        inactiveText: def.inactiveText || 'INACTIVA',
      };
    });
  }

  /**
   * Devuelve el estado booleano actual de una variable.
   * @param {string} varName
   * @returns {boolean}
   */
  getVariableState(varName) {
    return Boolean(this.variables[varName]?.value);
  }

  /**
   * Alterna el valor booleano de una variable.
   * @param {string} varName
   */
  toggleVariable(varName) {
    const variable = this.variables[varName];
    if (!variable || variable.type !== 'boolean') return;
    variable.value = !Boolean(variable.value);
  }

  /**
   * Resuelve tokens {{variable}} en un string.
   * @param {string} input
   * @returns {string}
   */
  resolveTokens(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g, (match, varName) => {
      const variable = this.variables[varName];
      if (!variable) return match;
      return variable.value ? variable.activeText : variable.inactiveText;
    });
  }

  /**
   * Devuelve una copia del nodo con texto/opciones resueltas.
   * @param {object} node
   * @returns {object}
   */
  resolveNode(node) {
    const textLines = TerminalEngine.normalizeText(node.text).map((line) => this.resolveTokens(line));
    const rawOptions = Array.isArray(node.options) ? node.options : [];

    const options = rawOptions.map((opt) => {
      const resolved = { ...opt };

      if (opt.action && opt.action.variable) {
        const isActive = this.getVariableState(opt.action.variable);
        const actionLabel = isActive ? opt.action.activeText : opt.action.inactiveText;
        resolved.label = this.resolveTokens(actionLabel || opt.label || '');
      } else {
        resolved.label = this.resolveTokens(opt.label || '');
      }

      return resolved;
    });

    return {
      ...node,
      text: textLines,
      options,
    };
  }
}
