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
  navigateTo(nodeId) {
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

    // Notificar al componente
    this.onClear();
    this.onRender(node);
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
    const node = this.getCurrentNode();
    if (!node || !node.options || index < 0 || index >= node.options.length) {
      return null;
    }
    const option = node.options[index];
    if (option.goto) {
      this.navigateTo(option.goto);
    }
    return option;
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
}
