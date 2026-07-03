---
name: mapa-provincia
description: Cómo generar y cablear el mapa de eventos de una provincia/comunidad nueva (o regenerar el de Madrid) en Capture it like a pro. Usar cuando el usuario pida "mapa de X provincia", añadir cobertura de mapa, retocar contornos/proyección, o geocodificar locales.
---

# Mapa de eventos por provincia — pipeline completo

El mapa de la app (`viewMap`) usa contornos geográficos REALES pre-generados en
`js/map-geo.js` (`window.MAP_GEO`), sin dependencias ni red en runtime. Este
skill documenta cómo generar la geometría de una provincia nueva y cablearla.

## 1. Generar la geometría — `tools/build_map.py`

- **Fuente**: opendatasoft `georef-spain-provincia` y `georef-spain-municipio`
  (datos IGN, abiertos). Export GeoJSON con `where` (API v2.1
  `/exports/geojson?where=...`).
- **GOTCHA tildes**: el `where` con tildes FALLA silencioso (Ávila devolvía 0
  features). Filtrar esas por código: `prov_code='05'` (Ávila). Códigos = código
  provincial INE de 2 dígitos. Municipios: `mun_code='28079'` (Madrid capital,
  INE de 5 dígitos). Normalizar nombres con `unicodedata.normalize('NFC', ...)`
  al leer (el dataset trae acentos descompuestos NFD).
- **Pipeline por figura**: anillo exterior más grande (`biggest`) → proyección →
  **Douglas-Peucker** (tolerancia en unidades de viewBox: 0.45 figura principal,
  0.7 vecinas) → **suavizado Chaikin** (2 iteraciones principal, 1 vecinas).
  SIN Chaikin el borde queda anguloso con picos de mitra "tipo rayo" — se ve
  fatal al ampliar. Con él, ~650 pts para Madrid ≈ 10 KB, perfecto.
- **Proyección**: equirrectangular centrada en la figura
  (`x = 50+(lon−lon0)·coslat·k`, `y = 50−(lat−lat0)·k`), ajustada para que la
  figura ocupe [12..88] del viewBox 0..100. `make_proj(ring)` la calcula.
- **Dos escenas por provincia**: `region` (provincia + vecinas de contexto con
  sus etiquetas) y `city` (municipio capital "a pelo", solo contorno — el
  usuario NO quiere metro/M-30/adornos).
- Ejecutar: `python tools/build_map.py` (autodescarga y cachea los GeoJSON en
  `tools/*.geojson`, ignorados por git). Regenera `js/map-geo.js` entero.

## 2. Estructura de `window.MAP_GEO`

```js
{ madrid: 'M…Z',                 // path escena region (figura principal)
  provs: { segovia:'M…Z', … },   // vecinas (escena region)
  proj:  {lon0,lat0,coslat,k},   // proyección escena region
  city:  { d:'M…Z', proj:{…} },  // municipio capital + su proyección
  cities:{ mad:[-3.7038,40.4168], … } }  // centros de ciudad lon/lat CRUDOS
```
Para varias provincias, la evolución prevista es anidar por clave de provincia.

## 3. Cableado en `js/app.js` (bloque "MAPA DE EVENTOS")

- `MAP_SCENE.region/.city`: SVG estático por escena (marco + clipPath rx=11,
  fondo `.map-bg`, vecinas `.map-neigh`, figura `.map-madrid`, etiquetas
  `.map-prov`). `mapScope` ('region'|'city') elige escena; conmutador
  `#mapScope` (botones `data-scope`); subtítulo por `MAP_SCOPE_SUB`.
- **Marcadores**: `ev.coords = [lon,lat]` (CRUDOS, orden lon,lat) → proyección
  exacta en runtime con la proj de la escena activa (`mapProject`). Sin coords →
  fallback `MAP_GEO.cities[ev.city]` + espiral áurea. Con coords, en la vista
  region se añade jitter mínimo `(i%3)*1.4` (los locales del centro caen a <1
  unidad y se fundirían). Todo se recorta a [5,95] (lo de fuera asoma al borde).
- **Cobertura/gating**: `MAP_COVERED_CITIES` = ciudades con geometría. El botón
  `#mapBtn` se deshabilita (en `renderResults`) si el filtro no alcanza ninguna
  (`mapCoverage()`); `mapBuildDays` también excluye eventos fuera de cobertura.
  Provincia nueva ⇒ añadir sus ciudades aquí cuando TENGA geometría.
- Colores: paleta del mapa AZUL (`.map-madrid` #3da9ff, vista `ac-blue`);
  marcadores por CSS vars `--mk-sala/--mk-congreso/--mk-ext/--mk-sel` (override
  oscurecido en `.app.light`). En SVG usar `style="fill:var(--…)"` — los
  atributos de presentación NO aceptan var().

## 4. Geocodificar locales (coords de salas/venues)

- Nominatim (OSM): `https://nominatim.openstreetmap.org/search?q=<dirección>&format=json&limit=1&countrycodes=es`
  con User-Agent identificativo y `sleep 1.2` entre peticiones (política de uso).
- GOTCHA Sentinel: el hook de seguridad bloquea encadenar la descarga con una
  tubería directa al intérprete. Descargar SIEMPRE a archivo (`-o resultado.json`)
  y parsear ese archivo en un paso separado.
- Guardar en el evento como `coords:[lon,lat]` (¡lon primero!), 5 decimales.

## 5. Verificación (siempre, en el visor del preview)

1. `preview_start` "static" → `preview_eval` + `preview_screenshot`.
2. Revisar AMBAS escenas (Comunidad y Ciudad), en claro Y oscuro.
3. Zoom de bordes: `svg.setAttribute('viewBox','30 20 40 40')` y captura — los
   picos angulosos solo se ven ampliado. Restaurar '0 0 100 100' después.
4. Probar: flechas de día, flechas ‹ › entre puntos (tarjeta `#mapInfo`),
   clic en marcador, "Entrar al evento" y ← de vuelta al mapa.
