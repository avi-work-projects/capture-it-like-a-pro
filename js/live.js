/* ══════════════════════════════════════════════════════════════════════════
   MODO EN DIRECTO ("Estoy dentro") — window.Live
   Vista para un evento QUE ESTÁ OCURRIENDO AHORA, con dos caras:

   BAILARÍN — flujo en dos fases:
     1) LO PRIMERO: lista de CAMARÓGRAFOS del evento, con la sala en la que
        está cada uno y orden de preferencia: reservado > te interesa grabar
        con él > le sigues > resto. Desde ahí te apuntas a la cola de uno.
        Sin camarógrafos → "No hay camarógrafos disponibles".
     2) Ya en una cola: TU TURNO, la cola de parejas y DÓNDE ESTÁ UBICADO
        (mapa creado, solo lectura, nada editable).
   CÁMARA:   su cola de parejas (avance manual o automático con el detector),
             marcar SU posición en el mapa y el detector de canciones.

   La "sala" de cada camarógrafo es DEMO por ahora (Sala principal / Sala 2):
   cuando el cámara se ubique en el mapa de una sala concreta, saldrá la real.

   Mapa embebido: mapa-editor/?live=view|cam (localStorage 'cilap-live-map',
   demo fijo sembrado aquí). Cola simulada (parejas demo + tú); estado por
   evento en 'cilap-live' {cam, myIdx, served}. El detector (js/detector.js)
   es el motor real de bachata-detector. app.js inyecta navegación (wire).
   ══════════════════════════════════════════════════════════════════════════ */
