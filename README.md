```
██╗   ██╗███████╗██████╗ ███╗   ███╗ ██████╗ 
╚██╗ ██╔╝██╔════╝██╔══██╗████╗ ████║██╔═══██╗
 ╚████╔╝ █████╗  ██████╔╝██╔████╔██║██║   ██║
  ╚██╔╝  ██╔══╝  ██╔══██╗██║╚██╔╝██║██║   ██║
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╔╝
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ 
```

# YERMO — Terminal Retro CRT

> _Interfaz web que simula un terminal monocromo de fósforo verde sobre monitor CRT._
> _Todo el contenido se define en ficheros JSON. El código HTML/CSS/JS actúa como motor genérico._

---

## ▸ Descripción

**Yermo** es una aplicación web estática que recrea la experiencia de usar un terminal de ordenador de los años 80: pantalla de fósforo verde, scanlines, flicker, phosphor decay, sonidos procedurales y música de fondo.

Todo el contenido navegable (textos, menús, opciones, arte ASCII) se define en un fichero `JSON` con un patrón de nodos y opciones, convirtiendo el motor en una herramienta reutilizable para cualquier narrativa o interfaz.

---

## ▸ Características

```
[■] Web Component <retro-terminal> autónomo
[■] Motor de navegación JSON (nodos + opciones)
[■] Efecto máquina de escribir con skip (Space/Enter)
[■] Navegación con teclado (↑↓ + Enter) y ratón
[■] Sonidos procedurales — Web Audio API, sin ficheros
[■] Música de fondo desde playlist JSON (URLs remotas)
[■] Efectos CRT: scanlines, flicker, phosphor decay
[■] Efectos canvas: interferencia, micro-flicker
[■] Animación de encendido (power-on)
[■] Fira Code — soporte completo Unicode/box-drawing
[■] Diseño responsive
[■] Sin dependencias, sin frameworks, sin build
```

---

## ▸ Estructura del proyecto

```
yermoApp/
├── index.html              Punto de entrada
├── server.ps1              Servidor HTTP local (PowerShell)
├── css/
│   └── terminal.css        Estilos CRT, animaciones, layout
├── js/
│   ├── retro-terminal.js   Web Component principal
│   ├── engine.js           Motor de navegación JSON
│   ├── audio.js            Sonidos procedurales + música
│   └── crt-effects.js      Efectos canvas (interferencia, flicker)
└── data/
    ├── content.json        Contenido navegable (nodos)
    └── playlist.json       Playlist de música de fondo
```

---

## ▸ Instalación y uso

No requiere instalación, build ni dependencias. Solo un servidor HTTP local.

### Opción 1 — PowerShell (incluido)

```powershell
cd yermoApp
powershell -ExecutionPolicy Bypass -File server.ps1
# Abrir http://localhost:8080/
```

### Opción 2 — Python

```bash
cd yermoApp
python -m http.server 8080
```

### Opción 3 — Node.js

```bash
cd yermoApp
npx serve -p 8080
```

### Opción 4 — VS Code

Instalar la extensión **Live Server** y abrir `index.html`.

---

## ▸ Configuración del componente

El terminal se inserta como un Web Component en el HTML:

```html
<retro-terminal
  src="data/content.json"
  typing-speed="18"
  crt-effects="true"
></retro-terminal>
```

| Atributo | Tipo | Default | Descripción |
|---|---|---|---|
| `src` | `string` | `data/content.json` | Ruta al JSON de contenido |
| `typing-speed` | `number` | `18` | Milisegundos entre caracteres |
| `crt-effects` | `boolean` | `true` | Activar efectos canvas CRT |

---

## ▸ Patrón de datos JSON — `content.json`

El fichero JSON es el corazón de la aplicación. Define **qué se muestra** y **cómo se navega**. El motor lo interpreta sin conocer el contenido.

### Estructura general

```json
{
  "config": { ... },
  "nodes": {
    "id_del_nodo": { ... },
    "otro_nodo": { ... }
  }
}
```

### Bloque `config`

Parámetros globales del terminal.

