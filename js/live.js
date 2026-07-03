/* ══════════════════════════════════════════════════════════════════════════
   MODO EN DIRECTO ("Estoy dentro") — window.Live
   Vista para un evento QUE ESTÁ OCURRIENDO AHORA.

   BAILARÍN:
     FASE 1 · Elegir camarógrafo: lista (sala + nº en cola + preferencias:
       reservado > te interesa > le sigues) y el mapa de SALAS del local —
       cada sala es una "página" independiente: se cambia con ‹ › o SWIPE
       sobre el mapa, y muestra los camarógrafos DE ESA SALA situados.
       Si ya estás en una cola: banner arriba con tu cámara, posición y
       tiempo estimado (toca para volver a su ficha).
     FASE 2 · Ficha de un camarógrafo: sonando en su sala (demo simulada),
       su cola, y el mapa de SU sala mostrando SOLO su marcador. CTA
       apuntarse/salir. El ← del móvil/app desde la ficha vuelve a la LISTA
       (no fuera del modo en directo) — Live.back() lo gestiona app.js.
   CÁMARA: su cola, su posición en el mapa (clave propia, no la pisan las
     vistas del bailarín), su "demanda" en el evento y el detector real.

   Claves: cola/estado 'cilap-live' {cam, prog}; mapa del bailarín (por sala)
   'cilap-live-map-view' + cams 'cilap-live-cams'; mapa del cámara
   'cilap-live-map'. Mis eventos (app.js) lee cilap-live para mostrar la cola
   a la que estás apuntado aunque cierres la app.
   ══════════════════════════════════════════════════════════════════════════ */