window.Live = (function(){
'use strict';

var LKEY = 'cilap-live';        // { [evId]: { cam, myIdx, served } }
var MAPKEY = 'cilap-live-map';
var SONG_AVG_MIN = 3.5;         // duración media de una bachata (estimaciones)
var SALA_DEMO = ['Sala principal', 'Sala 2'];   // demo hasta que el cam se ubique

var DEMO_COUPLES = ['Marcos & Lucía', 'Dani & Sofía', 'Álex & Marta', 'Hugo & Elena', 'Pablo & Nerea'];

/* mapa DEMO del evento (sala interior; formato del editor) */
var DEMO_MAP = {
  id: 'live-demo', name: 'Sala · mapa del evento',
  pieces: [ { id:1, kind:'rect', x:50, y:50, w:88, h:88, rot:0 } ],
  elements: [
    { id:2, type:'escenario',   x:50, y:13, w:150, h:44, rot:0 },
    { id:3, type:'dj',          x:50, y:27, w:30,  h:30, rot:0 },
    { id:4, type:'bar',         x:86, y:52, w:26,  h:104, rot:0 },
    { id:5, type:'banos',       x:12, y:88, w:28,  h:28, rot:0 },
    { id:6, type:'acceso',      x:50, y:92, w:28,  h:28, rot:0 },
    { id:7, type:'columna',     x:26, y:44, w:18,  h:18, rot:0 },
    { id:8, type:'columna',     x:74, y:70, w:18,  h:18, rot:0 },
    { id:9, type:'camarografo', x:63, y:66, w:26,  h:26, rot:0 }
  ]
};

var app = null;        // navegación inyectada por app.js (wire)
var ev = null, role = 'dancer';
var det = null;        // instancia del Detector
var uiTimer = null;
var logLines = [];

var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function fmtM(s){ return Math.floor(s / 60) + ':' + String(Math.floor(s) % 60).padStart(2, '0'); }

/* ── estado por evento ── */
function store(){ try{ return JSON.parse(localStorage.getItem(LKEY)) || {}; }catch(e){ return {}; } }
function st(){ var d = store(); return d[ev.id] || { cam:null, myIdx:null, served:0 }; }
function setSt(patch){
  var d = store(); d[ev.id] = Object.assign({}, st(), patch);
  try{ localStorage.setItem(LKEY, JSON.stringify(d)); }catch(e){}
}

/* ── camarógrafos del evento, con sala y preferencias ───────────────────── */
function evBase(){ return (ev.id || '').split('@')[0]; }
function lsObj(k){ try{ return JSON.parse(localStorage.getItem(k)) || {}; }catch(e){ return {}; } }
/* preferencias del bailarín con este cam: reservado > te interesa > le sigues */
function camPrefs(camId){
  var rv = lsObj('cilap-resv'), it = lsObj('cilap-interest'), fo = lsObj('cilap-follows');
  var keys = [ev.id + '_' + camId, evBase() + '_' + camId];
  var resv  = keys.some(function(k){ return rv[k]; });
  var inter = keys.some(function(k){ return it[k]; });
  return { resv:resv, interest:inter, follow:!!fo[camId], score:(resv ? 4 : 0) + (inter ? 2 : 0) + (fo[camId] ? 1 : 0) };
}
function evCams(){
  return (ev.camIds || []).map(function(id, i){
    var c = (window.CAMS_BY_ID || {})[id] || (typeof CAMS_BY_ID !== 'undefined' ? CAMS_BY_ID[id] : null);
    if(!c) return null;
    return { id:id, name:c.name, sala:SALA_DEMO[i % SALA_DEMO.length], prefs:camPrefs(id) };
  }).filter(Boolean).sort(function(a, b){ return b.prefs.score - a.prefs.score; });
}

/* la cola: parejas demo + tú (en la posición que cogiste al apuntarte) */
function queueList(){
  var s = st(), list = DEMO_COUPLES.map(function(n){ return { name:n, me:false }; });
  if(s.cam && s.myIdx != null) list.splice(Math.min(s.myIdx, list.length), 0, { name:'Tú y tu pareja', me:true });
  return list;
}
function songsLeftForMe(){
  var s = st();
  if(!s.cam || s.myIdx == null) return null;
  return s.myIdx - s.served;   // 0 = bailando ahora; <0 = ya bailaste
}

/* ── API pública ─────────────────────────────────────────────────────────── */
function wire(glue){ app = glue; }

function open(event, r){
  ev = event;
  role = r || (app && app.getRole && app.getRole()) || 'dancer';
  try{ if(!localStorage.getItem(MAPKEY)) localStorage.setItem(MAPKEY, JSON.stringify(DEMO_MAP)); }catch(e){}
  logLines = [];
  render();
  app.goView('viewLive', 'ac-red');
  if(uiTimer) clearInterval(uiTimer);
  uiTimer = setInterval(tickUI, 500);
}

function close(){
  if(uiTimer){ clearInterval(uiTimer); uiTimer = null; }
  if(det){ det.stop(); det = null; }
}

/* ── render ──────────────────────────────────────────────────────────────── */
function mapCard(mode, title, hint){
  return '<div class="lv-card">' +
    '<div class="lv-card-h">' + title + '</div>' +
    '<div class="lv-map-wrap"><iframe id="lvMap" src="mapa-editor/?live=' + mode + '" title="Mapa del evento"></iframe></div>' +
    '<p class="lv-hint">' + hint + '</p>' +
  '</div>';
}
function prepCard(title, hint){
  return '<div class="lv-card">' +
    '<div class="lv-card-h">' + title + '</div>' +
    '<div class="lv-prep idle" id="lvPrep"><b id="lvPrepState">—</b><span class="lv-cd" id="lvPrepCd">--:--</span><span class="lv-msg" id="lvPrepMsg"></span></div>' +
    (hint ? '<p class="lv-hint">' + hint + '</p>' : '') +
  '</div>';
}

function render(){
  var cam = role === 'cam';
  $('#liveTitle').textContent = cam ? 'Panel en directo' : 'Estoy dentro';
  $('#liveSub').textContent = ev.name + ' · ' + (ev.venue || '');
  var head = '<div class="lv-now"><span class="lv-dot"></span>EN DIRECTO · ' + esc(evHours(ev)) + '</div>';

  if(cam){
    $('#liveBody').innerHTML = head +
      '<div class="lv-card">' +
        '<div class="lv-card-h">Tu cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
        '<div id="lvQList"></div>' +
        '<div id="lvQActions"></div>' +
      '</div>' +
      mapCard('cam', 'Marca tu posición en la sala', 'Arrastra el marcador rojo parpadeante a donde estés.') +
      '<div class="lv-card">' +
        '<div class="lv-card-h">Detector de canciones</div>' +
        '<div class="lv-prep idle" id="lvPrep"><b id="lvPrepState">INACTIVO</b><span class="lv-cd" id="lvPrepCd">--:--</span><span class="lv-msg" id="lvPrepMsg">Arranca el detector para avisos de turno</span></div>' +
        '<div class="lv-np" id="lvNp" hidden>' +
          '<b id="lvNpTitle"></b><span id="lvNpArtist"></span>' +
          '<div class="lv-bar"><div class="lv-bar-fill" id="lvNpFill"></div></div>' +
          '<span class="lv-np-time"><span id="lvNpEl">--:--</span> / <span id="lvNpTot">--:--</span></span>' +
        '</div>' +
        '<div class="lv-token" id="lvTokenRow" hidden>' +
          '<input type="password" id="lvToken" placeholder="Pega tu API token de audd.io" autocomplete="off">' +
        '</div>' +
        '<div class="lv-det-actions">' +
          '<button class="cta" id="lvDetStart">Iniciar detector</button>' +
          '<button class="cta ghost" id="lvDetStop" hidden>Parar</button>' +
        '</div>' +
        '<div class="lv-status" id="lvDetStatus">El detector escucha por el micrófono e identifica cada canción (AudD).</div>' +
        '<div class="lv-log" id="lvLog"></div>' +
      '</div>';
    renderQueue();
    bindDetectorUI();
    tickUI();
    return;
  }

  /* ── BAILARÍN ── */
  var s = st();
  var mine = s.cam ? evCams().filter(function(c){ return c.id === s.cam; })[0] : null;

  if(!mine){
    /* FASE 1: lo primero, la lista de camarógrafos del evento */
    $('#liveBody').innerHTML = head +
      '<div class="lv-card">' +
        '<div class="lv-card-h">Camarógrafos en el evento</div>' +
        '<div id="lvCamList"></div>' +
      '</div>';
    renderCamPick();
    return;
  }

  /* FASE 2: en la cola de un camarógrafo → turno, cola y ubicación */
  $('#liveBody').innerHTML = head +
    '<div class="lv-inqueue">En la cola de <b>' + esc(mine.name) + '</b> · ' + esc(mine.sala) + '</div>' +
    prepCard('Tu turno', 'El aviso se calcula con tu posición (el camarógrafo lleva el detector de canciones).') +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
      '<div id="lvQList"></div>' +
      '<div id="lvQActions"></div>' +
    '</div>' +
    mapCard('view', 'Dónde está ubicado', 'El marcador rojo parpadeante es ' + esc(mine.name) + ' (' + esc(mine.sala) + ').');
  renderQueue();
  tickUI();
}

/* FASE 1 del bailarín: elegir camarógrafo (orden: reservado > interesa > sigues) */
function renderCamPick(){
  var box = $('#lvCamList'), cams = evCams();
  if(!cams.length){
    box.innerHTML = '<div class="lv-empty">No hay camarógrafos disponibles.<br><span>La sala está vacía — prueba más tarde.</span></div>';
    return;
  }
  box.innerHTML = cams.map(function(c){
    var badges = '';
    if(c.prefs.resv)          badges += '<span class="lv-badge resv">Plaza reservada ✓</span>';
    else if(c.prefs.interest) badges += '<span class="lv-badge int">Te interesa ♥</span>';
    else if(c.prefs.follow)   badges += '<span class="lv-badge fol">Le sigues</span>';
    return '<div class="lv-camrow">' +
      '<div class="lv-cam-i"><b>' + esc(c.name) + '</b><span class="lv-cam-s">' + esc(c.sala) + '</span>' + badges + '</div>' +
      '<button class="lv-join" data-cam="' + esc(c.id) + '">Apuntarme<br>a su cola</button>' +
    '</div>';
  }).join('');
  box.querySelectorAll('.lv-join').forEach(function(b){
    b.addEventListener('click', function(){
      setSt({ cam: b.dataset.cam, myIdx: DEMO_COUPLES.length, served: 0 });
      render();
    });
  });
}

function renderQueue(){
  var s = st(), list = queueList(), served = s.served;
  var rows = list.map(function(p, i){
    var stTxt, cls = '';
    if(i < served){ stTxt = '✓'; cls = 'done'; }
    else if(i === served){ stTxt = '▶ bailando'; cls = 'nowd'; }
    else { stTxt = '#' + (i - served); }
    if(p.me) cls += ' me';
    return '<div class="lv-q ' + cls + '"><span class="lv-q-n">' + esc(p.name) + '</span><span class="lv-q-s">' + stTxt + '</span></div>';
  }).join('');
  $('#lvQList').innerHTML = rows || '<div class="lv-hint">Nadie apuntado todavía.</div>';
  var pend = list.length - Math.min(served, list.length);
  $('#lvQCount').textContent = pend + ' en cola';

  var a = '';
  if(role === 'cam'){
    a = '<button class="cta" id="lvAdvance"' + (served >= list.length ? ' disabled' : '') + '>Cambio de pareja →</button>' +
        '<p class="lv-hint">Con el detector en marcha, la cola avanza SOLA con cada cambio de canción.</p>';
  } else {
    var left = songsLeftForMe();
    if(left != null && left < 0){
      a = '<p class="lv-hint done-hint">Ya bailaste ✓ — tu vídeo llegará por WeTransfer.</p>' +
          '<button class="cta ghost" id="lvJoinAgain">Volver a apuntarme</button>';
    } else {
      a = '<p class="lv-mine-pos">Eres el <b>#' + left + '</b> de la cola · ~' + Math.max(1, Math.round(left * SONG_AVG_MIN)) + ' min</p>' +
          '<button class="cta ghost" id="lvLeave">Salir de la cola</button>';
    }
  }
  $('#lvQActions').innerHTML = a;

  var again = $('#lvJoinAgain');
  if(again) again.addEventListener('click', function(){
    setSt({ myIdx: st().served + queueList().length });   // al final de la cola actual
    renderQueue(); tickUI();
  });
  var l = $('#lvLeave');
  if(l) l.addEventListener('click', function(){ setSt({ cam:null, myIdx:null }); render(); });
  var adv = $('#lvAdvance');
  if(adv) adv.addEventListener('click', advance);
}

function advance(){
  var total = queueList().length;
  if(st().served >= total) return;
  setSt({ served: st().served + 1 });
  renderQueue(); tickUI();
}

/* ── detector (solo cámara) ──────────────────────────────────────────────── */
function bindDetectorUI(){
  var hasKey = !!Detector.getKey();
  $('#lvTokenRow').hidden = hasKey;
  if(!hasKey) $('#lvToken').value = '';

  $('#lvDetStart').addEventListener('click', function(){
    var key = Detector.getKey() || ($('#lvToken').value || '').trim();
    if(!key){ $('#lvTokenRow').hidden = false; $('#lvToken').focus(); setStatus('Falta el token de audd.io (300 peticiones gratis al registrarte).'); return; }
    Detector.setKey(key);
    $('#lvTokenRow').hidden = true;
    startDetector(key);
  });
  $('#lvDetStop').addEventListener('click', stopDetector);
}
function setStatus(t){ var el = $('#lvDetStatus'); if(el) el.textContent = t; }
function addLog(t){
  logLines.push(t);
  if(logLines.length > 4) logLines.shift();
  var el = $('#lvLog'); if(el) el.innerHTML = logLines.map(esc).join('<br>');
}

function startDetector(key){
  if(det) det.stop();
  det = Detector.create(key, {
    onLog: addLog,
    onStatus: function(t){ setStatus(t); },
    onSong: function(){ tickUI(); },
    onChange: function(){ advance(); },     // cada cambio de canción = turno servido
    onUpdate: function(){ tickUI(); }
  });
  $('#lvDetStart').hidden = true;
  $('#lvDetStop').hidden = false;
  det.start().catch(function(e){
    setStatus('⚠️ ' + e.message);
    $('#lvDetStart').hidden = false;
    $('#lvDetStop').hidden = true;
    det = null;
  });
}
function stopDetector(){
  if(det){ det.stop(); det = null; }
  var b1 = $('#lvDetStart'), b2 = $('#lvDetStop');
  if(b1) b1.hidden = false;
  if(b2) b2.hidden = true;
  tickUI();
}

/* ── refresco de la tarjeta de aviso (cada 500 ms) ───────────────────────── */
var PREP_ALERT_SEC = 25, PREP_GO_SEC = 6;

function tickUI(){
  var prep = $('#lvPrep'); if(!prep) return;
  var state = 'idle', label, cd = '--:--', msg;
  if(role === 'cam'){ label = 'INACTIVO'; msg = 'Arranca el detector para avisos de turno'; }
  else { label = 'EN COLA'; msg = ''; }
  var song = det && det.currentSong;
  var fails = det ? det.consecutiveFails : 0;
  var left = songsLeftForMe();

  /* progreso de la canción en curso (solo cámara tiene #lvNp) */
  if(song && $('#lvNp')){
    var elapsed = det.nowSec() - song.startedAtSec;
    $('#lvNp').hidden = false;
    $('#lvNpTitle').textContent = song.title || '(sin título)';
    $('#lvNpArtist').textContent = song.artist || '';
    $('#lvNpEl').textContent = fmtM(Math.min(elapsed, song.duration));
    $('#lvNpTot').textContent = fmtM(song.duration);
    $('#lvNpFill').style.width = Math.min(elapsed / song.duration, 1) * 100 + '%';
  } else if($('#lvNp')) $('#lvNp').hidden = true;

  if(det && det.running){
    var justChanged = det.justChangedAt && (det.nowSec() - det.justChangedAt) < PREP_GO_SEC;
    if(fails >= 2){
      state = 'paused'; label = '🔇 ¿NO SUENA NADA?'; cd = fails + '×';
      msg = fails + ' intentos fallidos (' + (det.lastFailReason === 'silent-clip' ? 'micro sin audio' : det.lastFailReason === 'no-match' ? 'AudD no reconoce' : 'error de API') + ').';
    } else if(!song){
      state = 'waiting'; label = 'IDENTIFICANDO…'; cd = '--:--'; msg = 'Esperando el primer match';
    } else {
      var elapsed2 = det.nowSec() - song.startedAtSec;
      var rem = Math.max(0, song.duration - elapsed2);
      /* cámara: cada cambio de canción es cambio de pareja */
      if(justChanged){ state = 'go'; label = '¡CAMBIO DE PAREJA!'; cd = fmtM(rem); msg = 'Suena: ' + song.title; }
      else if(elapsed2 >= song.duration){ state = 'waiting'; label = 'ESPERANDO SIGUIENTE'; cd = '🔍'; msg = 'Buscando la próxima canción…'; }
      else if(rem <= PREP_ALERT_SEC){ state = 'alert'; label = '¡PREPÁRATE!'; cd = fmtM(rem); msg = 'La canción está acabando'; }
      else { state = 'waiting'; label = 'EN CURSO'; cd = fmtM(rem); msg = 'Tiempo hasta el cambio de pareja'; }
    }
  } else if(role !== 'cam' && left != null){
    /* bailarín: su turno según la cola */
    if(left < 0){ state = 'idle'; label = 'YA BAILASTE ✓'; cd = '--:--'; msg = 'Tu vídeo llegará por WeTransfer'; }
    else if(left === 0){ state = 'go'; label = '¡TE TOCA — A BAILAR!'; cd = 'YA'; msg = 'Estás bailando (según la cola)'; }
    else if(left === 1){ state = 'alert'; label = '¡PREPÁRATE!'; cd = '~' + Math.round(SONG_AVG_MIN) + "'"; msg = 'Eres el siguiente'; }
    else { state = 'waiting'; label = 'EN COLA · #' + left; cd = '~' + Math.max(1, Math.round(left * SONG_AVG_MIN)) + "'"; msg = 'Te quedan ' + left + ' canciones por delante'; }
  }

  prep.className = 'lv-prep ' + state;
  $('#lvPrepState').textContent = label;
  $('#lvPrepCd').textContent = cd;
  $('#lvPrepMsg').textContent = msg;
}

return { wire:wire, open:open, close:close };
})();