```json
{
  "config": {
    "startNode": "boot",
    "typingSpeed": 18,
    "typingSoundInterval": 2,
    "variables": {
      "door_sector_a": {
        "type": "boolean",
        "value": false,
        "activeText": "ABIERTA",
        "inactiveText": "CERRADA"
      }
    },
    "cursorChar": "█",
    "promptPrefix": "> ",
    "title": "YERMO SYSTEMS v2.41"
  }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `startNode` | `string` | ID del nodo inicial al arrancar |
| `typingSpeed` | `number` | ms entre caracteres (sobreescribible por atributo HTML) |
| `typingSoundInterval` | `number` | Emitir sonido de tecleo cada N caracteres |
| `variables` | `object` | Estado dinámico global (booleanos y sus textos activo/inactivo) |
| `cursorChar` | `string` | Carácter del cursor parpadeante |
| `promptPrefix` | `string` | Prefijo visual de cada opción de menú |
| `title` | `string` | Título del terminal (uso interno) |

#### Variables y tokens en texto

Puedes usar tokens en cualquier línea de `text` con el formato `{{nombre_variable}}`.
El motor sustituye el token por `activeText` o `inactiveText` según el estado booleano actual.

### Bloque `nodes`

Cada nodo es una **pantalla** del terminal. Un objeto con los siguientes campos:

```json
{
  "mi_nodo": {
    "id": "mi_nodo",
    "text": [
      "Línea 1 de texto",
      "Línea 2 de texto",
      "",
      "Línea con ║ caracteres ║ especiales ║"
    ],
    "sound": "confirm",
    "options": [
      {
        "action": {
          "variable": "door_sector_a",
          "activeText": "Cerrar puerta Sector A",
          "inactiveText": "Abrir puerta Sector A"
        }
      },
      { "label": "Ir a otro sitio", "goto": "otro_nodo" },
      { "label": "Volver", "goto": "boot" }
    ],
    "autoAdvance": "siguiente_nodo",
    "autoAdvanceDelay": 3000
  }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `string` | ✅ | Identificador único del nodo |
| `text` | `string[]` | ✅ | Líneas de texto (se muestran con efecto typewriter) |
| `options` | `array` | — | Opciones de menú navegables |
| `options[].label` | `string` | — | Texto visible de la opción (para navegación tradicional) |
| `options[].goto` | `string` | — | ID del nodo destino al seleccionar |
| `options[].action` | `object` | — | Acción local que alterna una variable y recarga el nodo |
| `options[].action.variable` | `string` | ✅* | Nombre de variable booleana asociada |
| `options[].action.activeText` | `string` | ✅* | Texto del botón cuando la variable está activa |
| `options[].action.inactiveText` | `string` | ✅* | Texto del botón cuando la variable está inactiva |
| `sound` | `string` | — | Sonido al entrar: `boot`, `confirm`, `error`, `select` |
| `autoAdvance` | `string` | — | ID del nodo al que avanzar automáticamente |
| `autoAdvanceDelay` | `number` | — | ms antes del auto-avance (default: 2000) |

\* Obligatorio cuando se usa `options[].action`.

### Flujo de navegación

```
                    ┌──────────┐
                    │   boot   │  ← startNode
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌───────┐
        │logs_menu │ │ comms  │ │ about │
        └────┬─────┘ └────────┘ └───────┘
             │
      ┌──────┼──────┐
      ▼      ▼      ▼
  ┌────────┐    ┌────────┐
  │activity│    │ error  │
  │  _log  │    │  _log  │
  └────────┘    └────────┘
```

Cada nodo puede enlazar a cualquier otro nodo por su `id`. No hay restricciones de estructura — puede ser un árbol, un grafo cíclico, o una historia lineal.

### Ejemplo: nodo con arte ASCII

```json
{
  "pantalla_titulo": {
    "id": "pantalla_titulo",
    "text": [
      "╔══════════════════════════════════╗",
      "║     MI APLICACIÓN RETRO         ║",
      "╚══════════════════════════════════╝",
      "",
      "Bienvenido al sistema."
    ],
    "options": [
      { "label": "Entrar", "goto": "menu_principal" }
    ]
  }
}
```

> **Tip:** Usa caracteres Unicode box-drawing (`╔═╗║╚╝─│┌┐└┘├┤┬┴┼`) y
> bloques (`█▓▒░`) para crear marcos y arte ASCII. La fuente Fira Code
> los soporta todos.

### Ejemplo: auto-avance (sin opciones)

```json
{
  "cargando": {
    "id": "cargando",
    "text": [
      "Conectando con el servidor remoto...",
      "Estableciendo canal seguro...",
      "Conexión establecida."
    ],
    "autoAdvance": "panel_principal",
    "autoAdvanceDelay": 3000
  }
}
```

El nodo se muestra, espera 3 segundos y salta automáticamente a `panel_principal`.

---

## ▸ Playlist de música — `playlist.json`

La música de fondo se carga desde un fichero JSON independiente. Al iniciar, se elige una pista aleatoria. Cuando termina, se elige otra distinta automáticamente.

### Estructura

```json
{
  "volume": 0.70,
  "tracks": [
    "https://ejemplo.com/pista1.mp3",
    "https://ejemplo.com/pista2.mp3",
    "https://ejemplo.com/pista3.mp3"
  ]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `volume` | `number` | Volumen de la música (0.0 – 1.0), relativo al volumen maestro |
| `tracks` | `string[]` | URLs de las pistas de audio (remotas o locales) |

### Comportamiento

```
1. El usuario hace clic o pulsa una tecla (gesto requerido por el navegador)
2. Se carga playlist.json
3. Se elige una pista aleatoria del array tracks[]
4. Se reproduce
5. Al terminar → se elige otra pista aleatoria (sin repetir la anterior)
6. Si una URL falla → se salta a otra tras 1 segundo
7. El botón SND en pantalla permite pausar/reanudar
```

> **Nota:** Las URLs remotas deben permitir CORS o ser del mismo origen.
> Archive.org funciona bien para música de dominio público.

---

## ▸ Sonidos procedurales

Todos los efectos de sonido se generan en tiempo real con **Web Audio API**. No hay ficheros de audio para los efectos.

```
typing   → Ráfaga de ruido filtrado (12ms, lowpass 2kHz)
select   → Blip sinusoidal ascendente (800→1200 Hz)
confirm  → Doble tono ascendente (900 Hz + 1350 Hz)
error    → Sawtooth descendente (400→120 Hz)
boot     → Barrido sinusoidal + ráfaga de ruido
hum      → Oscilador sinusoidal 60 Hz continuo (zumbido de monitor)
```

---

## ▸ Efectos CRT

La simulación CRT usa tres capas complementarias:

| Capa | Tecnología | Efectos |
|---|---|---|
| **CSS** | Animaciones + pseudo-elementos | Scanlines, flicker orgánico, phosphor decay, power-on |
| **Canvas** | `requestAnimationFrame` | Interferencia horizontal, micro-flicker, aberración de bordes |

---

## ▸ Personalización rápida

### Cambiar colores (verde → ámbar)

En `css/terminal.css`, modifica las variables `:root`:

```css
--term-fg: #ffb000;         /* Ámbar */
--term-fg-dim: #cc8e00;
--term-fg-bright: #ffd966;
--term-glow: rgba(255, 176, 0, 0.45);
--term-glow-strong: rgba(255, 176, 0, 0.7);
```

### Cambiar velocidad de escritura

En el atributo del componente:

```html
<retro-terminal typing-speed="30"></retro-terminal>
```

O en `data/content.json`:

```json
{ "config": { "typingSpeed": 30 } }
```

### Desactivar efectos CRT

```html
<retro-terminal crt-effects="false"></retro-terminal>
```

---

## ▸ Tecnologías

```
HTML5 ─── Estructura semántica
CSS3 ──── Variables y animaciones
JS ES ─── Módulos nativos, Web Components, Web Audio API, Canvas 2D
```

Sin dependencias. Sin frameworks. Sin transpilación. Sin build.

---

## ▸ Compatibilidad

```
Chrome  90+  ✅
Firefox 90+  ✅
Edge    90+  ✅
Safari  15+  ✅
```

Requiere soporte de ES Modules, Web Components v1 y Web Audio API.

---

## ▸ Licencia

MIT

---

```
> SISTEMA APAGÁNDOSE...
> FIN DE TRANSMISIÓN
> _
```
