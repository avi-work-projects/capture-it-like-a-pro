# Capture it like a pro

> Documento de referencia del proyecto. Contiene la visión, los user journeys,
> el estado actual y el roadmap. Léelo antes de tocar nada.

---

## 1. Visión del producto

**Capture it like a pro** es una PWA móvil que coordina la grabación de
parejas en sesiones de baile (concretamente, bachata por ahora).

El problema concreto que resuelve:

En una sala de baile, un único camarógrafo quiere grabar a varias parejas
durante una sesión musical. Hoy se hace mal: el camarógrafo le grita "¡ahora
tú!" a alguien, la gente no sabe cuándo le toca, hay solapamientos, vídeos
mal cortados, y al final reparte los vídeos por WhatsApp a tientas.

La app pone orden en eso:

1. **Identifica las canciones** que suenan en tiempo real (usando AudD,
   un servicio de fingerprinting tipo Shazam).
2. **Mantiene una cola ordenada** de las parejas que se han apuntado.
3. **Avisa a cada pareja** en su propio móvil cuándo le toca (gris →
   amarillo "prepárate" → verde "¡tu turno!").
4. **Avisa al camarógrafo** qué pareja debe grabar en cada momento.
5. Al final, el camarógrafo coge el vídeo bruto, lo corta por timestamps
   detectados, y envía a cada pareja su clip vía **WeTransfer**.

No hay storage de vídeos en la app. No hay login (de momento). No hay
pagos (de momento). Es deliberadamente minimalista.

---

## 2. Usuarios y user journeys

### 2.1 Roles

| Rol | Descripción |
|---|---|
| **Camarógrafo** | Persona con la cámara. Trae su móvil con la app. |
| **Bailarín** | Persona que va a bailar. Trae su móvil con la app. |
| **Organizador** (futuro) | Quien crea el evento y genera el QR de la cola. |

### 2.2 Journey del CAMARÓGRAFO

1. Abre la app → pantalla "¿Cómo entras?" → tap **🎥 Camarógrafo**
2. Filtra ubicación: País → Ciudad → Tipo de evento (sala / congreso / exterior)
3. Selecciona el evento concreto de una lista
4. Entra a la pantalla principal del evento:
   - Banner REC con la pareja que está bailando
   - Banner amarillo con la pareja que viene
   - Cuenta atrás hasta el siguiente cambio
   - Cola completa visible
5. Acerca el móvil al altavoz, pulsa "Iniciar grabación"
6. La app identifica las canciones automáticamente y avanza la cola
   en cada cambio
7. Al terminar el evento, el camarógrafo tiene una lista ordenada de
   timestamps: corta el vídeo bruto y envía a cada pareja vía WeTransfer

### 2.3 Journey del BAILARÍN

