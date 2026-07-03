
(function(){
  'use strict';
  var $ = function(s){ return document.querySelector(s); };
  var app = $('.app');

  var state = { role:null, country:null, prov:null, city:null, type:null, subtype:null };
  var ROLE_META = { cam:'Camarógrafo', dancer:'Bailarín' };
  /* iconos de rol: se muestran junto a los títulos de nivel 1 (en vez del slot
     "Rol" del histórico). dancer = figura bailando; cam = videocámara. */
  /* MISMO símbolo que las tarjetas de rol de la pantalla principal (view1) */
  var ROLE_ICON = {
    dancer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.8" cy="3.8" r="1.9"/><path d="M14.2 6.8c-.7 2.4-1.6 3.9-3.4 5.4"/><path d="M14.6 8.2l4.9-2.3"/><path d="M13.8 8.7l-4.9-1.5"/><path d="M10.8 12.2l3.1 3.9-1 4.9"/><path d="M10.8 12.2l-3.3 3.4 1.4 4.3"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.8l6-3.3v9l-6-3.3"/><circle cx="7.5" cy="12" r="2.2"/></svg>'
  };
  /* MISMO color que en la pantalla principal (view1 .card[data-role]) */
  var ROLE_COLOR = { dancer:'#c46bff', cam:'#ffd60a' };
  /* coloca el icono del rol actual junto a CADA título de nivel 1 (.v2-title) */
  function updateRoleIcons(){
    var r = state.role && state.role.value;
    var svg = (r && ROLE_ICON[r]) ? ROLE_ICON[r] : '';
    document.querySelectorAll('.v2-title').forEach(function(t){
      var ico = t.querySelector('.role-ico');
      if(!ico){ ico = document.createElement('span'); ico.className = 'role-ico'; }
      t.appendChild(ico);                 // icono SIEMPRE a la derecha del título
      ico.innerHTML = svg;
      ico.style.color = (r && ROLE_COLOR[r]) ? ROLE_COLOR[r] : '';
      ico.title = state.role ? state.role.label : '';
    });
  }
  var ORDER = ['role','country','prov','city','type','subtype'];   // orden lógico de los pasos
  var resultTimer = null;

  /* ── persistencia ligera en localStorage ──────────────────────────── */
  function store(k, def){ try{ var v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; }catch(e){ return def; } }
  function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var joined   = store('cilap-joined',  {});   // eventos donde TÚ estás de camarógrafo
  var follows  = store('cilap-follows', {});   // camarógrafos que SIGUES (global, badge amarillo en eventos)
  var interest = store('cilap-interest',{});   // "me interesa grabar contigo" POR EVENTO (clave eventId_camId)
  var resv     = store('cilap-resv',    {});   // plazas reservadas (clave eventId_camId)
  var queue    = store('cilap-queue',   {});   // colas a las que te has apuntado
  var checkins = store('cilap-checkin', {});   // eventos donde TÚ abriste cola
  var saldo    = store('cilap-saldo',   20);   // saldo mock del bailarín (20 € de regalo)
  var ref      = store('cilap-ref', { countries:[], cities:[] });   // país/ciudad de referencia (config)
  function hasRef(){ return !!(ref.cities && ref.cities.length); }
  var attend    = store('cilap-attend',  {});   // "voy a asistir" por evento (eventId->true)
  var wishrec   = store('cilap-wishrec', {});   // "me interesará grabar" por evento
  var camreq    = store('cilap-camreq',  {});   // "solicitar a camarógrafo": eventId -> [camIds]
  var myRatings = store('cilap-myratings', {}); // valoración del bailarín a la cámara de un baile (danceKey -> {stars,text})
  var isPrivate = store('cilap-private', false);// cuenta privada: interacciones anónimas
  /* normaliza para búsquedas insensibles a tildes/mayúsculas */
  function norm(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function fmtEur(x){ return x.toFixed(2).replace('.', ',') + ' €'; }
  function charge(x){
    saldo = Math.round((saldo - x) * 100) / 100;
    save('cilap-saldo', saldo);
    renderSaldo();
  }
  function renderSaldo(){
    var el = $('#setSaldo'); if(el) el.innerHTML = '<b>' + fmtEur(saldo) + '</b> disponibles';
  }
  var currentEvent = null;

  /* ── historial de navegación: el botón ← vuelve al MOMENTO anterior (no por
     jerarquía). Se apila un snapshot del estado actual ANTES de cada paso
     adelante (en goView y en las transiciones internas de la vista 2). ── */
  var navStack = [], histLock = false, refStackMark = 0;

  /* ── acento por pantalla ──────────────────────────────────────────── */
  var ACCENT_CLASSES = ['ac-red','ac-blue','ac-amber','ac-lime','ac-violet'];
  var ACCENTS = { view1:'ac-red', stepA:'ac-blue', stepP:'ac-blue', stepB:'ac-amber',
                  stepC:'ac-lime', stepD:'ac-violet', result:'ac-red' };
  function setAccent(cls){
    ACCENT_CLASSES.forEach(function(c){ app.classList.remove(c); });
    if(cls && cls !== 'ac-red') app.classList.add(cls);  // rojo = base
  }

  /* ── tema claro/oscuro ────────────────────────────────────────────── */
  var themeBtn = $('#themeBtn');
  function applyTheme(t){
    app.classList.toggle('light', t === 'light');
    themeBtn.textContent = t === 'light' ? '☾' : '☀';
    try{ localStorage.setItem('cilap-theme', t); }catch(e){}
  }
  themeBtn.addEventListener('click', function(){
    applyTheme(app.classList.contains('light') ? 'dark' : 'light');
  });
  var savedTheme = 'dark';
  try{ savedTheme = localStorage.getItem('cilap-theme') || 'dark'; }catch(e){}
  applyTheme(savedTheme);

  /* ── timecode del visor ───────────────────────────────────────────── */
  (function(){
    var el = $('#tc'), f = 0;
    function pad(n){ return (n<10?'0':'')+n; }
    setInterval(function(){
      f++;
      el.textContent = pad(Math.floor(f/90000)) + ':' +
                       pad(Math.floor(f/1500)%60) + ':' +
                       pad(Math.floor(f/25)%60) + ':' +
                       pad(f%25);
    }, 40);
  })();

  /* ── helpers de pasos ─────────────────────────────────────────────── */
  /* muestra solo las opciones cuyo data-show incluye la clave dada
     (ciudades según país, subtipos según tipo) */
  function filterOpts(stepId, keys){
    var arr = Array.isArray(keys) ? keys : [keys];
    document.querySelectorAll('#'+stepId+' .opt').forEach(function(o){
      var show = (o.dataset.show || '').split(',');
      o.hidden = !arr.some(function(k){ return show.indexOf(k) !== -1; });
    });
  }
  // preset: valor (o array) a dejar marcado al abrir (modo edición)
  function openStep(id, preset){
    var el = $('#'+id);
    if(id === 'stepP' && state.country) filterOpts('stepP', state.country.value);
    /* ciudades: por provincia si hay una concreta (fuera del picker de lugar,
       que no usa provincia); si no, por país */
    if(id === 'stepB' && state.country){
      var byProv = !refMode && state.prov && state.prov.value !== 'all';
      filterOpts('stepB', byProv ? state.prov.value : state.country.value);
    }
    if(id === 'stepD' && state.type)    filterOpts('stepD', state.type.value);
    var pa = Array.isArray(preset) ? preset : (preset != null ? [preset] : []);
    el.querySelectorAll('.opt').forEach(function(o){
      o.classList.remove('selected','picked','dim','multi-on');
      if(pa.length > 1){ if(pa.indexOf(o.dataset.value) !== -1) o.classList.add('multi-on'); }
      else if(pa.length === 1 && o.dataset.value === pa[0]) o.classList.add('selected');
    });
    updateContinue(id);
    // re-disparar el stagger interno aunque ya estuviera abierto antes
    el.classList.remove('open','settled');
    void el.offsetHeight;
    el.classList.add('open');
    setAccent(ACCENTS[id]);
    // cuando termina la entrada escalonada, fijar estado limpio (ver CSS .settled)
    setTimeout(function(){
      if(el.classList.contains('open')) el.classList.add('settled');
    }, 750);
  }
  function closeStep(id){ $('#'+id).classList.remove('open','settled'); }
  var ALL_STEPS = ['stepA','stepP','stepB','stepC','stepD','result'];
  function closeAll(){
    ALL_STEPS.forEach(closeStep);
    if(resultTimer){ clearTimeout(resultTimer); resultTimer=null; }
    $('#result').classList.remove('done');
    if(setCritCollapsed) setCritCollapsed(false);     // al editar, criterios visibles
  }
  function closeFrom(key){
    var map = { country:['stepA','stepP','stepB','stepC','stepD','result'],
                prov:['stepP','stepB','stepC','stepD','result'],
                city:['stepB','stepC','stepD','result'],
                type:['stepC','stepD','result'],
                subtype:['stepD','result'] };
    (map[key]||[]).forEach(closeStep);
    if(resultTimer){ clearTimeout(resultTimer); resultTimer=null; }
    $('#result').classList.remove('done');
  }
  /* abre el primer paso pendiente; si no queda ninguno, busca eventos.
     El subtipo solo aplica al tipo "Al exterior". */
  function advance(){
    if(refMode){                       // lugar habitual: solo País → Ciudad
      if(!state.country){ openStep('stepA'); }
      else if(!state.city){ openStep('stepB'); }
      else { finishRefPick(); }
      return;
    }
    if(!state.country){ openStep('stepA'); }
    else if(!state.prov){
      /* auto-salto: si el país (o países) elegido solo tiene UNA provincia con
         eventos, se fija sola y no molesta con el paso */
      var ps = provsWithEvents(state.country.value);
      if(ps.length <= 1){
        state.prov = { value: ps[0] || 'all', label: PROV_LABELS[ps[0]] || 'Todas', auto:true };
        renderPanel(); advance();
      } else openStep('stepP');
    }
    else if(!state.city){ openStep('stepB'); }
    else if(!state.type){ openStep('stepC'); }
    else if(state.type.value === 'exterior' && !state.subtype){ openStep('stepD'); }
    else {
      var r = $('#result');
      r.classList.remove('done');
      defaultDateRange();          // por defecto: próximos 7 días
      renderResults();
      if(setCritCollapsed) setCritCollapsed(false);     // criterios desplegados al recalcular
      $('#view2').scrollTop = 0;
      openStep('result');
      resultTimer = setTimeout(function(){ r.classList.add('done'); scheduleRelayout(); }, 1400);
    }
  }
  /* provincias con eventos para los países dados (para el auto-salto del paso) */
  function provsWithEvents(countries){
    var arr = Array.isArray(countries) ? countries : [countries];
    var set = {};
    EVENTS.forEach(function(ev){ if(arr.indexOf(ev.country) !== -1 && ev.prov) set[ev.prov] = 1; });
    return Object.keys(set);
  }
  /* rellena el filtro de fecha con los próximos 7 días si está vacío */
  var dateTouched = false;
  function defaultDateRange(){
    if(dateTouched || $('#dateFrom').value || $('#dateTo').value) return;
    var iso = function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
    var hoy = new Date(); var fin = new Date(); fin.setDate(fin.getDate() + 7);
    $('#dateFrom').value = iso(hoy);
    $('#dateTo').value   = iso(fin);
  }

  /* ── picker de pasos reutilizable (País → Ciudad) para "lugar":
     refTarget 'settings' = lugar habitual (single-select, guarda en ref);
     refTarget 'cams' = filtro de lugar del directorio (multi, como histórico) ── */
  var refTarget = 'settings';
  function refSingle(){ return refTarget === 'settings'; }
  function startRefPick(target){
    refTarget = target || 'settings';
    refStackMark = navStack.length;               // el historial del picker no contamina el global
    refMode = true;
    savedSearch = { country:state.country, prov:state.prov, city:state.city, type:state.type, subtype:state.subtype };
    state.country = null; state.prov = null; state.city = null;   // empieza en País (el picker no usa provincia)
    editing = null;
    var v2 = $('#view2');
    v2.classList.add('ref-mode');
    v2.classList.toggle('place-single', refSingle());   // single oculta casillas multi
    v2.querySelector('.v2-title').textContent = refSingle() ? 'Lugar habitual' : 'Lugar';
    v2.querySelector('.v2-sub').textContent   = refSingle() ? 'Elige tu país y ciudad de referencia.' : 'Elige país y ciudad para filtrar camarógrafos.';
    updateRoleIcons();                            // textContent borró el icono → re-pónlo
    closeAll();
    renderPanel();
    goView('view2', refSingle() ? 'ac-violet' : 'ac-amber');
    advance();                                    // → paso País
  }
  function finishRefPick(){
    var toArr = function(v){ return Array.isArray(v) ? v.slice() : [v]; };
    var countries = toArr(state.country.value);
    var target = refTarget;
    if(target === 'settings'){
      if(state.city.value === 'all'){             // "Todas" → todas las ciudades de esos países
        ref.cities = countries.reduce(function(acc, k){ return acc.concat(k === 'es' ? ['mad','sev','bcn'] : ['waw','kra']); }, []);
      } else { ref.cities = toArr(state.city.value); }
      ref.countries = countries;
      save('cilap-ref', ref);
      exitRefMode(true);
      refreshRefUI();
      renderSettings();
      histLock = true; goView('viewSettings','ac-violet'); histLock = false;
    } else {                                       // 'cams': aplica al filtro de lugar del directorio
      placeCountries = countries;
      placeCities = (state.city.value === 'all') ? [] : toArr(state.city.value);   // "Todas" → sin filtro de ciudad
      $('#placeLbl').textContent = placeLabel();
      exitRefMode(true);
      renderCamDir();
      histLock = true; goView('viewCams','ac-amber'); histLock = false;
    }
  }
  function exitRefMode(restore){
    refMode = false;
    $('#view2').classList.remove('place-single');
    if(navStack.length > refStackMark) navStack.length = refStackMark;   // descarta el historial del picker
    var v2 = $('#view2');
    v2.classList.remove('ref-mode');
    v2.querySelector('.v2-title').textContent = 'Encuentra tu pista';
    v2.querySelector('.v2-sub').textContent   = 'Filtra para ver los eventos disponibles.';
    updateRoleIcons();                            // textContent borró el icono → re-pónlo
    if(restore && savedSearch){
      state.country = savedSearch.country; state.prov = savedSearch.prov || null; state.city = savedSearch.city;
      state.type    = savedSearch.type;    state.subtype = savedSearch.subtype;
    }
    savedSearch = null;
    editing = null;
    closeAll();
    renderPanel();
  }

  /* ── panel de selecciones (huecos predefinidos) ───────────────────── */
  function renderPanel(){
    var firstEmpty = null;
    (refMode ? ['country','city'] : ['country','prov','city','type']).forEach(function(key){
      var slot = document.querySelector('#panel .slot[data-key="'+key+'"]');
      slot.classList.remove('now');
      if(state[key]){
        slot.classList.add('filled');
        slot.classList.toggle('allset', state[key].value === 'all');
        slot.querySelector('.sv').textContent = state[key].label;
      } else {
        slot.classList.remove('filled','allset');
        slot.querySelector('.sv').textContent = '—';
        if(!firstEmpty) firstEmpty = slot;
      }
    });
    // subtipo: sección aparte, solo existe si el tipo es "Al exterior"
    var sp = $('#subPanel');
    var isExt = !refMode && state.type && state.type.value === 'exterior';
    sp.classList.toggle('show', isExt);
    sp.classList.remove('now');
    if(isExt && state.subtype){
      sp.classList.add('filled');
      sp.classList.toggle('allset', state.subtype.value === 'all');
      sp.querySelector('.sv').textContent = state.subtype.label;
    } else {
      sp.classList.remove('filled','allset');
      sp.querySelector('.sv').textContent = '—';
      if(isExt && !firstEmpty) firstEmpty = sp;
    }
    if(firstEmpty) firstEmpty.classList.add('now');
    /* resumen para la barra de criterios comprimida */
    var sum = (refMode ? ['country','city'] : ['country','prov','city','type','subtype']).map(function(k){
      return state[k] ? state[k].label : null;
    }).filter(Boolean).join(' · ');
    var ms = $('#panelMiniSum'); if(ms) ms.textContent = sum || 'Sin criterios';
  }
  /* ✕ de cada hueco: quita esa selección (y las posteriores en cascada).
     El rol no lleva ✕/✎ a propósito: una vez elegido, no se edita desde aquí. */
  document.querySelectorAll('.slot .sx').forEach(function(btn){
    btn.addEventListener('click', function(){
      var key = btn.closest('.slot').dataset.key;
      /* ciudad y subtipo tienen valor por defecto: la ✕ vuelve a "Todas/Todos"
         (si ya es "Todas", la ✕ ni se muestra — solo queda editar) */
      if(key === 'city' && state.city){
        state.city = { value:'all', label:'Todas' };
        editing = null; closeAll(); renderPanel(); advance();
        return;
      }
      /* provincia también tiene "Todas"; la ciudad se resetea (dependía de ella) */
      if(key === 'prov' && state.prov){
        state.prov = { value:'all', label:'Todas' };
        state.city = state.city ? { value:'all', label:'Todas' } : null;
        editing = null; closeAll(); renderPanel(); advance();
        return;
      }
      if(key === 'subtype' && state.subtype){
        state.subtype = { value:'all', label:'Todos' };
        editing = null; closeAll(); renderPanel(); advance();
        return;
      }
      if(key === 'type' && state.type){
        state.type = { value:'all', label:'Todos' };
        state.subtype = null;                 // sin tipo concreto no hay subtipo
        editing = null; closeAll(); renderPanel(); advance();
        return;
      }
      goBackTo(key);   // país no tiene "todas": borrado en cascada
    });
  });

  /* ✎ de cada hueco: edita SOLO esa selección, respetando dependencias.
     Regla: la ciudad depende del país (país nuevo → ciudad a reelegir);
     el tipo es independiente y permanece fijado. */
  var editing = null;   // clave en edición, o null
  /* modo "lugar habitual": reutiliza el MISMO picker de pasos (País → Ciudad)
     pero, en vez de terminar en resultados, guarda en la referencia (cilap-ref)
     y vuelve a Configuración. savedSearch preserva la búsqueda en curso. */
  var refMode = false, savedSearch = null;
  function editSlot(key){
    pushHist();                          // momento previo (← vuelve a donde estabas)
    editing = key;
    closeAll();
    renderPanel();
    // el hueco en edición es el "activo" aunque esté relleno
    document.querySelectorAll('#panel .slot.now').forEach(function(s){ s.classList.remove('now'); });
    document.querySelector('.slot[data-key="'+key+'"]').classList.add('now');
    var map = { country:'stepA', prov:'stepP', city:'stepB', type:'stepC', subtype:'stepD' };
    /* sin preselección: al reabrir, las opciones salen limpias (con sus casillas
       de multiselección), no premarcadas como .selected */
    openStep(map[key]);
  }
  /* editar = pulsar sobre la PROPIA tarjeta (País/Ciudad/Tipo/Subtipo); el rol no
     se edita aquí. La ✕ (quitar) tiene su propio handler → no dispara la edición. */
  [].forEach.call(document.querySelectorAll('#panel .slot[data-key], #subPanel'), function(slot){
    var key = slot.dataset.key;
    if(key === 'role') return;
    slot.addEventListener('click', function(e){
      if(e.target.closest('.sx')) return;
      editSlot(key);
    });
  });

  function goBackTo(key){
    // borra ese paso y todos los posteriores, y reabre el paso tocado
    editing = null;
    var idx = ORDER.indexOf(key);
    ORDER.slice(idx).forEach(function(k){ state[k] = null; });
    renderPanel();
    if(key === 'role'){           // volver a la vista 1
      closeFrom('country');
      goView('view1', 'ac-red');
    } else if(key === 'country'){ closeFrom('country'); openStep('stepA'); }
    else if(key === 'prov'){      closeFrom('prov');    openStep('stepP'); }
    else if(key === 'city'){      closeFrom('city');    openStep('stepB'); }
    else if(key === 'type'){      closeFrom('type');    openStep('stepC'); }
    else if(key === 'subtype'){   closeFrom('subtype'); openStep('stepD'); }
  }

  /* ── botón atrás: vuelve al MOMENTO anterior (historial), no por jerarquía.
     Excepción: dentro del picker de "lugar habitual" (refMode) hace Ciudad →
     País → Configuración, que es su flujo natural de 2 pasos. */
  $('#navBack').addEventListener('click', function(){
    var open = function(id){ return $('#'+id).classList.contains('open'); };
    if(refMode){                          // picker de lugar: Ciudad → País → vista origen
      editing = null;
      if(open('stepB')){ state.city = null; renderPanel(); closeStep('stepB'); openStep('stepA'); }
      else {
        var back = refTarget;
        exitRefMode(true);
        histLock = true;
        if(back === 'cams'){ renderCamDir(); goView('viewCams','ac-amber'); }
        else goView('viewSettings','ac-violet');
        histLock = false;
      }
      return;
    }
    histBack();
  });

  /* ── botón home: al hub tras el rol (rol intacto, búsqueda limpia) ── */
  function goHome(){
    editing = null;
    if(refMode) exitRefMode(false);       // sal del modo lugar sin tocar la búsqueda guardada
    ['country','prov','city','type','subtype'].forEach(function(k){ state[k] = null; });
    closeAll();
    renderPanel();
    navStack.length = 0;                   // inicio = reinicio del historial
    histLock = true; goView('viewHub','ac-red'); histLock = false;
  }
  $('#homeBtn2').addEventListener('click', goHome);
  $('#homeBtn3').addEventListener('click', goHome);
  $('#homeBtnEC').addEventListener('click', goHome);

  /* ── transición genérica entre vistas ─────────────────────────────── */
  var VIEW_IDS = ['view1','viewHub','viewWhere','viewCreate','viewCreateForm','view2','viewSettings','viewCams','viewProfile','viewMine','viewMyEvents','viewDance','viewMap','view3','viewEvCams','viewLive'];
  /* GUARD anti-carreras: entrar/salir rápido (dos goView en <240 ms) dejaba el
     timeout de la transición VIEJA "reviviendo" su destino → dos vistas a la
     vez, una montada sobre otra (bug reportado con captura en viewEvCams).
     goSeq invalida los timeouts antiguos y curView protege al destino actual. */
  var goSeq = 0, curView = null;
  function goView(toId, accent){
    var to = $('#'+toId);
    if(accent) setAccent(accent);
    if(toId === 'viewHub') updateHub();   // contadores vivos al volver al hub
    var froms = [];
    VIEW_IDS.forEach(function(id){
      var v = $('#'+id);
      if(v !== to && !v.classList.contains('hidden')) froms.push(v);
    });
    curView = toId;
    if(!froms.length){
      /* ya estás en el destino (o está saliendo por una transición previa):
         cancela esa salida y quédate — sin esto, A→B→A rápido dejaba pantalla
         en blanco o la vista equivocada */
      ++goSeq;
      to.classList.remove('out','hidden');
      void to.offsetHeight;
      to.classList.add('in');
      return;
    }
    /* al salir del modo en directo, apagar micro/timers del módulo Live */
    if(window.Live && froms.some(function(f){ return f.id === 'viewLive'; })) Live.close();
    pushHist();                       // apila el momento que dejamos (← vuelve aquí)
    froms.forEach(function(f){ f.classList.remove('in'); f.classList.add('out'); });
    var seq = ++goSeq;
    setTimeout(function(){
      froms.forEach(function(f){
        if(f.id === curView){ f.classList.remove('out'); }   // ahora es el destino de OTRA transición: no lo toques
        else { f.classList.add('hidden'); f.classList.remove('out'); }
      });
      if(seq !== goSeq) return;       // hay una transición más nueva: no revivas este destino
      to.classList.remove('hidden');
      void to.offsetHeight;
      to.classList.add('in');
    }, 240);
  }

  /* ── rebote elástico en los bordes del scroll (efecto goma táctil):
     arrastrar más allá del límite estira con resistencia creciente;
     mientras mantengas el dedo se queda; al soltar vuelve con muelle.
     ARRIBA (tirar hacia abajo): rebota la vista ENTERA (efecto página iOS).
     ABAJO (tirar hacia arriba): SOLO el contenido — los hijos sticky (título
     .v2-head, buscadores…) se quedan anclados y el contenido se esconde por
     detrás (mismo espíritu que el .scroll-body de #view2). El chrome sticky
     ya es opaco y va con z-index por encima de los hijos transformados. ── */
  function addRubberBand(el){
    var startY = 0, pull = 0, tracking = false, mode = null, kids = null;
    function bodyKids(){
      /* hijos NO sticky = el contenido; se calcula al iniciar cada estirón
         (tras cada render cambian). OJO: transformarlos rompería un sticky
         INTERNO suyo (gotcha conocido) — las vistas con date-heads sticky
         dentro del contenido son #view2, que no pasa por aquí. */
      return [].filter.call(el.children, function(c){
        return getComputedStyle(c).position !== 'sticky';
      });
    }
    function setT(transition, transform){
      if(mode === 'top'){
        el.style.transition = transition; el.style.transform = transform;
      } else if(kids){
        kids.forEach(function(k){ k.style.transition = transition; k.style.transform = transform; });
      }
    }
    function release(){
      tracking = false;
      if(!pull){ mode = null; kids = null; return; }
      pull = 0;
      setT('transform .42s cubic-bezier(.2,.8,.3,1.18)', '');   // con sobreimpulso
      var m = mode, ks = kids;
      setTimeout(function(){
        if(m === 'top'){ el.style.transition = ''; }
        else if(ks){ ks.forEach(function(k){ k.style.transition = ''; }); }
      }, 440);
      mode = null; kids = null;
    }
    el.addEventListener('touchstart', function(e){
      tracking = true;
      pull = 0; mode = null; kids = null;
      startY = e.touches[0].clientY;
    }, { passive:true });
    el.addEventListener('touchmove', function(e){
      if(!tracking) return;
      var dy = e.touches[0].clientY - startY;
      var atTop = el.scrollTop <= 0;
      var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if((dy > 0 && atTop) || (dy < 0 && atBottom)){
        var m = dy > 0 ? 'top' : 'bottom';
        if(mode && mode !== m) setT('none', '');   // cambió de borde a mitad de gesto
        mode = m;
        if(m === 'bottom' && !kids) kids = bodyKids();
        pull = dy;
        // resistencia asintótica: nunca estira más de ~110px
        var damp = (dy < 0 ? -1 : 1) * 110 * (1 - 1 / (Math.abs(dy) / 300 + 1));
        setT('none', 'translateY(' + damp.toFixed(1) + 'px)');
        e.preventDefault();               // sin scroll nativo mientras estiras
      } else if(pull){
        pull = 0;                         // volviste a zona de scroll normal
        setT('none', '');
        mode = null; kids = null;
      }
    }, { passive:false });
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
  }
  /* rebote elástico en todas las vistas SALVO #view2: ahí el rebote sobre TODO
     el contenedor movía/comprimía el chrome (cabecera+criterios+pestañas, que
     van sticky dentro de #view2). En #view2 el rebote se aplica SOLO al bloque
     de contenido (.scroll-body) de la pestaña activa → ver contentRubberBand. */
  VIEW_IDS.forEach(function(id){ if(id !== 'view2') addRubberBand($('#'+id)); });

  /* bloque de contenido scrolleable de la pestaña visible de la vista 2.
     prox: #evtList (fecha+contador quedan fijos fuera); cal/horarios: el
     .scroll-body que envuelve la lista/rejilla (las sub-cabeceras quedan fuera,
     sticky). Es lo único que el rebote traslada. */
  function activeBody(){
    if(!$('#modeProx').hidden) return $('#evtList');
    /* CALENDARIO: SIN rebote. Su .scroll-body contiene las cabeceras de día
       sticky de la Agenda, y el transform del rebote rompe el position:sticky
       (durante el muelle de vuelta la cabecera se descoloca y "desaparece" al
       soltar). El mes/agenda cabe o scrollea nativo de sobra. */
    if(!$('#modeCal').hidden) return null;
    var m = !$('#modeHorarios').hidden ? $('#modeHorarios') : null;
    if(!m) return null;
    return m.querySelector('.scroll-body') || m;
  }
  /* mientras se está "revelando" el histórico al ritmo del scroll (ver criterios
     comprimibles), el rebote de contenido NO debe actuar (si no, el contenido
     botaría a la vez que crece el panel). */
  var critRevealing = false;
  /* rebote SOLO del contenido en #view2: el contenido se estira/esconde tras
     las cabeceras fijas y vuelve con muelle al soltar; el chrome no se inmuta.
     El scroll normal sigue siendo nativo sobre #view2 (cabeceras sticky). */
  (function(){
    var v2 = $('#view2'), startY = 0, pull = 0, body = null;
    function release(){
      if(!body) return;
      if(pull){
        body.style.transition = 'transform .42s cubic-bezier(.2,.8,.3,1.18)';
        body.style.transform = '';
        (function(b){ setTimeout(function(){ b.style.transition = ''; }, 440); })(body);
      }
      body = null; pull = 0;
    }
    v2.addEventListener('touchstart', function(e){
      body = activeBody(); pull = 0; startY = e.touches[0].clientY;
    }, { passive:true });
    v2.addEventListener('touchmove', function(e){
      if(!body || critRevealing){ if(pull){ pull=0; body.style.transition='none'; body.style.transform=''; } return; }
      var dy = e.touches[0].clientY - startY;
      var atTop = v2.scrollTop <= 0;
      var atBottom = v2.scrollTop + v2.clientHeight >= v2.scrollHeight - 1;
      if((dy > 0 && atTop) || (dy < 0 && atBottom)){
        pull = dy;
        var damp = (dy < 0 ? -1 : 1) * 110 * (1 - 1 / (Math.abs(dy) / 300 + 1));
        body.style.transition = 'none';
        body.style.transform = 'translateY(' + damp.toFixed(1) + 'px)';
        e.preventDefault();                 // sin scroll nativo mientras estiras
      } else if(pull){
        pull = 0; body.style.transition = 'none'; body.style.transform = '';
      }
    }, { passive:false });
    v2.addEventListener('touchend', release);
    v2.addEventListener('touchcancel', release);
  })();

  /* ── vista 1: elegir rol ──────────────────────────────────────────── */
  /* OJO: solo las tarjetas de ROL ([data-role]) — en view1 también vive ahora
     la tarjeta "Crear evento", que no debe disparar la elección de rol */
  document.querySelectorAll('#view1 .card[data-role]').forEach(function(card){
    card.addEventListener('click', function(){
      var role = card.dataset.role;
      state.role = { value:role, label:ROLE_META[role] };
      try{ localStorage.setItem('cilap-role', role); }catch(e){}
      renderPanel();
      updateRoleIcons();
      updateHub();
      goView('viewHub', 'ac-red');
    });
  });

  /* ── selección dentro de un paso (efecto menú de videojuego) ─────── */
  /* muestra/oculta el botón "Continuar" de un paso según las opciones multi-on */
  function updateContinue(stepId){
    var cont = document.getElementById('cont-' + stepId);
    if(!cont) return;
    var n = $('#'+stepId).querySelectorAll('.opt.multi-on').length;
    cont.hidden = (n === 0);
    cont.textContent = n > 1 ? ('Continuar · ' + n + ' elegidas')
                     : (n === 1 ? 'Continuar · 1 elegida' : 'Continuar');
  }
  function bindStep(stepId, key, next){
    var stepEl = $('#'+stepId);
    /* checkbox de multi-selección a la derecha de cada opción (salvo "Todas/Todos") */
    stepEl.querySelectorAll('.opt').forEach(function(opt){
      if(opt.dataset.value !== 'all' && !opt.querySelector('.mbox')){
        var mb = document.createElement('span'); mb.className = 'mbox'; opt.appendChild(mb);
      }
    });
    /* botón Continuar (confirma la multi-selección), tras las opciones */
    if(!document.getElementById('cont-' + stepId)){
      var cont = document.createElement('button');
      cont.className = 'multi-continue'; cont.id = 'cont-' + stepId; cont.hidden = true;
      cont.textContent = 'Continuar';
      stepEl.querySelector('.opts').insertAdjacentElement('afterend', cont);
      cont.addEventListener('click', function(){
        var vals = [], labels = [];
        stepEl.querySelectorAll('.opt.multi-on').forEach(function(o){ vals.push(o.dataset.value); labels.push(o.dataset.label); });
        if(!vals.length) return;
        pushHist();                                  // momento previo (← vuelve a este paso)
        var single = vals.length === 1;
        state[key] = { value: single ? vals[0] : vals, label: labels.join(', '), multi: !single };
        editing = null;
        if(key === 'country'){ state.prov = null; state.city = null; }  // dependencias en cascada
        if(key === 'prov')    state.city = null;
        if(key === 'type')    state.subtype = null;
        stepEl.querySelectorAll('.opt').forEach(function(o){ o.classList.remove('multi-on'); });
        updateContinue(stepId);
        closeStep(stepId);
        renderPanel();
        advance();
      });
    }
    /* clic en una opción: checkbox (derecha) = multi; centro = directo.
       PERO si ya estás en modo multi (hay alguna multi-on), CUALQUIER toque
       sigue siendo multi — solo "Todas/Todos" rompe el modo y va directo. */
    stepEl.querySelectorAll('.opt').forEach(function(opt){
      opt.addEventListener('click', function(e){
        var multiActivo = !!stepEl.querySelector('.opt.multi-on');
        var esTodas = opt.dataset.value === 'all';
        if((!refMode || !refSingle()) && !esTodas && (e.target.closest('.mbox') || multiActivo)){   // multi-toggle (single solo en lugar habitual)
          var eraSeleccion = opt.classList.contains('selected');
          /* si venías de una selección simple (p.ej. al EDITAR), pásala a multi
             para no perderla al empezar a multi-seleccionar */
          stepEl.querySelectorAll('.opt.selected').forEach(function(o){
            o.classList.remove('selected'); o.classList.add('multi-on');
          });
          /* la que ya estaba seleccionada queda multi-on (no la des-marques) */
          if(!eraSeleccion) opt.classList.toggle('multi-on');
          opt.classList.remove('dim','picked');
          updateContinue(stepId);
          return;
        }
        if(opt.classList.contains('picked')) return;
        pushHist();                                  // momento previo (← vuelve a este paso)
        var prev = state[key] ? state[key].value : null;
        stepEl.querySelectorAll('.opt').forEach(function(o){   // selección directa: limpia multi
          o.classList.remove('selected','picked','dim','multi-on');
          if(o !== opt) o.classList.add('dim');
        });
        updateContinue(stepId);
        opt.classList.add('selected','picked');
        state[key] = { value:opt.dataset.value, label:opt.dataset.label };
        editing = null;
        setTimeout(function(){            // deja ver el avance, luego pliega
          closeStep(stepId);
          renderPanel();
          next(opt.dataset.value, prev);
        }, 520);
      });
    });
  }

  bindStep('stepA','country', function(v, prev){
    if(prev && prev !== v){ state.prov = null; state.city = null; }  // país nuevo → prov/ciudad a reelegir
    renderPanel();
    advance();                                    // tipo y subtipo permanecen
  });

  bindStep('stepP','prov', function(v, prev){
    if(prev && prev !== v) state.city = null;     // provincia nueva → ciudad a reelegir
    renderPanel();
    advance();
  });

  bindStep('stepB','city', function(){ advance(); });

  bindStep('stepC','type', function(v, prev){
    if(prev && prev !== v) state.subtype = null;  // tipo nuevo → subtipo a reelegir
    if(v !== 'exterior')   state.subtype = null;  // el subtipo solo existe en exterior
    renderPanel();
    advance();
  });

  bindStep('stepD','subtype', function(){ advance(); });

  /* ── resultados: lista de eventos filtrada ────────────────────────── */
  /* coincide si el filtro es nulo, 'all', un valor igual, o un array que contiene el valor */
  function inFilter(entry, val){
    if(!entry) return true;
    var v = entry.value;
    if(v === 'all') return true;
    if(Array.isArray(v)) return v.indexOf(val) !== -1;
    return v === val;
  }
  function camCountOf(ev){ return ev.camIds.length + (joined[ev.id] ? 1 : 0); }

  /* "HH:MM–HH:MM" → [iniMin, finMin] (fin puede pasar de medianoche) */
  function tlMinsApp(tl){
    var p = (tl || '').replace('–','-').replace('—','-').split('-');
    function m(s){ var x = s.trim().split(':'); return (+x[0]) * 60 + (+x[1]); }
    var s = m(p[0] || '0:0'), e = m(p[1] || '0:0'); if(e <= s) e += 1440; return [s, e];
  }
  /* ocurrencias concretas de una sala semanal dentro de [fromTs, toTs] que aún
     no han terminado (así, al ampliar el rango, las salas se repiten) */
  function weeklyOccs(ev, fromTs, toTs){
    var days = ev.weekdays || [ev.weekday];
    var tl = tlMinsApp(ev.timeLabel), durMs = (tl[1] - tl[0]) * 60000;
    var now = Date.now(), d0 = new Date(fromTs);
    d0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
    var out = [];
    for(var add = 0; add < 400 && out.length < 120; add++){
      var d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + add, Math.floor(tl[0]/60), tl[0]%60, 0, 0);
      var s = d.getTime();
      if(s > toTs) break;
      if(days.indexOf(d.getDay()) === -1) continue;
      if(s + durMs < now) continue;          // ya terminó
      out.push({ start:s, end:s + durMs });
    }
    return out;
  }
  function renderResults(){
    var now = Date.now();
    /* filtro opcional por día o rango de días */
    var fv = $('#dateFrom').value, tv = $('#dateTo').value;
    var from = fv ? new Date(fv + 'T00:00:00').getTime() : null;
    var to   = tv ? new Date(tv + 'T23:59:59').getTime() : null;
    var winFrom = from || now, winTo = to || (now + 60 * 86400000);   // sin 'to': ventana de 60 días
    function passes(ev){
      if(!inFilter(state.country, ev.country)) return false;
      if(!inFilter(state.prov, ev.prov)) return false;
      if(!inFilter(state.city, ev.city)) return false;
      if(!inFilter(state.type, ev.type)) return false;
      if(state.subtype && !inFilter(state.subtype, ev.sub)) return false;
      return true;
    }
    function instance(ev, s, e){ return Object.assign({}, ev, { id: ev.id + '@' + s, startsAt:s, endsAt:e, recurrence:'oneoff' }); }
    /* pases concretos de un congreso (día/noche por jornada) como instancias */
    function passInstances(ev, fromTs, toTs){
      return congressOccs(ev).filter(function(o){
        return o.endsAt >= Date.now() && o.startsAt <= toTs && o.endsAt >= fromTs;
      }).map(function(o){
        var inst = instance(ev, o.startsAt, o.endsAt);
        inst.id += '#' + o.passType;
        inst.passType = o.passType;
        inst.passLabel = PASS_LABEL[o.passType];
        return inst;
      });
    }
    /* construye la lista EXPANDIENDO las salas semanales en sus ocurrencias
       dentro de la ventana (antes solo aparecía la próxima de cada sala, así que
       ampliar el rango no traía las repeticiones). */
    var list = [];
    EVENTS.forEach(function(ev){
      if(!passes(ev)) return;
      if(ev.recurrence === 'weekly'){
        var occFrom = winFrom;
        if(eventStatus(ev) === 'directo'){
          list.push(ev);                       // instancia EN DIRECTO (demo) → grupo "Ahora"
          var t = new Date(); t.setHours(0,0,0,0); t.setDate(t.getDate()+1);   // sus ocurrencias desde mañana (hoy ya lo cubre el directo)
          occFrom = Math.max(occFrom, t.getTime());
        }
        weeklyOccs(ev, occFrom, winTo).forEach(function(o){ list.push(instance(ev, o.start, o.end)); });
      } else if(ev.type === 'congreso' && ev.passes){
        /* un congreso de N días sale como sus PASES: cada día bajo su fecha */
        passInstances(ev, winFrom, winTo).forEach(function(i){ list.push(i); });
      } else {
        if(eventStatus(ev) === 'terminado') return;   // el pasado no se busca
        list.push(ev);
      }
    });
    list = list.filter(function(ev){
      return (!from || ev.endsAt >= from) && (!to || ev.startsAt <= to);
    });
    /* siempre ordenados por fecha, del más próximo al más lejano */
    list.sort(function(a, b){ return a.startsAt - b.startsAt; });
    var box = $('#evtList');
    box.innerHTML = '';
    function addHead(txt, cls){
      var h = document.createElement('div');
      h.className = 'date-head' + (cls ? ' ' + cls : '');
      h.textContent = txt;
      box.appendChild(h);
    }
    function addCard(ev){
      var b = document.createElement('button');
      b.className = 'evt t-' + ev.type;
      b.innerHTML = evtCardInner(ev);
      b.addEventListener('click', function(){ openEvent(ev); });
      box.appendChild(b);
    }
    /* "AHORA": los que están EN DIRECTO ahora mismo, agrupados arriba */
    var live = list.filter(function(ev){ return eventStatus(ev) === 'directo'; });
    var rest = list.filter(function(ev){ return eventStatus(ev) !== 'directo'; });
    if(live.length){ addHead('Ahora', 'now'); live.forEach(addCard); }
    /* el resto AGRUPADO POR FECHA (días sin eventos no aparecen). Los de HOY
       sin empezar van en su grupo "Hoy", resaltado, distinto de "Ahora" (directo). */
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var lastKey = null;
    rest.forEach(function(ev){
      var d = new Date(ev.startsAt);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if(key !== lastKey){
        var esHoy = d.getFullYear()===hoy.getFullYear() && d.getMonth()===hoy.getMonth() && d.getDate()===hoy.getDate();
        addHead(dateHeaderLabel(ev.startsAt), esHoy ? 'today' : '');
        lastKey = key;
      }
      addCard(ev);
    });
    $('#resCount').textContent = list.length === 1
      ? '1 evento encontrado' : list.length + ' eventos encontrados';
    $('#resEmpty').style.display = list.length ? 'none' : 'flex';
    if($('#dateRangeLbl')) updateDateLabel();
    /* Mapa solo donde hay cobertura geométrica (hoy: área de Madrid) */
    var cov = mapCoverage();
    $('#mapBtn').disabled = !cov;
    $('#mapBtn').title = cov ? 'Ver mapa de eventos' : 'Mapa no disponible aún en esta zona';
    if(evMode === 'prox') scheduleRelayout();   // rellena y ancla
  }
  /* contenido interno de una tarjeta de evento (lista "Próximos").
     Formato limpio: nombre + CAM arriba; HORA destacada debajo. SIN dirección
     ni ciudad (sobran aquí; están en el detalle). El día lo da la cabecera de
     grupo pegajosa. */
  function evtCardInner(ev){
    var n = camCountOf(ev);
    var foll = ev.camIds.filter(function(id){ return follows[id]; }).length;
    var multi = (ev.endsAt - ev.startsAt) > 86400000 * 1.1;   // ocupa varios días
    var when = multi ? (fmtDate(ev.startsAt) + ' – ' + fmtDate(ev.endsAt)) : evHours(ev);
    if(ev.passLabel) when += ' · ' + ev.passLabel;            // congreso: pase de día/noche
    return '<div class="evt-head">' +
        '<span class="evt-name">' + ev.name + '</span>' +
        '<span class="evt-badges">' +
          (foll ? '<span class="evt-follow" title="Camarógrafos que sigues">' + CAM_MINI_SVG + '×' + foll + '</span>' : '') +
          '<span class="evt-cams' + (n ? ' on' : '') + '">CAM ×' + n + '</span>' +
        '</span>' +
      '</div>' +
      '<span class="evt-when">' + when + '</span>';
  }
  /* el filtro de fecha re-filtra en vivo (y marca que el usuario lo tocó,
     para no re-imponer el rango por defecto de 7 días) */
  /* etiqueta compacta del rango en el botón "Editar fechas" */
  function shortDate(v){ if(!v) return ''; var p = v.split('-'); return parseInt(p[2],10) + ' ' + MON[parseInt(p[1],10)-1]; }
  function updateDateLabel(){
    var fv = $('#dateFrom').value, tv = $('#dateTo').value;
    var lbl = $('#dateRangeLbl');
    if(!fv && !tv) lbl.textContent = 'Todas las fechas';
    else if(fv && tv) lbl.textContent = shortDate(fv) + ' – ' + shortDate(tv);
    else lbl.textContent = fv ? ('Desde ' + shortDate(fv)) : ('Hasta ' + shortDate(tv));
  }
  $('#dateEditBtn').addEventListener('click', function(){
    var p = $('#datePanel'); p.hidden = !p.hidden;
    $('#dateEditBtn').classList.toggle('open', !p.hidden);
    scheduleRelayout();          // el chrome fijo cambia de alto al desplegar/plegar
  });
  $('#dateFrom').addEventListener('change', function(){ dateTouched = true; updateDateLabel(); renderResults(); });
  $('#dateTo').addEventListener('change', function(){ dateTouched = true; updateDateLabel(); renderResults(); });
  $('#dateClear').addEventListener('click', function(){
    dateTouched = false;         // restaura el rango por defecto (próximos 7 días)
    $('#dateFrom').value = '';
    $('#dateTo').value = '';
    defaultDateRange();          // vuelve a poner hoy → +7
    updateDateLabel();
    renderResults();
  });

  /* ── MAPA DE EVENTOS (un día concreto, navegable día a día) ───────────── */
  /* colores de marcador vía CSS vars (--mk-*): cálidos sobre el mapa azul y
     con override en tema claro (los tonos claros se lavan sobre crema) */
  var MAP_TYPE_COLOR = { sala:'var(--mk-sala)', congreso:'var(--mk-congreso)', exterior:'var(--mk-ext)' };
  var MAP_TYPE_LABEL = { sala:'Sala de baile', congreso:'Congreso', exterior:'Social al exterior' };
  /* contornos REALES (IGN vía georef-spain-provincia/municipio) proyectados al
     viewBox 0..100: los genera tools/build_map.py en js/map-geo.js (MAP_GEO).
     Dos escenas: 'region' (Comunidad + provincias vecinas) y 'city' (municipio
     de Madrid a pelo). MAP_GEO.cities = lon/lat CRUDOS del centro de cada
     ciudad (fallback para eventos sin coords propias). */
  var MAP_GEO = window.MAP_GEO || { madrid:'', provs:{}, proj:null, city:{ d:'', proj:null }, center:{ d:'', proj:null }, cities:{} };
  var mapDays = [], mapDayIdx = 0, mapSel = 0, mapScope = 'region';
  /* cobertura del mapa POR PROVINCIA (por ahora, solo Madrid tiene geometría):
     si el filtro actual no alcanza ninguna, el botón Mapa se deshabilita */
  var MAP_COVERED_PROVS = { p28:1 };
  var MAP_SCOPE_SUB = { region:'Comunidad de Madrid', city:'Madrid · ciudad', center:'Madrid · centro (M-30)' };
  function mapFrame(inner){
    return '<defs><clipPath id="mapClip"><rect x="3" y="3" width="94" height="94" rx="11"/></clipPath></defs>' +
      '<g clip-path="url(#mapClip)">' +
        '<rect class="map-bg" x="3" y="3" width="94" height="94"/>' + inner +
      '</g>' +
      '<rect class="map-region" x="3" y="3" width="94" height="94" rx="11"/>';
  }
  /* hito "Sol" (Puerta del Sol) para orientarse en ciudad y centro */
  function solMark(proj){
    if(!proj) return '';
    var x = 50 + (-3.7038 - proj.lon0) * proj.coslat * proj.k;
    var y = 50 - (40.4168 - proj.lat0) * proj.k;
    return '<g class="map-sol" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')"><circle r="0.9"/><text y="-2">Sol</text></g>';
  }
  var MAP_SCENE = {
    region: mapFrame(
      '<g class="map-neigh">' +
        Object.keys(MAP_GEO.provs).map(function(k){ return '<path d="' + MAP_GEO.provs[k] + '"/>'; }).join('') +
      '</g>' +
      '<g class="map-prov">' +
        '<text x="24" y="10" text-anchor="middle">Segovia</text>' +
        '<text x="96" y="16" text-anchor="end">Guadalajara</text>' +
        '<text x="96" y="72" text-anchor="end">Cuenca</text>' +
        '<text x="38" y="95" text-anchor="middle">Toledo</text>' +
        '<text x="4" y="52" text-anchor="start">Ávila</text>' +
      '</g>' +
      '<path class="map-madrid" d="' + MAP_GEO.madrid + '"/>' +
      '<text class="map-madrid-lbl" x="44" y="42">MADRID</text>'),
    /* vista ciudad: contorno real del municipio + malla sutil de barrios
       (128 polígonos en UN solo path) que hace reconocible la trama de Madrid */
    city: mapFrame(
      '<path class="map-madrid" d="' + MAP_GEO.city.d + '"/>' +
      '<path class="map-dist" d="' + (MAP_GEO.city.dist || '') + '"/>' +
      solMark(MAP_GEO.city.proj)),
    /* vista centro: solo los barrios dentro de la M-30 (y periferia inmediata),
       como mosaico relleno — la vista ciudad entera mete demasiado barrio */
    center: mapFrame('<path class="map-center" d="' + (MAP_GEO.center ? MAP_GEO.center.d : '') + '"/>' +
      solMark(MAP_GEO.center && MAP_GEO.center.proj))
  };

  function mapBuildDays(){
    var now = Date.now(), winFrom = now, winTo = now + 60 * 86400000;
    /* solo provincias con cobertura: un evento de Sevilla no debe salir clavado
       al borde del mapa de Madrid */
    function passes(ev){ return MAP_COVERED_PROVS[ev.prov] && inFilter(state.country, ev.country) && inFilter(state.prov, ev.prov) && inFilter(state.city, ev.city) && inFilter(state.type, ev.type) && (!state.subtype || inFilter(state.subtype, ev.sub)); }
    function instance(ev, s, e){ return Object.assign({}, ev, { id: ev.id + '@' + s, startsAt:s, endsAt:e, recurrence:'oneoff' }); }
    var list = [];
    EVENTS.forEach(function(ev){
      if(!passes(ev)) return;
      if(ev.recurrence === 'weekly'){
        var occFrom = winFrom;
        if(eventStatus(ev) === 'directo'){ list.push(ev); var t = new Date(); t.setHours(0,0,0,0); t.setDate(t.getDate()+1); occFrom = Math.max(occFrom, t.getTime()); }
        weeklyOccs(ev, occFrom, winTo).forEach(function(o){ list.push(instance(ev, o.start, o.end)); });
      } else if(ev.type === 'congreso' && ev.passes){
        /* en el mapa, cada pase del congreso cae en SU día */
        congressOccs(ev).forEach(function(o){
          if(o.endsAt < now || o.startsAt > winTo) return;
          var inst = instance(ev, o.startsAt, o.endsAt);
          inst.id += '#' + o.passType;
          inst.passType = o.passType;
          inst.passLabel = PASS_LABEL[o.passType];
          list.push(inst);
        });
      } else { if(eventStatus(ev) === 'terminado') return; list.push(ev); }
    });
    list.sort(function(a, b){ return a.startsAt - b.startsAt; });
    var days = [], byKey = {};
    list.forEach(function(ev){
      /* un directo que empezó ayer (madrugada) se agrupa bajo HOY: está pasando ahora */
      var ts = eventStatus(ev) === 'directo' ? Date.now() : ev.startsAt;
      var d = new Date(ts), key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if(!byKey[key]){
        var d0 = new Date(d); d0.setHours(0,0,0,0);
        byKey[key] = { ts:d0.getTime(), label:dateHeaderLabel(ts), events:[] };
        days.push(byKey[key]);
      }
      byKey[key].events.push(ev);
    });
    return days;
  }
  function mapProj(){
    if(mapScope === 'city'   && MAP_GEO.city.proj)   return MAP_GEO.city.proj;
    if(mapScope === 'center' && MAP_GEO.center && MAP_GEO.center.proj) return MAP_GEO.center.proj;
    return MAP_GEO.proj;
  }
  function mapProject(ll){
    var p = mapProj();
    return [ 50 + (ll[0] - p.lon0) * p.coslat * p.k, 50 - (ll[1] - p.lat0) * p.k ];
  }
  function mapMarkerXY(ev, i){
    var own = !!ev.coords, ll = ev.coords || MAP_GEO.cities[ev.city];
    if(!ll || !mapProj()) return [50, 50];
    var q = mapProject(ll);
    /* con coords propias el punto es EXACTO (en la vista región, un pelín de
       jitter: los locales del centro caen a <1 unidad y se fundirían en uno);
       sin coords, reparto en espiral áurea alrededor del centro de su ciudad */
    var ang = i * 2.39996;
    var r = own ? (mapScope === 'region' ? (i % 3) * 1.4 : 0)
                : (i === 0 ? 0 : (mapScope === 'city' ? 10 : 7) + (i % 4) * 4);
    q = [ q[0] + Math.cos(ang) * r * 0.75, q[1] + Math.sin(ang) * r ];
    /* recorte al marco: lo de fuera del encuadre asoma pegado al borde.
       Margen 7 (no 5): en las ESQUINAS el clip redondeado (rx=11) se comía el
       marcador y quedaba seleccionable pero invisible */
    return [ Math.max(7, Math.min(93, q[0])), Math.max(7, Math.min(93, q[1])) ];
  }
  /* ¿el filtro actual alcanza alguna provincia con cobertura de mapa? */
  function mapCoverage(){
    return EVENTS.some(function(ev){
      return MAP_COVERED_PROVS[ev.prov] && inFilter(state.country, ev.country) &&
             inFilter(state.prov, ev.prov) && inFilter(state.city, ev.city) && inFilter(state.type, ev.type);
    });
  }
  function mapTypeGlyph(type, color){
    if(type === 'congreso') return '<path d="M0,-1.5 L1.3,1.2 L-1.3,1.2 Z" style="fill:' + color + '"/>';
    if(type === 'exterior') return '<path d="M0,-1.6 L0.5,-0.5 L1.6,0 L0.5,0.5 L0,1.6 L-0.5,0.5 L-1.6,0 L-0.5,-0.5 Z" style="fill:' + color + '"/>';
    return '<circle r="1.3" style="fill:' + color + '"/>';
  }
  function openMap(){
    mapDays = mapBuildDays();
    mapSel = 0;
    /* abrir en HOY (o el primer día futuro): un congreso ya empezado agrupa en
       su fecha de inicio, que puede quedar atrás */
    var t0 = new Date(); t0.setHours(0,0,0,0);
    mapDayIdx = 0;
    for(var i = 0; i < mapDays.length; i++){ if(mapDays[i].ts >= t0.getTime()){ mapDayIdx = i; break; } }
    renderMap();
    goView('viewMap','ac-blue');
  }
  function renderMap(){
    var stage = $('#mapStage'), empty = $('#mapEmpty'), info = $('#mapInfo');
    $('#viewMap .v2-sub').textContent = MAP_SCOPE_SUB[mapScope];
    $('#mapScope').querySelectorAll('button').forEach(function(b){
      b.classList.toggle('on', b.dataset.scope === mapScope);
    });
    if(!mapDays.length){
      stage.innerHTML = ''; $('#mapDayLbl').textContent = '—'; empty.style.display = 'block';
      info.hidden = true;
      $('#mapPrev').disabled = true; $('#mapNext').disabled = true; return;
    }
    empty.style.display = 'none';
    mapDayIdx = Math.max(0, Math.min(mapDayIdx, mapDays.length - 1));
    var day = mapVisibleDay();
    if(!day.events.length){
      stage.innerHTML = '<svg viewBox="0 0 100 100" class="map-svg" preserveAspectRatio="xMidYMid meet">' + MAP_SCENE[mapScope] + '</svg>';
      $('#mapDayLbl').textContent = day.label;
      $('#mapPrev').disabled = mapDayIdx <= 0;
      $('#mapNext').disabled = mapDayIdx >= mapDays.length - 1;
      info.hidden = true;
      return;
    }
    info.hidden = false;
    mapSel = Math.max(0, Math.min(mapSel, day.events.length - 1));
    $('#mapDayLbl').textContent = day.label;
    $('#mapPrev').disabled = mapDayIdx <= 0;
    $('#mapNext').disabled = mapDayIdx >= mapDays.length - 1;
    /* el seleccionado se pinta en rojo, mayor y EL ÚLTIMO (encima del resto) */
    var order = day.events.map(function(_, i){ return i; });
    order.push(order.splice(mapSel, 1)[0]);
    var markers = order.map(function(i){
      var ev = day.events[i], sel = i === mapSel;
      var p = mapMarkerXY(ev, i), col = sel ? 'var(--mk-sel)' : (MAP_TYPE_COLOR[ev.type] || 'var(--muted)');
      return '<g class="map-mk' + (sel ? ' sel' : '') + '" data-ev="' + i + '" transform="translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')' + (sel ? ' scale(1.55)' : '') + '">' +
        '<circle class="mk-halo" r="1.3" fill="none" style="stroke:' + col + '"/>' +
        mapTypeGlyph(ev.type, col) + '</g>';
    }).join('');
    stage.innerHTML = '<svg viewBox="0 0 100 100" class="map-svg" preserveAspectRatio="xMidYMid meet">' + MAP_SCENE[mapScope] + markers + '</svg>';
    stage.querySelectorAll('.map-mk').forEach(function(g){
      g.addEventListener('click', function(){ mapSel = Number(g.dataset.ev); renderMap(); });
    });
    renderMapInfo(day);
  }
  /* tarjeta bajo el mapa con el evento seleccionado; ‹ › ciclan entre puntos */
  function renderMapInfo(day){
    var ev = day.events[mapSel], col = MAP_TYPE_COLOR[ev.type] || 'var(--muted)';
    var multi = (ev.endsAt - ev.startsAt) > 86400000 * 1.1;
    var when = multi ? (fmtDate(ev.startsAt) + ' – ' + fmtDate(ev.endsAt)) : evHours(ev);
    $('#mapInfoBody').innerHTML =
      '<div class="mi-top"><span class="mp-type" style="color:' + col + ';border-color:' + col + '">' + (MAP_TYPE_LABEL[ev.type] || ev.type) + '</span>' +
      '<span class="mi-count">' + (mapSel + 1) + ' / ' + day.events.length + '</span></div>' +
      '<b class="mi-name">' + ev.name + '</b>' +
      '<span class="mi-meta">' + when + ' · ' + ev.venue + ' · ' + (CITY_LABELS[ev.city] || ev.city) + ' · CAM ×' + camCountOf(ev) + '</span>' +
      '<button class="cta mi-enter" id="miEnter">Entrar al evento</button>';
    $('#mapInfo').hidden = false;
    var single = day.events.length < 2;
    $('#mapSelPrev').disabled = single;
    $('#mapSelNext').disabled = single;
    $('#miEnter').addEventListener('click', function(){ openEvent(ev); });
  }
  /* día visible según el alcance: en CENTRO solo los eventos cuyo punto cae
     dentro del encuadre (lo muy lejano ni aparece ni se puede seleccionar) */
  function mapVisibleDay(){
    var dayFull = mapDays[mapDayIdx];
    if(!dayFull) return { ts:0, label:'—', events:[] };
    if(mapScope !== 'center') return dayFull;
    return { ts: dayFull.ts, label: dayFull.label, events: dayFull.events.filter(function(ev2){
      var ll2 = ev2.coords || MAP_GEO.cities[ev2.city];
      if(!ll2) return false;
      var q2 = mapProject(ll2);
      return q2[0] >= 2 && q2[0] <= 98 && q2[1] >= 2 && q2[1] <= 98;
    }) };
  }
  function mapSelStep(dir){
    var day = mapVisibleDay(); if(day.events.length < 2) return;
    mapSel = (mapSel + dir + day.events.length) % day.events.length;
    renderMap();
  }
  $('#mapBtn').addEventListener('click', openMap);
  $('#mapPrev').addEventListener('click', function(){ if(mapDayIdx > 0){ mapDayIdx--; mapSel = 0; renderMap(); } });
  $('#mapNext').addEventListener('click', function(){ if(mapDayIdx < mapDays.length - 1){ mapDayIdx++; mapSel = 0; renderMap(); } });
  $('#mapSelPrev').addEventListener('click', function(){ mapSelStep(-1); });
  $('#mapSelNext').addEventListener('click', function(){ mapSelStep(1); });
  /* la tarjeta de evento bajo el mapa también se desliza con SWIPE */
  (function(){
    var sx = 0, sy = 0, on = false;
    var info = $('#mapInfo');
    info.addEventListener('touchstart', function(e){ on = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    info.addEventListener('touchend', function(e){
      if(!on) return; on = false;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if(Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) mapSelStep(dx < 0 ? 1 : -1);
    });
  })();
  $('#mapScope').querySelectorAll('button').forEach(function(b){
    b.addEventListener('click', function(){
      if(mapScope === b.dataset.scope) return;
      mapScope = b.dataset.scope; renderMap();
    });
  });
  $('#mapBack').addEventListener('click', histBack);
  $('#mapHome').addEventListener('click', goHome);

  /* ── modos del resultado: Próximos · Calendario · Horarios salas ──────── */
  /* calPast SIEMPRE true: los eventos pasados se ven por defecto (el switch
     "Ver eventos pasados" se eliminó a petición del usuario) */
  var evMode = 'prox', calYear = (new Date()).getFullYear(), calMonth = null, calSub = 'cal', calPast = true;
  function ymVal(y, m){ return y * 12 + m; }
  /* NAVEGACIÓN LIBRE (norma única del usuario): el swipe y las flechas
     funcionan SIEMPRE entre meses — sin topes; el único caso especial es
     "cero eventos para los filtros", donde ni siquiera hay vista de mes */
  function goCalMonth(delta){
    var v = ymVal(calYear, calMonth) + delta;
    pushHist();                          // cambio de mes: ← vuelve al mes anterior
    calYear = Math.floor(v / 12); calMonth = ((v % 12) + 12) % 12; renderCalMode();
    /* entrada suave del mes nuevo: SOLO opacidad (un transform rompería los
       sticky internos de la agenda — gotcha conocido) */
    var body = $('#modeCal .scroll-body');
    if(body){ body.classList.remove('cal-fade'); void body.offsetWidth; body.classList.add('cal-fade'); }
  }
  function eventsByFilter(rec, withSub){
    return EVENTS.filter(function(ev){
      if(ev.recurrence !== rec) return false;
      if(!inFilter(state.country, ev.country)) return false;
      if(!inFilter(state.prov, ev.prov)) return false;
      if(!inFilter(state.city, ev.city)) return false;
      if(!inFilter(state.type, ev.type)) return false;
      if(withSub && state.subtype && !inFilter(state.subtype, ev.sub)) return false;
      return true;
    });
  }
  function calEvent(id){
    var base = EVENTS_BY_ID[(id || '').split('@')[0]];
    if(!base) return;
    if(id.indexOf('@') === -1){ openEvent(base); return; }
    /* id de PASE (base@ts#day|night) desde la agenda → abrir esa instancia */
    var ts = parseInt(id.split('@')[1], 10);
    var pt = id.split('#')[1];
    var occ = (typeof congressOccs === 'function' ? congressOccs(base) : []).filter(function(o){
      return o.startsAt === ts && (!pt || o.passType === pt);
    })[0];
    if(!occ){ openEvent(base); return; }
    var inst = Object.assign({}, base, {
      id: id, startsAt: occ.startsAt, endsAt: occ.endsAt, recurrence:'oneoff',
      passType: occ.passType, passLabel: PASS_LABEL[occ.passType]
    });
    openEvent(inst);
  }
  function renderCalMode(){
    var c = $('#modeCal');
    var evs = eventsByFilter('oneoff', true);
    var weekly = eventsByFilter('weekly', false);   // las salas TAMBIÉN se representan
    /* sin NINGÚN evento para los filtros: nada de meses ni rejillas — solo el
       aviso (el swipe de pestañas sigue funcionando sobre #view2) */
    if(!evs.length && !weekly.length){
      c.innerHTML = '<div class="scroll-body"><p class="cal-empty" style="margin-top:26px">Sin eventos para los filtros seleccionados.</p></div>';
      scheduleRelayout();
      return;
    }
    if(calMonth == null){
      Calendar.renderYear(c, calYear, evs, weekly, {
        onYear:  function(y){ pushHist(); calYear = y; renderCalMode(); },
        onMonth: function(m){ pushHist(); calMonth = m; calSub = 'agenda'; renderCalMode(); }   // al abrir un mes → Agenda primero
      });
    } else {
      /* navegación LIBRE: flechas siempre activas (norma única del usuario) */
      Calendar.renderMonth(c, calYear, calMonth, evs, weekly, calSub, { canPrev:true, canNext:true }, {
        onBack:  function(){ pushHist(); calMonth = null; renderCalMode(); },
        onSub:   function(s){ if(s!==calSub) pushHist(); calSub = s; renderCalMode(); },
        onStep:  function(d){ goCalMonth(d); },
        onEvent: calEvent,
        onSalas: function(){ setEvMode('horarios'); }   // el chip de salas lleva a Horarios
      });
    }
    scheduleRelayout();   // fija año, nav de mes y sub-pestañas
  }
  var horSala = null, horSub = 'horario';   // sala seleccionada + pestaña (horario/proximos)
  function renderHorariosMode(){
    Calendar.renderHorarios($('#modeHorarios'), eventsByFilter('weekly', false), horSala, horSub, {
      onSala:  function(id){ pushHist(); horSala = id; horSub = 'horario'; renderHorariosMode(); },
      onBack:  function(){ pushHist(); horSala = null; renderHorariosMode(); },
      onSub:   function(s){ if(s!==horSub) pushHist(); horSub = s; renderHorariosMode(); },
      onEvent: calEvent,
      /* un día concreto de la sala = un evento puntual de esa fecha (apuntarte) */
      onOccurrence: function(id, start, end){
        var base = EVENTS_BY_ID[id];
        openEvent(Object.assign({}, base, { id: id + '@' + start, startsAt: start, endsAt: end, recurrence: 'oneoff' }));
      }
    });
    scheduleRelayout();   // fija subtítulo (sala) + sub-pestañas (tras asentar layout)
  }
  function setEvMode(mode){
    if(mode !== evMode) pushHist();      // cambio de pestaña de resultados: ← vuelve a la anterior
    evMode = mode;
    document.querySelectorAll('#evModeTabs .fchip').forEach(function(t){ t.classList.toggle('on', t.dataset.mode === mode); });
    $('#modeProx').hidden     = mode !== 'prox';
    $('#modeCal').hidden      = mode !== 'cal';
    $('#modeHorarios').hidden = mode !== 'horarios';
    if(mode === 'prox')          renderResults();
    else if(mode === 'cal')    { calMonth = null; calYear = (new Date()).getFullYear(); renderCalMode(); }   // SIEMPRE abre en el ANUAL
    else                       { horSala = null; renderHorariosMode(); }
    /* en calendario/horarios comprimimos los criterios para que el contenido
       (p.ej. el mes entero) quepa arriba. Cambiar de pestaña NUNCA despliega
       el histórico (solo se despliega con esfuerzo/Editar o subiendo <0,5s) */
    if(mode !== 'prox' && setCritCollapsed) setCritCollapsed(true);
    scheduleRelayout();
  }
  document.querySelectorAll('#evModeTabs .fchip').forEach(function(t){
    t.addEventListener('click', function(){ setEvMode(t.dataset.mode); });
  });

  /* ── criterios comprimibles ───────────────────────────────────────────
     Los criterios (rol/país/ciudad/tipo) solo se comprimen al LLEGAR AL FINAL
     del scroll (sin acelerar el scroll: al estar abajo del todo, el navegador
     mantiene la posición). Las pestañas quedan ancladas justo bajo la cabecera
     (lo más arriba posible). Para volver a desplegar: tirar hacia arriba
     (sobre-scroll) estando arriba del todo, o cambiar de pestaña los despliega
     según convenga. */
  /* ── PATRÓN "chrome fijo": títulos, subtítulos, pestañas y sub-pestañas se
     quedan anclados (sticky) en un bloque contiguo arriba; SOLO el contenido
     de la pestaña hace scroll, deslizándose por DETRÁS de esos bloques. Cada
     bloque fijo se apila justo debajo del anterior (top acumulado por JS, que
     mide alturas variables). Documentado en CLAUDE.md. */
  /* fija cada bloque EN SU POSICIÓN NATURAL (sticky top = su propio offset),
     así NO se mueve nunca (una sola posición estable) sin importar márgenes.
     Mide la posición natural poniéndolos static un instante (sin repintar). */
  /* apila los bloques fijos: cada uno se pega justo debajo del anterior
     (top = altura de la cabecera + suma de alturas de los bloques fijos
     previos). El contenido NO fijo que haya en medio (panel de criterios
     expandido, pasos) hace scroll por detrás. Determinista (offsetHeight). */
  function pinBelow(scroller, els){
    els = els.filter(Boolean); if(!els.length) return 0;
    var head = scroller.querySelector('.v2-head');
    var top = head ? head.offsetHeight : 0;
    /* si los bloques aún no tienen altura (contenido oculto), NO anclar:
       evita apilarlos todos en el mismo top (efecto "achatado") */
    if(!els[0].offsetHeight) return 0;
    /* offsetHeight NO incluye márgenes: si no se cuentan, cada bloque se ancla
       más arriba de su posición natural y al scrollear "recupera" ese hueco (el
       chrome se comprime hasta bloquearse). Hay que sumar el hueco REAL entre
       bloques, que por colapso de márgenes es el MÁXIMO entre el margen inferior
       del anterior y el superior del actual (no la suma). Así el top de anclaje
       coincide con la posición natural → cero holgura, cero compresión. */
    var prevMB = 0;
    els.forEach(function(el, i){
      var cs = getComputedStyle(el);
      var mt = parseFloat(cs.marginTop) || 0;
      top += Math.max(prevMB, mt);                     // hueco real (colapso)
      el.classList.add('pinned');
      el.style.position = 'sticky';
      el.style.top = Math.round(top) + 'px';
      el.style.zIndex = String(Math.max(1, 6 - i));   // los de arriba, por encima
      top += el.offsetHeight;
      prevMB = parseFloat(cs.marginBottom) || 0;
    });
    return Math.round(top);   // borde inferior del chrome (para anclar las cabeceras de día)
  }
  /* recalcula el apilado fijo de la vista 2 según el modo/estado actual */
  function restickView2(){
    var v2 = $('#view2');
    if(!$('#result').classList.contains('open')) return;
    var els = [];
    if(v2.classList.contains('crit-collapsed')) els.push($('#panelMini'));
    els.push($('#evModeTabs'));
    if(evMode === 'prox'){
      /* fecha + nº de eventos SIEMPRE fijos arriba; la lista scrollea detrás
         con sus cabeceras de día pegajosas */
      els.push(v2.querySelector('#modeProx .datefilter'), $('#resCount'));
    } else if(evMode === 'horarios' && horSala == null){
      els.push(v2.querySelector('#modeHorarios .sala-search'),    // "Buscar sala" fijo
               v2.querySelector('#modeHorarios .res-count'));     // "Salas disponibles" fijo
    } else if(evMode === 'horarios' && horSala != null){
      els.push(v2.querySelector('#modeHorarios .cal-monthnav'),   // ‹ Salas
               v2.querySelector('#modeHorarios .sala-head'),       // subtítulo (sala)
               $('#salaTabs'));                                    // sub-pestañas
      if(horSub === 'proximos') els.push(v2.querySelector('#modeHorarios .sala-occ-head'));   // "Elige un día" fijo
    } else if(evMode === 'cal' && calMonth != null){
      els.push(v2.querySelector('#modeCal .cal-monthtop'),   // año + switch
               v2.querySelector('#modeCal .cal-monthnav'),    // ‹ mes ›
               $('#calSubTabs'));
    }
    var bottom = pinBelow(v2, els);
    /* las cabeceras de día (.date-head) se fijan justo bajo este chrome */
    if(bottom) v2.style.setProperty('--group-top', bottom + 'px');
  }
  /* apilado fijo del perfil: título (nombre+ciudad) + pestañas */
  function restickProfile(){
    var v = $('#viewProfile'); if(v.classList.contains('hidden')) return;
    pinBelow(v, [$('#profTabs')]);
  }
  /* rellena la pestaña activa con blanco SOLO hasta el borde inferior de la
     pantalla (ni se queda corta ni crea blanco masivo). Así el contenido corto
     no genera scroll (cabeceras quietas) y el largo scrollea por detrás. */
  function fillMode(){
    var v2 = $('#view2'); if(v2.classList.contains('hidden')) return;
    /* altura del "chrome" SOBRE la pestaña (cabecera + criterios + pestañas);
       sumando alturas de elementos (más fiable que medir posiciones) */
    var head = v2.querySelector('.v2-head'), tabs = $('#evModeTabs');
    var chrome = (head ? head.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
    if(v2.classList.contains('crit-collapsed')){ var m = $('#panelMini'); if(m) chrome += m.offsetHeight; }
    else { var p = $('#panel'); if(p) chrome += p.offsetHeight; var sp = $('#subPanel'); if(sp && sp.classList.contains('show')) chrome += sp.offsetHeight; }
    var minH = Math.max(160, v2.clientHeight - chrome - 56);   // 56 = reserva inferior + márgenes
    var collapsed = v2.classList.contains('crit-collapsed');
    /* recorrido extra cuando los criterios están EXPANDIDOS en una vista de
       detalle: hay que poder bajar lo suficiente para que el panel salga de
       vista y se colapse (≈ alto del panel + margen). */
    var panelH = 0; if(!collapsed){ var pp = $('#panel'); if(pp) panelH = pp.offsetHeight; }
    ['modeProx','modeCal','modeHorarios'].forEach(function(id){
      var el = document.getElementById(id); if(!el) return;
      var detail = (id === 'modeHorarios' && horSala != null) || (id === 'modeCal' && calMonth != null);
      if(el.hidden){ el.style.minHeight = ''; return; }
      /* detalle + colapsado: NO rellenar → el contenido cabe natural y el
         .scroll-body rebote (se estira y vuelve) en vez de scrollear a un blanco. */
      if(detail && collapsed){ el.style.minHeight = ''; return; }
      /* detalle + expandido: recorrido = alto del panel + 60, suficiente para
         bajar y que el panel salga de vista → se colapsa (si no, el mes cabe
         entero y no se podía comprimir el histórico). */
      if(detail){ el.style.minHeight = Math.max(160, (v2.clientHeight - chrome) + panelH + 60) + 'px'; return; }
      /* no-detalle (prox / año): rellena hasta el borde inferior. */
      el.style.minHeight = minH + 'px';
    });
  }
  function relayoutView2(){ fillMode(); restickView2(); }
  /* re-ancla a los 60ms y de nuevo a los 350ms (tras la transición de vista),
     porque medir en plena transición da posiciones erróneas (chrome mal fijado) */
  function scheduleRelayout(){ setTimeout(relayoutView2, 60); setTimeout(relayoutView2, 350); }

  var setCritCollapsed;   // accesible desde setEvMode (auto-colapsar en cal/horarios)
  (function(){
    var v2 = $('#view2'), tabs = $('#evModeTabs'), mini = $('#panelMini');
    var panel = $('#panel'), subp = $('#subPanel');
    var EFFORT = 80, LOCK_MS = 500, effort = 0, touchY = 0, collapsedAt = 0;
    function critReady(){ return $('#result').classList.contains('open'); }
    function inDetailView(){ return (evMode === 'cal' && calMonth != null) || (evMode === 'horarios' && horSala != null); }
    function headH(){ var h = v2.querySelector('.v2-head'); return h ? h.offsetHeight : 0; }
    function locked(){ return Date.now() - collapsedAt >= LOCK_MS; }   // anclado tras 0,5 s
    function setBox(el, on, anim){
      el.style.transition = anim ? '' : 'none';   // colapsar = instantáneo (sin salto); desplegar = animado
      el.style.maxHeight = on ? '0px' : '';
      el.style.opacity   = on ? '0' : '';
      el.style.marginTop = on ? '0px' : '';
      el.style.marginBottom = on ? '0px' : '';
      el.style.paddingTop = on ? '0px' : '';
      el.style.paddingBottom = on ? '0px' : '';
      el.style.borderWidth = on ? '0px' : '';      // con max-height:0+overflow:hidden el borde (2px) seguía ocupando → holgura residual del chrome
      el.style.overflow = on ? 'hidden' : '';       // hidden SOLO al colapsar (recorta el contenido a max-height:0); expandido = visible (no recorta esquinas de "Tipo")
    }
    function tops(){ restickView2(); }   // apila cabecera→(mini)→pestañas→subtítulos/sub-pestañas
    function collapse(on, fromGesture){
      var was = v2.classList.contains('crit-collapsed');
      if(on && !was){
        var h0 = v2.scrollHeight;
        setBox(panel, true, false); setBox(subp, true, false);   // instantáneo
        v2.classList.add('crit-collapsed');
        var h1 = v2.scrollHeight;
        v2.scrollTop = Math.max(0, v2.scrollTop - (h0 - h1));     // compensa: el contenido no salta
        collapsedAt = fromGesture ? Date.now() : 0;              // auto (cambio de pestaña) → anclado ya
      } else if(!on && was){
        setBox(panel, false, true); setBox(subp, false, true);   // animado al desplegar
        v2.classList.remove('crit-collapsed');
        effort = 0;
      }
      tops(); fillMode();   // cambia el offset de la pestaña → recalcula relleno
    }
    setCritCollapsed = collapse;
    v2.addEventListener('scroll', function(){
      if(!critReady()) return;
      restickView2();   // re-ancla (cumulativo: barato, no toca el scroll)
      if(!v2.classList.contains('crit-collapsed')){
        /* comprimir cuando el histórico ya ha salido de vista (tras la cabecera) */
        var head = v2.querySelector('.v2-head');
        var hb = head ? head.getBoundingClientRect().bottom : 0;
        if(panel.getBoundingClientRect().bottom <= hb + 2) collapse(true, true);   // gesto
      } else if(v2.scrollTop <= 2 && !locked() && !inDetailView()){
        /* "subir rápido = volver a desplegar" SOLO fuera de vistas de detalle.
           En detalle (sala / mes) al colapsar se quita el min-height → el
           contenido cabe → scrollTop salta a 0 → esto se disparaba en BUCLE
           re-desplegando el histórico. Ahí solo se despliega con Editar/arrastre. */
        collapse(false);
      }
    }, { passive:true });
    /* tras 0,5 s anclado: desplegar exige "esfuerzo" (sobre-scroll arriba).
       Excepción: dentro de una SALA (horSala) el chrome debe quedar quieto (el
       usuario no quiere que se mueva al sobre-scrollear; para editar criterios
       ahí está el botón "Editar"). En Calendario SÍ se permite desplegar tirando
       hacia arriba (el mes cabe sin scroll, así que es la forma natural). */
    function canEffort(){
      return critReady() && v2.classList.contains('crit-collapsed') && v2.scrollTop <= 2 &&
             !(evMode === 'horarios' && horSala != null);
    }
    /* RUEDA (escritorio): mismo umbral pero despliegue instantáneo. */
    function tryEffort(amount){
      if(!canEffort()) return;
      if(!locked()){ collapse(false); return; }
      effort += amount;
      if(effort > EFFORT){ collapse(false); v2.scrollTop = 0; }
    }
    v2.addEventListener('wheel', function(e){ if(e.deltaY < 0) tryEffort(-e.deltaY); else effort = 0; }, { passive:true });

    /* TÁCTIL: tras superar el "esfuerzo", el histórico se despliega AL RITMO del
       propio arrastre (no de golpe). El panel crece y la barra mini se desvanece
       en proporción al dedo; al soltar, si se reveló lo suficiente se completa,
       si no, vuelve a colapsarse. */
    var revealing = false, revFrac = 0, pFull = 0, sFull = 0, mFull = 0;
    function natural(el){            // alto natural del bloque (medido sin pintar)
      var mh = el.style.maxHeight, tr = el.style.transition, ov = el.style.overflow;
      el.style.transition = 'none'; el.style.overflow = 'hidden'; el.style.maxHeight = 'none';
      var h = el.scrollHeight;
      el.style.maxHeight = mh; el.style.transition = tr; el.style.overflow = ov;
      return h;
    }
    function partial(el, full, frac){
      el.style.transition = 'none'; el.style.overflow = 'hidden';
      el.style.maxHeight = (full * frac) + 'px';
      el.style.opacity = String(frac);
    }
    function revealStart(){
      revealing = true; critRevealing = true;
      pFull = natural(panel) || 1;
      sFull = subp.classList.contains('show') ? natural(subp) : 0;
      mFull = mini.offsetHeight || 40;
    }
    function revealTo(frac){
      frac = Math.max(0, Math.min(1, frac)); revFrac = frac;
      partial(panel, pFull, frac);
      if(sFull) partial(subp, sFull, frac);
      mini.style.transition = 'none'; mini.style.overflow = 'hidden';
      mini.style.maxHeight = (mFull * (1 - frac)) + 'px'; mini.style.opacity = String(1 - frac);
    }
    function revealEnd(){
      if(!revealing) return;
      var done = revFrac >= 0.4;
      revealing = false; critRevealing = false;
      mini.style.maxHeight = ''; mini.style.opacity = ''; mini.style.overflow = ''; mini.style.transition = '';
      if(done){ collapse(false); }                       // completar (animado)
      else { setBox(panel, true, false); setBox(subp, true, false); effort = 0; tops(); fillMode(); }  // cancelar
    }
    v2.addEventListener('touchstart', function(e){ touchY = e.touches[0].clientY; effort = 0; }, { passive:true });
    v2.addEventListener('touchmove', function(e){
      var y = e.touches[0].clientY, dy = y - touchY; touchY = y;
      if(!canEffort()){ if(revealing) revealEnd(); return; }
      if(!locked()){ if(dy > 0) collapse(false); return; }   // <0,5 s desde el colapso → despliega solo
      effort = Math.max(0, effort + dy);                      // arriba suma, abajo resta
      if(effort > EFFORT){
        if(!revealing) revealStart();
        revealTo((effort - EFFORT) / pFull);                 // 1:1 con el arrastre
      } else if(revealing){
        revealTo(0);
      }
    }, { passive:true });
    v2.addEventListener('touchend',    function(){ if(revealing) revealEnd(); }, { passive:true });
    v2.addEventListener('touchcancel', function(){ if(revealing) revealEnd(); }, { passive:true });
    mini.addEventListener('click', function(){ v2.scrollTop = 0; collapse(false); });
  })();

  window.addEventListener('resize', function(){ relayoutView2(); restickProfile(); });

  /* swipe horizontal para cambiar de pestaña (Próximos/Calendario/Horarios),
     SALVO en Calendario con un mes abierto (ahí el swipe cambia de mes — se
     gestiona dentro del propio handler, sobre todo el área de resultados) */
  (function(){
    /* el gesto escucha en TODO #view2 (no solo en #result) para que el swipe de
       mes funcione aunque el contenido del mes/agenda sea corto o esté vacío
       (debajo de "No hay eventos…" el área ya no es #result, pero sí #view2) */
    var r = $('#view2'), sx = 0, sy = 0, ORDER = ['prox','horarios','cal'];
    r.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    r.addEventListener('touchend', function(e){
      if(!$('#result').classList.contains('open')) return;   // solo sobre los resultados
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if(!(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6)) return;
      var dir = dx < 0 ? 1 : -1;
      /* Calendario con un mes abierto: el swipe cambia de mes (se gestiona aquí,
         sobre TODO el área de resultados, para que funcione aunque el contenido
         del mes/agenda sea corto o esté vacío) */
      if(evMode === 'cal' && calMonth != null){ goCalMonth(dir); return; }
      /* dentro de una sala: el swipe alterna sus SUB-pestañas (Horario/Próximos) */
      if(evMode === 'horarios' && horSala != null){
        var subs = ['horario','proximos'], j = subs.indexOf(horSub) + dir;
        if(j >= 0 && j < subs.length){ horSub = subs[j]; renderHorariosMode(); }
        return;
      }
      /* si no, cambia de pestaña principal (Próximos/Calendario/Horarios) */
      var i = ORDER.indexOf(evMode) + dir;
      if(i >= 0 && i < ORDER.length) setEvMode(ORDER[i]);
    }, { passive:true });
  })();

  /* ── vista 3: detalle del evento + camarógrafos ───────────────────── */
  var CAM_SVG = '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.8l6-3.3v9l-6-3.3"/><circle cx="7.5" cy="12" r="2.2"/></svg>';
  /* cámara mini para el badge amarillo de seguidos en la lista de eventos */
  var CAM_MINI_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.8l6-3.3v9l-6-3.3"/></svg>';

  var camSelEv = null;     // camarógrafo desplegado dentro del detalle
  /* ¿este camarógrafo ya abrió cola en este evento? (mock + tu check-in) */
  function camLiveIn(ev, c){
    if(c.you) return !!checkins[ev.id];
    return (ev.liveCams || []).indexOf(c.id) !== -1;
  }
  /* acciones del bailarín sobre un camarógrafo según el momento del evento */
  function buildCamActions(ev, c, st){
    var key = ev.id + '_' + c.id;
    var a = '<span class="cam-actions">';
    /* "Me interesa grabar contigo" no tiene sentido si el evento ya pasó */
    if(st !== 'terminado'){
      a += '<button class="act' + (interest[key] ? ' done' : '') + '" data-act="interest" data-cam="' + c.id + '">' +
           (interest[key] ? '♥ Te interesa este evento ✓' : '♥ Me interesa grabar contigo') + '</button>';
    }
    if(queue[key]){
      a += '<span class="act done">En su cola ✓</span>';
    } else if(st === 'previo'){
      if(resv[key]){
        a += '<span class="act done">Plaza reservada ✓</span>';
      } else {
        var ok = saldo >= c.reserve;
        a += '<button class="act primary" data-act="resv" data-cam="' + c.id + '"' +
             (ok ? '' : ' disabled') + '>Reservar plaza · ' +
             (c.reserve ? fmtEur(c.reserve) : 'gratis') + '</button>';
        if(!ok) a += '<span class="act-hint">Saldo insuficiente (' + fmtEur(saldo) + ')</span>';
      }
    } else if(st === 'directo'){
      if(camLiveIn(ev, c)){
        var fee = Math.max(0, c.price - (resv[key] ? c.reserve : 0));
        var ok2 = saldo >= fee;
        a += '<button class="act primary" data-act="queue" data-cam="' + c.id + '"' +
             (ok2 ? '' : ' disabled') + '>Apuntarme a la cola · ' + fmtEur(fee) +
             (resv[key] ? ' (reserva descontada)' : '') + '</button>';
        if(!ok2) a += '<span class="act-hint">Saldo insuficiente (' + fmtEur(saldo) + ')</span>';
      } else {
        a += '<span class="act-hint">Aún no ha llegado al evento — cola sin abrir</span>';
      }
    } else {
      a += '<span class="act-hint">Evento terminado</span>';
    }
    return a + '</span>';
  }
  function renderEventDetail(){
    var ev = currentEvent;
    var st = eventStatus(ev);
    var soyCam = state.role && state.role.value === 'cam';
    /* evento EN DIRECTO → botón al modo "Estoy dentro" (módulo js/live.js) */
    var leb = $('#liveEnterBtn');
    leb.hidden = st !== 'directo';
    leb.querySelector('b').textContent = soyCam ? 'Panel en directo' : 'Estoy dentro';
    $('#evName').textContent = ev.name; updateRoleIcons();   // textContent borra el icono de rol → re-añadir
    $('#evMeta').textContent = fmtDate(ev.startsAt) + ' · ' + evHours(ev) + ' · ' + ev.venue;
    $('#evTags').innerHTML =
      (st === 'directo'   ? '<span class="tag2 hl">● En directo</span>' : '') +
      (st === 'terminado' ? '<span class="tag2">Terminado</span>' : '') +
      (ev.passLabel ? '<span class="tag2 tt-congreso">' + ev.passLabel + '</span>' : '') +
      '<span class="tag2">' + CITY_LABELS[ev.city] + '</span>' +
      '<span class="tag2 tt-' + ev.type + '">' + TYPE_LABELS[ev.type] + '</span>' +
      (ev.sub ? '<span class="tag2 hl">' + SUB_LABELS[ev.sub] + '</span>' : '');
    /* información breve del evento */
    $('#evBrief').textContent = TYPE_LABELS[ev.type] + ' · ' + CITY_LABELS[ev.city] + ' · ' + ev.venue +
      (ev.timeLabel ? ' · ' + ev.timeLabel : '');
    /* intenciones del bailarín (no comprometen; ocultas si eres cámara o pasó) */
    renderIntents(ev);
    /* botón que LLEVA a la vista de camarógrafos apuntados (no despliega aquí) */
    var total = ev.camIds.length + (joined[ev.id] ? 1 : 0);
    $('#revealCams').textContent = (st === 'terminado' ? 'Ver quién asistió' : 'Ver camarógrafos apuntados') + ' · ×' + total;
    /* CTA del camarógrafo: apuntarse al evento */
    var btn = $('#joinBtn');
    btn.hidden = !soyCam;
    if(soyCam){
      if(joined[ev.id]){ btn.classList.add('leave');    btn.textContent = 'Quitarme de este evento'; }
      else             { btn.classList.remove('leave'); btn.textContent = 'Apuntarme como camarógrafo'; }
    }
    /* check-in del camarógrafo: solo entre el inicio y el fin del evento */
    var ck = $('#checkinBtn'), hint = $('#checkinHint');
    ck.hidden = true; hint.hidden = true;
    if(soyCam && joined[ev.id]){
      ck.hidden = false;
      ck.disabled = false;
      ck.classList.remove('leave');
      if(checkins[ev.id]){
        ck.classList.add('leave');
        ck.disabled = true;
        ck.textContent = 'Cola abierta ✓';
        hint.hidden = false;
        hint.textContent = 'Los bailarines ya pueden apuntarse a tu cola';
      } else if(st === 'directo'){
        ck.textContent = 'He llegado · abrir cola';
      } else {
        ck.disabled = true;
        ck.textContent = 'He llegado · abrir cola';
        hint.hidden = false;
        hint.textContent = (st === 'previo')
          ? 'Disponible a partir de las ' + fmtTime(ev.startsAt)
          : 'El evento ya terminó';
      }
    }
  }

  /* ── vista propia: camarógrafos apuntados a un evento/día concreto ────── */
  function renderEventCams(){
    var ev = currentEvent;
    var st = eventStatus(ev);
    var soyCam = state.role && state.role.value === 'cam';
    $('#ecSub').textContent = ev.name + ' · ' + fmtDate(ev.startsAt) + ' · ' + evHours(ev);
    var cams = ev.camIds.map(function(id){ return CAMS_BY_ID[id]; });
    var youCard = joined[ev.id];
    var html = '';
    cams.forEach(function(c){
      html += '<div class="camcard' + (follows[c.id] ? ' followed' : '') + '" data-cam="' + c.id + '">' +
        ccInner(c) +
        '<div class="cc-event">' +
          '<div class="cc-ev-line"><span class="cc-ev-k">Llegada</span> ~' + fmtTime(ev.startsAt) +
            ' · <span class="cc-ev-k">Salida</span> ~' + fmtTime(ev.endsAt) + '</div>' +
          '<div class="cc-ev-line"><span class="cc-ev-k">Tasa</span> ' + fmtEur(c.price) +
            ' · <span class="cc-ev-k">Reserva</span> ' + (c.reserve ? fmtEur(c.reserve) : 'gratis') + '</div>' +
          (!soyCam ? buildCamActions(ev, c, st) : '') +
        '</div>' +
      '</div>';
    });
    if(youCard){
      html += '<div class="cam you"><span class="ic">' + CAM_SVG + '</span>' +
        '<div class="cam-info"><b>Tú</b><small>Apuntado desde este móvil como camarógrafo</small></div>' +
        '<span class="you-tag">Tú</span></div>';
    }
    var total = cams.length + (youCard ? 1 : 0);
    $('#camList').innerHTML = html;
    $('#camCount').textContent = '×' + total;
    $('#camEmptyTxt').textContent = soyCam
      ? 'Nadie se ha apuntado aún — sé el primero.'
      : (st === 'terminado' ? 'Nadie grabó en este evento.' : 'Aún no hay camarógrafos en este evento.');
    $('#camEmpty').style.display = total ? 'none' : 'flex';
    var back = function(){ renderEventCams(); goView('viewEvCams','ac-red'); };
    wireCamCards($('#camList'), renderEventCams, back);
    if(!soyCam){
      $('#camList').querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(e){
          e.stopPropagation();
          if(b.disabled) return;
          var c = CAMS_BY_ID[b.dataset.cam];
          var key = ev.id + '_' + c.id;
          if(b.dataset.act === 'interest'){
            if(interest[key]) delete interest[key]; else interest[key] = true;
            save('cilap-interest', interest);
          } else if(b.dataset.act === 'resv'){
            resv[key] = true; save('cilap-resv', resv);
            charge(c.reserve);
          } else if(b.dataset.act === 'queue'){
            queue[key] = true; save('cilap-queue', queue);
            charge(Math.max(0, c.price - (resv[key] ? c.reserve : 0)));
          }
          renderEventCams();
        });
      });
    }
  }

  /* ── intenciones del bailarín sobre un evento (no comprometen a nada) ────
     "Interesado en grabar" implica "Voy a asistir"; al apagar "Voy a asistir"
     se apaga también "Interesado en grabar". */
  function saveIntents(){ save('cilap-attend', attend); save('cilap-wishrec', wishrec); }
  function renderIntents(ev){
    var st = eventStatus(ev);
    var soyCam = state.role && state.role.value === 'cam';
    var show = !soyCam && st !== 'terminado';
    $('#evIntents').hidden = !show;
    if(!show) return;
    $('#intAttend').classList.toggle('on', !!attend[ev.id]);
    $('#intWish').classList.toggle('on', !!wishrec[ev.id]);
  }
  $('#intAttend').addEventListener('click', function(){
    var ev = currentEvent;
    if(attend[ev.id]){ delete attend[ev.id]; delete wishrec[ev.id]; }   // apagar asistencia apaga todo
    else attend[ev.id] = true;
    saveIntents(); renderIntents(ev);
  });
  $('#intWish').addEventListener('click', function(){
    var ev = currentEvent;
    if(wishrec[ev.id]){ delete wishrec[ev.id]; }
    else { wishrec[ev.id] = true; attend[ev.id] = true; }               // interesado ⇒ asistir
    saveIntents(); renderIntents(ev);
  });
  $('#revealCams').addEventListener('click', function(){ renderEventCams(); goView('viewEvCams','ac-red'); });
  $('#ecBack').addEventListener('click', histBack);

  function openEvent(ev){
    currentEvent = ev;
    camSelEv = null;
    renderEventDetail();
    goView('view3', 'ac-red');
  }

  $('#backToEvents').addEventListener('click', histBack);

  /* ── modo EN DIRECTO (módulo js/live.js): cableado de navegación ── */
  if(window.Live){
    Live.wire({
      goView: goView, histBack: histBack, goHome: goHome,
      getRole: function(){ return state.role ? state.role.value : 'dancer'; }
    });
    $('#liveEnterBtn').addEventListener('click', function(){
      if(currentEvent) Live.open(currentEvent, state.role ? state.role.value : 'dancer');
    });
    /* ← del directo: desde la ficha de un camarógrafo vuelve a la LISTA
       (Live.back() lo resuelve); solo sale de la vista si ya estás en ella */
    $('#liveBack').addEventListener('click', function(){ if(Live.back()) return; histBack(); });
    $('#liveHome').addEventListener('click', goHome);
  }

  $('#joinBtn').addEventListener('click', function(){
    if(!currentEvent) return;
    if(joined[currentEvent.id]) delete joined[currentEvent.id];
    else joined[currentEvent.id] = true;
    try{ localStorage.setItem('cilap-joined', JSON.stringify(joined)); }catch(e){}
    renderEventDetail();
  });

  /* check-in del camarógrafo (validado también aquí, no solo en la UI) */
  $('#checkinBtn').addEventListener('click', function(){
    if(!currentEvent || checkins[currentEvent.id]) return;
    if(eventStatus(currentEvent) !== 'directo') return;   // solo dentro de la ventana
    checkins[currentEvent.id] = true;
    save('cilap-checkin', checkins);
    renderEventDetail();
  });

  /* ── hub: ¿qué buscas? ────────────────────────────────────────────── */
  /* nº de eventos futuros con alguna intención marcada (para el contador del hub) */
  function myEventsCount(){
    var ids = {};
    Object.keys(attend).forEach(function(id){ if(attend[id]) ids[id] = 1; });
    Object.keys(wishrec).forEach(function(id){ if(wishrec[id]) ids[id] = 1; });
    Object.keys(interest).forEach(function(k){
      if(!interest[k]) return;
      var us = k.lastIndexOf('_'); if(us !== -1) ids[k.slice(0, us)] = 1;
    });
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    return Object.keys(ids).filter(function(id){
      var ev = resolveEv(id); return ev && intentTs(id, ev) >= hoy.getTime();
    }).length;
  }
  function updateHub(){
    var dancer = state.role && state.role.value === 'dancer';
    $('#hubSub').textContent = dancer ? 'Entraste como bailarín.' : 'Entraste como camarógrafo.';
    $('#hubMineName').textContent = dancer ? 'Mis bailes' : 'Mis sesiones';
    /* contadores vivos bajo cada tarjeta */
    if(dancer){
      var pend = MY_DANCES.filter(function(d){ return !myRatings[danceKey(d)]; }).length;
      $('#hubMineCnt').textContent = pend ? (pend + ' por valorar') : (MY_DANCES.length + ' bailes');
    } else {
      $('#hubMineCnt').textContent = MY_SESSIONS.length + ' sesiones';
    }
    var me = myEventsCount();
    $('#hubMyEvCnt').textContent = me ? (me + ' marcado' + (me === 1 ? '' : 's')) : 'ninguno aún';
    var nf = Object.keys(follows).filter(function(k){ return follows[k]; }).length;
    $('#hubCamsCnt').textContent = nf ? (nf + ' favorito' + (nf === 1 ? '' : 's')) : 'directorio';
    refreshRefUI();
  }
  /* refleja la config de país/ciudad: botón "Eventos en mi ciudad"
     bloqueado y aviso en el engranaje mientras no se haya rellenado */
  function refreshRefUI(){
    var ok = hasRef();
    var wc = $('#whereCity');
    if(wc){
      wc.classList.toggle('locked', !ok);
      wc.disabled = !ok;
      $('#whereCitySub').textContent = ok ? refLabel() : 'Configúralo en ⚙ para activarlo';
    }
    $('#settingsBadge').hidden = ok;
  }
  function refLabel(){
    if(ref.cities.length) return ref.cities.map(function(c){ return CITY_LABELS[c]; }).join(', ');
    return 'Tu país y ciudad de referencia';
  }
  /* el hub es la raíz de navegación: su ← SIEMPRE vuelve a la Home (rol),
     no al historial (que tras una restauración puede estar vacío y dejarte
     en el propio hub) */
  $('#hubBack').addEventListener('click', function(){ goView('view1','ac-red'); });
  /* "Próximos eventos" → pregunta ¿Dónde? (En mi ciudad / En otro lugar) */
  $('#hubProx').addEventListener('click', function(){ goView('viewWhere','ac-red'); });
  $('#whereBack').addEventListener('click', histBack);
  /* "En otro lugar" = la búsqueda libre de antes ("Busco evento") */
  $('#whereOther').addEventListener('click', function(){
    goView('view2');
    advance();                       // retoma la búsqueda donde estuviera (paso País)
  });
  /* "En mi ciudad": país y ciudad fijados a la referencia + TODOS los tipos →
     va directo a los resultados (sin pasar por elegir Tipo). */
  $('#whereCity').addEventListener('click', function(){
    if(!hasRef()) return;
    var COUNTRY_LBL = function(k){ return k === 'es' ? 'España' : 'Polonia'; };
    var cities = ref.cities.slice();
    var countries = ref.countries.length
      ? ref.countries.slice()
      : cities.map(function(c){ return CITY_COUNTRY[c]; }).filter(function(k, i, a){ return a.indexOf(k) === i; });
    function pack(vals, lblFn){
      var single = vals.length === 1;
      return { value: single ? vals[0] : vals.slice(), label: vals.map(lblFn).join(', '), multi: !single };
    }
    state.country = pack(countries, COUNTRY_LBL);
    var provsRef = cities.map(function(c){ return CITY_PROV[c]; }).filter(function(k, i, a){ return k && a.indexOf(k) === i; });
    state.prov = provsRef.length ? pack(provsRef, function(p){ return PROV_LABELS[p]; }) : { value:'all', label:'Todas' };
    state.city    = pack(cities, function(c){ return CITY_LABELS[c]; });
    state.type = { value:'all', label:'Todos' };   // ya filtrado por TODOS los tipos
    state.subtype = null;
    editing = null;
    closeAll();
    renderPanel();
    goView('view2');
    advance();                       // país+ciudad+tipo puestos → resultados directos
  });
  $('#hubCams').addEventListener('click', function(){
    renderCamDir();
    goView('viewCams','ac-amber');
  });
  $('#hubMine').addEventListener('click', function(){
    renderMine();
    goView('viewMine','ac-lime');
  });
  $('#hubMyEvents').addEventListener('click', function(){
    renderMyEvents();
    goView('viewMyEvents','ac-red');
  });

  /* ── configuración: país y ciudad de referencia (⚙) ──────────────────── */
  function renderSettings(){
    var dancer = state.role && state.role.value === 'dancer';
    $('#setSaldoHead').style.display = dancer ? '' : 'none';   // el saldo es cosa del bailarín
    $('#setSaldo').style.display = dancer ? '' : 'none';
    renderSaldo();
    $('#setPlaceVal').textContent = hasRef() ? refLabel() : 'Sin configurar';
    document.querySelectorAll('#setPrivacy .privacy-opt').forEach(function(o){
      o.classList.toggle('multi-on', (o.dataset.priv === 'private') === setPrivate);
    });
  }
  var setPrivate = false;
  function openSettings(){
    setPrivate = !!isPrivate;
    renderSettings();
    goView('viewSettings','ac-violet');
  }
  $('#hubSettings').addEventListener('click', openSettings);
  /* Crear evento: selector de tipo → wizard (módulo js/create.js) */
  $('#hubCreate').addEventListener('click', function(){ goView('viewCreate','ac-red'); });
  $('#createBack').addEventListener('click', histBack);
  $('#createHome').addEventListener('click', goHome);
  if(window.CreateEv){
    CreateEv.wire({ goView: goView, histBack: histBack, goHome: goHome });
    document.querySelectorAll('#viewCreate [data-ctype]').forEach(function(b){
      b.addEventListener('click', function(){ CreateEv.open(b.dataset.ctype); });
    });
    $('#cfBack').addEventListener('click', histBack);
    $('#cfHome').addEventListener('click', goHome);
  }
  /* "Indicar lugar habitual": abre el MISMO picker de pasos, solo País + Ciudad */
  /* OJO: envuelto — pasar startRefPick directo colaba el MouseEvent como
     refTarget y el picker se comportaba como el de camarógrafos (multi) */
  $('#setPlaceBtn').addEventListener('click', function(){ startRefPick('settings'); });
  $('#setPrivacy').addEventListener('click', function(e){
    var o = e.target.closest('.privacy-opt'); if(!o) return;
    setPrivate = (o.dataset.priv === 'private');
    renderSettings();
  });
  $('#setBack').addEventListener('click', histBack);
  $('#setSave').addEventListener('click', function(){
    isPrivate = setPrivate;
    save('cilap-private', isPrivate);
    refreshRefUI();
    goView('viewHub','ac-red');
  });
  $('#mapaBtn').addEventListener('click', function(){
    location.href = 'mapa-editor/';   // módulo aparte; se integrará más adelante
  });

  /* ── directorio de camarógrafos: ordenar, filtrar, seguir, ver perfil ── */
  var camSort = { key:'rating', dir:'desc' }, rev3On = false;
  var placeCountries = [], placeCities = [];   // vacío = todos
  var SORT_DEF = { rating:'desc', price:'asc', videos:'desc' };   // sentido inicial por criterio
  /* CITY_COUNTRY viene de data.js (derivado de las tablas de db.js) */
  function upcomingOf(c){
    return EVENTS.filter(function(e){
      return e.camIds.indexOf(c.id) !== -1 && eventStatus(e) !== 'terminado';
    });
  }
  /* contenido común de una tarjeta de camarógrafo (directorio y detalle de evento) */
  function ccInner(c){
    var nEv = upcomingOf(c).length;
    return '<div class="cc-top">' + CAM_SVG +
        '<div class="cc-id"><b>' + c.name + '</b><small>' + CITY_LABELS[c.city] + '</small></div>' +
        '<button class="cbtn follow' + (follows[c.id] ? ' on' : '') + '" data-follow="' + c.id + '">' +
          (follows[c.id] ? '✓ Siguiendo' : 'Seguir') + '</button>' +
      '</div>' +
      '<div class="cc-stats"><span class="star">★</span> ' + c.rating.toFixed(1) + '/6 · ' +
        c.reviews + ' reseñas · ' + c.videos + ' vídeos · <span class="tier">' + priceTier(c.price) + '</span></div>' +
      '<div class="cc-foot">' +
        '<span class="cc-evn">' + (nEv ? 'Grabará en ' + nEv + ' evento' + (nEv > 1 ? 's' : '') : 'Sin eventos próximos') + '</span>' +
        '<button class="cbtn" data-profile="' + c.id + '">Ver perfil</button>' +
      '</div>';
  }
  /* engancha los botones Seguir / Ver perfil de un contenedor de tarjetas.
     reRender = repinta el contenedor tras seguir; back = acción para volver
     aquí desde el perfil */
  function wireCamCards(box, reRender, back){
    box.querySelectorAll('[data-profile]').forEach(function(b){
      b.addEventListener('click', function(e){ e.stopPropagation(); openProfile(CAMS_BY_ID[b.dataset.profile], back); });
    });
    box.querySelectorAll('[data-follow]').forEach(function(b){
      b.addEventListener('click', function(e){ e.stopPropagation(); toggleFollow(b.dataset.follow); reRender(); });
    });
  }
  var backToCams = function(){ renderCamDir(); goView('viewCams','ac-amber'); };
  function renderCamDir(){
    var list = CAMS.filter(function(c){
      if(placeCountries.length && placeCountries.indexOf(CITY_COUNTRY[c.city]) === -1) return false;
      if(placeCities.length && placeCities.indexOf(c.city) === -1) return false;
      if(rev3On && c.reviews <= 3) return false;       // filtro +3 reseñas
      return true;
    });
    if(camSort){                                       // null = sin ordenación
      var k = camSort.key, dir = camSort.dir === 'asc' ? 1 : -1;
      list.sort(function(a, b){
        var av = k === 'price' ? a.price : (k === 'videos' ? a.videos : a.rating);
        var bv = k === 'price' ? b.price : (k === 'videos' ? b.videos : b.rating);
        return (av - bv) * dir;
      });
    }
    var box = $('#camDir');
    box.innerHTML = '';
    list.forEach(function(c){
      var el = document.createElement('div');
      el.className = 'camcard' + (follows[c.id] ? ' followed' : '');
      el.dataset.cam = c.id;
      el.innerHTML = ccInner(c);
      el.addEventListener('click', function(){ openProfile(c, backToCams); });   // tap tarjeta → perfil
      box.appendChild(el);
    });
    wireCamCards(box, renderCamDir, backToCams);
    $('#camDirEmpty').style.display = list.length ? 'none' : 'flex';
  }
  function toggleFollow(id){
    if(follows[id]) delete follows[id]; else follows[id] = true;
    save('cilap-follows', follows);
  }
  /* refleja el estado del orden en los chips (clase on + asc/desc para la flecha) */
  function renderSortChips(){
    document.querySelectorAll('#sortChips .fchip').forEach(function(ch){
      var on = camSort && camSort.key === ch.dataset.sort;
      ch.classList.toggle('on', !!on);
      ch.classList.toggle('asc',  !!(on && camSort.dir === 'asc'));
      ch.classList.toggle('desc', !!(on && camSort.dir === 'desc'));
    });
  }
  /* 3 estados por criterio: sentido natural → inverso → sin ordenación */
  document.querySelectorAll('#sortChips .fchip').forEach(function(ch){
    ch.addEventListener('click', function(){
      var key = ch.dataset.sort;
      if(!camSort || camSort.key !== key)        camSort = { key:key, dir:SORT_DEF[key] };
      else if(camSort.dir === SORT_DEF[key])     camSort = { key:key, dir:(SORT_DEF[key] === 'desc' ? 'asc' : 'desc') };
      else                                       camSort = null;   // 3er toque: quitar orden
      renderSortChips();
      renderCamDir();
    });
  });
  /* menú "Lugar": país + ciudad multi-seleccionables (estilo Busco evento) */
  function placeLabel(){
    if(placeCities.length)    return placeCities.map(function(c){ return CITY_LABELS[c]; }).join(', ');
    if(placeCountries.length) return placeCountries.map(function(k){ return k === 'es' ? 'España' : 'Polonia'; }).join(', ');
    return 'Todos los lugares';
  }
  function renderPlaceMenu(){
    document.querySelectorAll('#pmCountries .po').forEach(function(o){
      o.classList.toggle('multi-on', placeCountries.indexOf(o.dataset.c) !== -1);
    });
    var cities = placeCountries.length
      ? placeCountries.reduce(function(acc, k){ return acc.concat(k === 'es' ? ['mad','sev','bcn'] : ['waw','kra']); }, [])
      : ['mad','sev','bcn','waw','kra'];
    $('#pmCities').innerHTML = cities.map(function(c){
      return '<button class="opt po" data-city="' + c + '"><span class="lbl"><b>' + CITY_LABELS[c] + '</b></span><span class="mbox"></span></button>';
    }).join('');
    document.querySelectorAll('#pmCities .po').forEach(function(o){
      o.classList.toggle('multi-on', placeCities.indexOf(o.dataset.city) !== -1);
    });
  }
  /* "Lugar" abre el picker de pasos (País → Ciudad), como el menú histórico */
  $('#placeBtn').addEventListener('click', function(){ startRefPick('cams'); });
  $('#pmCountries').addEventListener('click', function(e){
    var o = e.target.closest('.po'); if(!o) return;
    var k = o.dataset.c, i = placeCountries.indexOf(k);
    if(i === -1) placeCountries.push(k); else placeCountries.splice(i, 1);
    placeCities = placeCities.filter(function(c){ return !placeCountries.length || placeCountries.indexOf(CITY_COUNTRY[c]) !== -1; });
    renderPlaceMenu();
  });
  $('#pmCities').addEventListener('click', function(e){
    var o = e.target.closest('.po'); if(!o) return;
    var c = o.dataset.city, i = placeCities.indexOf(c);
    if(i === -1) placeCities.push(c); else placeCities.splice(i, 1);
    renderPlaceMenu();
  });
  $('#placeApply').addEventListener('click', function(){
    $('#placeMenu').hidden = true;
    $('#placeLbl').textContent = placeLabel();
    renderCamDir();
  });
  $('#rev3Chip').addEventListener('click', function(){
    rev3On = !rev3On;
    this.classList.toggle('on', rev3On);
    renderCamDir();
  });
  $('#camsBack').addEventListener('click', histBack);
  $('#camsHome').addEventListener('click', goHome);

  /* ── perfil del camarógrafo (estadísticas detalladas) ─────────────── */
  var currentProfile = null, profileBack = backToCams, revSort = 'recent';
  function openProfile(c, back){
    currentProfile = c;
    profileBack = back || backToCams;
    revSort = 'recent';
    document.querySelectorAll('#revSortChips .fchip').forEach(function(o){ o.classList.toggle('on', o.dataset.rsort === 'recent'); });
    setProfTab('events');                 // "Próximos eventos" abierta por defecto
    renderProfile();
    goView('viewProfile','ac-amber');
    setTimeout(restickProfile, 280);      // fija título + pestañas tras la transición
  }
  function renderProfile(){
    var c = currentProfile;
    var dancedWith = MY_DANCES.filter(function(d){ return d.camId === c.id; }).length;
    $('#profName').textContent = c.name; updateRoleIcons();   // textContent borra el icono de rol → re-añadir
    $('#profSub').textContent = CITY_LABELS[c.city];
    var bio = $('#profBio');
    bio.textContent = c.bio || '';
    bio.style.display = c.bio ? 'block' : 'none';
    var ig = $('#profIg');
    ig.href = 'https://instagram.com/' + c.ig;
    ig.querySelector('.ig-h').textContent = '@' + c.ig;
    $('#profStats').innerHTML =
      '<div class="pstat"><div class="pk">Puntuación</div><div class="pv"><span class="star">★</span> ' + c.rating.toFixed(1) + '/6</div></div>' +
      '<div class="pstat"><div class="pk">Reseñas</div><div class="pv">' + c.reviews + '</div></div>' +
      '<div class="pstat"><div class="pk">Vídeos entregados</div><div class="pv">' + c.videos + '</div></div>' +
      '<div class="pstat"><div class="pk">Precio medio</div><div class="pv"><span class="tier">' + priceTier(c.price) + '</span> · ' + fmtEur(c.price) + '</div></div>' +
      '<div class="pstat wide"><div class="pk">Has grabado con ' + c.name.split(' ')[0] + '</div><div class="pv sm">' +
        (dancedWith ? dancedWith + (dancedWith > 1 ? ' veces' : ' vez') : 'Todavía ninguna') + '</div></div>' +
      '<div class="pstat wide"><div class="pk">Sala más concurrida</div><div class="pv sm">' +
        c.topVenue.name + ' · ' + c.topVenue.times + ' veces</div></div>' +
      '<div class="pstat wide"><div class="pk">Evento más concurrido</div><div class="pv sm">' +
        c.topEvent.name + ' · ' + c.topEvent.couples + ' parejas</div></div>';
    $('#profTabRevNum').textContent = c.reviews;
    var fb = $('#profFollowBtn');
    fb.classList.toggle('leave', !!follows[c.id]);
    fb.textContent = follows[c.id] ? '✓ Siguiendo · dejar de seguir' : 'Seguir';
    renderProfEvents();
    renderProfReviews();
  }
  function renderProfEvents(){
    var c = currentProfile;
    var evs = upcomingOf(c).sort(function(a, b){ return a.startsAt - b.startsAt; });
    $('#profEvents').innerHTML = evs.map(function(e){
      return '<span class="mini-evt" data-ev="' + e.id + '">' + e.name +
        '<span class="me-when">' + fmtDate(e.startsAt) + ' · ' + evHours(e) + '</span></span>';
    }).join('');
    $('#profEvents').querySelectorAll('.mini-evt').forEach(function(me){
      me.addEventListener('click', function(){ openEvent(EVENTS_BY_ID[me.dataset.ev]); });
    });
    $('#profNoEvents').style.display = evs.length ? 'none' : 'flex';
    $('#profEvents').style.display = evs.length ? 'flex' : 'none';
  }
  function renderProfReviews(){
    var c = currentProfile;
    var revs = (REVIEWS[c.id] || []).slice();
    if(revSort === 'stars') revs.sort(function(a, b){ return b.stars - a.stars || (a.date < b.date ? 1 : -1); });
    else                    revs.sort(function(a, b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    $('#profReviews').innerHTML = revs.length
      ? revs.map(function(r){
          return '<div class="review"><div class="rv-top"><span class="rv-by">' + r.by +
            '</span><span class="rv-st">★ ' + r.stars + '/6 · ' + fmtRevDate(r.date) + '</span></div>' +
            '<div class="rv-tx">' + r.text + '</div></div>';
        }).join('')
      : '<div class="review"><div class="rv-tx">Aún no hay reseñas con texto.</div></div>';
  }
  function setProfTab(t){
    document.querySelectorAll('#profTabs .fchip').forEach(function(ch){ ch.classList.toggle('on', ch.dataset.tab === t); });
    $('#tabEvents').hidden  = (t !== 'events');
    $('#tabReviews').hidden = (t !== 'reviews');
  }
  $('#profTabs').addEventListener('click', function(e){
    var b = e.target.closest('.fchip'); if(b) setProfTab(b.dataset.tab);
  });
  document.querySelectorAll('#revSortChips .fchip').forEach(function(ch){
    ch.addEventListener('click', function(){
      revSort = ch.dataset.rsort;
      document.querySelectorAll('#revSortChips .fchip').forEach(function(o){ o.classList.toggle('on', o === ch); });
      renderProfReviews();
    });
  });
  $('#profFollowBtn').addEventListener('click', function(){
    if(currentProfile){ toggleFollow(currentProfile.id); renderProfile(); }
  });
  $('#profBack').addEventListener('click', histBack);
  $('#profHome').addEventListener('click', goHome);

  /* ── mis bailes (bailarín) / mis sesiones (camarógrafo) ───────────── */
  var DANCE_STATUS = {
    recibido:  { txt:'Recibido ✓',           cls:'ok'  },
    enviado:   { txt:'Enviado · WeTransfer', cls:'mid' },
    pendiente: { txt:'Pendiente de envío',   cls:''    }
  };
  /* "12 jun 2026" → timestamp (para ordenar/agrupar) */
  function parseMyDate(s){ var p = (s||'').split(' '); return new Date(+p[2], MON.indexOf(p[1]), +p[0]).getTime(); }
  /* clave estable de un baile para guardar su valoración */
  function danceKey(d){ return d.eventId + '|' + d.song + '|' + d.camId; }
  /* fila de estrellas 0-6 (★ llenas / ☆ vacías) */
  function starsRow(n){
    var h = '';
    for(var i=1;i<=6;i++) h += '<span class="star' + (i<=n?' on':'') + '">' + (i<=n?'★':'☆') + '</span>';
    return h;
  }
  var mineQuery = '';
  /* ancla cabecera + (buscador/toggle) sticky y fija --group-top para que las
     cabeceras de fecha (.date-head) se peguen al hacer scroll (estilo iOS).
     Norma general: toda vista con separadores de fecha usa esto. */
  function pinHeads(viewId, extraEls){
    var v = $('#'+viewId); if(!v) return;
    var head = v.querySelector('.v2-head');
    var top = head ? head.offsetHeight : 0;
    v.style.setProperty('--head-top', top + 'px');
    (extraEls || []).forEach(function(el){ if(el && !el.hidden) top += el.offsetHeight; });
    v.style.setProperty('--group-top', top + 'px');
  }
  function renderMine(){
    var dancer = state.role && state.role.value === 'dancer';
    $('#mineTitle').textContent = dancer ? 'Mis bailes' : 'Mis sesiones';
    $('#mineSub').textContent = dancer
      ? 'Tus actuaciones grabadas; el vídeo te llega por WeTransfer.'
      : 'Tus grabaciones, evento a evento.';
    var q = norm(mineQuery);
    var box = $('#mineList');
    box.innerHTML = '';
    /* construye [{ts, date, html}] ya filtrado, luego ordena por fecha desc y
       agrupa con cabeceras de fecha (.date-head) entre tarjetas */
    var rows = [];
    if(dancer){
      MY_DANCES.forEach(function(d, i){
        var ev = EVENTS_BY_ID[d.eventId], cam = CAMS_BY_ID[d.camId], p = d.partner;
        var hay = norm([d.song, ev.name, ev.venue, d.date, cam.name, p.name].join(' '));
        if(q && hay.indexOf(q) === -1) return;
        var st = DANCE_STATUS[d.status];
        var r = myRatings[danceKey(d)];
        var rateTag = r
          ? '<span class="drate rated">' + starsRow(r.stars) + '</span>'
          : '<span class="st pend">Pendiente de valorar</span>';
        rows.push({ ts:parseMyDate(d.date), date:d.date,
          html:'<button class="dance dance-card" data-i="' + i + '">' +
            '<b>' + ev.name + '</b>' +                                  /* lugar (1) */
            '<span class="dinfo">' + d.song + '</span>' +              /* canción */
            '<span class="dinfo">Te grabó ' + cam.name + '</span>' +   /* quién grabó (2) */
            '<span class="d-tags">' +
              '<span class="st ' + st.cls + '">' + st.txt + '</span>' +
              rateTag +
            '</span></button>' });
      });
    } else {
      MY_SESSIONS.forEach(function(s){
        var ev = EVENTS_BY_ID[s.eventId];
        var hay = norm([ev.name, ev.venue, s.date].join(' '));
        if(q && hay.indexOf(q) === -1) return;
        var done = s.sent >= s.couples;
        rows.push({ ts:parseMyDate(s.date), date:s.date,
          html:'<div class="dance">' +
            '<b>' + ev.name + '</b>' +
            '<span class="dinfo">' + ev.venue + ' · grabaste a ' + s.couples + ' parejas</span>' +
            '<span class="st ' + (done ? 'ok' : 'mid') + '">' +
              (done ? 'Todo enviado · ' + s.sent + '/' + s.couples
                    : 'Enviados ' + s.sent + '/' + s.couples + ' · WeTransfer') + '</span></div>' });
      });
    }
    rows.sort(function(a, b){ return b.ts - a.ts; });   // más reciente primero
    if(!rows.length){
      box.innerHTML = '<p class="cal-empty">' + (mineQuery ? 'Sin resultados para «' + mineQuery + '».' : 'Todavía no hay nada por aquí.') + '</p>';
      return;
    }
    var lastDate = null, h = '';
    rows.forEach(function(r){
      if(r.date !== lastDate){ h += '<div class="date-head">' + r.date + '</div>'; lastDate = r.date; }
      h += r.html;
    });
    box.innerHTML = h;
    if(dancer){
      box.querySelectorAll('.dance-card').forEach(function(c){
        c.addEventListener('click', function(){ openDance(Number(c.dataset.i)); });
      });
    }
    setTimeout(function(){ pinHeads('viewMine', [$('#mineSearchBox')]); }, 60);
  }
  $('#mineSearch').addEventListener('input', function(){ mineQuery = this.value; renderMine(); });
  $('#mineBack').addEventListener('click', histBack);
  $('#mineHome').addEventListener('click', goHome);

  /* ── detalle de un baile: info + vincular pareja + valorar a la cámara ──── */
  var currentDance = null, dnStars = 0;
  function openDance(i){
    var d = MY_DANCES[i]; if(!d) return;
    currentDance = d;
    var r = myRatings[danceKey(d)];
    dnStars = r ? r.stars : 0;
    renderDance();
    goView('viewDance','ac-lime');
  }
  function renderDance(){
    var d = currentDance; if(!d) return;
    var ev = EVENTS_BY_ID[d.eventId], cam = CAMS_BY_ID[d.camId], p = d.partner;
    var st = DANCE_STATUS[d.status];
    $('#dnSong').textContent = d.song;
    $('#dnMeta').textContent = ev.name + ' · ' + d.date;
    var r = myRatings[danceKey(d)];
    var linkHtml;
    if(p.link === 'ok')           linkHtml = '<span class="lk ok">Pareja vinculada ✓ (' + p.name + ')</span>';
    else if(p.link === 'pending') linkHtml = '<span class="lk pend">Esperando confirmación de ' + p.name + '</span>';
    else                          linkHtml = '<button class="linkbtn" id="dnLink">Vincular pareja (' + p.name + ')</button>';
    $('#dnBody').innerHTML =
      '<div class="dn-info">' +
        '<span class="dinfo">Te grabó <b>' + cam.name + '</b></span>' +
        '<span class="dinfo">Bailaste con <b>' + p.name + '</b></span>' +
        '<span class="st ' + st.cls + '">' + st.txt + '</span>' +
        '<span class="linkrow">' + linkHtml + '</span>' +
      '</div>' +
      '<div class="rate-box">' +
        '<div class="pm-h">Valora a ' + cam.name + '</div>' +
        '<div class="star-pick" id="dnStarPick">' + starsRow(dnStars) + '</div>' +
        '<textarea id="dnText" class="rate-text" placeholder="Cuéntale qué tal (opcional)">' + (r && r.text ? r.text : '') + '</textarea>' +
        '<button class="multi-continue" id="dnSave">' + (r ? 'Actualizar valoración' : 'Guardar valoración') + '</button>' +
      '</div>';
    /* estrellas clicables */
    $('#dnStarPick').querySelectorAll('.star').forEach(function(s, idx){
      s.addEventListener('click', function(){ dnStars = idx + 1; $('#dnStarPick').innerHTML = starsRow(dnStars); bindDnStars(); });
    });
    var lk = $('#dnLink');
    if(lk) lk.addEventListener('click', function(){
      var row = lk.parentElement;
      row.innerHTML = '<span class="linkform"><input type="email" placeholder="correo de ' + p.name + '"><button class="linkbtn">Enviar</button></span>';
      row.querySelector('input').focus();
      row.querySelector('.linkbtn').addEventListener('click', function(){
        var val = row.querySelector('input').value.trim();
        if(!val || val.indexOf('@') === -1) return;
        p.email = val; p.link = 'pending'; renderDance();
      });
    });
    $('#dnSave').addEventListener('click', function(){
      if(!dnStars) return;
      myRatings[danceKey(d)] = { stars:dnStars, text:($('#dnText').value || '').trim() };
      save('cilap-myratings', myRatings);
      renderMine();
      goView('viewMine','ac-lime');
    });
  }
  function bindDnStars(){
    $('#dnStarPick').querySelectorAll('.star').forEach(function(s, idx){
      s.addEventListener('click', function(){ dnStars = idx + 1; $('#dnStarPick').innerHTML = starsRow(dnStars); bindDnStars(); });
    });
  }
  $('#dnBack').addEventListener('click', histBack);
  $('#dnHome').addEventListener('click', goHome);

  /* ── Mis eventos: eventos marcados (asistir / interés en grabar / con cámara) ── */
  var myEvPast = false;
  function resolveEv(id){ return EVENTS_BY_ID[id] || EVENTS_BY_ID[(id||'').split('@')[0]] || null; }
  /* fecha concreta de una intención: instancia (@ts) → su ts; semanal → próxima
     ocurrencia; puntual → su inicio */
  function intentTs(id, ev){
    if(id.indexOf('@') !== -1) return parseInt(id.split('@')[1], 10);   // parseInt: ignora el sufijo '#pase'
    if(ev.recurrence === 'weekly'){ var occ = weeklyOccs(ev, Date.now(), Date.now() + 60 * 86400000); return occ.length ? occ[0].start : Date.now(); }
    return ev.startsAt || Date.now();
  }
  function renderMyEvents(){
    var byEv = {};   // id de instancia (o base) -> {ev, id, ts, attend, wish, cams:[]}
    function bucket(id){
      var ev = resolveEv(id); if(!ev) return null;
      if(!byEv[id]) byEv[id] = { ev:ev, id:id, ts:intentTs(id, ev), attend:false, wish:false, cams:[] };
      return byEv[id];
    }
    Object.keys(attend).forEach(function(id){ if(attend[id]){ var b = bucket(id); if(b) b.attend = true; } });
    Object.keys(wishrec).forEach(function(id){ if(wishrec[id]){ var b = bucket(id); if(b) b.wish = true; } });
    Object.keys(interest).forEach(function(key){
      if(!interest[key]) return;
      var us = key.lastIndexOf('_'); if(us === -1) return;
      var evId = key.slice(0, us), camId = key.slice(us + 1);
      var b = bucket(evId); var cam = CAMS_BY_ID[camId];
      if(b && cam && b.cams.indexOf(cam.name) === -1) b.cams.push(cam.name);
    });
    var hoy = new Date(); hoy.setHours(0,0,0,0); var todayTs = hoy.getTime();
    var list = Object.keys(byEv).map(function(k){ return byEv[k]; });
    var hasPast = list.some(function(b){ return b.ts < todayTs; });
    if(!myEvPast) list = list.filter(function(b){ return b.ts >= todayTs; });
    list.sort(function(a, b){ return a.ts - b.ts; });   // próximos primero
    /* el toggle "Ver pasados" solo aparece si hay alguno */
    $('#myEvToggle').style.display = hasPast ? 'flex' : 'none';
    $('#myEvPastSw').classList.toggle('on', myEvPast);
    var box = $('#myEvList');
    /* EN DIRECTO: si estás apuntado a la cola de un camarógrafo AHORA MISMO,
       sale lo primero (aunque hayas salido del menú o cerrado la app) */
    var liveH = '';
    try{
      var lv = JSON.parse(localStorage.getItem('cilap-live')) || {};
      Object.keys(lv).forEach(function(evId){
        var sLive = lv[evId]; if(!sLive || !sLive.cam) return;
        var e = resolveEv(evId); if(!e || eventStatus(e) !== 'directo') return;
        var p = (sLive.prog || {})[sLive.cam] || {};
        if(p.myIdx == null) return;
        var leftQ = p.myIdx - (p.served || 0);
        var camL = CAMS_BY_ID[sLive.cam];
        liveH += '<div class="date-head now">Ahora · en directo</div>' +
          '<button class="dance dance-card" data-liveev="' + evId + '">' +
            '<b>' + e.name + '</b>' +
            '<span class="dinfo">En la cola de ' + (camL ? camL.name : 'un camarógrafo') +
              (leftQ < 0 ? ' · ya bailaste ✓' : leftQ === 0 ? ' · ¡te toca!' : ' · eres el #' + leftQ + ' · ~' + Math.max(1, Math.round(leftQ * 3.5)) + ' min') + '</span>' +
            '<span class="me-chips"><span class="me-chip attend">Estoy dentro</span></span>' +
          '</button>';
      });
    }catch(e2){}
    $('#myEvEmpty').style.display = (list.length || liveH) ? 'none' : 'flex';
    /* agrupado por fecha (cabeceras .date-head sticky), como Mis bailes */
    var lastKey = null, h = liveH;
    list.forEach(function(b){
      var ev = b.ev, d = new Date(b.ts);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if(key !== lastKey){ h += '<div class="date-head">' + dateHeaderLabel(b.ts) + '</div>'; lastKey = key; }
      var chips = '';
      if(b.attend) chips += '<span class="me-chip attend">Voy a asistir</span>';
      if(b.wish)   chips += '<span class="me-chip wish">Interesado en grabar</span>';
      b.cams.forEach(function(n){ chips += '<span class="me-chip cam">Grabar con ' + n + '</span>'; });
      h += '<button class="dance dance-card" data-ev="' + b.id + '">' +
        '<b>' + ev.name + '</b>' +
        '<span class="dinfo">' + ev.venue + ' · ' + (CITY_LABELS[ev.city] || ev.city) + '</span>' +
        '<span class="me-chips">' + chips + '</span></button>';
    });
    box.innerHTML = h;
    box.querySelectorAll('.dance-card').forEach(function(c){
      if(c.dataset.liveev){
        /* tarjeta "en directo": directo al modo Estoy dentro de ese evento */
        c.addEventListener('click', function(){
          var e = resolveEv(c.dataset.liveev);
          if(e && window.Live){ currentEvent = e; Live.open(e, state.role ? state.role.value : 'dancer'); }
        });
      } else {
        c.addEventListener('click', function(){ openEvent(resolveEv(c.dataset.ev)); });
      }
    });
    setTimeout(function(){ pinHeads('viewMyEvents', [$('#myEvToggle')]); }, 60);
  }
  $('#myEvPastSw').addEventListener('click', function(){ myEvPast = !myEvPast; renderMyEvents(); });
  $('#meBack').addEventListener('click', histBack);
  $('#meHome').addEventListener('click', goHome);

  /* ── restaurar la posición tras recargar (botón ⟳ o refresco) ──────────
     guardamos un snapshot de navegación al salir de la página y, al cargar,
     intentamos dejar al usuario donde estaba (o lo más cerca posible). */
  /* ── snapshot/restore para el historial del botón ← (en memoria) ──────── */
  var ALL_STEPS_H = ['stepA','stepP','stepB','stepC','stepD','result'];
  function currentViewId(){ return VIEW_IDS.filter(function(id){ return !$('#'+id).classList.contains('hidden'); })[0] || 'view1'; }
  function openStepNow(){ return ALL_STEPS_H.filter(function(id){ return $('#'+id).classList.contains('open'); })[0] || null; }
  function snapNav(){
    return {
      view: currentViewId(),
      country: state.country, prov: state.prov, city: state.city, type: state.type, subtype: state.subtype,
      evMode: evMode, horSala: horSala, horSub: horSub,
      calMonth: calMonth, calYear: calYear, calSub: calSub, calPast: calPast,
      step: openStepNow(), editing: editing, refMode: refMode,
      event: currentEvent, profile: currentProfile, dance: currentDance, mapDayIdx: mapDayIdx, mapScope: mapScope
    };
  }
  function pushHist(){ if(histLock) return; navStack.push(snapNav()); if(navStack.length > 60) navStack.shift(); }
  function applyNav(s){
    histLock = true;
    try{
      if(refMode) exitRefMode(false);            // si veníamos del picker de lugar, sal de ese modo
      state.country = s.country; state.prov = s.prov || null; state.city = s.city; state.type = s.type; state.subtype = s.subtype;
      evMode = s.evMode || 'prox'; horSala = s.horSala; horSub = s.horSub || 'horario';
      calMonth = s.calMonth; calYear = s.calYear; calSub = s.calSub || 'cal'; calPast = !!s.calPast;
      editing = null;
      renderPanel(); updateRoleIcons();
      var v = s.view;
      if(v === 'view1'){ goView('view1','ac-red'); return; }
      if(v === 'viewHub' || v === 'viewWhere' || v === 'viewCreate'){ goView(v, 'ac-red'); return; }
      if(v === 'viewCreateForm'){ goView('viewCreate','ac-red'); return; }   // el formulario no se restaura a medias
      if(v === 'viewCams'){ renderCamDir(); goView('viewCams','ac-amber'); return; }
      if(v === 'viewMine'){ renderMine(); goView('viewMine','ac-lime'); return; }
      if(v === 'viewMyEvents'){ renderMyEvents(); goView('viewMyEvents','ac-red'); return; }
      if(v === 'viewSettings'){ openSettings(); return; }
      if(v === 'viewDance' && s.dance){ currentDance = s.dance; renderDance(); goView('viewDance','ac-lime'); return; }
      if(v === 'viewMap'){ mapDays = mapBuildDays(); mapDayIdx = s.mapDayIdx || 0; mapSel = 0; mapScope = s.mapScope || 'region'; renderMap(); goView('viewMap','ac-blue'); return; }
      if(v === 'viewProfile' && s.profile){ openProfile(s.profile); return; }
      if(v === 'view3' && s.event){ openEvent(s.event); return; }
      if(v === 'viewLive' && s.event){ if(window.Live) Live.open(s.event, state.role ? state.role.value : 'dancer'); else openEvent(s.event); return; }
      if(v === 'viewEvCams' && s.event){ openEvent(s.event); renderEventCams(); goView('viewEvCams','ac-red'); return; }
      /* vista 2 (filtros / resultados) */
      goView('view2');
      if(s.editing){ editSlot(s.editing); }
      else {
        closeAll(); advance();
        if(s.step === 'result'){
          if(resultTimer){ clearTimeout(resultTimer); resultTimer = null; }
          $('#result').classList.add('done');
          if(evMode && evMode !== 'prox'){ setEvMode(evMode); if(evMode === 'horarios' && horSala) renderHorariosMode(); }
        }
      }
    } catch(e){ console.error('applyNav: snapshot irrecuperable, voy al hub', e); goView('viewHub','ac-red'); }
    finally { histLock = false; }
  }
  function histBack(){
    if(navStack.length){ applyNav(navStack.pop()); }
    else { goHome(); }                            // sin historial: a inicio (hub)
  }

  function captureNav(){
    try{
      var view = VIEW_IDS.filter(function(id){ return !$('#'+id).classList.contains('hidden'); })[0] || 'view1';
      sessionStorage.setItem('cilap-nav', JSON.stringify({
        role: state.role ? state.role.value : null,
        country: state.country, prov: state.prov, city: state.city, type: state.type, subtype: state.subtype,
        view: view, evMode: evMode,
        horSala: horSala, horSub: horSub,
        calMonth: calMonth, calYear: calYear, calSub: calSub, calPast: calPast,
        profileId: currentProfile ? currentProfile.id : null,
        eventId: (currentEvent && EVENTS_BY_ID[currentEvent.id]) ? currentEvent.id : null
      }));
    }catch(e){}
  }
  window.addEventListener('beforeunload', captureNav);
  window.addEventListener('pagehide', captureNav);

  function restoreNav(){
    var s; try{ s = JSON.parse(sessionStorage.getItem('cilap-nav')); }catch(e){}
    if(!s || !s.role) return;
    try{
      state.role = { value: s.role, label: ROLE_META[s.role] };
      state.country = s.country; state.prov = s.prov || null; state.city = s.city; state.type = s.type; state.subtype = s.subtype;
      renderPanel(); updateRoleIcons(); updateHub();
      var v = s.view;
      if(v === 'view1' || v === 'viewHub' || v === 'viewWhere' || v === 'viewCreate'){ goView('viewHub','ac-red'); return; }
      if(v === 'viewCams'){ renderCamDir(); goView('viewCams','ac-amber'); return; }
      if(v === 'viewMine' || v === 'viewDance'){ renderMine(); goView('viewMine','ac-lime'); return; }
      if(v === 'viewMyEvents'){ renderMyEvents(); goView('viewMyEvents','ac-red'); return; }
      if(v === 'viewSettings'){ openSettings(); return; }
      if(v === 'viewProfile' && s.profileId && CAMS_BY_ID[s.profileId]){ openProfile(CAMS_BY_ID[s.profileId]); return; }
      if((v === 'view3' || v === 'viewEvCams' || v === 'viewLive') && s.eventId && EVENTS_BY_ID[s.eventId]){
        openEvent(EVENTS_BY_ID[s.eventId]);
        if(v === 'viewEvCams'){ renderEventCams(); goView('viewEvCams','ac-red'); }
        return;
      }
      /* view2 (filtros / pestañas) */
      calMonth = s.calMonth; calYear = s.calYear; calSub = s.calSub || 'cal'; calPast = !!s.calPast;
      goView('view2'); advance();
      if(s.evMode && s.evMode !== 'prox'){
        setEvMode(s.evMode);
        if(s.evMode === 'horarios' && s.horSala){ horSala = s.horSala; horSub = s.horSub || 'horario'; renderHorariosMode(); }
      }
    }catch(e){ goView('viewHub','ac-red'); }
  }
  histLock = true; restoreNav(); histLock = false;   // la restauración inicial no entra en el historial
})();