window.Live = (function(){
'use strict';

var LKEY = 'cilap-live';
var MAPKEY_CAM = 'cilap-live-map';        // mapa donde el CÁMARA marca su posición
var MAPKEY_VIEW = 'cilap-live-map-view';  // mapa (por sala) que VE el bailarín
var CAMSKEY = 'cilap-live-cams';
var SONG_AVG = 210;

var DEMO_COUPLES = ['Marcos & Lucía', 'Dani & Sofía', 'Álex & Marta', 'Hugo & Elena',
                    'Pablo & Nerea', 'Iván & Carla', 'Sergio & Paula', 'Leo & Noa'];

/* SALAS del local: cada una con SU mapa completo (páginas independientes) */
var SALAS = [
  { name:'Sala principal', map:{
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
  { name:'Sala 2', map:{
      id:'sala-2', name:'Sala 2',
      pieces:[ { id:1, kind:'rect', x:50, y:52, w:72, h:80, rot:0 } ],
      elements:[
        { id:2, type:'dj',     x:50, y:22, w:26, h:26, rot:0 },
        { id:3, type:'bar',    x:74, y:60, w:22, h:70, rot:0 },
        { id:4, type:'acceso', x:32, y:88, w:24, h:24, rot:0 }
      ] } }
];
/* cola demo y sitio (sala + posición dentro de SU sala) por cámara */
var CAM_DEMO = {
  juan:   { n:0, sala:0, x:32, y:42 },
  carlos: { n:2, sala:0, x:60, y:62 },
  lucia:  { n:3, sala:0, x:30, y:76 },
  ana:    { n:0, sala:1, x:50, y:40 },
  david:  { n:4, sala:1, x:62, y:70 }
};
var DEMO_SONGS = [
  ['Romeo Santos', 'Propuesta Indecente', 224],
  ['Prince Royce', 'Darte un Beso', 192],
  ['Aventura', 'Obsesión', 238],
  ['Juan Luis Guerra', 'Bachata Rosa', 204],
  ['Manuel Turizo', 'La Bachata', 163],
  ['Grupo Extra', 'Me Emborracharé', 210]
];
/* mapa base del CÁMARA (su marcador "Tú" persiste aquí) */
var CAM_BASE_MAP = { id:'sala-cam', name:'Tu sala', pieces:SALAS[0].map.pieces, elements:SALAS[0].map.elements };

var app = null;
var ev = null, role = 'dancer';
var selCam = null;      // ficha abierta (no persiste)
var salaIdx = 0;        // sala visible en el pager de fase 1
var mapSeq = 0;         // bust del iframe al cambiar de sala/ficha
var det = null;
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

/* ── camarógrafos del evento ── */
function evBase(){ return (ev.id || '').split('@')[0]; }
function lsObj(k){ try{ return JSON.parse(localStorage.getItem(k)) || {}; }catch(e){ return {}; } }
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
  var demo = CAM_DEMO[camId] || { n:(i * 2) % 5, sala:i % SALAS.length, x:30 + (i * 13) % 45, y:35 + (i * 17) % 45 };
  return { id:camId, name:c.name, sala:SALAS[demo.sala].name, salaIdx:demo.sala, demo:demo, prefs:camPrefs(camId) };
}
function evCams(){
  return (ev.camIds || []).map(camInfo).filter(Boolean)
    .sort(function(a, b){ return b.prefs.score - a.prefs.score; });
}

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
  return p.myIdx - p.served;
}
function pendingOf(camId){
  var p = progOf(camId);
  return Math.max(0, (CAM_DEMO[camId] || { n:2 }).n - p.served);
}
/* tiempo estimado hasta tu turno (canción simulada actual + 3:30 por pareja) */
function etaSecs(){
  var s = st(), left = songsLeftForMe();
  if(left == null || left <= 0) return 0;
  var sim = simNow(s.cam);
  return sim.remaining + (left - 1) * SONG_AVG;
}

var SET_TOTAL = DEMO_SONGS.reduce(function(s, x){ return s + x[2]; }, 0);
function simNow(camId){
  var seed = 0; for(var i = 0; i < (camId || '').length; i++) seed += camId.charCodeAt(i);
  var t = (Math.floor(Date.now() / 1000) + seed * 137) % SET_TOTAL;
  var idx = 0;
  while(t >= DEMO_SONGS[idx][2]){ t -= DEMO_SONGS[idx][2]; idx++; }
  var s = DEMO_SONGS[idx];
  return { artist:s[0], title:s[1], duration:s[2], elapsed:t, remaining:s[2] - t };
}

/* ── API pública ── */
function wire(glue){ app = glue; }

function open(event, r){
  ev = event;
  role = r || (app && app.getRole && app.getRole()) || 'dancer';
  selCam = st().cam;          // si ya estás en una cola, entra por su ficha
  if(role === 'cam'){
    /* mapa propio del cámara: se siembra UNA vez y no lo pisan las vistas */
    try{
      var cur = null; try{ cur = JSON.parse(localStorage.getItem(MAPKEY_CAM)); }catch(e2){}
      if(!cur || cur.id !== CAM_BASE_MAP.id) localStorage.setItem(MAPKEY_CAM, JSON.stringify(CAM_BASE_MAP));
    }catch(e){}
  }
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

/* ← del header: desde la ficha vuelve a la LISTA; desde la lista, sale */
function back(){
  if(role !== 'cam' && selCam){ selCam = null; render(); return true; }
  return false;
}

/* escribe el mapa de UNA sala + los cams a mostrar (todos los de la sala, o
   solo uno para la ficha) y devuelve el src del iframe (con bust) */
function stageMap(salaI, onlyCamId){
  try{
    localStorage.setItem(MAPKEY_VIEW, JSON.stringify(SALAS[salaI].map));
    var cams = (ev.camIds || []).map(camInfo).filter(Boolean)
      .filter(function(c){ return c.salaIdx === salaI && (!onlyCamId || c.id === onlyCamId); })
      .map(function(c){ return { id:c.id, name:c.name.split(' ')[0], x:c.demo.x, y:c.demo.y }; });
    localStorage.setItem(CAMSKEY, JSON.stringify(cams));
  }catch(e){}
  return 'mapa-editor/?live=view&r=' + (++mapSeq);
}

/* ── render ── */
function render(){
  var cam = role === 'cam';
  $('#liveTitle').textContent = cam ? 'Panel en directo' : 'Estoy dentro';
  $('#liveSub').textContent = ev.name + ' · ' + (ev.venue || '');
  var head = '<div class="lv-now"><span class="lv-dot"></span>EN DIRECTO · ' + esc(evHours(ev)) + '</div>';

  if(cam){ renderCamRole(head); return; }
  if(selCam) renderCamDetail(head);
  else renderCamPick(head);
}

/* ── FASE 1 · lista + salas paginadas ── */
function renderCamPick(head){
  var cams = evCams(), s = st();
  var joined = s.cam ? camInfo(s.cam, 0) : null;
  var left = songsLeftForMe();

  var banner = '';
  if(joined && left != null && left >= 0){
    banner = '<button class="lv-joined" id="lvJoinedBanner">' +
      '<span class="lv-dot"></span>' +
      '<span class="lv-joined-t">En la cola de <b>' + esc(joined.name) + '</b> · ' +
        (left === 0 ? '¡te toca!' : '#' + left + ' · ~<b id="lvJoinedTime">' + fmtM(etaSecs()) + '</b>') + '</span>' +
      '<span class="lv-cam-go">›</span>' +
    '</button>';
  }

  var listHtml;
  if(!cams.length){
    listHtml = '<div class="lv-empty">No hay camarógrafos disponibles.<br><span>La sala está vacía — prueba más tarde.</span></div>';
  } else {
    listHtml = cams.map(function(c){
      var badge = c.prefs.resv ? '<span class="lv-badge resv">Plaza reservada ✓</span>'
        : c.prefs.interest ? '<span class="lv-badge int">Te interesa ♥</span>'
        : c.prefs.follow ? '<span class="lv-badge fol">Le sigues</span>' : '';
      var mine = s.cam === c.id;
      var pend = pendingOf(c.id);
      var q = mine
        ? '<div class="lv-cam-q mine"><b>TÚ</b><span>' + (left === 0 ? 'bailas' : '#' + left) + '</span></div>'
        : '<div class="lv-cam-q' + (pend === 0 ? ' free' : '') + '"><b>' + pend + '</b><span>en cola</span></div>';
      return '<button class="lv-camrow' + (mine ? ' mine' : '') + '" data-cam="' + esc(c.id) + '">' +
        '<div class="lv-cam-i"><b>' + esc(c.name) + '</b><span class="lv-cam-s">' + esc(c.sala) + '</span>' + badge + '</div>' +
        q + '<span class="lv-cam-go">›</span>' +
      '</button>';
    }).join('');
  }

  $('#liveBody').innerHTML = head + banner +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Camarógrafos en el evento</div>' +
      '<div id="lvCamList">' + listHtml + '</div>' +
      '<p class="lv-hint">Toca uno para ver su cola, qué suena en su sala y dónde está.</p>' +
    '</div>' +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Salas del local</div>' +
      '<div class="lv-salapager">' +
        '<button class="cal-nav" id="lvSalaPrev">‹</button>' +
        '<span id="lvSalaName">' + esc(SALAS[salaIdx].name) + ' <small>' + (salaIdx + 1) + '/' + SALAS.length + '</small></span>' +
        '<button class="cal-nav" id="lvSalaNext">›</button>' +
      '</div>' +
      '<div class="lv-map-wrap">' +
        '<iframe id="lvMap" src="' + stageMap(salaIdx) + '" title="Mapa de la sala"></iframe>' +
        '<div class="lv-swipe" id="lvSalaSwipe"></div>' +
      '</div>' +
      '<p class="lv-hint">Desliza (o usa ‹ ›) para pasar de sala; cada marcador rojo es un camarógrafo.</p>' +
    '</div>';

  document.querySelectorAll('.lv-camrow').forEach(function(b){
    b.addEventListener('click', function(){ selCam = b.dataset.cam; render(); });
  });
  var jb = $('#lvJoinedBanner');
  if(jb) jb.addEventListener('click', function(){ selCam = s.cam; render(); });
  $('#lvSalaPrev').addEventListener('click', function(){ gotoSala(salaIdx - 1); });
  $('#lvSalaNext').addEventListener('click', function(){ gotoSala(salaIdx + 1); });
  /* swipe sobre el mapa (capa transparente: el iframe se traga los toques) */
  (function(){
    var sx = 0, sy = 0, on = false, ov = $('#lvSalaSwipe');
    ov.addEventListener('touchstart', function(e){ on = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    ov.addEventListener('touchend', function(e){
      if(!on) return; on = false;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if(Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) gotoSala(salaIdx + (dx < 0 ? 1 : -1));
    });
  })();
}
function gotoSala(i){
  salaIdx = (i + SALAS.length) % SALAS.length;
  var f = $('#lvMap'); if(!f) return;
  f.src = stageMap(salaIdx);
  $('#lvSalaName').innerHTML = esc(SALAS[salaIdx].name) + ' <small>' + (salaIdx + 1) + '/' + SALAS.length + '</small>';
}

/* ── FASE 2 · ficha (el mapa muestra SOLO a ese camarógrafo, en su sala) ── */
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
    '<div class="lv-card">' +
      '<div class="lv-card-h">Sonando en su sala <span class="lv-count">demo</span></div>' +
      '<div class="lv-np" id="lvSim" data-cam="' + esc(c.id) + '">' +
        '<b id="lvSimTitle"></b><span id="lvSimArtist"></span>' +
        '<div class="lv-bar"><div class="lv-bar-fill" id="lvSimFill"></div></div>' +
        '<span class="lv-np-time"><span id="lvSimEl">--:--</span> / <span id="lvSimTot">--:--</span> · quedan <b id="lvSimRem">--:--</b></span>' +
      '</div>' +
    '</div>' +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Su cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
      '<div id="lvQList"></div>' +
      '<div id="lvQActions"></div>' +
    '</div>' +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Dónde está situado</div>' +
      '<div class="lv-map-wrap"><iframe id="lvMap" src="' + stageMap(c.salaIdx, c.id) + '" title="Ubicación"></iframe></div>' +
      '<p class="lv-hint">' + esc(c.name.split(' ')[0]) + ' en ' + esc(c.sala) + ' (solo se muestra su marcador).</p>' +
    '</div>';

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
    setSt({ cam: camId });                                       // cambiarse = salir de la anterior
    setProg(camId, { myIdx: pNow.served + pendingOf(camId) });   // al final de SU cola
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

/* ── rol CÁMARA ── */
var SELF = '_self';
function renderCamRole(head){
  /* demanda demo + señales reales del dispositivo (si el bailarín local marcó algo) */
  var it = lsObj('cilap-interest'), fo = lsObj('cilap-follows');
  var interesados = 3 + Object.keys(it).filter(function(k){ return it[k] && k.indexOf(evBase()) === 0; }).length;
  var seguidores = 5 + Object.keys(fo).filter(function(k){ return fo[k]; }).length;
  $('#liveBody').innerHTML = head +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Tu demanda en el evento <span class="lv-count">demo</span></div>' +
      '<div class="lv-demand"><div><b>' + interesados + '</b><span>interesados en grabar contigo</span></div>' +
      '<div><b>' + seguidores + '</b><span>te siguen</span></div></div>' +
    '</div>' +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Tu cola de parejas <span class="lv-count" id="lvQCount"></span></div>' +
      '<div id="lvQList"></div>' +
      '<div id="lvQActions"></div>' +
    '</div>' +
    '<div class="lv-card">' +
      '<div class="lv-card-h">Marca tu posición en la sala</div>' +
      '<div class="lv-map-wrap"><iframe id="lvMap" src="mapa-editor/?live=cam&r=' + (++mapSeq) + '" title="Tu posición"></iframe></div>' +
      '<p class="lv-hint">Arrastra TU marcador («Tú») a donde estés.</p>' +
    '</div>' +
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

/* ── detector (solo cámara) ── */
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
    onChange: function(){ advance(SELF); },
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

/* ── refresco (500 ms) ── */
var PREP_ALERT_SEC = 25, PREP_GO_SEC = 6;

function tickUI(){
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
  var jt = $('#lvJoinedTime');
  if(jt) jt.textContent = fmtM(etaSecs());

  var prep = $('#lvPrep'); if(!prep) return;
  var state = 'idle', label, cd = '--:--', msg;
  if(role === 'cam'){ label = 'INACTIVO'; msg = 'Arranca el detector para avisos de turno'; }
  else { label = 'EN COLA'; msg = ''; }
  var song = det && det.currentSong;
  var fails = det ? det.consecutiveFails : 0;
  var left = songsLeftForMe();

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
      cd = fmtM(etaSecs());
      msg = 'Te quedan ' + left + ' canciones por delante';
    }
  }

  prep.className = 'lv-prep ' + state;
  $('#lvPrepState').textContent = label;
  $('#lvPrepCd').textContent = cd;
  $('#lvPrepMsg').textContent = msg;
}

return { wire:wire, open:open, close:close, back:back };
})();
