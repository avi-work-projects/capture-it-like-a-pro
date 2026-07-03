/* ══════════════════════════════════════════════════════════════════════════
   MODO EN DIRECTO ("Estoy dentro") — window.Live
   Vista para un evento QUE ESTÁ OCURRIENDO AHORA.

   BAILARÍN — flujo:
     FASE 1 · Elegir camarógrafo: mapa del local (las SALAS con su forma y
       cada camarógrafo situado con su nombre) + lista ordenada por
       preferencia (reservado > te interesa > le sigues > resto) con su sala
       y cuánta gente tiene en cola. Tocar uno abre su FICHA.
     FASE 2 · Ficha del camarógrafo (ANTES de apuntarte): qué canción suena
       (demo simulada — la real la emitirá el detector del cámara), su cola
       actual y dónde está situado; CTA "Apuntarme a su cola". Si ya estás en
       su cola: tarjeta TU TURNO arriba y "Salir de la cola" bien visible.
       "‹ Elegir otro camarógrafo" SIEMPRE disponible (cambiarse = salir de
       la cola anterior y apuntarse al nuevo).
   CÁMARA: su cola de parejas (avance manual o automático con el detector),
     marcar SU posición en el mapa y el detector de canciones real.

   Demo sin backend: colas por camarógrafo con tamaños distintos (0/0/2/3/4),
   "sonando ahora" simulado con un setlist en bucle (reloj real, distinto por
   cámara), salas demo (el mapa fijo tiene 2). Los camarógrafos se pintan en
   el mapa vía localStorage 'cilap-live-cams' (el editor en modo live los
   añade como marcadores BLOQUEADOS con su nombre).
   ══════════════════════════════════════════════════════════════════════════ */
