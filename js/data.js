/* data.js — capa de ACCESO a datos: hace los "JOIN" sobre las tablas de
   js/db.js (window.DB) y construye las estructuras de runtime que consume el
   resto de la app (EVENTS, CAMS, etiquetas…). PARA CAMBIAR DATOS: editar
   db.js; aquí solo vive la lógica de derivación/joins y los helpers puros. */

  /* ── etiquetas y relaciones geográficas, derivadas de DB ── */
  var CITY_LABELS = { all:'Todas' };
  var PROV_LABELS = { all:'Todas' };
  var CITY_PROV = {};       // city → province
  var CITY_COUNTRY = {};    // city → country (via province)
  var PROV_COUNTRY = {};
  DB.provinces.forEach(function(p){ PROV_LABELS[p.id] = p.name; PROV_COUNTRY[p.id] = p.country; });
  DB.cities.forEach(function(c){
    CITY_LABELS[c.id] = c.name;
    CITY_PROV[c.id] = c.prov;
    CITY_COUNTRY[c.id] = PROV_COUNTRY[c.prov];
  });
  var TYPE_LABELS = {};
  DB.types.forEach(function(t){ TYPE_LABELS[t.id] = t.name; });
  var SUB_LABELS = { all:'Todos' };
  DB.subtypes.forEach(function(s){ SUB_LABELS[s.id] = s.name; });

  /* ── camarógrafos + reseñas (join reviews.cam → cams.id) ── */
  var CAMS = DB.cams;
  var CAMS_BY_ID = {};
  CAMS.forEach(function(c){ CAMS_BY_ID[c.id] = c; });
  /* tier de precio automático: <7 → $ · 7-12 → $$ · >12 → $$$ */
  function priceTier(p){ return p < 7 ? '$' : (p > 12 ? '$$$' : '$$'); }

  var REVIEWS = {};
  DB.reviews.forEach(function(r){ (REVIEWS[r.cam] = REVIEWS[r.cam] || []).push(r); });
  /* dd mmm a partir de YYYY-MM-DD (sin construir Date sin args) */
  function fmtRevDate(s){ var p = s.split('-'); return parseInt(p[2],10) + ' ' + MON[parseInt(p[1],10)-1]; }

  /* ── eventos: JOIN de DB.events + event_cams + passes ──
     recurrence 'weekly' (weekdays 0=dom..6=sáb + timeLabel) | 'oneoff'
     (dateStart/dateEnd). country/prov se derivan de la ciudad. */
  var EVENTS = DB.events.map(function(rec){
    var e = Object.assign({}, rec);
    e.country = CITY_COUNTRY[e.city];
    e.prov = CITY_PROV[e.city];
    /* cámaras del evento (relación N:M) + las que ya hicieron check-in */
    e.camIds = []; e.liveCams = [];
    DB.event_cams.forEach(function(ec){
      if(ec.event !== e.id) return;
      e.camIds.push(ec.cam);
      if(ec.live) e.liveCams.push(ec.cam);
    });
    if(!e.liveCams.length) delete e.liveCams;
    /* pases de congreso (tabla passes; [ini,fin] → {start,end}) */
    var ps = DB.passes.filter(function(p){ return p.event === e.id; });
    if(ps.length){
      e.passes = ps.map(function(p){
        return { date: p.date,
                 day:   p.day   ? { start:p.day[0],   end:p.day[1] }   : null,
                 night: p.night ? { start:p.night[0], end:p.night[1] } : null };
      });
    }
    return e;
  });
  /* eventos creados por el usuario (wizard "Crear evento") — se funden con los
     demo al cargar; llevan mine:true para poder gestionarlos/borrarlos */
  try{
    (JSON.parse(localStorage.getItem('cilap-myevents')) || []).forEach(function(e){
      e.mine = true;
      e.country = e.country || CITY_COUNTRY[e.city];
      EVENTS.push(e);
    });
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

  /* mis bailes / mis sesiones — desde las tablas DB.my_dances/my_sessions
     (partner.link: none | pending | ok; status: pendiente→enviado→recibido) */
  var MY_DANCES = DB.my_dances.map(function(d){
    return { eventId:d.event, date:d.date, song:d.song, partner:d.partner, camId:d.cam, status:d.status };
  });
  var MY_SESSIONS = DB.my_sessions.map(function(s){
    return { eventId:s.event, date:s.date, couples:s.couples, sent:s.sent };
  });
