/* ══════════════════════════════════════════════════════════════════════════
   CREAR EVENTO — window.CreateEv (wizard, F5)
   Formulario por tipo (sala semanal / congreso con pases / exterior) que
   guarda en localStorage 'cilap-myevents'. data.js los funde con los demo al
   cargar (mine:true) y les calcula horarios y pases como a los demás, así que
   aparecen en Próximos, Calendario, Mapa y Horarios sin más código.

   Tras guardar se recarga la app (la integración de horarios/pases ocurre en
   la carga de data.js); el selector de tipo lista "Tus eventos creados" con
   opción de borrar. app.js nos inyecta la navegación con CreateEv.wire(...).
   ══════════════════════════════════════════════════════════════════════════ */
window.CreateEv = (function(){
'use strict';

var KEY = 'cilap-myevents';
var CITY_COUNTRY = { mad:'es', sev:'es', bcn:'es', waw:'pl', kra:'pl' };
var DOW_LBL = ['D','L','M','X','J','V','S'];             // getDay(): 0=domingo
var TYPE_TITLE = { sala:'Nueva sala de baile', congreso:'Nuevo congreso', exterior:'Nuevo social al exterior' };

var app = null;      // navegación inyectada (wire)
var type = 'sala';
/* mapas de salas por evento: máximos por tipo; interior permitido en todos
   MENOS en los sociales al exterior (solo mapas de exterior) */
var MAP_MAX = { sala:3, congreso:6, exterior:2 };
var selMaps = [];    // [{lib:'int'|'ext', id, name}] del evento en edición
function libMaps(lib){
  try{ return JSON.parse(localStorage.getItem(lib === 'int' ? 'cip_mapas_v1' : 'cip_mapas_ext_v1')) || []; }catch(e){ return []; }
}

var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; } }
function save(list){ try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch(e){} }

function wire(glue){ app = glue; renderMineList(); }

