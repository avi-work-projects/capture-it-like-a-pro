/* data.js — datos mock + helpers puros (globales; se carga ANTES que app.js) */
/* ════════════════════════ MODELO DE DATOS (mock) ════════════════════
     Entidades y relaciones (detalle completo en PROYECTO.md):
       CAM (camarógrafo): id, name, city, desc, rating (media de notas
            enteras 0-6), videos (nº entregados), price (€/vídeo declarado
            por el camarógrafo, 4-20 → tier $/$$/$$$).
       EVENT: id, name, country, city, type, sub (solo exterior), venue,
            when, camIds[] → referencia a CAM.
       DANCE (baile grabado, para "Mis bailes"): eventId→EVENT, camId→CAM,
            date, song (identificada por AudD), partner, status
            (pendiente → enviado [WeTransfer] → recibido).
       SESSION (sesión de grabación, para "Mis sesiones"): eventId→EVENT,
            date, couples (parejas grabadas), sent (vídeos ya enviados).
  ════════════════════════════════════════════════════════════════════ */
  var CITY_LABELS = { all:'Todas', mad:'Madrid', sev:'Sevilla', bcn:'Barcelona',
                      waw:'Varsovia', kra:'Cracovia' };
  var TYPE_LABELS = { sala:'Salas de baile', congreso:'Congresos', exterior:'Al exterior' };
  var SUB_LABELS  = { all:'Todos', terraza:'Terraza', playa:'Playa', parque:'Parque' };

  /* rating = media de notas ENTERAS 0-6 de los bailarines;
     price = tasa por vídeo declarada por el camarógrafo (mín 4 € · máx 20 €);
     reserve = coste de reservar plaza, lo elige el camarógrafo (0 € o 2 €)
               y se DESCUENTA de la tasa al apuntarse a la cola */
  /* rating = media de reseñas (0-6); reviews = nº de reseñas;
     topEvent = evento más concurrido (por parejas); topVenue = sala donde más
     ha grabado (+ nº de veces); ig = instagram; bio = texto libre (≤200) */
  var CAMS = [
    { id:'juan',   name:'Juan Pérez',     city:'mad', desc:'5 años de experiencia · 4K',  rating:5.5, reviews:24, videos:132, price:9,  reserve:2,
      ig:'juanperez.films', topEvent:{name:'Bachata Friday Night', couples:18}, topVenue:{name:'Sala Tropic', times:21},
      bio:'Llevo 5 años grabando bachata. Me obsesiona pillar el momento exacto del giro. Entrego en 4K y respondo rápido por DM.' },
    { id:'ana',    name:'Ana López',      city:'mad', desc:'Buena luz · 4K',              rating:5.7, reviews:31, videos:87,  price:14, reserve:2,
      ig:'ana.lopez.video', topEvent:{name:'Bachata Friday Night', couples:15}, topVenue:{name:'Sala Tropic', times:13},
      bio:'Vídeo y color cuidados, cada clip parece una escena. Suelo grabar en salas de Madrid los fines de semana.' },
    { id:'carlos', name:'Carlos Ruiz',    city:'mad', desc:'Estabilizador pro · 48h',     rating:5.2, reviews:58, videos:210, price:6,  reserve:0,
      ig:'carlosruiz4k', topEvent:{name:'Bachata Sunset Madrid', couples:22}, topVenue:{name:'Terraza Plaza España', times:9},
      bio:'Estabilizador siempre, cero tirones. Entrega garantizada en 48h. Si quieres un plano concreto, dímelo antes de bailar.' },
    { id:'lucia',  name:'Lucía Martín',   city:'bcn', desc:'Vídeos en 48h',               rating:5.4, reviews:19, videos:64,  price:8,  reserve:2,
      ig:'lucia.captura', topEvent:{name:'Bachata Beach Party', couples:27}, topVenue:{name:'Sala Caribbean', times:16},
      bio:'Rápida y cercana. Te mando el vídeo en 48h y sin marcas de agua. Barcelona y alrededores.' },
    { id:'david',  name:'David Soto',     city:'bcn', desc:'2 cámaras',                   rating:4.8, reviews:11, videos:45,  price:5,  reserve:0,
      ig:'davidsoto.cam', topEvent:{name:'Bachata Beach Party', couples:14}, topVenue:{name:'Sala Caribbean', times:7},
      bio:'Grabo con dos cámaras para no perder ningún ángulo. Precio ajustado para que todos puedan llevarse su baile.' },
    { id:'marta',  name:'Marta Gil',      city:'sev', desc:'Equipo doble · multicámara',  rating:5.9, reviews:42, videos:156, price:15, reserve:2,
      ig:'marta.gil.films', topEvent:{name:'Congreso Bachatísimo', couples:40}, topVenue:{name:'Palacio de Congresos', times:11},
      bio:'Equipo doble y mucho mimo en el montaje. He grabado los mayores congresos del sur. Pregúntame sin compromiso.' },
    { id:'piotr',  name:'Piotr Nowak',    city:'waw', desc:'Slow-motion · 4K',            rating:5.0, reviews:2,  videos:38,  price:6,  reserve:0,
      ig:'piotr.nowak.video', topEvent:{name:'Warsaw Bachata Social', couples:12}, topVenue:{name:'Klub Mokotów', times:8},
      bio:'Slow-motion y 4K. Me encanta el detalle de los pies. Varsovia.' },
    { id:'magda',  name:'Magda Kowalska', city:'kra', desc:'Multicámara',                 rating:5.3, reviews:3,  videos:71,  price:10, reserve:2,
      ig:'magda.k.films', topEvent:{name:'Kraków Bachata Fest', couples:31}, topVenue:{name:'ICE Kraków', times:6},
      bio:'Multicámara bien sincronizada. Cracovia y festivales. Entrega rápida.' }
  ];
  var CAMS_BY_ID = {};
  CAMS.forEach(function(c){ CAMS_BY_ID[c.id] = c; });
  /* tier de precio automático: <7 → $ · 7-12 → $$ · >12 → $$$ */
  function priceTier(p){ return p < 7 ? '$' : (p > 12 ? '$$$' : '$$'); }

  /* reseñas en texto (para la vista de perfil) — stars 0-6, date YYYY-MM-DD */
  var REVIEWS = {
    juan:  [ {by:'Lucía', stars:6, date:'2026-06-12', text:'Plano impecable y me lo mandó al día siguiente.'},
             {by:'Sofía', stars:5, date:'2026-05-28', text:'Muy buen ojo para el momento del giro.'} ],
    ana:   [ {by:'Diego', stars:6, date:'2026-06-14', text:'Edición muy cuidada, parece una peli.'},
             {by:'Marta', stars:6, date:'2026-06-01', text:'La luz y el encuadre, de otro nivel.'},
             {by:'Hugo',  stars:5, date:'2026-04-20', text:'Tardó un poco pero mereció la pena.'} ],
    carlos:[ {by:'Inés',  stars:5, date:'2026-06-10', text:'Estabilidad perfecta, cero tirones.'},
             {by:'Pablo', stars:5, date:'2026-05-15', text:'Entrega en 48h cumplida al minuto.'} ],
    lucia: [ {by:'Ana',   stars:6, date:'2026-06-13', text:'Rapidísima y súper maja.'} ],
    david: [ {by:'Sara',  stars:4, date:'2026-05-30', text:'Dos cámaras, buen resultado.'} ],
    marta: [ {by:'Elena', stars:6, date:'2026-06-11', text:'El montaje a varias cámaras es espectacular.'},
             {by:'Juan',  stars:6, date:'2026-05-20', text:'La mejor del congreso, sin duda.'} ],
    piotr: [ {by:'Kasia', stars:5, date:'2026-06-05', text:'Slow-motion precioso.'} ],
    magda: [ {by:'Tomek', stars:5, date:'2026-06-08', text:'Multicámara muy bien sincronizada.'} ]
  };
  /* dd mmm a partir de YYYY-MM-DD (sin construir Date sin args) */
  function fmtRevDate(s){ var p = s.split('-'); return parseInt(p[2],10) + ' ' + MON[parseInt(p[1],10)-1]; }

  /* recurrence: 'weekly' (salas que se repiten cada semana — van a "Horarios
     salas") | 'oneoff' (fecha concreta: congresos/exterior — van al calendario).
     weekly: weekday (0=dom..6=sáb) + timeLabel. liveCams = check-in hecho. */
  var EVENTS = [
    { id:'fri',   name:'Bachata Friday Night',  country:'es', city:'mad', type:'sala', recurrence:'weekly', weekday:5, timeLabel:'23:00–03:00',
      venue:'Sala Tropic',          camIds:['juan','ana'], liveCams:['juan'] },
    { id:'acad',  name:'Open Class SBK',        country:'es', city:'mad', type:'sala', recurrence:'weekly', weekday:4, timeLabel:'20:30–22:30',
      venue:'Academia Ritmo',       camIds:[] },
    { id:'club',  name:'Caribbean Late Night',  country:'es', city:'bcn', type:'sala', recurrence:'weekly', weekday:6, timeLabel:'00:30–05:30',
      venue:'Sala Caribbean',       camIds:[] },
    { id:'waw1',  name:'Warsaw Bachata Social', country:'pl', city:'waw', type:'sala', recurrence:'weekly', weekday:5, timeLabel:'21:00–00:30',
      venue:'Klub Mokotów',         camIds:['piotr'] },
    { id:'sunset',name:'Bachata Sunset Madrid', country:'es', city:'mad', type:'exterior', sub:'terraza', recurrence:'oneoff',
      venue:'Terraza Plaza España', camIds:['carlos'] },
    { id:'beach', name:'Bachata Beach Party',   country:'es', city:'bcn', type:'exterior', sub:'playa', recurrence:'oneoff',
      venue:'Playa Bogatell',       camIds:['lucia','david'] },
    { id:'waw2',  name:'Vistula Open Air',      country:'pl', city:'waw', type:'exterior', sub:'parque', recurrence:'oneoff',
      venue:'Park Vístula',         camIds:[] },
    { id:'cong',  name:'Congreso Bachatísimo',  country:'es', city:'sev', type:'congreso', recurrence:'oneoff',
      venue:'Palacio de Congresos', camIds:['marta'] },
    { id:'wknd',  name:'Sevilla Weekender',     country:'es', city:'sev', type:'congreso', recurrence:'oneoff',
      venue:'Hotel Triana',         camIds:[] },
    { id:'kra1',  name:'Kraków Bachata Fest',   country:'pl', city:'kra', type:'congreso', recurrence:'oneoff',
      venue:'ICE Kraków',           camIds:['magda'] },
    { id:'verano',name:'Bachata Verano Playa',  country:'es', city:'bcn', type:'exterior', sub:'playa', recurrence:'oneoff',
      venue:'Playa Barceloneta',    camIds:['lucia'] },
    { id:'octmd', name:'Congreso Otoño Madrid', country:'es', city:'mad', type:'congreso', recurrence:'oneoff',
      venue:'IFEMA',                camIds:['juan','ana'] },
    { id:'navmad',name:'Bachata Navideña',      country:'es', city:'mad', type:'exterior', sub:'terraza', recurrence:'oneoff',
      venue:'Mercado de Navidad',   camIds:[] },
    { id:'finsev',name:'Bachatísimo Fin de Año',country:'es', city:'sev', type:'congreso', recurrence:'oneoff',
      venue:'Palacio de Congresos', camIds:['marta'] }
  ];
  var EVENTS_BY_ID = {};
  EVENTS.forEach(function(e){ EVENTS_BY_ID[e.id] = e; });

  /* Horarios:
     - SEMANALES → ocurrencia relativa a ahora (fri/waw1 EN DIRECTO para demo).
     - PUNTUALES → fechas absolutas de 2026, repartidas por todo el año. */
  (function(){
    var H = 3600e3, D = 24 * H, now = Date.now();
    var W = { fri:[-1*H, 3*H], waw1:[-0.5*H, 3.5*H], acad:[2*D, 2*D + 2*H], club:[4*D, 4*D + 5*H] };
    function at(mo,d,hh,mm){ return new Date(2026, mo, d, hh, mm || 0).getTime(); }
    function span(mo,d1,d2){ return [new Date(2026,mo,d1,10,0).getTime(), new Date(2026,mo,d2,23,59).getTime()]; }
    var O = {
      sunset:[at(5,20,19,30), at(5,20,23,30)],   // 20 jun
      beach: [at(5,21,18,0),  at(5,21,23,0)],     // 21 jun
      cong:  span(5,26,28),                        // 26–28 jun
      waw2:  [at(6,5,17,0),   at(6,5,21,0)],      // 5 jul
      wknd:  span(6,10,12),                        // 10–12 jul
      kra1:  span(6,17,19),                        // 17–19 jul
      verano:[at(7,8,18,0),   at(7,8,23,0)],      // 8 ago
      octmd: null,                                 // (octmd abajo)
      navmad:[at(11,12,18,30),at(11,12,23,0)]      // 12 dic
    };
    O.octmd = span(9,23,25);                        // 23–25 oct
    O.finsev = span(11,29,31);                       // 29–31 dic
    EVENTS.forEach(function(e){
      if(W[e.id]){ e.startsAt = now + W[e.id][0]; e.endsAt = now + W[e.id][1]; }
      else if(O[e.id]){ e.startsAt = O[e.id][0]; e.endsAt = O[e.id][1]; }
    });
  })();
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function fmtTime(t){ var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  var DOW = ['dom','lun','mar','mié','jue','vie','sáb'];
  var MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtDate(t){ var d = new Date(t); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function sameDay(a, b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  /* cabecera de fecha: "Hoy" / "Mañana" / fecha normal */
  function dateHeaderLabel(t){
    var d = new Date(t), hoy = new Date(), man = new Date(); man.setDate(hoy.getDate() + 1);
    if(sameDay(d, hoy)) return 'Hoy';
    if(sameDay(d, man)) return 'Mañana';
    return fmtDate(t);
  }
  function evHours(ev){ return fmtTime(ev.startsAt) + '–' + fmtTime(ev.endsAt); }
  /* estado del evento respecto a ahora: previo | directo | terminado */
  function eventStatus(ev){
    var n = Date.now();
    return n < ev.startsAt ? 'previo' : (n > ev.endsAt ? 'terminado' : 'directo');
  }

  /* mis bailes (rol bailarín) — el vídeo NO se guarda aquí: llega por WeTransfer.
     partner.link: none (solo texto) | pending (correo enviado, falta que la
     pareja confirme el baile) | ok (vinculada). La confirmación real es futura. */
  var MY_DANCES = [
    { eventId:'fri',    date:'23 may 2026', song:'Romeo Santos — Propuesta Indecente',
      partner:{ name:'Lucía', link:'ok' },                            camId:'juan',   status:'recibido' },
    { eventId:'fri',    date:'23 may 2026', song:'Prince Royce — Darte un Beso',
      partner:{ name:'Sofía', link:'none' },                          camId:'ana',    status:'enviado' },
    { eventId:'sunset', date:'24 may 2026', song:'Aventura — Obsesión',
      partner:{ name:'Marta', link:'pending', email:'marta@mail.com' }, camId:'carlos', status:'pendiente' },
    { eventId:'cong',   date:'31 may 2026', song:'Juan Luis Guerra — Bachata Rosa',
      partner:{ name:'Elena', link:'none' },                          camId:'marta',  status:'recibido' }
  ];

  /* mis sesiones (rol camarógrafo): cuántas parejas grabé por evento */
  var MY_SESSIONS = [
    { eventId:'fri',    date:'23 may 2026', couples:14, sent:14 },
    { eventId:'sunset', date:'24 may 2026', couples:9,  sent:6 },
    { eventId:'beach',  date:'1 jun 2026',  couples:11, sent:0 }
  ];
