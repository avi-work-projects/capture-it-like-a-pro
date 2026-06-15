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

  /* liveCams = camarógrafos que YA han hecho check-in (cola abierta) */
  var EVENTS = [
    { id:'fri',   name:'Bachata Friday Night',  country:'es', city:'mad', type:'sala',
      venue:'Sala Tropic',          when:'Vie',     camIds:['juan','ana'], liveCams:['juan'] },
    { id:'acad',  name:'Open Class SBK',        country:'es', city:'mad', type:'sala',
      venue:'Academia Ritmo',       when:'Jue',     camIds:[] },
    { id:'sunset',name:'Bachata Sunset Madrid', country:'es', city:'mad', type:'exterior', sub:'terraza',
      venue:'Terraza Plaza España', when:'Sáb',     camIds:['carlos'] },
    { id:'beach', name:'Bachata Beach Party',   country:'es', city:'bcn', type:'exterior', sub:'playa',
      venue:'Playa Bogatell',       when:'Dom',     camIds:['lucia','david'] },
    { id:'club',  name:'Caribbean Late Night',  country:'es', city:'bcn', type:'sala',
      venue:'Sala Caribbean',       when:'Sáb',     camIds:[] },
    { id:'cong',  name:'Congreso Bachatísimo',  country:'es', city:'sev', type:'congreso',
      venue:'Palacio de Congresos', when:'31 may',  camIds:['marta'] },
    { id:'wknd',  name:'Sevilla Weekender',     country:'es', city:'sev', type:'congreso',
      venue:'Hotel Triana',         when:'13–15 jun', camIds:[] },
    { id:'waw1',  name:'Warsaw Bachata Social', country:'pl', city:'waw', type:'sala',
      venue:'Klub Mokotów',         when:'Vie',     camIds:['piotr'] },
    { id:'waw2',  name:'Vistula Open Air',      country:'pl', city:'waw', type:'exterior', sub:'parque',
      venue:'Park Vístula',         when:'Dom',     camIds:[] },
    { id:'kra1',  name:'Kraków Bachata Fest',   country:'pl', city:'kra', type:'congreso',
      venue:'ICE Kraków',           when:'20–22 jun', camIds:['magda'] }
  ];
  var EVENTS_BY_ID = {};
  EVENTS.forEach(function(e){ EVENTS_BY_ID[e.id] = e; });

  /* horarios mock RELATIVOS a ahora, para poder probar los tres estados:
     fri y waw1 están EN DIRECTO ahora mismo; acad ya terminó; el resto, futuro */
  (function(){
    var H = 3600e3, D = 24 * H, now = Date.now();
    var T = { fri:[-1*H, 3*H],      acad:[-3*D, -3*D + 2*H],
              sunset:[D + 6*H, D + 10*H], beach:[2*D, 2*D + 5*H],
              club:[3*D, 3*D + 5*H],     cong:[5*D, 5*D + 12*H],
              wknd:[8*D, 10*D],          waw1:[-0.5*H, 3.5*H],
              waw2:[4*D, 4*D + 4*H],     kra1:[12*D, 14*D] };
    EVENTS.forEach(function(e){
      e.startsAt = now + T[e.id][0];
      e.endsAt   = now + T[e.id][1];
    });
  })();
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function fmtTime(t){ var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  var DOW = ['dom','lun','mar','mié','jue','vie','sáb'];
  var MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtDate(t){ var d = new Date(t); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
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
