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
  var TYPE_LABELS = { sala:'Salas de baile', congreso:'Congresos', exterior:'Sociales al exterior' };
  var SUB_LABELS  = { all:'Todos', terraza:'Terraza', playa:'Playa', parque:'Parque' };
  /* provincias (nivel entre País y Ciudad): claves p+código INE (España) o
     slug (Polonia). Cada ciudad pertenece a una; ev.prov se deriva de su city. */
  var PROV_LABELS = { all:'Todas', p28:'Madrid', p41:'Sevilla', p08:'Barcelona',
                      pmz:'Mazovia', pmp:'Małopolska' };
  var CITY_PROV = { mad:'p28', sev:'p41', bcn:'p08', waw:'pmz', kra:'pmp' };

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

  /* recurrence: 'weekly' (salas reales que se repiten cada semana → "Horarios
     salas"; weekdays JS 0=dom..6=sáb + timeLabel) | 'oneoff' (fecha concreta:
     congresos/exterior reales con dateStart/dateEnd → calendario).
     Datos reales: salas de sbkapp.es (Madrid), congresos de lasalsadelbaile.com.
     liveCams = check-in ya hecho (demo). */
  var EVENTS = [
  /* === SALAS REALES de Madrid (sbkapp.es), semanales === */
  { id:'s_thehost', name:"The Host", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[2, 3, 4, 5], timeLabel:"23:30–04:00", venue:"C. de Ferraz, 38", coords:[-3.71731,40.42631], camIds:["juan", "ana"], liveCams:["juan"] },
  { id:'s_salacalips', name:"Sala Calipso", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[5, 6], timeLabel:"22:00–04:00", venue:"C. de Uruguay, 5", coords:[-3.67582,40.45529], camIds:[] },
  { id:'s_salsebasti', name:"Salsebastián", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[5, 6], timeLabel:"22:00–04:00", venue:"Av. Fuente Nueva, 5, Nave 16B", coords:[-3.61069,40.54729], camIds:[] },
  { id:'s_azucar', name:"Azúcar", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[5, 6], timeLabel:"23:00–05:00", venue:"C. de Atocha, 107", coords:[-3.69517,40.41057], camIds:["lucia"] },
  { id:'s_salabongos', name:"Sala Bongos", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[5, 6], timeLabel:"23:00–05:00", venue:"C. de Bravo Murillo, 52", coords:[-3.70304,40.45318], camIds:["david"] },
  { id:'s_laermita', name:"La Ermita", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[6, 0], timeLabel:"18:00–22:00", venue:"P.º de la Virgen del Puerto, 4", coords:[-3.72125,40.41552], camIds:[] },
  { id:'s_karamelosa', name:"Karamelo (Sala Cha3)", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[6], timeLabel:"23:00–05:00", venue:"Calle de San Pol de Mar, 1", coords:[-3.72658,40.42392], camIds:[] },
  { id:'s_catslatind', name:"Cats Latin Dance", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[0], timeLabel:"20:00–02:00", venue:"C. de Julián Romea, 4", coords:[-3.71343,40.44278], camIds:[] },
  { id:'s_kumarah540', name:"Kumarah 5.40", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[4, 0], timeLabel:"22:00–03:00", venue:"C. Sofía, 3", coords:[-3.89313,40.49977], camIds:[] },
  { id:'s_salajowke', name:"Sala Jowke", country:'es', city:'mad', type:'sala', recurrence:'weekly', weekdays:[0], timeLabel:"20:00–02:00", venue:"Av. San Martín de Valdeiglesias, 22", coords:[-3.82743,40.35819], camIds:[] },
  /* === CONGRESOS REALES (lasalsadelbaile.com), fechas concretas === */
  /* pasados (para "Ver eventos pasados" del calendario) */
  { id:'c_valbaila', name:"Valencia Baila 2026 · Spring", country:'es', city:'sev', type:'congreso', recurrence:'oneoff', dateStart:'2026-04-24', dateEnd:'2026-04-26', venue:"Sevilla", camIds:["lucia"] },
  { id:'c_aura', name:"Aura Latin Festival", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-05-15', dateEnd:'2026-05-17', venue:"Madrid", camIds:["juan", "carlos"] },
  { id:'c_urban', name:"URBAN Bachata Festival 2026", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-06-12', dateEnd:'2026-06-14', venue:"Occidental Aranjuez", coords:[-3.60433,40.05702], camIds:["juan", "ana"] },
  { id:'c_madsum', name:"Madrid Summer Festival 2026", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-06-26', dateEnd:'2026-06-28', venue:"Hotel Isla de la Garena", coords:[-3.40119,40.48613], camIds:["carlos"] },
  { id:'c_bigsoc', name:"The Big Social Dance", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-08-09', dateEnd:'2026-08-10', venue:"Madrid", camIds:[] },
  { id:'c_bcnsum', name:"Bachatazo Barcelona Summer 2026", country:'es', city:'bcn', type:'congreso', recurrence:'oneoff', dateStart:'2026-08-13', dateEnd:'2026-08-17', venue:"Barcelona", camIds:["lucia", "david"] },
  { id:'c_back', name:"Back to School 2026 · Madrid", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-10-30', dateEnd:'2026-11-01', venue:"Madrid", camIds:["juan"] },
  { id:'c_full', name:"Full Bachata 2026", country:'es', city:'mad', type:'congreso', recurrence:'oneoff', dateStart:'2026-11-27', dateEnd:'2026-11-29', venue:"Madrid", camIds:[] },
  { id:'c_emotion', name:"E-Motion Sevilla Bachata Congress", country:'es', city:'sev', type:'congreso', recurrence:'oneoff', dateStart:'2026-11-27', dateEnd:'2026-11-29', venue:"Sevilla", camIds:["marta"] },
  /* === EXTERIOR (al aire libre), fechas concretas === */
  { id:'e_sunset', name:"Bachata Sunset Madrid", country:'es', city:'mad', type:'exterior', sub:'terraza', recurrence:'oneoff', dateStart:'2026-06-20', dateEnd:'2026-06-20', venue:"Terraza Plaza España", coords:[-3.71088,40.42345], camIds:["carlos"] },
  { id:'e_beach', name:"Bachata Beach Party", country:'es', city:'bcn', type:'exterior', sub:'playa', recurrence:'oneoff', dateStart:'2026-07-11', dateEnd:'2026-07-11', venue:"Playa Bogatell", camIds:["lucia", "david"] }
  ];
  /* eventos creados por el usuario (wizard "Crear evento") — se funden con los
     demo al cargar; llevan mine:true para poder gestionarlos/borrarlos */
  try{
    (JSON.parse(localStorage.getItem('cilap-myevents')) || []).forEach(function(e){ e.mine = true; EVENTS.push(e); });
  }catch(err){}

  var EVENTS_BY_ID = {};
  EVENTS.forEach(function(e){ EVENTS_BY_ID[e.id] = e; e.prov = CITY_PROV[e.city]; });

  /* Horarios (calculados):
     - SEMANALES → próxima ocurrencia (día de weekdays + hora de timeLabel).
     - PUNTUALES → fechas reales dateStart/dateEnd.
     DEMO: la sala "The Host" se fuerza EN DIRECTO ahora para probar check-in. */
  (function(){
    var H = 3600e3, now = Date.now(), nd = new Date();
    function tlMins(tl){                 // "HH:MM–HH:MM" → [iniMin, finMin] (fin puede pasar de medianoche)
      var p = tl.replace('–','-').split('-');
      function m(s){ var x = s.split(':'); return (+x[0]) * 60 + (+x[1]); }
      var s = m(p[0]), e = m(p[1]); if(e <= s) e += 1440; return [s, e];
    }
    function nextWeekly(weekdays, sMin, durMs){
      for(var add = 0; add < 14; add++){
        var d = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate() + add, Math.floor(sMin/60), sMin % 60, 0, 0);
        if(weekdays.indexOf(d.getDay()) !== -1 && d.getTime() + durMs >= now) return d.getTime();
      }
      return now;
    }
    EVENTS.forEach(function(e){
      if(e.recurrence === 'weekly'){
        var tl = tlMins(e.timeLabel), dur = (tl[1] - tl[0]) * 60000;
        var st = nextWeekly(e.weekdays || [e.weekday], tl[0], dur);
        e.startsAt = st; e.endsAt = st + dur;
      } else if(e.dateStart){
        var a = e.dateStart.split('-'), b = (e.dateEnd || e.dateStart).split('-');
        if(e.timeLabel && e.dateStart === (e.dateEnd || e.dateStart)){
          /* puntual de UN día con horario (wizard exterior): horas reales */
          var tl2 = tlMins(e.timeLabel);
          e.startsAt = new Date(+a[0], +a[1]-1, +a[2], Math.floor(tl2[0]/60), tl2[0]%60).getTime();
          e.endsAt   = e.startsAt + (tl2[1] - tl2[0]) * 60000;
        } else {
          e.startsAt = new Date(+a[0], +a[1]-1, +a[2], 10, 0).getTime();
          e.endsAt   = new Date(+b[0], +b[1]-1, +b[2], 23, 59).getTime();
        }
      }
    });
    /* CONGRESOS: pases de DÍA/NOCHE por día (los administra quien crea el
       evento). Si no traen `passes` explícito (los del wizard sí lo traen),
       se sintetiza el patrón típico: 1er día solo NOCHE (fiesta de
       bienvenida), días centrales DÍA+NOCHE, último día solo DÍA.
       Horas por defecto: día 11:00–20:00 · noche 22:00–04:00. */
    EVENTS.forEach(function(e){
      if(e.type !== 'congreso' || !e.dateStart || e.passes) return;
      var a = e.dateStart.split('-'), b = (e.dateEnd || e.dateStart).split('-');
      var d0 = new Date(+a[0], +a[1]-1, +a[2]), d1 = new Date(+b[0], +b[1]-1, +b[2]);
      var days = Math.round((d1 - d0) / 86400000) + 1;
      e.passes = [];
      for(var i = 0; i < days; i++){
        var d = new Date(d0); d.setDate(d0.getDate() + i);
        var iso = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
        e.passes.push({
          date: iso,
          day:   (i === 0 && days > 1)        ? null : { start:'11:00', end:'20:00' },
          night: (i === days - 1 && days > 1) ? null : { start:'22:00', end:'04:00' }
        });
      }
    });
    var live = EVENTS_BY_ID['s_thehost'];   // demo en directo
    if(live){ live.startsAt = now - 1 * H; live.endsAt = now + 3 * H; }
  })();
  var PASS_LABEL = { day:'Pase de día', night:'Pase de noche' };
  /* expande un congreso en sus pases concretos → [{startsAt, endsAt, passType}] */
  function congressOccs(ev){
    if(!ev.passes) return [];
    var out = [];
    ev.passes.forEach(function(p){
      var d = p.date.split('-');
      ['day','night'].forEach(function(k){
        var t = p[k]; if(!t) return;
        var s = t.start.split(':'), e = t.end.split(':');
        var st = new Date(+d[0], +d[1]-1, +d[2], +s[0], +s[1]).getTime();
        var en = new Date(+d[0], +d[1]-1, +d[2], +e[0], +e[1]).getTime();
        if(en <= st) en += 86400000;   // el pase de noche cruza la medianoche
        out.push({ startsAt: st, endsAt: en, passType: k });
      });
    });
    return out;
  }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function fmtTime(t){ var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  var DOW = ['dom','lun','mar','mié','jue','vie','sáb'];
  var MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtDate(t){ var d = new Date(t); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function sameDay(a, b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  /* cabecera de fecha: "Hoy · lun 15 jun" / "Mañana · …" / fecha normal */
  function dateHeaderLabel(t){
    var d = new Date(t), hoy = new Date(), man = new Date(); man.setDate(hoy.getDate() + 1);
    if(sameDay(d, hoy)) return 'Hoy · ' + fmtDate(t);
    if(sameDay(d, man)) return 'Mañana · ' + fmtDate(t);
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
    { eventId:'s_thehost', date:'12 jun 2026', song:'Romeo Santos — Propuesta Indecente',
      partner:{ name:'Lucía', link:'ok' },                             camId:'juan',   status:'recibido' },
    { eventId:'s_thehost', date:'12 jun 2026', song:'Prince Royce — Darte un Beso',
      partner:{ name:'Sofía', link:'none' },                           camId:'ana',    status:'enviado' },
    { eventId:'e_sunset',  date:'20 jun 2026', song:'Aventura — Obsesión',
      partner:{ name:'Marta', link:'pending', email:'marta@mail.com' }, camId:'carlos', status:'pendiente' },
    { eventId:'c_urban',   date:'13 jun 2026', song:'Juan Luis Guerra — Bachata Rosa',
      partner:{ name:'Elena', link:'none' },                           camId:'juan',   status:'recibido' }
  ];

  /* mis sesiones (rol camarógrafo): cuántas parejas grabé por evento */
  var MY_SESSIONS = [
    { eventId:'s_thehost', date:'12 jun 2026', couples:14, sent:14 },
    { eventId:'e_sunset',  date:'20 jun 2026', couples:9,  sent:6 },
    { eventId:'c_urban',   date:'13 jun 2026', couples:11, sent:0 }
  ];
