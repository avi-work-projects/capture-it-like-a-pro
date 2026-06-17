# Capture it like a pro — guía del proyecto

PWA móvil (HTML/CSS/JS sin framework, sin build) desplegada en GitHub Pages.
Archivos: `index.html` + `css/styles.css` + `js/data.js` (datos/helpers globales) +
`js/app.js` (UI, IIFE) + `js/calendar.js` (`window.Calendar`). `mapa-editor/` es de
OTRA sesión: no tocarlo ni incluirlo en commits. Usar `git add` selectivo.

## PATRÓN "chrome fijo" (sticky headers) — OBLIGATORIO en vistas con scroll

**Regla:** en cualquier vista con scroll vertical, los bloques ESTRUCTURALES se
quedan anclados (fijos) arriba formando un bloque contiguo y opaco; **solo el
contenido de la pestaña/sub-pestaña hace scroll**, deslizándose POR DETRÁS de
esos bloques. Al soltar, rebote elástico (ya implementado en `addRubberBand`).

Son "estructurales" y por tanto NO se mueven con el scroll:
- **Título** de la vista (1er nivel; p. ej. cabecera "Encuentra tu pista", `.v2-head`).
- **Pestañas** (1er nivel; p. ej. `#evModeTabs`: Próximos/Calendario/Horarios).
- **Subtítulo** (2º nivel; p. ej. el nombre de la sala "Azúcar", `.sala-head`;
  o el nombre del camarógrafo "Marta Gil · Sevilla" en el perfil).
- **Sub-pestañas** (2º nivel; p. ej. `#salaTabs` Horario semanal/Próximos días,
  `#calSubTabs` Calendario/Agenda, `#profTabs` Próximos eventos/Reseñas).

Solo hace scroll el contenido más interno (las filas de días, las reseñas, la
lista de eventos…), que se esconde detrás del bloque fijo.

### Cómo se implementa (en `js/app.js`)
- `pinBelow(baseTop, els)`: apila una lista de elementos como sticky, cada uno con
  `top` = altura acumulada de los anteriores (mide alturas variables por JS;
  **mide TODAS las alturas ANTES de mutar estilos**, si no salen 0). Pone `.pinned`,
  `position:sticky`, `top` y `z-index` decreciente (los de arriba, por encima).
- `restickView2()` / `restickProfile()`: recogen, según el modo/estado actual, los
  elementos estructurales presentes y llaman a `pinBelow`. Se invocan:
  - tras CADA render del contenido (`renderHorariosMode`, `renderCalMode`, `setEvMode`,
    `openProfile`) con un `setTimeout(…, 60)` (deja asentar el layout — en el preview
    medir alturas justo tras cambiar el DOM da 0),
  - y en CADA evento `scroll` de la vista (mantiene el anclado correcto y se
    autocorrige; OJO: el handler de scroll debe re-anclar en CUALQUIER estado,
    colapsado o no).
- CSS: cada bloque fijo debe ser **opaco** (`background:var(--bg)`) y llevar
  `.pinned{box-shadow:0 -18px 0 var(--bg)}` para tapar micro-huecos al apilarse
  (si no, se ve pasar el texto por detrás).
- El contenedor con scroll (`.view` / `#view2`) NO debe tener ancestros intermedios
  con `overflow` distinto de `visible` entre el sticky y el scroller (p. ej.
  `#result.open{overflow:visible}`), o el sticky se ancla al contenedor equivocado.

### Espacio de scroll (para que el efecto exista aunque haya poco contenido)
Si una pestaña tiene poco contenido, igualmente debe poder hacerse scroll para
esconderlo tras el bloque fijo: dar `min-height` al contenedor de la pestaña
(p. ej. `#modeHorarios{min-height:125vh}`). Excepción: el calendario de mes debe
"caber" sin scroll, así que `#modeCal` usa un `min-height` menor (82vh).

## Otros gotchas
- La transición de `max-height` NO "tickea" en el preview headless: las medidas de
  altura mienten a mitad de transición (medir con `transition:none`); en navegador
  real va fluida. Por eso `#result.open` usa `max-height:none` (no recorta nunca).
- No transicionar custom properties registradas con `@property` (se congelan):
  fundir por-propiedad.
- Cache-busting `?v=Date.now()` (document.write) en los includes — TEMPORAL dev.
- Verificar siempre en el preview con sondas (`preview_eval`); las capturas dan timeout.

## Despliegue
`git add` (solo archivos propios) → commit (co-author) → push → esperar build de
Pages y confirmar HTTP 200 en https://avi-work-projects.github.io/capture-it-like-a-pro/