window.Live = (function(){
'use strict';

var LKEY = 'cilap-live';        // { [evId]: { cam, prog:{ [camId]:{myIdx,served} } } }
var MAPKEY = 'cilap-live-map';
var CAMSKEY = 'cilap-live-cams';
var SONG_AVG = 210;             // 3:30, media de una bachata (segundos)

/* pool de parejas demo (se corta según la cola de cada cámara) */
var DEMO_COUPLES = ['Marcos & Lucía', 'Dani & Sofía', 'Álex & Marta', 'Hugo & Elena',
                    'Pablo & Nerea', 'Iván & Carla', 'Sergio & Paula', 'Leo & Noa'];
/* tamaño de cola demo por cámara (petición: 0, 0, 2, 3, 4…) y su sitio en el mapa */
var CAM_DEMO = {
  juan:   { n:0, sala:'Sala principal', x:30, y:38 },
  ana:    { n:0, sala:'Sala 2',         x:79, y:30 },
  carlos: { n:2, sala:'Sala principal', x:52, y:64 },
  lucia:  { n:3, sala:'Sala principal', x:26, y:74 },
  david:  { n:4, sala:'Sala 2',         x:82, y:62 }
};
/* setlist demo en bucle para "sonando ahora" (artista, título, duración s) */
var DEMO_SONGS = [
  ['Romeo Santos', 'Propuesta Indecente', 224],
  ['Prince Royce', 'Darte un Beso', 192],
  ['Aventura', 'Obsesión', 238],
  ['Juan Luis Guerra', 'Bachata Rosa', 204],
  ['Manuel Turizo', 'La Bachata', 163],
  ['Grupo Extra', 'Me Emborracharé', 210]
];

/* mapa DEMO del local: DOS salas (principal + sala 2) — v2 */
var DEMO_MAP = {
  id: 'live-demo-v2', name: 'The Host · mapa del local',
  pieces: [
    { id:1, kind:'rect', x:34, y:52, w:62, h:88, rot:0 },   // Sala principal
    { id:2, kind:'rect', x:81, y:46, w:28, h:60, rot:0 }    // Sala 2
  ],
  elements: [
    { id:3, type:'escenario', x:34, y:13, w:110, h:40, rot:0 },
    { id:4, type:'dj',        x:34, y:26, w:28,  h:28, rot:0 },
    { id:5, type:'dj',        x:81, y:22, w:24,  h:24, rot:0 },
    { id:6, type:'bar',       x:56, y:56, w:24,  h:80, rot:0 },
    { id:7, type:'banos',     x:12, y:88, w:26,  h:26, rot:0 },
    { id:8, type:'acceso',    x:34, y:92, w:26,  h:26, rot:0 },
    { id:9, type:'columna',   x:20, y:52, w:16,  h:16, rot:0 }
  ]
};

var app = null;        // navegación inyectada por app.js (wire)
var ev = null, role = 'dancer';
var selCam = null;     // cámara cuya FICHA se está viendo (no persiste)
var det = null;        // instancia del Detector (solo rol cámara)
var uiTimer = null;
var logLines = [];

var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function fmtM(s){ s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ── estado por evento ── */
function store(){ try{ return JSON.parse(localStorage.getItem(LKEY)) || {}; }catch(e){ return {}; } }
function st(){ var d = store(); return d[ev.id] || { cam:null, prog:{} }; }
function setSt(patch){
  var d = store(); d[ev.id] = Object.assign({}, st(), patch);
  try{ localStorage.setItem(LKEY, JSON.stringify(d)); }catch(e){}
}
function progOf(camId){ return (st().prog || {})[camId] || { myIdx:null, served:0 }; }
function setProg(camId, patch){
  var s = st(), prog = Object.assign({}, s.prog || {});
  prog[camId] = Object.assign({}, progOf(camId), patch);
  setSt({ prog: prog });
}

/* ── camarógrafos del evento ────────────────────────────────────────────── */
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
function camInfo(camId, i){
  var c = (typeof CAMS_BY_ID !== 'undefined' ? CAMS_BY_ID[camId] : null);
  if(!c) return null;
  var demo = CAM_DEMO[camId] || { n:(i * 2) % 5, sala:(i % 2 ? 'Sala 2' : 'Sala principal'), x:30 + (i * 13) % 45, y:35 + (i * 17) % 45 };
  return { id:camId, name:c.name, sala:demo.sala, demo:demo, prefs:camPrefs(camId) };
}
function evCams(){
  return (ev.camIds || []).map(camInfo).filter(Boolean)
    .sort(function(a, b){ return b.prefs.score - a.prefs.score; });
}

/* cola de un camarógrafo: sus parejas demo + tú (si estás en SU cola) */
function queueList(camId){
  var demo = (CAM_DEMO[camId] || { n:2 }).n;
  var list = DEMO_COUPLES.slice(0, demo).map(function(n){ return { name:n, me:false }; });
  var s = st(), p = progOf(camId);
  if(s.cam === camId && p.myIdx != null) list.splice(Math.min(p.myIdx, list.length), 0, { name:'Tú y tu pareja', me:true });
  return list;
}
function songsLeftForMe(){
  var s = st();
  if(!s.cam) return null;
  var p = progOf(s.cam);
  if(p.myIdx == null) return null;
  return p.myIdx - p.served;   // 0 = bailando ahora; <0 = ya bailaste
}
/* pendientes de una cola (sin contarte a ti) */
function pendingOf(camId){
  var p = progOf(camId);
  return Math.max(0, (CAM_DEMO[camId] || { n:2 }).n - p.served);
}

/* "sonando ahora" SIMULADO: setlist en bucle sobre el reloj real, con
   desfase por cámara (cada sala va por otra canción). Lo real llegará del
   detector del cámara cuando haya backend. */
var SET_TOTAL = DEMO_SONGS.reduce(function(s, x){ return s + x[2]; }, 0);
function simNow(camId){
  var seed = 0; for(var i = 0; i < camId.length; i++) seed += camId.charCodeAt(i);
  var t = (Math.floor(Date.now() / 1000) + seed * 137) % SET_TOTAL;
  var idx = 0;
  while(t >= DEMO_SONGS[idx][2]){ t -= DEMO_SONGS[idx][2]; idx++; }
  var s = DEMO_SONGS[idx];
  return { artist:s[0], title:s[1], duration:s[2], elapsed:t, remaining:s[2] - t };
}

/* ── API pública ─────────────────────────────────────────────────────────── */
function wire(glue){ app = glue; }

function open(event, r){
  ev = event;
  role = r || (app && app.getRole && app.getRole()) || 'dancer';
  seedMapData();
  selCam = st().cam;          // si ya estás en una cola, entra por su ficha
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

/* siembra el mapa demo (v2, con 2 salas) y los camarógrafos situados */
function seedMapData(){
  try{
    var cur = null;
    try{ cur = JSON.parse(localStorage.getItem(MAPKEY)); }catch(e2){}
    if(!cur || cur.id !== DEMO_MAP.id) localStorage.setItem(MAPKEY, JSON.stringify(DEMO_MAP));
    var cams = (ev.camIds || []).map(camInfo).filter(Boolean).map(function(c){
      return { id:c.id, name:c.name.split(' ')[0], x:c.demo.x, y:c.demo.y };
    });
    localStorage.setItem(CAMSKEY, JSON.stringify(cams));
  }catch(e){}
}

/* ── piezas de UI reutilizables ─────────────────────────────────────────── */
function mapCard(mode, title, hint){
  return '<div class="lv-card">' +
    '<div class="lv-card-h">' + title + '</div>' +
    '<div class="lv-map-wrap"><iframe id="lvMap" src="mapa-editor/?live=' + mode + '" title="Mapa del evento"></iframe></div>' +
    '<p class="lv-hint">' + hint + '</p>' +
  '</div>';
}
/* tarjeta "sonando ahora" (simulada) de la sala de un cam */
function nowCard(camId){
  return '<div class="lv-card">' +
    '<div class="lv-card-h">Sonando en su sala <span class="lv-count">demo</span></div>' +
    '<div class="lv-np" id="lvSim" data-cam="' + esc(camId) + '">' +
      '<b id="lvSimTitle"></b><span id="lvSimArtist"></span>' +
      '<div class="lv-bar"><div class="lv-bar-fill" id="lvSimFill"></div></div>' +
      '<span class="lv-np-time"><span id="lvSimEl">--:--</span> / <span id="lvSimTot">--:--</span> · quedan <b id="lvSimRem">--:--</b></span>' +
    '</div>' +
  '</div>';
}

function render(){
  var cam = role === 'cam';
  $('#liveTitle').textContent = cam ? 'Panel en directo' : 'Estoy dentro';
  $('#liveSub').textContent = ev.name + ' · ' + (ev.venue || '');
  var head = '<div class="lv-now"><span class="lv-dot"></span>EN DIRECTO · ' + esc(evHours(ev)) + '</div>';

  if(cam){ renderCamRole(head); return; }
  if(selCam) renderCamDetail(head);
  else renderCamPick(head);
}

/* ── FASE 1 · elegir camarógrafo (mapa de salas + lista) ────────────────── */
function renderCamPick(head){
  var cams = evCams();
  var listHtml;
  if(!cams.length){
    listHtml = '<div class="lv-empty">No hay camarógrafos disponibles.<br><span>La sala está vacía — prueba más tarde.</span></div>';
  } else {
    listHtml = cams.map(function(c){
      var badge = c.prefs.resv ? '<span class="lv-badge resv">Plaza reservada ✓</span>'
        : c.prefs.interest ? '<span class="lv-badge int">Te interesa ♥</span>'
        : c.prefs.follow ? '<span class="lv-badge fol">Le sigues</span>' : '';
      var pend = pendingOf(c.id);
      return '<button class="lv-camrow" data-cam="' + esc(c.id) + '">' +
        '<div class="lv-cam-i"><b>' + esc(c.name) + '</b><span class="lv-cam-s">' + esc(c.sala) + '</span>' + badge + '</div>' +
        '<div class="lv-cam-q' + (pend === 0 ? ' free' : '') + '"><b>' + pend + '</b><span>en cola</span></div>' +
        '<span class="lv-cam-go">›</span>' +
      '</button>';
    }).join('');
  }
  $('#liveBody').innerHTML = head +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Camarógrafos en el evento</div>' +
      '<div id="lvCamList">' + listHtml + '</div>' +
      '<p class="lv-hint">Toca uno para ver su cola, qué suena en su sala y dónde está.</p>' +
    '</div>' +
    mapCard('view', 'Salas del local', 'Cada marcador rojo es un camarógrafo (con su nombre debajo).');
  document.querySelectorAll('.lv-camrow').forEach(function(b){
    b.addEventListener('click', function(){ selCam = b.dataset.cam; render(); });
  });
}

/* ── FASE 2 · ficha del camarógrafo (antes y después de apuntarte) ──────── */
function renderCamDetail(head){
  var c = camInfo(selCam, 0);
  if(!c){ selCam = null; render(); return; }
  var s = st(), joinedHere = s.cam === c.id;
  var badge = c.prefs.resv ? '<span class="lv-badge resv">Plaza reservada ✓</span>'
    : c.prefs.interest ? '<span class="lv-badge int">Te interesa ♥</span>'
    : c.prefs.follow ? '<span class="lv-badge fol">Le sigues</span>' : '';

  $('#liveBody').innerHTML = head +
    '<button class="lv-backrow" id="lvPickOther">‹ Elegir otro camarógrafo</button>' +
    '<div class="lv-camhead"><b>' + esc(c.name) + '</b><span>' + esc(c.sala) + '</span>' + badge + '</div>' +
    (joinedHere
      ? '<div class="lv-card"><div class="lv-card-h">Tu turno</div>' +
          '<div class="lv-prep idle" id="lvPrep"><b id="lvPrepState">—</b><span class="lv-cd" id="lvPrepCd">--:--</span><span class="lv-msg" id="lvPrepMsg"></span></div>' +
        '</div>'
      : '') +
    nowCard(c.id) +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Su cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
      '<div id="lvQList"></div>' +
      '<div id="lvQActions"></div>' +
    '</div>' +
    mapCard('view', 'Dónde está situado', 'Busca el marcador «' + esc(c.name.split(' ')[0]) + '» en ' + esc(c.sala) + '.');

  $('#lvPickOther').addEventListener('click', function(){ selCam = null; render(); });
  renderQueue(c.id);
  tickUI();
}

function renderQueue(camId){
  var s = st(), p = progOf(camId), list = queueList(camId), served = p.served;
  var joinedHere = s.cam === camId;
  var rows = list.map(function(q, i){
    var stTxt, cls = '';
    if(i < served){ stTxt = '✓'; cls = 'done'; }
    else if(i === served){ stTxt = '▶ bailando'; cls = 'nowd'; }
    else { stTxt = '#' + (i - served); }
    if(q.me) cls += ' me';
    return '<div class="lv-q ' + cls + '"><span class="lv-q-n">' + esc(q.name) + '</span><span class="lv-q-s">' + stTxt + '</span></div>';
  }).join('');
  $('#lvQList').innerHTML = rows || '<div class="lv-hint">Nadie en su cola — ¡turno inmediato!</div>';
  var pend = list.length - Math.min(served, list.length);
  $('#lvQCount').textContent = pend + ' en cola';

  var a = '';
  if(role === 'cam'){
    a = '<button class="cta" id="lvAdvance"' + (served >= list.length ? ' disabled' : '') + '>Cambio de pareja →</button>' +
        '<p class="lv-hint">Con el detector en marcha, la cola avanza SOLA con cada cambio de canción.</p>';
  } else if(joinedHere){
    var left = songsLeftForMe();
    if(left != null && left < 0){
      a = '<p class="lv-hint done-hint">Ya bailaste ✓ — tu vídeo llegará por WeTransfer.</p>' +
          '<button class="cta" id="lvJoin">Volver a apuntarme</button>';
    } else {
      a = '<button class="cta leave" id="lvLeave">✕ Salir de la cola</button>';
    }
  } else {
    var warn = s.cam ? '<p class="lv-hint">Al apuntarte SALDRÁS de la cola de ' + esc((camInfo(s.cam, 0) || { name:'tu cámara actual' }).name) + '.</p>' : '';
    a = '<button class="cta" id="lvJoin">Apuntarme a su cola · serías el #' + (pend + 1) + '</button>' + warn;
  }
  $('#lvQActions').innerHTML = a;

  var j = $('#lvJoin');
  if(j) j.addEventListener('click', function(){
    var pNow = progOf(camId);
    setSt({ cam: camId });                                   // cambiarse = salir de la anterior
    setProg(camId, { myIdx: pNow.served + pendingOf(camId) });   // al final de SU cola actual
    render();
  });
  var l = $('#lvLeave');
  if(l) l.addEventListener('click', function(){
    setSt({ cam:null });
    setProg(camId, { myIdx:null });
    render();
  });
  var adv = $('#lvAdvance');
  if(adv) adv.addEventListener('click', function(){ advance(camId); });
}

function advance(camId){
  var p = progOf(camId), total = queueList(camId).length;
  if(p.served >= total) return;
  setProg(camId, { served: p.served + 1 });
  renderQueue(camId);
  tickUI();
}

/* ── rol CÁMARA: su cola + su posición + detector ───────────────────────── */
var SELF = '_self';
function renderCamRole(head){
  $('#liveBody').innerHTML = head +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Tu cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
      '<div id="lvQList"></div>' +
      '<div id="lvQActions"></div>' +
    '</div>' +
    mapCard('cam', 'Marca tu posición en la sala', 'Arrastra TU marcador (el desbloqueado) a donde estés.') +
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
  renderQueue(SELF);
  bindDetectorUI();
  tickUI();
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
    onChange: function(){ advance(SELF); },   // cada cambio de canción = turno servido
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

/* ── refresco (cada 500 ms): sonando-ahora sim + tarjeta de aviso ───────── */
var PREP_ALERT_SEC = 25, PREP_GO_SEC = 6;

function tickUI(){
  /* sonando ahora (simulado) de la ficha del cam */
  var sim = $('#lvSim');
  if(sim){
    var now = simNow(sim.dataset.cam);
    $('#lvSimTitle').textContent = now.title;
    $('#lvSimArtist').textContent = now.artist;
    $('#lvSimEl').textContent = fmtM(now.elapsed);
    $('#lvSimTot').textContent = fmtM(now.duration);
    $('#lvSimRem').textContent = fmtM(now.remaining);
    $('#lvSimFill').style.width = (now.elapsed / now.duration) * 100 + '%';
  }

  var prep = $('#lvPrep'); if(!prep) return;
  var state = 'idle', label, cd = '--:--', msg;
  if(role === 'cam'){ label = 'INACTIVO'; msg = 'Arranca el detector para avisos de turno'; }
  else { label = 'EN COLA'; msg = ''; }
  var song = det && det.currentSong;
  var fails = det ? det.consecutiveFails : 0;
  var left = songsLeftForMe();

  /* progreso de la canción real (solo cámara tiene #lvNp) */
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
      if(justChanged){ state = 'go'; label = '¡CAMBIO DE PAREJA!'; cd = fmtM(rem); msg = 'Suena: ' + song.title; }
      else if(elapsed2 >= song.duration){ state = 'waiting'; label = 'ESPERANDO SIGUIENTE'; cd = '🔍'; msg = 'Buscando la próxima canción…'; }
      else if(rem <= PREP_ALERT_SEC){ state = 'alert'; label = '¡PREPÁRATE!'; cd = fmtM(rem); msg = 'La canción está acabando'; }
      else { state = 'waiting'; label = 'EN CURSO'; cd = fmtM(rem); msg = 'Tiempo hasta el cambio de pareja'; }
    }
  } else if(role !== 'cam' && left != null){
    /* bailarín: turno según la cola, con cuenta atrás sobre la canción SIMULADA */
    var s2 = st(), simn = s2.cam ? simNow(s2.cam) : null;
    if(left < 0){ state = 'idle'; label = 'YA BAILASTE ✓'; cd = '--:--'; msg = 'Tu vídeo llegará por WeTransfer'; }
    else if(left === 0){ state = 'go'; label = '¡TE TOCA — A BAILAR!'; cd = simn ? fmtM(simn.remaining) : 'YA'; msg = simn ? 'Suena: ' + simn.title : 'Estás bailando (según la cola)'; }
    else if(left === 1){
      var alert1 = simn && simn.remaining <= PREP_ALERT_SEC;
      state = alert1 ? 'alert' : 'waiting';
      label = alert1 ? '¡PREPÁRATE!' : 'ERES EL SIGUIENTE';
      cd = simn ? fmtM(simn.remaining) : '~4\'';
      msg = alert1 ? 'La canción está acabando — te toca en la siguiente' : 'Cuando acabe esta canción, te toca';
    }
    else {
      state = 'waiting'; label = 'EN COLA · #' + left;
      cd = simn ? fmtM(simn.remaining + (left - 1) * SONG_AVG) : ('~' + Math.round(left * SONG_AVG / 60) + "'");
      msg = 'Te quedan ' + left + ' canciones por delante';
    }
  }

  prep.className = 'lv-prep ' + state;
  $('#lvPrepState').textContent = label;
  $('#lvPrepCd').textContent = cd;
  $('#lvPrepMsg').textContent = msg;
}

return { wire:wire, open:open, close:close };
})();
