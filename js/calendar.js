/* calendar.js — vista de calendario de eventos (año → mes / agenda) y horarios
   de salas. Estilo inspirado en el calendario anual de horas-excelia: rejilla
   de meses + eventos multi-día como barras "formato viaje".
   Usa globales puras de data.js (DOW, MON, fmtDate, evHours, eventStatus,
   CITY_LABELS, TYPE_LABELS). No toca el estado de app.js: recibe los eventos
   ya filtrados y callbacks para navegar. */
(function(){
  'use strict';

  var MNS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var DOW_H = ['L','M','X','J','V','S','D'];                 // lun-first
  var DOW_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  var TYPE_COLOR = { sala:'#c46bff', congreso:'#3da9ff', exterior:'#ffd60a' };
  var MAX_BAR_ROWS = 5;

  function colOf(date){ return (date.getDay() + 6) % 7; }   // lun=0 .. dom=6
  function dayStart(y,m,d){ return new Date(y,m,d,0,0,0,0).getTime(); }
  function dayEnd(y,m,d){ return new Date(y,m,d,23,59,59,999).getTime(); }
  function coversDay(ev, y, m, d){
    return ev.startsAt <= dayEnd(y,m,d) && ev.endsAt >= dayStart(y,m,d);
  }
  function isMultiDay(ev){ return (ev.endsAt - ev.startsAt) > 86400000 * 1.1; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  /* minutos inicio/fin de un timeLabel "23:00–05:00" (cruza medianoche → +1440) */
  function tlMins(tl){
    var p = (tl||'').replace('–','-').replace('—','-').split('-');
    function m(s){ var x = s.trim().split(':'); return (+x[0])*60 + (+x[1]); }
    var s = m(p[0]||'0:0'), e = m(p[1]||'0:0'); if(e <= s) e += 1440; return [s, e];
  }
  /* próximas N fechas concretas de una sala (a partir de hoy) */
  function upcomingDates(sala, n){
    var days = sala.weekdays || [sala.weekday];
    var tl = tlMins(sala.timeLabel), durMs = (tl[1]-tl[0])*60000;
    var now = Date.now(), nd = new Date(), out = [];
    for(var add=0; add<70 && out.length<n; add++){
      var d = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate()+add, Math.floor(tl[0]/60), tl[0]%60, 0, 0);
      if(days.indexOf(d.getDay()) !== -1 && d.getTime()+durMs >= now) out.push({ start:d.getTime(), end:d.getTime()+durMs });
    }
    return out;
  }

  /* ───────────────────────── VISTA AÑO (12 meses con puntos) ───────────── */
  function renderYear(container, year, events, cb){
    var today = new Date(); today.setHours(0,0,0,0);
    var h = '<div class="cal-yearnav">' +
      '<button class="cal-nav" data-act="prevY">‹</button>' +
      '<span class="cal-year">' + year + '</span>' +
      '<button class="cal-nav" data-act="nextY">›</button></div>';
    h += '<div class="cal-months">';
    for(var m=0; m<12; m++){
      h += '<button class="cal-mini" data-month="' + m + '">';
      h += '<div class="cal-mini-name">' + MNS[m] + '</div>';
      h += '<div class="cal-mini-grid">';
      DOW_H.forEach(function(d){ h += '<span class="cal-mini-h">' + d + '</span>'; });
      var first = new Date(year, m, 1), last = new Date(year, m+1, 0);
      var lead = colOf(first);
      for(var i=0;i<lead;i++) h += '<span class="cal-mini-d out"></span>';
      for(var d=1; d<=last.getDate(); d++){
        var evs = events.filter(function(ev){ return coversDay(ev, year, m, d); });
        var isToday = today.getFullYear()===year && today.getMonth()===m && today.getDate()===d;
        var dots = '';
        if(evs.length){
          var types = {};
          evs.forEach(function(ev){ types[ev.type] = true; });
          Object.keys(types).slice(0,3).forEach(function(t){
            dots += '<i style="background:' + (TYPE_COLOR[t]||'#888') + '"></i>';
          });
        }
        h += '<span class="cal-mini-d' + (evs.length?' has':'') + (isToday?' today':'') + '">' +
             '<b>' + d + '</b><span class="cal-mini-dots">' + dots + '</span></span>';
      }
      h += '</div></button>';
    }
    h += '</div>';
    container.innerHTML = h;
    container.querySelector('[data-act="prevY"]').addEventListener('click', function(){ cb.onYear(year-1); });
    container.querySelector('[data-act="nextY"]').addEventListener('click', function(){ cb.onYear(year+1); });
    container.querySelectorAll('.cal-mini').forEach(function(b){
      b.addEventListener('click', function(){ cb.onMonth(parseInt(b.dataset.month,10)); });
    });
  }

  /* ───────────────────────── VISTA MES (calendario / agenda) ───────────── */
  function renderMonth(container, year, month, events, sub, nav, cb){
    var today = new Date(); today.setHours(0,0,0,0);
    nav = nav || { canPrev:true, canNext:true, past:false };
    /* fila superior: año (vuelve a la rejilla anual) + switch "Ver eventos pasados" */
    var h = '<div class="cal-monthtop">' +
      '<button class="cal-nav" data-act="back">‹ ' + year + '</button>' +
      '<button class="cal-pastsw' + (nav.past?' on':'') + '" data-act="past"><span class="sw-track"><span class="sw-knob"></span></span>Ver eventos pasados</button>' +
      '</div>';
    h += '<div class="cal-monthnav">' +
      '<button class="cal-nav" data-act="prevM"' + (nav.canPrev?'':' disabled') + '>‹</button>' +
      '<span class="cal-mtitle">' + MNS[month] + ' ' + year + '</span>' +
      '<button class="cal-nav" data-act="nextM"' + (nav.canNext?'':' disabled') + '>›</button></div>';
    h += '<div class="tabbar" id="calSubTabs">' +
      '<button class="fchip' + (sub==='cal'?' on':'') + '" data-sub="cal">Calendario</button>' +
      '<button class="fchip' + (sub==='agenda'?' on':'') + '" data-sub="agenda">Agenda</button>' +
      '</div>';

    // eventos del mes (que intersecten el mes)
    var mEvs = events.filter(function(ev){
      return ev.startsAt <= dayEnd(year,month,new Date(year,month+1,0).getDate()) &&
             ev.endsAt >= dayStart(year,month,1);
    });

    if(sub === 'agenda'){
      h += renderAgenda(year, month, mEvs);
    } else {
      h += renderGrid(year, month, mEvs, today);
    }
    container.innerHTML = h;

    container.querySelector('[data-act="back"]').addEventListener('click', cb.onBack);
    container.querySelector('[data-act="past"]').addEventListener('click', cb.onTogglePast);
    var pv = container.querySelector('[data-act="prevM"]'), nx = container.querySelector('[data-act="nextM"]');
    if(nav.canPrev) pv.addEventListener('click', function(){ cb.onStep(-1); });
    if(nav.canNext) nx.addEventListener('click', function(){ cb.onStep(1); });
    container.querySelectorAll('#calSubTabs .fchip').forEach(function(t){
      t.addEventListener('click', function(){ cb.onSub(t.dataset.sub); });
    });
    container.querySelectorAll('[data-ev]').forEach(function(el){
      el.addEventListener('click', function(){ cb.onEvent(el.dataset.ev); });
    });
  }

  function renderGrid(year, month, mEvs, today){
    /* todos los eventos (puntuales incluidos) se pintan como barras con texto:
       los de un día ocupan una sola columna */
    var allEv = mEvs;
    var first = new Date(year, month, 1), last = new Date(year, month+1, 0);
    var h = '<div class="cal-grid"><div class="cal-grid-h">';
    DOW_H.forEach(function(d){ h += '<span>' + d + '</span>'; });
    h += '</div>';
    // construir semanas (lun-first) que cubren el mes
    var cur = new Date(year, month, 1 - colOf(first));
    while(cur <= last){
      var wk = [];
      for(var i=0;i<7;i++){ wk.push(new Date(cur.getFullYear(),cur.getMonth(),cur.getDate())); cur.setDate(cur.getDate()+1); }
      var wStart = dayStart(wk[0].getFullYear(),wk[0].getMonth(),wk[0].getDate());
      var wEnd = dayEnd(wk[6].getFullYear(),wk[6].getMonth(),wk[6].getDate());
      // barras de eventos que intersectan esta semana (recortadas al mes)
      var bars = [];
      allEv.forEach(function(ev){
        if(ev.endsAt < wStart || ev.startsAt > wEnd) return;
        var cs = 0, ce = 6;
        while(cs<=6 && !(coversDay(ev, wk[cs].getFullYear(), wk[cs].getMonth(), wk[cs].getDate()) && wk[cs].getMonth()===month)) cs++;
        while(ce>=cs && !(coversDay(ev, wk[ce].getFullYear(), wk[ce].getMonth(), wk[ce].getDate()) && wk[ce].getMonth()===month)) ce--;
        if(cs>ce) return;
        bars.push({ ev:ev, cs:cs, ce:ce, row:-1 });
      });
      // asignación greedy de filas (sin solapamiento)
      var occ = []; for(var r=0;r<MAX_BAR_ROWS;r++) occ.push([]);
      bars.forEach(function(b){
        for(var r=0;r<MAX_BAR_ROWS;r++){
          var ok = occ[r].every(function(x){ return b.ce < x[0] || b.cs > x[1]; });
          if(ok){ b.row = r; occ[r].push([b.cs,b.ce]); break; }
        }
      });
      var nRows = bars.reduce(function(mx,b){ return Math.max(mx, b.row+1); }, 0);
      h += '<div class="cal-week" style="--bars:' + nRows + '">';
      // celdas de día
      for(var di=0; di<7; di++){
        var d = wk[di], inM = d.getMonth()===month;
        var isT = inM && d.getTime()===today.getTime();
        var wknd = di>=5;
        /* cierre del cuadrado: cada celda lleva borde sup+izq; añadimos der/inf
           cuando el vecino es de otro mes (o es el límite) para que NO queden
           cuadrados abiertos junto a las casillas "fuera de mes" */
        var edge = '';
        if(inM){
          var D = d.getDate(), L = last.getDate();
          if(di === 6 || D === L)  edge += ' r';   // última columna o último día del mes
          if(D + 7 > L)            edge += ' b';   // no hay día del mes justo debajo
        }
        h += '<div class="cal-day' + (inM?'':' out') + (isT?' today':'') + (wknd?' wknd':'') + edge + '">' +
             '<span class="cal-dn">' + (inM?d.getDate():'') + '</span>' +
             '</div>';
      }
      // barras superpuestas
      bars.forEach(function(b){
        var leftPct = (b.cs/7)*100, wPct = ((b.ce-b.cs+1)/7)*100;
        var col = TYPE_COLOR[b.ev.type] || '#888';
        var rounded = (coversDay(b.ev, wk[b.cs].getFullYear(),wk[b.cs].getMonth(),wk[b.cs].getDate()) && b.ev.startsAt >= wStart);
        var roundedE = (b.ev.endsAt <= wEnd);
        h += '<button class="cal-bar' + (rounded?' s':'') + (roundedE?' e':'') + '" data-ev="' + b.ev.id + '" ' +
             'style="left:' + leftPct.toFixed(2) + '%;width:' + wPct.toFixed(2) + '%;top:calc(var(--cal-dn-h) + ' + b.row + '*var(--cal-bar-h));' +
             'background:' + col + '22;border-color:' + col + ';color:' + col + '">' +
             '<span>' + esc(b.ev.name) + '</span></button>';
      });
      h += '</div>';
    }
    h += '</div>';
    if(!mEvs.length) h += '<p class="cal-empty">No hay eventos puntuales este mes.</p>';
    return h;
  }

  function renderAgenda(year, month, mEvs){
    var list = mEvs.slice().sort(function(a,b){ return a.startsAt - b.startsAt; });
    if(!list.length) return '<p class="cal-empty">No hay eventos puntuales este mes.</p>';
    var h = '<div class="evts" style="margin-top:14px">';
    var lastKey = null;
    list.forEach(function(ev){
      var d = new Date(ev.startsAt), key = d.getDate();
      if(key !== lastKey){ h += '<div class="date-head">' + dateHeaderLabel(ev.startsAt) + '</div>'; lastKey = key; }
      var when = isMultiDay(ev) ? (fmtDate(ev.startsAt) + ' – ' + fmtDate(ev.endsAt)) : evHours(ev);
      var col = TYPE_COLOR[ev.type] || '#888';
      h += '<button class="evt t-' + ev.type + '" data-ev="' + ev.id + '" style="border-left-color:' + col + '">' +
           '<div class="evt-head"><span class="evt-name">' + esc(ev.name) + '</span></div>' +
           '<span class="evt-meta">' + when + ' · ' + ev.venue + ' · ' + (CITY_LABELS[ev.city]||ev.city) + '</span></button>';
    });
    h += '</div>';
    return h;
  }

  /* ───────────────────────── HORARIOS SALAS (semanales) ─────────────────
     Dos niveles: 1) lista de salas disponibles → 2) al pulsar una sala, su
     horario semanal (los días que se repite y a qué hora). */
  function renderHorarios(container, weekly, selId, sub, cb){
    var order = [1,2,3,4,5,6,0];   // lun..dom
    var h;
    if(selId == null){
      /* nivel 1: salas de baile disponibles + buscador */
      h = '<div class="sala-search"><input type="text" id="salaSearch" placeholder="Buscar sala…" autocomplete="off"></div>';
      h += '<p class="res-count">Salas de baile disponibles</p>';
      if(!weekly.length){
        h += '<div class="notice" style="margin-top:12px"><span class="nosig">Sin salas</span><p>No hay salas semanales con esos filtros.</p></div>';
      } else {
        var sorted = weekly.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
        sorted.forEach(function(ev){
          var nd = (ev.weekdays || [ev.weekday]).length;
          h += '<button class="evt t-sala" data-sala="' + ev.id + '" data-name="' + esc(ev.name).toLowerCase() + ' ' + esc(ev.venue).toLowerCase() + '">' +
               '<div class="evt-head"><span class="evt-name">' + esc(ev.name) + '</span>' +
                 '<span class="evt-badges"><span class="evt-cams on">' + nd + ' día' + (nd>1?'s':'') + '/sem</span></span></div>' +
               '<span class="evt-meta">' + ev.venue + ' · ' + (CITY_LABELS[ev.city]||ev.city) + '</span></button>';
        });
        h += '<p class="cal-empty" id="salaSearchEmpty" hidden>Ninguna sala coincide con la búsqueda.</p>';
      }
    } else {
      /* nivel 2: horario semanal de la sala elegida */
      var sala = null;
      weekly.forEach(function(e){ if(e.id === selId) sala = e; });
      if(!sala){ container.innerHTML = ''; return; }
      var days = (sala.weekdays || [sala.weekday]).slice();
      var tab = (sub === 'proximos') ? 'proximos' : 'horario';
      h = '<div class="cal-monthnav"><button class="cal-nav" data-act="horBack">‹ Salas</button></div>';
      h += '<div class="sala-head"><b>' + esc(sala.name) + '</b>' +
           '<span class="evt-meta">' + sala.venue + ' · ' + (CITY_LABELS[sala.city]||sala.city) + '</span></div>';
      /* dos pestañas: Horario semanal · Próximos días */
      h += '<div class="tabbar" id="salaTabs">' +
        '<button class="fchip' + (tab==='horario'?' on':'') + '" data-stab="horario">Horario semanal</button>' +
        '<button class="fchip' + (tab==='proximos'?' on':'') + '" data-stab="proximos">Próximos días</button>' +
      '</div>';
      if(tab === 'horario'){
        order.forEach(function(wd){
          if(days.indexOf(wd) === -1) return;
          h += '<div class="sala-day"><span class="sala-dow">' + DOW_FULL[(wd+6)%7] + '</span>' +
               '<span class="evt-time">🕒 ' + (sala.timeLabel || '—') + '</span></div>';
        });
      } else {
        /* próximos días concretos: cada uno es un evento de un día → apuntarte */
        var occ = upcomingDates(sala, 10);
        h += '<p class="res-count">Elige un día para apuntarte</p>';
        if(!occ.length){
          h += '<p class="cal-empty">Sin próximas fechas.</p>';
        } else {
          occ.forEach(function(o){
            var d = new Date(o.start);
            h += '<button class="evt t-sala" data-occ="' + o.start + '_' + o.end + '">' +
                 '<div class="evt-head"><span class="evt-name">' + DOW_FULL[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MNS[d.getMonth()].toLowerCase() + '</span>' +
                 '<span class="evt-badges"><span class="evt-cams on">Apuntarme ›</span></span></div>' +
                 (sala.timeLabel ? '<span class="evt-time">🕒 ' + sala.timeLabel + '</span>' : '') + '</button>';
          });
        }
      }
    }
    container.innerHTML = h;
    var back = container.querySelector('[data-act="horBack"]');
    if(back) back.addEventListener('click', cb.onBack);
    container.querySelectorAll('[data-sala]').forEach(function(el){
      el.addEventListener('click', function(){ cb.onSala(el.dataset.sala); });
    });
    container.querySelectorAll('#salaTabs .fchip').forEach(function(t){
      t.addEventListener('click', function(){ cb.onSub(t.dataset.stab); });
    });
    container.querySelectorAll('[data-occ]').forEach(function(el){
      el.addEventListener('click', function(){ var p = el.dataset.occ.split('_'); cb.onOccurrence(selId, +p[0], +p[1]); });
    });
    /* buscador de salas: filtra ocultando tarjetas (sin re-render → no pierde foco) */
    var search = container.querySelector('#salaSearch');
    if(search){
      var norm = function(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
      search.addEventListener('input', function(){
        var q = norm(this.value.trim()), shown = 0;
        container.querySelectorAll('[data-sala]').forEach(function(el){
          var ok = !q || norm(el.dataset.name).indexOf(q) !== -1;
          el.hidden = !ok; if(ok) shown++;
        });
        var empty = container.querySelector('#salaSearchEmpty');
        if(empty) empty.hidden = shown > 0;
      });
    }
  }

  window.Calendar = { renderYear:renderYear, renderMonth:renderMonth, renderHorarios:renderHorarios };
})();
