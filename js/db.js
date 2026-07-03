/* ══════════════════════════════════════════════════════════════════════════
   db.js — LA "BASE DE DATOS" DE LA APP (tablas relacionales de datos demo)

   ★ ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA CAMBIAR/AÑADIR DATOS ★

   Se carga ANTES que data.js: data.js hace los "JOIN" y construye las
   estructuras de runtime (EVENTS, CAMS, etiquetas…), así que el resto de la
   app no sabe que esto existe. El día que haya backend, estas tablas se
   sustituyen por las respuestas de la API y punto.

   Convenciones:
   - Cada tabla es un array de registros con `id` y claves foráneas por nombre
     (p. ej. `city:'mad'` apunta a cities.id).
   - Relaciones N:M en tablas propias (event_cams).
   - Nada de lógica aquí: SOLO datos.
   ══════════════════════════════════════════════════════════════════════════ */
window.DB = {

  /* ── GEOGRAFÍA ─────────────────────────────────────────────────────────── */
  countries: [
    { id:'es', name:'España' },
    { id:'pl', name:'Polonia' }
  ],
  /* province.id: p+código INE (España) o slug (resto) */
  provinces: [
    { id:'p28', name:'Madrid',      country:'es' },
    { id:'p41', name:'Sevilla',     country:'es' },
    { id:'p08', name:'Barcelona',   country:'es' },
    { id:'pmz', name:'Mazovia',     country:'pl' },
    { id:'pmp', name:'Małopolska',  country:'pl' }
  ],
  /* lonlat = [lon, lat] del centro (fallback del mapa si el evento no trae coords) */
  cities: [
    { id:'mad', name:'Madrid',    prov:'p28', lonlat:[-3.7038, 40.4168] },
    { id:'sev', name:'Sevilla',   prov:'p41', lonlat:[-5.9940, 37.3920] },
    { id:'bcn', name:'Barcelona', prov:'p08', lonlat:[ 2.1700, 41.3800] },
    { id:'waw', name:'Varsovia',  prov:'pmz', lonlat:[21.0100, 52.2300] },
    { id:'kra', name:'Cracovia',  prov:'pmp', lonlat:[19.9400, 50.0600] }
  ],

  /* ── CATÁLOGOS ─────────────────────────────────────────────────────────── */
  types: [
    { id:'sala',     name:'Salas de baile' },
    { id:'congreso', name:'Congresos' },
    { id:'exterior', name:'Sociales al exterior' }
  ],
  subtypes: [   /* solo para type=exterior */
    { id:'terraza', name:'Terraza' },
    { id:'playa',   name:'Playa' },
    { id:'parque',  name:'Parque' },
    { id:'piscina', name:'Piscina' }
  ],

  /* ── CAMARÓGRAFOS ──────────────────────────────────────────────────────────
     rating = media de notas enteras 0-6 · reviews = nº de reseñas ·
     price = €/vídeo (4-20 → tier $/$$/$$$) · reserve = coste de reserva (0|2 €) */
  cams: [
    { id:'juan',   name:'Juan Pérez',     city:'mad', desc:'5 años de experiencia · 4K',  rating:5.5, reviews:24, videos:132, price:9,  reserve:2,
      ig:'juanperez.films', topEvent:{ name:'Bachata Friday Night', couples:18 }, topVenue:{ name:'Sala Tropic', times:21 },
      bio:'Llevo 5 años grabando bachata. Me obsesiona pillar el momento exacto del giro. Entrego en 4K y respondo rápido por DM.' },
    { id:'ana',    name:'Ana López',      city:'mad', desc:'Buena luz · 4K',              rating:5.7, reviews:31, videos:87,  price:14, reserve:2,
      ig:'ana.lopez.video', topEvent:{ name:'Bachata Friday Night', couples:15 }, topVenue:{ name:'Sala Tropic', times:13 },
      bio:'Vídeo y color cuidados, cada clip parece una escena. Suelo grabar en salas de Madrid los fines de semana.' },
    { id:'carlos', name:'Carlos Ruiz',    city:'mad', desc:'Estabilizador pro · 48h',     rating:5.2, reviews:58, videos:210, price:6,  reserve:0,
      ig:'carlosruiz4k', topEvent:{ name:'Bachata Sunset Madrid', couples:22 }, topVenue:{ name:'Terraza Plaza España', times:9 },
      bio:'Estabilizador siempre, cero tirones. Entrega garantizada en 48h. Si quieres un plano concreto, dímelo antes de bailar.' },
    { id:'lucia',  name:'Lucía Martín',   city:'bcn', desc:'Vídeos en 48h',               rating:5.4, reviews:19, videos:64,  price:8,  reserve:2,
      ig:'lucia.captura', topEvent:{ name:'Bachata Beach Party', couples:27 }, topVenue:{ name:'Sala Caribbean', times:16 },
      bio:'Rápida y cercana. Te mando el vídeo en 48h y sin marcas de agua. Barcelona y alrededores.' },
    { id:'david',  name:'David Soto',     city:'bcn', desc:'2 cámaras',                   rating:4.8, reviews:11, videos:45,  price:5,  reserve:0,
      ig:'davidsoto.cam', topEvent:{ name:'Bachata Beach Party', couples:14 }, topVenue:{ name:'Sala Caribbean', times:7 },
      bio:'Grabo con dos cámaras para no perder ningún ángulo. Precio ajustado para que todos puedan llevarse su baile.' },
    { id:'marta',  name:'Marta Gil',      city:'sev', desc:'Equipo doble · multicámara',  rating:5.9, reviews:42, videos:156, price:15, reserve:2,
      ig:'marta.gil.films', topEvent:{ name:'Congreso Bachatísimo', couples:40 }, topVenue:{ name:'Palacio de Congresos', times:11 },
      bio:'Equipo doble y mucho mimo en el montaje. He grabado los mayores congresos del sur. Pregúntame sin compromiso.' },
    { id:'piotr',  name:'Piotr Nowak',    city:'waw', desc:'Slow-motion · 4K',            rating:5.0, reviews:2,  videos:38,  price:6,  reserve:0,
      ig:'piotr.nowak.video', topEvent:{ name:'Warsaw Bachata Social', couples:12 }, topVenue:{ name:'Klub Mokotów', times:8 },
      bio:'Slow-motion y 4K. Me encanta el detalle de los pies. Varsovia.' },
    { id:'magda',  name:'Magda Kowalska', city:'kra', desc:'Multicámara',                 rating:5.3, reviews:3,  videos:71,  price:10, reserve:2,
      ig:'magda.k.films', topEvent:{ name:'Kraków Bachata Fest', couples:31 }, topVenue:{ name:'ICE Kraków', times:6 },
      bio:'Multicámara bien sincronizada. Cracovia y festivales. Entrega rápida.' }
  ],

  /* reseñas de texto (perfil del camarógrafo) — cam → cams.id, stars 0-6 */
  reviews: [
    { cam:'juan',   by:'Lucía', stars:6, date:'2026-06-12', text:'Plano impecable y me lo mandó al día siguiente.' },
    { cam:'juan',   by:'Sofía', stars:5, date:'2026-05-28', text:'Muy buen ojo para el momento del giro.' },
    { cam:'ana',    by:'Diego', stars:6, date:'2026-06-14', text:'Edición muy cuidada, parece una peli.' },
    { cam:'ana',    by:'Marta', stars:6, date:'2026-06-01', text:'La luz y el encuadre, de otro nivel.' },
    { cam:'ana',    by:'Hugo',  stars:5, date:'2026-04-20', text:'Tardó un poco pero mereció la pena.' },
    { cam:'carlos', by:'Inés',  stars:5, date:'2026-06-10', text:'Estabilidad perfecta, cero tirones.' },
    { cam:'carlos', by:'Pablo', stars:5, date:'2026-05-15', text:'Entrega en 48h cumplida al minuto.' },
    { cam:'lucia',  by:'Ana',   stars:6, date:'2026-06-13', text:'Rapidísima y súper maja.' },
    { cam:'david',  by:'Sara',  stars:4, date:'2026-05-30', text:'Dos cámaras, buen resultado.' },
    { cam:'marta',  by:'Elena', stars:6, date:'2026-06-11', text:'El montaje a varias cámaras es espectacular.' },
    { cam:'marta',  by:'Juan',  stars:6, date:'2026-05-20', text:'La mejor del congreso, sin duda.' },
    { cam:'piotr',  by:'Kasia', stars:5, date:'2026-06-05', text:'Slow-motion precioso.' },
    { cam:'magda',  by:'Tomek', stars:5, date:'2026-06-08', text:'Multicámara muy bien sincronizada.' }
  ],

  /* ── EVENTOS ───────────────────────────────────────────────────────────────
     recurrence 'weekly' (weekdays 0=dom..6=sáb + timeLabel) | 'oneoff'
     (dateStart/dateEnd). country se deriva de city→prov. coords=[lon,lat]
     exactas del local (Nominatim). Las cámaras van en event_cams; los pases
     de congreso en passes (si faltan, data.js sintetiza el patrón típico). */
  events: [
    /* salas reales de Madrid (sbkapp.es), semanales */
    { id:'s_thehost',   name:"The Host",            city:'mad', type:'sala', recurrence:'weekly', weekdays:[2,3,4,5], timeLabel:"23:30–04:00", venue:"C. de Ferraz, 38",                 coords:[-3.71731,40.42631] },
    { id:'s_salacalips',name:"Sala Calipso",        city:'mad', type:'sala', recurrence:'weekly', weekdays:[5,6],     timeLabel:"22:00–04:00", venue:"C. de Uruguay, 5",                 coords:[-3.67582,40.45529] },
    { id:'s_salsebasti',name:"Salsebastián",        city:'mad', type:'sala', recurrence:'weekly', weekdays:[5,6],     timeLabel:"22:00–04:00", venue:"Av. Fuente Nueva, 5, Nave 16B",    coords:[-3.61069,40.54729] },
    { id:'s_azucar',    name:"Azúcar",              city:'mad', type:'sala', recurrence:'weekly', weekdays:[5,6],     timeLabel:"23:00–05:00", venue:"C. de Atocha, 107",                coords:[-3.69517,40.41057] },
    { id:'s_salabongos',name:"Sala Bongos",         city:'mad', type:'sala', recurrence:'weekly', weekdays:[5,6],     timeLabel:"23:00–05:00", venue:"C. de Bravo Murillo, 52",          coords:[-3.70304,40.45318] },
    { id:'s_laermita',  name:"La Ermita",           city:'mad', type:'sala', recurrence:'weekly', weekdays:[6,0],     timeLabel:"18:00–22:00", venue:"P.º de la Virgen del Puerto, 4",   coords:[-3.72125,40.41552] },
    { id:'s_karamelosa',name:"Karamelo (Sala Cha3)",city:'mad', type:'sala', recurrence:'weekly', weekdays:[6],       timeLabel:"23:00–05:00", venue:"Calle de San Pol de Mar, 1",       coords:[-3.72658,40.42392] },
    { id:'s_catslatind',name:"Cats Latin Dance",    city:'mad', type:'sala', recurrence:'weekly', weekdays:[0],       timeLabel:"20:00–02:00", venue:"C. de Julián Romea, 4",            coords:[-3.71343,40.44278] },
    { id:'s_kumarah540',name:"Kumarah 5.40",        city:'mad', type:'sala', recurrence:'weekly', weekdays:[4,0],     timeLabel:"22:00–03:00", venue:"C. Sofía, 3",                      coords:[-3.89313,40.49977] },
    { id:'s_salajowke', name:"Sala Jowke",          city:'mad', type:'sala', recurrence:'weekly', weekdays:[0],       timeLabel:"20:00–02:00", venue:"Av. San Martín de Valdeiglesias, 22", coords:[-3.82743,40.35819] },
    /* congresos DEMO (probar pases/bloqueos) */
    { id:'c_demo_full', name:"Bachata Sunrise Weekend", city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-07-10', dateEnd:'2026-07-12', venue:"Hotel Riu Plaza España", coords:[-3.71207,40.42395] },
    { id:'c_demo_block',name:"Madrid Bachata Camp",     city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-07-17', dateEnd:'2026-07-19', venue:"Palacio Vistalegre",     coords:[-3.73238,40.38380] },
    /* congresos reales (lasalsadelbaile.com) — los 2 primeros son PASADOS */
    { id:'c_valbaila',  name:"Valencia Baila 2026 · Spring",        city:'sev', type:'congreso', recurrence:'oneoff', dateStart:'2026-04-24', dateEnd:'2026-04-26', venue:"Sevilla" },
    { id:'c_aura',      name:"Aura Latin Festival",                 city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-05-15', dateEnd:'2026-05-17', venue:"Madrid" },
    { id:'c_urban',     name:"URBAN Bachata Festival 2026",         city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-06-12', dateEnd:'2026-06-14', venue:"Occidental Aranjuez",    coords:[-3.60433,40.05702] },
    { id:'c_madsum',    name:"Madrid Summer Festival 2026",         city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-06-26', dateEnd:'2026-06-28', venue:"Hotel Isla de la Garena", coords:[-3.40119,40.48613] },
    { id:'c_bigsoc',    name:"The Big Social Dance",                city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-08-09', dateEnd:'2026-08-10', venue:"Madrid" },
    { id:'c_bcnsum',    name:"Bachatazo Barcelona Summer 2026",     city:'bcn', type:'congreso', recurrence:'oneoff', dateStart:'2026-08-13', dateEnd:'2026-08-17', venue:"Barcelona" },
    { id:'c_back',      name:"Back to School 2026 · Madrid",        city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-10-30', dateEnd:'2026-11-01', venue:"Madrid" },
    { id:'c_full',      name:"Full Bachata 2026",                   city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-11-27', dateEnd:'2026-11-29', venue:"Madrid" },
    { id:'c_emotion',   name:"E-Motion Sevilla Bachata Congress",   city:'sev', type:'congreso', recurrence:'oneoff', dateStart:'2026-11-27', dateEnd:'2026-11-29', venue:"Sevilla" },
    /* sociales al exterior */
    { id:'e_sunset', name:"Bachata Sunset Madrid", city:'mad', type:'exterior', sub:'terraza', recurrence:'oneoff', dateStart:'2026-06-20', dateEnd:'2026-06-20', venue:"Terraza Plaza España",    coords:[-3.71088,40.42345] },
    { id:'e_beach',  name:"Bachata Beach Party",   city:'bcn', type:'exterior', sub:'playa',   recurrence:'oneoff', dateStart:'2026-07-11', dateEnd:'2026-07-11', venue:"Playa Bogatell" },
    { id:'e_pool',   name:"Pool Party Bachata",    city:'mad', type:'exterior', sub:'piscina', recurrence:'oneoff', dateStart:'2026-07-18', dateEnd:'2026-07-18', timeLabel:'12:00–19:00', venue:"Piscina Hotel Emperador", coords:[-3.70687,40.42120] }
  ],

  /* relación N:M evento↔camarógrafo. live:true = ya hizo check-in (demo) */
  event_cams: [
    { event:'s_thehost',   cam:'juan', live:true },
    { event:'s_thehost',   cam:'ana' },
    { event:'s_thehost',   cam:'carlos' },
    { event:'s_thehost',   cam:'lucia' },
    { event:'s_thehost',   cam:'david' },
    { event:'s_azucar',    cam:'lucia' },
    { event:'s_salabongos',cam:'david' },
    { event:'c_demo_full', cam:'juan' },
    { event:'c_demo_full', cam:'marta' },
    { event:'c_demo_block',cam:'carlos' },
    { event:'c_valbaila',  cam:'lucia' },
    { event:'c_aura',      cam:'juan' },
    { event:'c_aura',      cam:'carlos' },
    { event:'c_urban',     cam:'juan' },
    { event:'c_urban',     cam:'ana' },
    { event:'c_madsum',    cam:'carlos' },
    { event:'c_bcnsum',    cam:'lucia' },
    { event:'c_bcnsum',    cam:'david' },
    { event:'c_back',      cam:'juan' },
    { event:'c_emotion',   cam:'marta' },
    { event:'e_sunset',    cam:'carlos' },
    { event:'e_beach',     cam:'lucia' },
    { event:'e_beach',     cam:'david' },
    { event:'e_pool',      cam:'ana' }
  ],

  /* pases de congreso por jornada — day/night = [inicio, fin] o null (sin pase;
     ambos null = día BLOQUEADO). Los congresos que no aparezcan aquí reciben
     el patrón típico sintetizado por data.js. */
  passes: [
    { event:'c_demo_full',  date:'2026-07-10', day:['11:00','20:00'], night:['22:00','04:00'] },
    { event:'c_demo_full',  date:'2026-07-11', day:['11:00','20:00'], night:['22:00','04:00'] },
    { event:'c_demo_full',  date:'2026-07-12', day:['11:00','20:00'], night:['22:00','04:00'] },
    { event:'c_demo_block', date:'2026-07-17', day:null,              night:['22:00','05:00'] },
    { event:'c_demo_block', date:'2026-07-18', day:['12:00','20:00'], night:['23:00','05:00'] },
    { event:'c_demo_block', date:'2026-07-19', day:null,              night:null }
  ],

  /* ── DATOS PERSONALES DEMO (Mis bailes / Mis sesiones) ─────────────────── */
  my_dances: [
    { event:'s_thehost', date:'12 jun 2026', song:'Romeo Santos — Propuesta Indecente', partner:{ name:'Lucía', link:'ok' },                              cam:'juan',   status:'recibido' },
    { event:'s_thehost', date:'12 jun 2026', song:'Prince Royce — Darte un Beso',       partner:{ name:'Sofía', link:'none' },                            cam:'ana',    status:'enviado' },
    { event:'e_sunset',  date:'20 jun 2026', song:'Aventura — Obsesión',                partner:{ name:'Marta', link:'pending', email:'marta@mail.com' }, cam:'carlos', status:'pendiente' },
    { event:'c_urban',   date:'13 jun 2026', song:'Juan Luis Guerra — Bachata Rosa',    partner:{ name:'Elena', link:'none' },                            cam:'juan',   status:'recibido' }
  ],
  my_sessions: [
    { event:'s_thehost', date:'12 jun 2026', couples:14, sent:14 },
    { event:'e_sunset',  date:'20 jun 2026', couples:9,  sent:6 },
    { event:'c_urban',   date:'13 jun 2026', couples:11, sent:0 }
  ],

  /* ── DEMO DEL MODO EN DIRECTO ("Estoy dentro") ─────────────────────────── */
  demo: {
    /* parejas ficticias para las colas */
    couples: ['Marcos & Lucía', 'Dani & Sofía', 'Álex & Marta', 'Hugo & Elena',
              'Pablo & Nerea', 'Iván & Carla', 'Sergio & Paula', 'Leo & Noa'],
    /* setlist simulado del "sonando ahora" — [artista, título, duración s] */
    songs: [
      ['Romeo Santos', 'Propuesta Indecente', 224],
      ['Prince Royce', 'Darte un Beso', 192],
      ['Aventura', 'Obsesión', 238],
      ['Juan Luis Guerra', 'Bachata Rosa', 204],
      ['Manuel Turizo', 'La Bachata', 163],
      ['Grupo Extra', 'Me Emborracharé', 210]
    ],
    /* salas del local en directo: cada una con SU mapa (formato del editor) */
    salas: [
      { id:0, name:'Sala principal', map:{
          id:'sala-1', name:'Sala principal',
          pieces:[ { id:1, kind:'rect', x:50, y:50, w:86, h:88, rot:0 } ],
          elements:[
            { id:2, type:'escenario', x:50, y:13, w:150, h:42, rot:0 },
            { id:3, type:'dj',        x:50, y:27, w:28,  h:28, rot:0 },
            { id:4, type:'bar',       x:86, y:52, w:24,  h:96, rot:0 },
            { id:5, type:'banos',     x:13, y:88, w:26,  h:26, rot:0 },
            { id:6, type:'acceso',    x:50, y:92, w:26,  h:26, rot:0 },
            { id:7, type:'columna',   x:24, y:46, w:16,  h:16, rot:0 },
            { id:8, type:'columna',   x:70, y:70, w:16,  h:16, rot:0 }
          ] } },
      { id:1, name:'Sala 2', map:{
          id:'sala-2', name:'Sala 2',
          pieces:[ { id:1, kind:'rect', x:50, y:52, w:72, h:80, rot:0 } ],
          elements:[
            { id:2, type:'dj',     x:50, y:22, w:26, h:26, rot:0 },
            { id:3, type:'bar',    x:74, y:60, w:22, h:70, rot:0 },
            { id:4, type:'acceso', x:32, y:88, w:24, h:24, rot:0 }
          ] } }
    ],
    /* dónde está cada camarógrafo (sala + x,y dentro de SU sala) y cuánta
       cola tiene (queue = nº de parejas demo delante) */
    live_cams: [
      { cam:'juan',   sala:0, x:32, y:42, queue:0 },
      { cam:'carlos', sala:0, x:60, y:62, queue:2 },
      { cam:'lucia',  sala:0, x:30, y:76, queue:3 },
      { cam:'ana',    sala:1, x:50, y:40, queue:0 },
      { cam:'david',  sala:1, x:62, y:70, queue:4 }
    ]
  }
};
