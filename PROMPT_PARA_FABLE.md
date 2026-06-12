# Prompt para Claude Fable

Copia el bloque de código de abajo y pégalo en una sesión nueva de
Claude Fable. Antes de mandar, sustituye `[FUENTE_AQUÍ]` por la
tipografía que quieres (Google Fonts o cualquier CDN).

> Lee primero `PROYECTO.md` si necesitas más contexto del producto.
> Pero el prompt es autosuficiente.

---

```
Eres Claude Fable diseñando UI. Genera UN SOLO archivo .html autónomo
con las dos primeras vistas de una PWA móvil llamada "Capture it like
a pro".

═══════════════════════════════════════════════════════════════════════════
RESTRICCIONES TÉCNICAS
═══════════════════════════════════════════════════════════════════════════
  • UN archivo .html. CSS y JS inline. Sin frameworks. Sin imágenes
    externas (solo emojis o SVG inline).
  • Mobile-first 390×844. En desktop centrado con max-width, sin
    estirar a pantalla completa.
  • Que abra haciendo doble clic, sin servidor.
  • Idioma de la UI: español.
  • Tipografía: [FUENTE_AQUÍ] vía Google Fonts (o link CDN si no está en
    Google Fonts). Úsala con criterio para titulares y cuerpo, jugando
    con pesos y tamaños.

═══════════════════════════════════════════════════════════════════════════
ESTÉTICA
═══════════════════════════════════════════════════════════════════════════
  • SIMPLE, rápida, multi-opción, interactiva. Nada de temática pesada
    ni recargada.
  • Predominan NEGRO y BLANCO. Un único color de acento llamativo
    (tú eliges cuál — verde lima, naranja eléctrico, magenta, etc. —
    úsalo con mesura, solo para llamar la atención en la selección
    activa y micro-detalles).
  • Generoso uso de espacio en blanco/negro. Jerarquía clara.
  • Buenas micro-interacciones (hover/tap states, transiciones suaves
    entre vistas). No exageres con efectos pirotécnicos, busca
    elegancia funcional.

═══════════════════════════════════════════════════════════════════════════
LAS DOS VISTAS
═══════════════════════════════════════════════════════════════════════════

VISTA 1 — Selección de rol
  Titular grande con el nombre de la app o un slogan.
  Pregunta: "¿Cómo entras?"
  Dos opciones tappables grandes (cards mitad de pantalla cada una):
    🎥  CAMARÓGRAFO   — "Soy quien graba"
    💃  BAILARÍN      — "Vengo a bailar"
  Tap → transición animada a VISTA 2. Ambas rutas llevan a la misma
  VISTA 2; el rol se recordará para usarlo más adelante.

VISTA 2 — Filtros de eventos en cascada
  La misma pantalla muestra los pasos secuencialmente, apareciendo
  conforme se contestan.

  PASO A — País
    Botones: 🇪🇸 España  |  🇵🇱 Polonia
    • España → desplegar PASO B.
    • Polonia → mensaje sutil "Aún no hay eventos en Polonia 🇵🇱"
      + botón "Volver".

  PASO B — Ciudad (solo si España)
    "¿Qué ciudad?"
    Opciones: Todas · Madrid · Sevilla · Barcelona
    Selección → desplegar PASO C.

  PASO C — Tipo de evento
    "¿Qué tipo?"
    Opciones con icono:
      🏠  Salas de baile
      🎪  Congresos
      🌅  Al exterior  (terrazas, playa, parque)
    Selección → mensaje "Buscando eventos…" con un loader simple
    y un placeholder "Próximamente: aquí saldría la lista".

  Cada paso ya contestado queda visible arriba como "breadcrumb"
  pulsable: tap en uno retrocede al estado anterior, plegando los
  pasos posteriores.

═══════════════════════════════════════════════════════════════════════════
DINAMISMO DESEABLE (CSS funcional, no descrito)
═══════════════════════════════════════════════════════════════════════════
  • Entradas de elementos con stagger pequeño (≈80ms entre uno y otro).
  • Hover/tap en cards: glow del color de acento + scale 1.02, sin
    desplazar el contenido.
  • Transición VISTA 1 → VISTA 2: las cards salen rápido (slide o fade)
    y la VISTA 2 entra desde abajo.
  • PASO B aparece tras seleccionar A con expand-down (max-height +
    opacity, stagger en botones internos). Idem para PASO C.
  • Selección activa: borde luminoso del color de acento + check sutil.
  • Breadcrumb: chips que entran por la izquierda. Al pulsar uno,
    secuencia inversa de plegado.
  • Polonia: shake horizontal sutil del botón "Volver" al renderizar.

═══════════════════════════════════════════════════════════════════════════
ENTREGABLE
═══════════════════════════════════════════════════════════════════════════
Un único bloque de código HTML completo, listo para guardar como
index.html y abrir.
Al final del bloque, 5-8 líneas de comentarios diciendo qué decisiones
de diseño tomaste (color de acento elegido y por qué, pesos de tipografía
usados, intensidad del glow) para que sea fácil retocarlo.

No envuelvas el código en explicaciones largas — solo lo justo para que
sepa qué tocar.
```

---

## Tras recibir la respuesta

1. Guarda el HTML que te devuelva como `index.html` en esta carpeta
   (`capture-it-like-a-pro/`).
2. Doble click → ábrelo en Edge.
3. Itera con Fable si quieres ajustes (glow, fuente, color).
4. Cuando te guste, **pásamelo a mí** (en este chat de Claude Code en la
   carpeta `bachata-detector`) y lo integro en la app real conservando
   toda la lógica del detector.