1. Abre la app → pantalla "¿Cómo entras?" → tap **💃 Bailarín**
2. Filtra ubicación igual que el camarógrafo
3. Selecciona el evento, se apunta a la cola (toma una posición libre)
4. Ve su tarjeta personal: "Eres la pareja #4 · Faltan 3 antes de ti"
5. Cuando queden 2 parejas (yo soy el #4 y va el #2) → su móvil pasa
   a **amarillo pulsante**: "¡PREPÁRATE!"
6. Cuando le toca → **verde flash**: "¡TU TURNO! · Acércate a la cámara"
7. Tras bailar → vuelve a gris: "Ya bailaste · disfruta el resto"
8. Al final del evento, recibe su vídeo por email (lo manda el camarógrafo
   vía WeTransfer)

---

## 3. Pantallas / flujos UI

### 3.1 Estado actual deployado
URL: https://avi-work-projects.github.io/bachata-detector/
Repo: https://github.com/avi-work-projects/bachata-detector

Tiene un prototipo "single-device" con:
- Splash + selector de evento + selector de camarógrafo (mock)
- 3 sub-vistas conmutables: grid de bailarines / mi vista / vista
  camarógrafo
- Detector real conectado a AudD funcionando

### 3.2 Lo que vamos a rediseñar con Claude Fable

Empezamos por **solo 2 vistas**, para no morir:

**VISTA 1** — "¿Cómo entras?" (selección de rol)
- Pregunta única
- Dos cards grandes: 🎥 Camarógrafo / 💃 Bailarín

**VISTA 2** — Filtros de ubicación en cascada
- Paso A: País (España / Polonia)
  - Polonia → "Aún no hay eventos en Polonia"
- Paso B: Ciudad (Todas / Madrid / Sevilla / Barcelona)
- Paso C: Tipo de evento (Salas de baile / Congresos / Al exterior)
- Tras paso C: placeholder "Próximamente: aquí saldría la lista"

Cada paso elegido queda como breadcrumb pulsable arriba.

### 3.3 Estilo

- Tema oscuro siempre, predominio negro/blanco
- UN único color de acento llamativo (a elegir por el diseñador)
- Tipografía con personalidad (Google Fonts, especificar)
- Dinámico tipo videojuego, transiciones limpias entre pasos
- Mobile-first 390×844

---

## 4. Datos mock que la app maneja (para prototipar)

### Eventos
```json
[
  { "id": "evt-fri", "name": "Bachata Friday Night", "city": "Madrid",
    "location": "Sala Tropic", "when": "Vie 23 mayo · 22:00",
    "type": "sala" },
  { "id": "evt-sat", "name": "Bachata Sunset Madrid", "city": "Madrid",
    "location": "Plaza España", "when": "Sáb 24 mayo · 19:30",
    "type": "exterior" },
  { "id": "evt-sun", "name": "Bachata Beach Party", "city": "Barcelona",
    "location": "Sala Caribbean", "when": "Dom 25 mayo · 21:00",
    "type": "sala" },
  { "id": "evt-cong", "name": "Congreso Bachatísimo 2026", "city": "Sevilla",
    "location": "Palacio de Congresos", "when": "Sáb 31 mayo · todo el día",
    "type": "congreso" }
]
```

### Camarógrafos por evento (mock)
```json
{
  "evt-fri": [
    { "id": "cam-juan", "name": "Juan Pérez", "desc": "5 años · 4K" },
    { "id": "cam-ana",  "name": "Ana López",  "desc": "Cinematográfico" }
  ],
  "evt-sat": [
    { "id": "cam-carlos", "name": "Carlos Ruiz",
      "desc": "Estabilizador profesional · entrega 48h" }
  ],
  "evt-sun": [
    { "id": "cam-lucia", "name": "Lucía Martín", "desc": "Vídeos en 48h" },
    { "id": "cam-david", "name": "David Soto",   "desc": "2 cámaras" }
  ]
}
```

### Cola mock (para visualizar el flujo)
```json
[
  { "id": "q1", "name": "Marta & Pedro" },
  { "id": "q2", "name": "Lucía & Carlos" },
  { "id": "q3", "name": "Tú & Pareja", "isMe": true },
  { "id": "q4", "name": "Sofía & Diego" },
  { "id": "q5", "name": "Ana & Miguel" },
  { "id": "q6", "name": "Inés & Hugo" }
]
```

---

## 4.5 Modelo de datos (v1 — en evolución)

> Implementado como mock en `index.html`. Cuando llegue la Fase 2 (Firebase),
> estas entidades pasan a colecciones. Los ❓ son dudas abiertas.

### Entidades

**USER** (futuro; hoy el rol vive en localStorage)
| Campo | Tipo | Notas |
|---|---|---|
| id | string | |
| name | string | |
| email | string | para recibir el WeTransfer |
| profiles | `{ cam?, dancer? }` | ✅ DECIDIDO: una misma cuenta puede tener AMBOS perfiles y moverse libremente por el menú. El registro en sí queda fuera del MVP. |
| balance | number € | saldo del bailarín para reservas y colas. Mock: 20 € de regalo en localStorage; la recarga real es futura. |

**CAM (camarógrafo)** — perfil público
| Campo | Tipo | Notas |
|---|---|---|
| id | string | |
| name | string | |
| city | ref CITY | localización base, para el filtro del directorio |
| desc | string | una línea de venta ("4K · entrega 48h") |
| rating | number 0-6 | ✅ DECIDIDO: media de las notas de los bailarines; cada voto es un ENTERO de 0 a 6 (futura entidad VOTE: dancerId, camId, value 0-6) |
| videos | int | nº de vídeos entregados (sube con cada sesión) |
| price | number € | ✅ DECIDIDO: lo declara el camarógrafo, mínimo 4 y máximo 20 €. **Derivado**: tier `$` (<7) / `$$` (7-12) / `$$$` (>12) |
| reserve | 0 € \| 2 € | ✅ DECIDIDO: coste de "Reservar plaza", lo elige el camarógrafo (gratis o 2 €). Al apuntarse a la cola se DESCUENTA de la tasa. |

**EVENT**
| Campo | Tipo | Notas |
|---|---|---|
| id | string | |
| name, venue, when | string | `when` = día; el horario va aparte |
| startsAt / endsAt | datetime | ✅ hora de inicio y fin (por defecto en la ficha del evento). Estado **derivado**: `previo` / `directo` / `terminado` |
| country / city | ref | filtros en cascada |
| type | `sala` \| `congreso` \| `exterior` | |
| sub | `terraza` \| `playa` \| `parque` | **solo si type=exterior** |
| camIds | ref CAM[] | camarógrafos apuntados (0..n). "Apuntarse" = añadirte aquí |

**DANCE (baile grabado)** → alimenta "Mis bailes" del bailarín
| Campo | Tipo | Notas |
|---|---|---|
| eventId | ref EVENT | |
| camId | ref CAM | quién te grabó |
| dancerId | ref USER | (mock: siempre "tú") |
| date | date | |
| song | string | título identificado por AudD en directo |
| partner | `{name, email?, link}` | ✅ DECIDIDO: opcionalmente VINCULABLE a otro usuario introduciendo su correo. `link`: `none` (solo texto) → `pending` (correo enviado, falta que la pareja CONFIRME el baile) → `confirmed`. El flujo de confirmación se construirá más adelante; la UI ya lo presenta. |
| status | `pendiente` → `enviado` → `recibido` | el vídeo viaja por WeTransfer, NUNCA se almacena en la app |

**SESSION (sesión de grabación)** → alimenta "Mis sesiones" del camarógrafo
| Campo | Tipo | Notas |
|---|---|---|
| eventId | ref EVENT | |
| camId | ref CAM | (mock: siempre "tú") |
| date | date | |
| couples | int | parejas grabadas |
| sent | int | vídeos ya enviados (sent == couples ⇒ sesión cerrada) |

### Relaciones
- EVENT 1—n DANCE · EVENT 1—n SESSION · CAM 1—n DANCE · CAM 1—n SESSION
- SESSION es agregable desde DANCE (couples = nº de DANCEs de ese cam en ese
  evento) ❓ — ¿mantenemos ambas o derivamos SESSION al vuelo?

**Entidades nuevas del flujo "apuntarse con un camarógrafo"** (mock en localStorage):

| Entidad | Campos | Notas |
|---|---|---|
| FAVORITE | dancerId, camId | "Me interesa grabar contigo" → el cam sale arriba del directorio con ♥ |
| RESERVATION | dancerId, camId, eventId, amount | solo ANTES del evento; cuesta `CAM.reserve` (0 o 2 €), se cobra del saldo |
| CHECKIN | camId, eventId, at | "He llegado · abrir cola". ✅ REGLA: solo válido entre `startsAt` y `endsAt` |
| QUEUE_ENTRY | dancerId, camId, eventId, feePaid | solo si hay CHECKIN del cam. `feePaid = CAM.price − (RESERVATION.amount si existe)` |

### Dudas abiertas para decidir
1. Flujo de confirmación de pareja (correo real + pantalla de "confirma este
   baile") — presentado en UI, pendiente de construir.
2. Recarga de saldo real (pasarela de pago) — hoy es un número mock de 20 €.
3. ¿La reserva caduca/se devuelve si el camarógrafo no se presenta al evento?

---

## 5. Stack técnico

| Pieza | Tecnología | Notas |
|---|---|---|
| Frontend | HTML+CSS+JS vanilla, todo en `index.html` | Sin frameworks, sin build, sin dependencias |
| Persistencia | `localStorage` del navegador | API key, preferencias |
| API de identificación | [AudD.io](https://audd.io/) | Free 300 calls/registro, $5/1000 después |
| Despliegue | GitHub Pages | HTTPS gratis (necesario para `getUserMedia` en móvil) |
| CI | GitHub Actions con un workflow simple | Inyecta el secret AUDD_TOKEN en build |
| PWA | `manifest.json` + icono | Instalable en móvil |
| Backend | **NINGUNO** | Decisión deliberada: sin coste, sin gestión |

### Limitaciones que vienen de "sin backend"
- **No hay sync multi-móvil real**: cada móvil tiene su propio estado. La
  Fase 2 del roadmap requiere añadir Firebase u otro Realtime DB.
- **No hay registro persistente** de parejas/eventos: todo en localStorage
  del dispositivo.
- **No hay autenticación**: el rol es solo una preferencia del navegador.

---

## 6. Estado actual del proyecto

### ✅ Hecho
- **Detector de cambios de canción funcionando**: combina AudD con
  predicción temporal. Latencia 3-7s tras el cambio real.
- **Estrategia time-window**: identifica la canción, programa mid-check
  y end-check basándose en la duración devuelta por AudD.
- **Recalibración por timecode-ambiguity**: AudD a veces matchea un
  estribillo repetido; el sistema detecta la deriva y se recalibra.
- **Filtro de compilaciones**: descarta matches que parecen "mix bachata"
  vs canciones reales.
- **Skip de clips silenciosos**: si el mic captó silencio, no se gasta
  call API.
- **Selector de micrófono**: por si Edge coge el equivocado.
- **Test mic dedicado**: 5 segundos de grabación + playback para
  diagnosticar audio.
- **PWA instalable** con icono y manifest.
- **Auto-inyección del API token** vía GitHub Secret en deploy.
- **Prototipo single-device** del flujo: event picker + cam picker +
  3 vistas (grid bailarines / mi vista / vista cámara).

### 🔜 Lo que toca ahora (esta iteración)
- **Rediseño visual** de las 2 primeras vistas (rol + filtros), con
  ayuda de Claude Fable, estilo dinámico videojuego pero sobrio.
- Integrar el nuevo look en el `index.html` real conservando toda la
  lógica del detector.

### 🛠 Pendiente más adelante (roadmap)

**Fase 1 — Visual completo** (en curso)
- Las 2 vistas iniciales nuevas (rol + filtros)
- Rediseño de la pantalla principal (REC banner + cola + cards)

**Fase 2 — Multi-móvil real**
- Backend con Firebase Realtime DB (o Supabase)
- Códigos de sesión (`/sesion/XYZ`)
- Sincronización en tiempo real entre el móvil del camarógrafo y los
  bailarines

**Fase 3 — Registro con QR**
- El camarógrafo genera un QR del evento
- Los bailarines lo escanean → formulario nombre + email → entran a cola

**Fase 4 — Post-procesado del vídeo**
- El camarógrafo sube el vídeo bruto a la app (o lo trocea con su
  software favorito)
- La app le da los timestamps de cada cambio para cortar precisamente
- Envío por WeTransfer (manual o integrado con la API de WeTransfer)

---

## 7. Decisiones de producto / restricciones

- **No storage de vídeos**: el camarógrafo envía por WeTransfer.
- **No login** en el MVP: el rol es solo una preferencia del navegador
  (localStorage).
- **No pagos** en el MVP: gratis para todos.
- **Idioma único**: español. (Internacionalización es futuro).
- **Solo móvil**: la app está optimizada mobile-first. En desktop se ve
  pero no es el target.
- **Tema oscuro siempre**: no hay theme switcher.

---

## 8. Branding / nombre

- **Nombre del producto**: "Capture it like a pro"
- **Tagline candidato**: "Tu turno de baile, perfectamente capturado"
  (sustituye por algo mejor si se te ocurre)
- **Audiencia**: bailarines de bachata en España, escena social — gente
  que va a eventos por afición, no profesionales.