/* lista "Tus eventos creados" bajo el selector de tipo (viewCreate) */
function renderMineList(){
  var box = $('#createMine'); if(!box) return;
  var list = load();
  if(!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = '<span class="hub-sec-lbl">Tus eventos creados</span>' +
    list.map(function(e){
      return '<div class="cf-mine"><span class="cf-mine-n">' + esc(e.name) + '</span>' +
        '<span class="cf-mine-t">' + esc(TYPE_LABELS[e.type] || e.type) + '</span>' +
        '<button class="cf-mine-x" data-del="' + esc(e.id) + '" title="Borrar">✕</button></div>';
    }).join('');
  box.querySelectorAll('[data-del]').forEach(function(b){
    b.addEventListener('click', function(){
      save(load().filter(function(e){ return e.id !== b.dataset.del; }));
      location.reload();   // el evento sale de EVENTS al recargar
    });
  });
}

/* ── formulario ──────────────────────────────────────────────────────────── */
function open(t){
  type = t;
  selMaps = [];
  $('#cfTitle').textContent = TYPE_TITLE[type] || 'Nuevo evento';
  $('#cfSub').textContent = type === 'sala' ? 'Se repetirá cada semana los días que marques.'
    : type === 'congreso' ? 'Varios días; configura el pase de día y de noche de cada jornada.'
    : 'Un día concreto, al aire libre.';
  $('#createFormBody').innerHTML = formHtml();
  bindForm();
  app.goView('viewCreateForm', 'ac-red');
}

function cityOptions(){
  return Object.keys(CITY_LABELS).filter(function(k){ return k !== 'all'; })
    .map(function(k){ return '<option value="' + k + '">' + esc(CITY_LABELS[k]) + '</option>'; }).join('');
}

function formHtml(){
  var common =
    '<label class="cf-l">Nombre del evento</label>' +
    '<input class="cf-in" id="cfName" maxlength="48" placeholder="' +
      (type === 'sala' ? 'p. ej. Sala Candela' : type === 'congreso' ? 'p. ej. Madrid Bachata Weekend' : 'p. ej. Bachata al atardecer') + '">' +
    '<label class="cf-l">Ciudad</label>' +
    '<select class="cf-in" id="cfCity">' + cityOptions() + '</select>' +
    '<label class="cf-l">Local / dirección</label>' +
    '<input class="cf-in" id="cfVenue" maxlength="60" placeholder="p. ej. C. de Atocha, 107">' +
    '<label class="cf-l">Ubicación exacta <span class="cf-opt">(opcional — pega el ENLACE de Google Maps del sitio, o «lat, lon»)</span></label>' +
    '<input class="cf-in" id="cfCoords" placeholder="https://www.google.com/maps/place/…  ·  40.4168, -3.7038">';

  var byType = '';
  if(type === 'sala'){
    byType =
      '<label class="cf-l">Días de la semana</label>' +
      '<div class="cf-dows" id="cfDows">' +
        [1,2,3,4,5,6,0].map(function(d){ return '<button type="button" class="cf-dow" data-d="' + d + '">' + DOW_LBL[d] + '</button>'; }).join('') +
      '</div>' +
      '<div class="cf-row">' +
        '<div><label class="cf-l">Empieza</label><input class="cf-in" id="cfT1" type="time" value="22:00"></div>' +
        '<div><label class="cf-l">Termina</label><input class="cf-in" id="cfT2" type="time" value="04:00"></div>' +
      '</div>';
  } else if(type === 'congreso'){
    byType =
      '<div class="cf-row">' +
        '<div><label class="cf-l">Del</label><input class="cf-in" id="cfD1" type="date"></div>' +
        '<div><label class="cf-l">Al</label><input class="cf-in" id="cfD2" type="date"></div>' +
      '</div>' +
      '<div class="cf-row">' +
        '<div><label class="cf-l">Pase de DÍA</label><div class="cf-times"><input class="cf-in" id="cfDayT1" type="time" value="11:00"><input class="cf-in" id="cfDayT2" type="time" value="20:00"></div></div>' +
        '<div><label class="cf-l">Pase de NOCHE</label><div class="cf-times"><input class="cf-in" id="cfNightT1" type="time" value="22:00"><input class="cf-in" id="cfNightT2" type="time" value="04:00"></div></div>' +
      '</div>' +
      '<label class="cf-l">Pases por jornada</label>' +
      '<div id="cfPassDays" class="cf-passdays"><p class="lv-hint">Elige las fechas y aquí configuras cada día.</p></div>';
  } else {
    byType =
      '<div class="cf-row">' +
        '<div><label class="cf-l">Fecha</label><input class="cf-in" id="cfD1" type="date"></div>' +
        '<div><label class="cf-l">Tipo de sitio</label><select class="cf-in" id="cfSub"><option value="terraza">Terraza</option><option value="playa">Playa</option><option value="parque">Parque</option></select></div>' +
      '</div>' +
      '<div class="cf-row">' +
        '<div><label class="cf-l">Empieza</label><input class="cf-in" id="cfT1" type="time" value="18:00"></div>' +
        '<div><label class="cf-l">Termina</label><input class="cf-in" id="cfT2" type="time" value="23:00"></div>' +
      '</div>';
  }

  /* mapas de las salas: interior+exterior salvo en sociales (solo exterior) */
  var allowInt = type !== 'exterior';
  var mapsSec =
    '<label class="cf-l">Mapas de las salas <span class="cf-opt">(opcional — hasta ' + MAP_MAX[type] + (allowInt ? ', de interior o exterior' : ', SOLO de exterior') + ')</span></label>' +
    '<div id="cfMapList" class="cf-maplist"></div>' +
    '<div class="cf-mapadd">' +
      '<select class="cf-in" id="cfMapSel"></select>' +
      '<button type="button" class="cf-addmap" id="cfMapAdd">Añadir</button>' +
    '</div>' +
    '<p class="lv-hint">¿No está en la lista? Créalo en el editor y vuelve: ' +
      (allowInt ? '<a href="mapa-editor/" target="_blank" rel="noopener">editor interior ↗</a> · ' : '') +
      '<a href="mapa-editor/?mode=exterior" target="_blank" rel="noopener">editor exterior ↗</a> ' +
      '<button type="button" class="cf-reload" id="cfMapReload" title="Recargar la biblioteca">↻</button></p>';

  return common + byType + mapsSec +
    '<p class="cf-err" id="cfErr" hidden></p>' +
    '<button class="cta" id="cfSave">Crear evento</button>';
}

/* ── selección de mapas del evento ── */
function refreshMapSel(){
  var sel = $('#cfMapSel'); if(!sel) return;
  var allowInt = type !== 'exterior';
  var used = {};
  selMaps.forEach(function(m){ used[m.lib + ':' + m.id] = true; });
  function group(lbl, lib){
    var maps = libMaps(lib).filter(function(m){ return !used[lib + ':' + m.id]; });
    if(!maps.length) return '';
    return '<optgroup label="' + lbl + '">' + maps.map(function(m){
      return '<option value="' + lib + ':' + esc(m.id) + '">' + esc(m.name || 'Sin nombre') + '</option>';
    }).join('') + '</optgroup>';
  }
  var h = (allowInt ? group('Interior', 'int') : '') + group('Exterior', 'ext');
  sel.innerHTML = h || '<option value="">— no hay mapas en tu biblioteca —</option>';
  sel.disabled = !h;
  $('#cfMapAdd').disabled = !h || selMaps.length >= MAP_MAX[type];
}
function renderMapList(){
  var box = $('#cfMapList'); if(!box) return;
  box.innerHTML = selMaps.map(function(m, i){
    return '<div class="cf-mine"><span class="cf-mine-n">' + esc(m.name) + '</span>' +
      '<span class="cf-mine-t">' + (m.lib === 'int' ? 'interior' : 'exterior') + '</span>' +
      '<button class="cf-mine-x" data-i="' + i + '" title="Quitar">✕</button></div>';
  }).join('') || '<p class="lv-hint">Sin mapas todavía — elige uno de tu biblioteca.</p>';
  box.querySelectorAll('[data-i]').forEach(function(b){
    b.addEventListener('click', function(){ selMaps.splice(+b.dataset.i, 1); renderMapList(); refreshMapSel(); });
  });
}

function bindForm(){
  document.querySelectorAll('.cf-dow').forEach(function(b){
    b.addEventListener('click', function(){ b.classList.toggle('on'); });
  });
  if(type === 'congreso'){
    ['cfD1','cfD2'].forEach(function(id){ $('#' + id).addEventListener('change', renderPassDays); });
  }
  $('#cfSave').addEventListener('click', submit);
  /* mapas de salas: añadir desde la biblioteca / recargarla tras crear uno */
  renderMapList();
  refreshMapSel();
  $('#cfMapAdd').addEventListener('click', function(){
    var v = $('#cfMapSel').value; if(!v) return;
    if(selMaps.length >= MAP_MAX[type]) return;
    var lib = v.split(':')[0], id = v.slice(v.indexOf(':') + 1);
    var m = libMaps(lib).filter(function(x){ return x.id === id; })[0];
    if(!m) return;
    selMaps.push({ lib: lib, id: id, name: m.name || 'Sin nombre' });
    renderMapList();
    refreshMapSel();
  });
  $('#cfMapReload').addEventListener('click', function(){ refreshMapSel(); });
}

/* filas por día del congreso: checkbox Día / Noche (patrón típico premarcado) */
function renderPassDays(){
  var d1 = $('#cfD1').value, d2 = $('#cfD2').value || d1;
  var box = $('#cfPassDays');
  if(!d1){ box.innerHTML = '<p class="lv-hint">Elige las fechas y aquí configuras cada día.</p>'; return; }
  var a = d1.split('-'), b = d2.split('-');
  var t0 = new Date(+a[0], +a[1]-1, +a[2]), t1 = new Date(+b[0], +b[1]-1, +b[2]);
  var days = Math.max(1, Math.round((t1 - t0) / 86400000) + 1);
  if(days > 10){ box.innerHTML = '<p class="cf-err">Máximo 10 días.</p>'; return; }
  var h = '';
  for(var i = 0; i < days; i++){
    var d = new Date(t0); d.setDate(t0.getDate() + i);
    var iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var first = i === 0 && days > 1, last = i === days - 1 && days > 1;
    h += '<div class="cf-pass" data-date="' + iso + '">' +
      '<span class="cf-pass-d">' + fmtDate(d.getTime()) + '</span>' +
      '<label class="cf-chk"><input type="checkbox" class="cf-day"' + (first ? '' : ' checked') + '> Día</label>' +
      '<label class="cf-chk"><input type="checkbox" class="cf-night"' + (last ? '' : ' checked') + '> Noche</label>' +
    '</div>';
  }
  box.innerHTML = h;
}

/* extrae [lon,lat] de un enlace de Google Maps o de un "lat, lon" pegado.
   Un enlace LARGO de Maps lleva las coordenadas dentro; se prueba en orden:
   1) !3dLAT!4dLON  → la CHINCHETA exacta del sitio (lo más preciso)
   2) q= / ll= / query=LAT,LON
   3) @LAT,LON      → el centro del ENCUADRE (menos preciso, vale igual)
   4) "LAT, LON" a pelo.
   Los enlaces CORTOS (maps.app.goo.gl) no llevan coordenadas → se avisa. */
function parseCoords(v){
  v = (v || '').trim();
  if(!v) return null;
  if(/(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(v)) return { short:true };
  function ok(lat, lon){
    lat = +lat; lon = +lon;
    if(isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return [lon, lat];   // el modelo guarda [lon, lat]
  }
  var m = v.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if(m) return ok(m[1], m[2]);
  m = v.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if(m) return ok(m[1], m[2]);
  m = v.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if(m) return ok(m[1], m[2]);
  m = v.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if(m) return ok(m[1], m[2]);
  return null;
}
function err(t){ var e = $('#cfErr'); e.textContent = t; e.hidden = false; }

function submit(){
  $('#cfErr').hidden = true;
  var name = ($('#cfName').value || '').trim();
  var city = $('#cfCity').value;
  var venue = ($('#cfVenue').value || '').trim() || CITY_LABELS[city];
  if(!name) return err('Ponle un nombre al evento.');
  var coordsV = ($('#cfCoords').value || '').trim();
  var coords = coordsV ? parseCoords(coordsV) : null;
  if(coords && coords.short) return err('Ese enlace corto (maps.app.goo.gl) no lleva las coordenadas dentro. Abre el enlace, y copia la URL COMPLETA de la barra del navegador — o mantén pulsado el punto en Maps y copia el «lat, lon».');
  if(coordsV && !coords) return err('No he podido sacar las coordenadas de ahí. Pega el enlace largo de Google Maps o un «lat, lon» (p. ej. 40.4168, -3.7038).');

  var ev = { id: 'u_' + Date.now(), name: name, country: CITY_COUNTRY[city] || 'es', city: city, venue: venue, camIds: [] };
  if(coords) ev.coords = coords;
  if(selMaps.length) ev.maps = selMaps.slice(0, MAP_MAX[type]);   // mapas de las salas

  if(type === 'sala'){
    var dows = [].map.call(document.querySelectorAll('.cf-dow.on'), function(b){ return +b.dataset.d; });
    if(!dows.length) return err('Marca al menos un día de la semana.');
    var t1 = $('#cfT1').value, t2 = $('#cfT2').value;
    if(!t1 || !t2) return err('Faltan las horas.');
    ev.type = 'sala'; ev.recurrence = 'weekly';
    ev.weekdays = dows; ev.timeLabel = t1 + '–' + t2;
  } else if(type === 'congreso'){
    var d1 = $('#cfD1').value, d2 = $('#cfD2').value || d1;
    if(!d1) return err('Falta la fecha de inicio.');
    if(d2 < d1) return err('La fecha final es anterior a la inicial.');
    var dayT = { start: $('#cfDayT1').value || '11:00', end: $('#cfDayT2').value || '20:00' };
    var nightT = { start: $('#cfNightT1').value || '22:00', end: $('#cfNightT2').value || '04:00' };
    var passes = [].map.call(document.querySelectorAll('.cf-pass'), function(row){
      return {
        date: row.dataset.date,
        day:   row.querySelector('.cf-day').checked   ? { start: dayT.start,   end: dayT.end }   : null,
        night: row.querySelector('.cf-night').checked ? { start: nightT.start, end: nightT.end } : null
      };
    }).filter(function(p){ return p.day || p.night; });
    if(!passes.length) return err('El congreso necesita al menos un pase.');
    ev.type = 'congreso'; ev.recurrence = 'oneoff';
    ev.dateStart = d1; ev.dateEnd = d2; ev.passes = passes;
  } else {
    var d = $('#cfD1').value;
    if(!d) return err('Falta la fecha.');
    var e1 = $('#cfT1').value || '18:00', e2 = $('#cfT2').value || '23:00';
    ev.type = 'exterior'; ev.recurrence = 'oneoff'; ev.sub = $('#cfSub').value;
    ev.dateStart = d; ev.dateEnd = d; ev.timeLabel = e1 + '–' + e2;
  }

  var list = load(); list.push(ev); save(list);
  /* la integración (horarios, pases, prov) ocurre al cargar data.js → recargar
     con arranque limpio; tu evento ya sale en Próximos/Horarios/Mapa */
  try{ sessionStorage.removeItem('cilap-nav'); }catch(e2){}
  location.reload();
}

return { wire: wire, open: open };
})();
