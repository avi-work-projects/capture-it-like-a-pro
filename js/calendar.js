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
  var MAX_BAR_ROWS = 3;

  function colOf(date){ return (date.getDay() + 6) % 7; }   // lun=0 .. dom=6
  function dayStart(y,m,d){ return new Date(y,m,d,0,0,0,0).getTime(); }
  function dayEnd(y,m,d){ return new Date(y,m,d,23,59,59,999).getTime(); }
  function coversDay(ev, y, m, d){
    return ev.startsAt <= dayEnd(y,m,d) && ev.endsAt >= dayStart(y,m,d);
  }
  function isMultiDay(ev){ return (ev.endsAt - ev.startsAt) > 86400000 * 1.1; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

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
  function renderMonth(container, year, month, events, sub, cb){
    var today = new Date(); today.setHours(0,0,0,0);
    var h = '<div class="cal-monthnav">' +
      '<button class="cal-nav" data-act="back">‹ ' + year + '</button>' +
      '<span class="cal-mtitle">' + MNS[month] + ' ' + year + '</span>' +
      '<span class="cal-mnav"><button class="cal-nav" data-act="prevM">‹</button>' +
      '<button class="cal-nav" data-act="nextM">›</button></span></div>';
    h += '<div class="ctrl"><div class="chips" id="calSubTabs">' +
      '<button class="fchip' + (sub==='cal'?' on':'') + '" data-sub="cal">Calendario</button>' +
      '<button class="fchip' + (sub==='agenda'?' on':'') + '" data-sub="agenda">Agenda</button>' +
      '</div></div>';

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
    container.querySelector('[data-act="prevM"]').addEventListener('click', function(){ cb.onMonth((month+11)%12, month===0?year-1:year); });
    container.querySelector('[data-act="nextM"]').addEventListener('click', function(){ cb.onMonth((month+1)%12, month===11?year+1:year); });
    container.querySelectorAll('#calSubTabs .fchip').forEach(function(t){
      t.addEventListener('click', function(){ cb.onSub(t.dataset.sub); });
    });
    container.querySelectorAll('[data-ev]').forEach(function(el){
      el.addEventListener('click', function(){ cb.onEvent(el.dataset.ev); });
    });
  }

  function renderGrid(year, month, mEvs, today){
    var multi = mEvs.filter(isMultiDay);
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
      // barras multi-día que intersectan esta semana (recortadas al mes)
      var bars = [];
      multi.forEach(function(ev){
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
        var singles = inM ? mEvs.filter(function(ev){ return !isMultiDay(ev) && coversDay(ev, d.getFullYear(), d.getMonth(), d.getDate()); }) : [];
        var dots = singles.slice(0,3).map(function(ev){ return '<i style="background:' + (TYPE_COLOR[ev.type]||'#888') + '"></i>'; }).join('');
        h += '<div class="cal-day' + (inM?'':' out') + (isT?' today':'') + (wknd?' wknd':'') + '">' +
             '<span class="cal-dn">' + (inM?d.getDate():'') + '</span>' +
             (singles.length ? '<span class="cal-day-dots" data-ev="' + singles[0].id + '">' + dots + '</span>' : '') +
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
      h += '<button class="evt" data-ev="' + ev.id + '" style="border-left-color:' + col + '">' +
           '<div class="evt-head"><span class="evt-name">' + esc(ev.name) + '</span></div>' +
           '<span class="evt-meta">' + when + ' · ' + ev.venue + ' · ' + (CITY_LABELS[ev.city]||ev.city) + '</span></button>';
    });
    h += '</div>';
    return h;
  }

  /* ───────────────────────── HORARIOS SALAS (semanales) ────────────────── */
  function renderHorarios(container, weekly, cb){
    var byDay = {};
    weekly.forEach(function(ev){ (byDay[ev.weekday] = byDay[ev.weekday] || []).push(ev); });
    var order = [1,2,3,4,5,6,0];   // lun..dom
    var h = '<p class="res-count" style="margin-top:14px">Salas que se repiten cada semana</p>';
    var any = false;
    order.forEach(function(wd){
      var evs = byDay[wd]; if(!evs || !evs.length) return;
      any = true;
      h += '<div class="date-head">' + DOW_FULL[(wd+6)%7] + '</div>';
      evs.forEach(function(ev){
        h += '<button class="evt t-sala" data-ev="' + ev.id + '">' +
             '<div class="evt-head"><span class="evt-name">' + esc(ev.name) + '</span></div>' +
             '<span class="evt-meta">' + (ev.timeLabel||'') + ' · ' + ev.venue + ' · ' + (CITY_LABELS[ev.city]||ev.city) + '</span></button>';
      });
    });
    if(!any) h += '<div class="notice" style="margin-top:12px"><span class="nosig">Sin salas</span><p>No hay salas semanales con esos filtros.</p></div>';
    container.innerHTML = h;
    container.querySelectorAll('[data-ev]').forEach(function(el){
      el.addEventListener('click', function(){ cb.onEvent(el.dataset.ev); });
    });
  }

  window.Calendar = { renderYear:renderYear, renderMonth:renderMonth, renderHorarios:renderHorarios };
})();
