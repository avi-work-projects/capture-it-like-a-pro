
(function(){
  'use strict';
  var $ = function(s){ return document.querySelector(s); };
  var app = $('.app');

  var state = { role:null, country:null, city:null, type:null, subtype:null };
  var ROLE_META = { cam:'Camarógrafo', dancer:'Bailarín' };
  var ORDER = ['role','country','city','type','subtype'];   // orden lógico de los pasos
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
  var isPrivate = store('cilap-private', false);// cuenta privada: interacciones anónimas
  function fmtEur(x){ return x.toFixed(2).replace('.', ',') + ' €'; }
  function charge(x){
    saldo = Math.round((saldo - x) * 100) / 100;
    save('cilap-saldo', saldo);
    renderSaldo();
  }
  function renderSaldo(){
    $('#hubSaldo').innerHTML = 'Saldo <b>' + fmtEur(saldo) + '</b>';
  }
  var currentEvent = null;

  /* ── acento por pantalla ──────────────────────────────────────────── */
  var ACCENT_CLASSES = ['ac-red','ac-blue','ac-amber','ac-lime','ac-violet'];
  var ACCENTS = { view1:'ac-red', stepA:'ac-blue', stepB:'ac-amber',
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
    if(id === 'stepB' && state.country) filterOpts('stepB', state.country.value);
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
  var ALL_STEPS = ['stepA','stepB','stepC','stepD','result'];
  function closeAll(){
    ALL_STEPS.forEach(closeStep);
    if(resultTimer){ clearTimeout(resultTimer); resultTimer=null; }
    $('#result').classList.remove('done');
    if(setCritCollapsed) setCritCollapsed(false);     // al editar, criterios visibles
  }
  function closeFrom(key){
    var map = { country:['stepA','stepB','stepC','stepD','result'],
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
    if(!state.country){ openStep('stepA'); }
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
  /* rellena el filtro de fecha con los próximos 7 días si está vacío */
  var dateTouched = false;
  function defaultDateRange(){
    if(dateTouched || $('#dateFrom').value || $('#dateTo').value) return;
    var iso = function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
    var hoy = new Date(); var fin = new Date(); fin.setDate(fin.getDate() + 7);
    $('#dateFrom').value = iso(hoy);
    $('#dateTo').value   = iso(fin);
  }

  /* ── panel de selecciones (huecos predefinidos) ───────────────────── */
  function renderPanel(){
    var firstEmpty = null;
    ['role','country','city','type'].forEach(function(key){
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
    var isExt = state.type && state.type.value === 'exterior';
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
    var sum = ['country','city','type','subtype'].map(function(k){
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
  function editSlot(key){
    editing = key;
    closeAll();
    renderPanel();
    // el hueco en edición es el "activo" aunque esté relleno
    document.querySelectorAll('#panel .slot.now').forEach(function(s){ s.classList.remove('now'); });
    document.querySelector('.slot[data-key="'+key+'"]').classList.add('now');
    var map = { country:'stepA', city:'stepB', type:'stepC', subtype:'stepD' };
    openStep(map[key], state[key] && state[key].value);
  }
  document.querySelectorAll('.slot .se').forEach(function(btn){
    btn.addEventListener('click', function(){
      editSlot(btn.closest('.slot').dataset.key);
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
    else if(key === 'city'){      closeFrom('city');    openStep('stepB'); }
    else if(key === 'type'){      closeFrom('type');    openStep('stepC'); }
    else if(key === 'subtype'){   closeFrom('subtype'); openStep('stepD'); }
  }

  /* ── botón atrás: SUBIR un nivel de jerarquía desde el paso visible.
     No es un "volver a donde estabas": también en edición sube de nivel. */
  $('#navBack').addEventListener('click', function(){
    editing = null;
    var open = function(id){ return $('#'+id).classList.contains('open'); };
    if(open('result')){
      goBackTo((state.type && state.type.value === 'exterior') ? 'subtype' : 'type');
    }
    else if(open('stepD'))  goBackTo('type');
    else if(open('stepC'))  goBackTo('city');
    else if(open('stepB'))  goBackTo('country');
    else                    goView('viewHub','ac-red');   // padre del paso país = hub
  });

  /* ── botón home: al hub tras el rol (rol intacto, búsqueda limpia) ── */
  function goHome(){
    editing = null;
    ['country','city','type','subtype'].forEach(function(k){ state[k] = null; });
    closeAll();
    renderPanel();
    goView('viewHub','ac-red');
  }
  $('#homeBtn2').addEventListener('click', goHome);
  $('#homeBtn3').addEventListener('click', goHome);
  $('#homeBtnEC').addEventListener('click', goHome);

  /* ── transición genérica entre vistas ─────────────────────────────── */
  var VIEW_IDS = ['view1','viewHub','view2','viewSettings','viewCams','viewProfile','viewMine','view3','viewEvCams'];
  function goView(toId, accent){
    var to = $('#'+toId);
    if(accent) setAccent(accent);
    // oculta TODAS las vistas visibles que no sean el destino (las
    // transiciones solapadas podían dejar dos vistas a la vez)
    var froms = [];
    VIEW_IDS.forEach(function(id){
      var v = $('#'+id);
      if(v !== to && !v.classList.contains('hidden')) froms.push(v);
    });
    if(!froms.length) return;
    froms.forEach(function(f){ f.classList.remove('in'); f.classList.add('out'); });
    setTimeout(function(){
      froms.forEach(function(f){ f.classList.add('hidden'); f.classList.remove('out'); });
      to.classList.remove('hidden');
      void to.offsetHeight;
      to.classList.add('in');
    }, 240);
  }

  /* ── rebote elástico en los bordes del scroll (efecto goma táctil):
     arrastrar más allá del límite estira con resistencia creciente;
     mientras mantengas el dedo se queda; al soltar vuelve con muelle ── */
  function addRubberBand(el){
    var startY = 0, pull = 0, tracking = false;
    function release(){
      tracking = false;
      if(!pull) return;
      pull = 0;
      el.style.transition = 'transform .42s cubic-bezier(.2,.8,.3,1.18)';  // con sobreimpulso
      el.style.transform = '';
      setTimeout(function(){ el.style.transition = ''; }, 440);
    }
    el.addEventListener('touchstart', function(e){
      tracking = true;
      pull = 0;
      startY = e.touches[0].clientY;
    }, { passive:true });
    el.addEventListener('touchmove', function(e){
      if(!tracking) return;
      var dy = e.touches[0].clientY - startY;
      var atTop = el.scrollTop <= 0;
      var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if((dy > 0 && atTop) || (dy < 0 && atBottom)){
        pull = dy;
        // resistencia asintótica: nunca estira más de ~110px
        var damp = (dy < 0 ? -1 : 1) * 110 * (1 - 1 / (Math.abs(dy) / 300 + 1));
        el.style.transition = 'none';
        el.style.transform = 'translateY(' + damp.toFixed(1) + 'px)';
        e.preventDefault();               // sin scroll nativo mientras estiras
      } else if(pull){
        pull = 0;                         // volviste a zona de scroll normal
        el.style.transition = 'none';
        el.style.transform = '';
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
    var m = !$('#modeCal').hidden ? $('#modeCal')
          : (!$('#modeHorarios').hidden ? $('#modeHorarios') : null);
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
  document.querySelectorAll('#view1 .card').forEach(function(card){
    card.addEventListener('click', function(){
      var role = card.dataset.role;
      state.role = { value:role, label:ROLE_META[role] };
      try{ localStorage.setItem('cilap-role', role); }catch(e){}
      renderPanel();
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
        var single = vals.length === 1;
        state[key] = { value: single ? vals[0] : vals, label: labels.join(', '), multi: !single };
        editing = null;
        if(key === 'country') state.city = null;     // dependencias en cascada
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
        if(!esTodas && (e.target.closest('.mbox') || multiActivo)){   // multi-toggle
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
    if(prev && prev !== v) state.city = null;     // país nuevo → ciudad a reelegir
    renderPanel();
    advance();                                    // tipo y subtipo permanecen
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
      if(!inFilter(state.city, ev.city)) return false;
      if(!inFilter(state.type, ev.type)) return false;
      if(state.subtype && !inFilter(state.subtype, ev.sub)) return false;
      return true;
    }
    function instance(ev, s, e){ return Object.assign({}, ev, { id: ev.id + '@' + s, startsAt:s, endsAt:e, recurrence:'oneoff' }); }
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
  $('#dateFrom').addEventListener('change', function(){ dateTouched = true; renderResults(); });
  $('#dateTo').addEventListener('change', function(){ dateTouched = true; renderResults(); });
  $('#dateClear').addEventListener('click', function(){
    dateTouched = true;          // "ver todo": no volver a meter los 7 días
    $('#dateFrom').value = '';
    $('#dateTo').value = '';
    renderResults();
  });

  /* ── modos del resultado: Próximos · Calendario · Horarios salas ──────── */
  var evMode = 'prox', calYear = (new Date()).getFullYear(), calMonth = null, calSub = 'cal', calPast = false;
  function ymVal(y, m){ return y * 12 + m; }
  /* límites de navegación de meses: por defecto del mes actual hacia delante
     (hasta el último evento); con "Ver eventos pasados" se abre hacia atrás
     hasta el primer mes con evento */
  function calLimits(){
    var now = new Date(), cur = ymVal(now.getFullYear(), now.getMonth());
    var minV = cur, maxV = cur;
    eventsByFilter('oneoff', true).forEach(function(e){
      var d = new Date(e.startsAt), v = ymVal(d.getFullYear(), d.getMonth());
      if(v < minV) minV = v; if(v > maxV) maxV = v;
    });
    return { lower: calPast ? minV : cur, upper: Math.max(maxV, cur), cur: cur, evMin: minV };
  }
  function goCalMonth(delta){
    var lim = calLimits(), v = ymVal(calYear, calMonth) + delta;
    if(v < lim.lower || v > lim.upper) return;
    calYear = Math.floor(v / 12); calMonth = v % 12; renderCalMode();
  }
  function eventsByFilter(rec, withSub){
    return EVENTS.filter(function(ev){
      if(ev.recurrence !== rec) return false;
      if(!inFilter(state.country, ev.country)) return false;
      if(!inFilter(state.city, ev.city)) return false;
      if(!inFilter(state.type, ev.type)) return false;
      if(withSub && state.subtype && !inFilter(state.subtype, ev.sub)) return false;
      return true;
    });
  }
  function calEvent(id){ openEvent(EVENTS_BY_ID[id]); }
  function renderCalMode(){
    var c = $('#modeCal');
    if(calMonth == null){
      Calendar.renderYear(c, calYear, eventsByFilter('oneoff', true), {
        onYear:  function(y){ calYear = y; renderCalMode(); },
        onMonth: function(m){ calMonth = m; calSub = 'agenda'; renderCalMode(); }   // al abrir un mes → Agenda primero
      });
    } else {
      var lim = calLimits(), v = ymVal(calYear, calMonth);
      var nav = { canPrev: v > lim.lower, canNext: v < lim.upper, past: calPast };
      Calendar.renderMonth(c, calYear, calMonth, eventsByFilter('oneoff', true), calSub, nav, {
        onBack:  function(){ calMonth = null; renderCalMode(); },
        onSub:   function(s){ calSub = s; renderCalMode(); },
        onStep:  function(d){ goCalMonth(d); },
        onEvent: calEvent,
        onTogglePast: function(){
          calPast = !calPast;
          if(!calPast){   // al apagar, si estabas en un mes pasado, vuelve al actual
            var l = calLimits();
            if(ymVal(calYear, calMonth) < l.lower){ var n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); }
          }
          renderCalMode();
        }
      });
    }
    scheduleRelayout();   // fija año+switch, nav de mes y sub-pestañas
  }
  var horSala = null, horSub = 'horario';   // sala seleccionada + pestaña (horario/proximos)
  function renderHorariosMode(){
    Calendar.renderHorarios($('#modeHorarios'), eventsByFilter('weekly', false), horSala, horSub, {
      onSala:  function(id){ horSala = id; horSub = 'horario'; renderHorariosMode(); },
      onBack:  function(){ horSala = null; renderHorariosMode(); },
      onSub:   function(s){ horSub = s; renderHorariosMode(); },
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
    evMode = mode;
    document.querySelectorAll('#evModeTabs .fchip').forEach(function(t){ t.classList.toggle('on', t.dataset.mode === mode); });
    $('#modeProx').hidden     = mode !== 'prox';
    $('#modeCal').hidden      = mode !== 'cal';
    $('#modeHorarios').hidden = mode !== 'horarios';
    if(mode === 'prox')          renderResults();
    else if(mode === 'cal')    { if(calMonth == null){ var nd = new Date(); calMonth = nd.getMonth(); calYear = nd.getFullYear(); } renderCalMode(); }   // abre en el mes en curso
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
      } else if(v2.scrollTop <= 2 && !locked()){
        collapse(false);                                          // subir antes de 0,5 s → despliega solo
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

  /* swipe horizontal en el calendario para cambiar de mes (solo en vista mes) */
  (function(){
    var mc = $('#modeCal'), sx = 0, sy = 0;
    mc.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    mc.addEventListener('touchend', function(e){
      if(calMonth == null) return;                 // solo en vista de mes
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6){
        goCalMonth(dx < 0 ? 1 : -1);   // ← siguiente / → anterior (respeta límites)
      }
    }, { passive:true });
  })();

  /* swipe horizontal para cambiar de pestaña (Próximos/Calendario/Horarios),
     SALVO en Calendario con un mes abierto (ahí el swipe cambia de mes) */
  (function(){
    var r = $('#result'), sx = 0, sy = 0, ORDER = ['prox','cal','horarios'];
    r.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    r.addEventListener('touchend', function(e){
      if(evMode === 'cal' && calMonth != null) return;   // ahí manda el swipe de meses
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if(!(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6)) return;
      var dir = dx < 0 ? 1 : -1;
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
    $('#evName').textContent = ev.name;
    $('#evMeta').textContent = fmtDate(ev.startsAt) + ' · ' + evHours(ev) + ' · ' + ev.venue;
    $('#evTags').innerHTML =
      (st === 'directo'   ? '<span class="tag2 hl">● En directo</span>' : '') +
      (st === 'terminado' ? '<span class="tag2">Terminado</span>' : '') +
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
  $('#ecBack').addEventListener('click', function(){ goView('view3','ac-red'); });

  function openEvent(ev){
    currentEvent = ev;
    camSelEv = null;
    renderEventDetail();
    goView('view3', 'ac-red');
  }

  $('#backToEvents').addEventListener('click', function(){
    if($('#result').classList.contains('open')) renderResults();  // refresca CAM ×n
    goView('view2', 'ac-red');
  });

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
  function updateHub(){
    var dancer = state.role && state.role.value === 'dancer';
    $('#hubSub').textContent = dancer ? 'Entraste como bailarín.' : 'Entraste como camarógrafo.';
    $('#hubMineName').textContent = dancer ? 'Mis bailes' : 'Mis sesiones';
    $('#hubMineSub').textContent = dancer ? 'Quién te grabó y qué' : 'Lo que has grabado';
    renderSaldo();
    $('#hubSaldo').classList.toggle('show', dancer);   // el saldo es cosa del bailarín
    refreshRefUI();
  }
  /* refleja la config de país/ciudad: botón "Eventos en mi ciudad"
     bloqueado y aviso en el engranaje mientras no se haya rellenado */
  function refreshRefUI(){
    var ok = hasRef();
    $('#hubMyCity').classList.toggle('locked', !ok);
    $('#hubMyCity').disabled = !ok;
    $('#hubMyCitySub').textContent = ok ? refLabel() : 'Configúralo en ⚙ para activarlo';
    $('#settingsBadge').hidden = ok;
  }
  function refLabel(){
    if(ref.cities.length) return ref.cities.map(function(c){ return CITY_LABELS[c]; }).join(', ');
    return 'Tu país y ciudad de referencia';
  }
  $('#hubBack').addEventListener('click', function(){ goView('view1','ac-red'); });
  $('#hubEvent').addEventListener('click', function(){
    goView('view2');
    advance();                       // retoma la búsqueda donde estuviera
  });
  /* "Eventos en mi ciudad": filtros con país y ciudad ya fijados a la
     referencia guardada; solo queda elegir el Tipo */
  $('#hubMyCity').addEventListener('click', function(){
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
    state.city    = pack(cities, function(c){ return CITY_LABELS[c]; });
    state.type = null; state.subtype = null;   // el tipo se elige ahora
    editing = null;
    closeAll();
    renderPanel();
    goView('view2');
    advance();                       // país+ciudad puestos → abre directamente "Tipo"
  });
  $('#hubCams').addEventListener('click', function(){
    renderCamDir();
    goView('viewCams','ac-amber');
  });
  $('#hubMine').addEventListener('click', function(){
    renderMine();
    goView('viewMine','ac-lime');
  });

  /* ── configuración: país y ciudad de referencia (⚙) ──────────────────── */
  var setCountries = [], setCities = [];   // selección temporal hasta "Guardar"
  function renderSettings(){
    document.querySelectorAll('#setCountries .po').forEach(function(o){
      o.classList.toggle('multi-on', setCountries.indexOf(o.dataset.c) !== -1);
    });
    var cities = setCountries.length
      ? setCountries.reduce(function(acc, k){ return acc.concat(k === 'es' ? ['mad','sev','bcn'] : ['waw','kra']); }, [])
      : ['mad','sev','bcn','waw','kra'];
    $('#setCities').innerHTML = cities.map(function(c){
      return '<button class="opt po" data-city="' + c + '"><span class="lbl"><b>' + CITY_LABELS[c] + '</b></span><span class="mbox"></span></button>';
    }).join('');
    document.querySelectorAll('#setCities .po').forEach(function(o){
      o.classList.toggle('multi-on', setCities.indexOf(o.dataset.city) !== -1);
    });
    document.querySelectorAll('#setPrivacy .privacy-opt').forEach(function(o){
      o.classList.toggle('multi-on', (o.dataset.priv === 'private') === setPrivate);
    });
  }
  var setPrivate = false;
  $('#hubSettings').addEventListener('click', function(){
    setCountries = ref.countries.slice();
    setCities    = ref.cities.slice();
    setPrivate   = !!isPrivate;
    renderSettings();
    goView('viewSettings','ac-violet');
  });
  $('#setPrivacy').addEventListener('click', function(e){
    var o = e.target.closest('.privacy-opt'); if(!o) return;
    setPrivate = (o.dataset.priv === 'private');
    renderSettings();
  });
  $('#setBack').addEventListener('click', function(){ goView('viewHub','ac-red'); });
  $('#setCountries').addEventListener('click', function(e){
    var o = e.target.closest('.po'); if(!o) return;
    var k = o.dataset.c, i = setCountries.indexOf(k);
    if(i === -1) setCountries.push(k); else setCountries.splice(i, 1);
    setCities = setCities.filter(function(c){ return !setCountries.length || setCountries.indexOf(CITY_COUNTRY[c]) !== -1; });
    renderSettings();
  });
  $('#setCities').addEventListener('click', function(e){
    var o = e.target.closest('.po'); if(!o) return;
    var c = o.dataset.city, i = setCities.indexOf(c);
    if(i === -1) setCities.push(c); else setCities.splice(i, 1);
    renderSettings();
  });
  $('#setSave').addEventListener('click', function(){
    // ciudad sin país marcado: deriva el país para mantener coherencia
    ref.cities = setCities.slice();
    ref.countries = setCountries.length
      ? setCountries.slice()
      : ref.cities.map(function(c){ return CITY_COUNTRY[c]; }).filter(function(k, i, a){ return a.indexOf(k) === i; });
    save('cilap-ref', ref);
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
  var CITY_COUNTRY = { mad:'es', sev:'es', bcn:'es', waw:'pl', kra:'pl' };
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
  $('#placeBtn').addEventListener('click', function(){
    var m = $('#placeMenu');
    m.hidden = !m.hidden;
    if(!m.hidden) renderPlaceMenu();
  });
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
  $('#camsBack').addEventListener('click', function(){ goView('viewHub','ac-red'); });
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
    $('#profName').textContent = c.name;
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
  $('#profBack').addEventListener('click', function(){ profileBack(); });
  $('#profHome').addEventListener('click', goHome);

  /* ── mis bailes (bailarín) / mis sesiones (camarógrafo) ───────────── */
  var DANCE_STATUS = {
    recibido:  { txt:'Recibido ✓',           cls:'ok'  },
    enviado:   { txt:'Enviado · WeTransfer', cls:'mid' },
    pendiente: { txt:'Pendiente de envío',   cls:''    }
  };
  function renderMine(){
    var dancer = state.role && state.role.value === 'dancer';
    $('#mineTitle').textContent = dancer ? 'Mis bailes' : 'Mis sesiones';
    $('#mineSub').textContent = dancer
      ? 'Tus actuaciones grabadas; el vídeo te llega por WeTransfer.'
      : 'Tus grabaciones, evento a evento.';
    var box = $('#mineList');
    box.innerHTML = '';
    if(dancer){
      MY_DANCES.forEach(function(d, i){
        var ev = EVENTS_BY_ID[d.eventId], cam = CAMS_BY_ID[d.camId];
        var st = DANCE_STATUS[d.status];
        var p = d.partner;
        var linkHtml;
        if(p.link === 'ok')           linkHtml = '<span class="lk ok">Pareja vinculada ✓</span>';
        else if(p.link === 'pending') linkHtml = '<span class="lk pend">Esperando confirmación de ' + p.name + '</span>';
        else                          linkHtml = '<button class="linkbtn" data-link="' + i + '">Vincular pareja</button>';
        var el = document.createElement('div');
        el.className = 'dance';
        el.innerHTML =
          '<b>' + d.song + '</b>' +
          '<span class="dmeta">' + ev.name + ' · ' + d.date + '</span>' +
          '<span class="dinfo">Te grabó ' + cam.name + ' · bailaste con ' + p.name + '</span>' +
          '<span class="linkrow">' + linkHtml + '</span>' +
          '<span class="st ' + st.cls + '">' + st.txt + '</span>';
        box.appendChild(el);
      });
      /* vincular pareja: basta su correo; queda pendiente de que ELLA confirme
         el baile (la verificación real se construirá más adelante) */
      box.querySelectorAll('[data-link]').forEach(function(lb){
        lb.addEventListener('click', function(){
          var d = MY_DANCES[Number(lb.dataset.link)];
          var row = lb.parentElement;
          row.innerHTML =
            '<span class="linkform">' +
            '<input type="email" placeholder="correo de ' + d.partner.name + '">' +
            '<button class="linkbtn">Enviar</button></span>';
          row.querySelector('input').focus();
          row.querySelector('.linkbtn').addEventListener('click', function(){
            var val = row.querySelector('input').value.trim();
            if(!val || val.indexOf('@') === -1) return;
            d.partner.email = val;
            d.partner.link = 'pending';
            renderMine();
          });
        });
      });
    } else {
      MY_SESSIONS.forEach(function(s){
        var ev = EVENTS_BY_ID[s.eventId];
        var done = s.sent >= s.couples;
        var el = document.createElement('div');
        el.className = 'dance';
        el.innerHTML =
          '<b>' + ev.name + '</b>' +
          '<span class="dmeta">' + ev.venue + ' · ' + s.date + '</span>' +
          '<span class="dinfo">Grabaste a ' + s.couples + ' parejas</span>' +
          '<span class="st ' + (done ? 'ok' : 'mid') + '">' +
            (done ? 'Todo enviado · ' + s.sent + '/' + s.couples
                  : 'Enviados ' + s.sent + '/' + s.couples + ' · WeTransfer') + '</span>';
        box.appendChild(el);
      });
    }
  }
  $('#mineBack').addEventListener('click', function(){ goView('viewHub','ac-red'); });
  $('#mineHome').addEventListener('click', goHome);

  /* ── restaurar la posición tras recargar (botón ⟳ o refresco) ──────────
     guardamos un snapshot de navegación al salir de la página y, al cargar,
     intentamos dejar al usuario donde estaba (o lo más cerca posible). */
  function captureNav(){
    try{
      var view = VIEW_IDS.filter(function(id){ return !$('#'+id).classList.contains('hidden'); })[0] || 'view1';
      sessionStorage.setItem('cilap-nav', JSON.stringify({
        role: state.role ? state.role.value : null,
        country: state.country, city: state.city, type: state.type, subtype: state.subtype,
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
      state.country = s.country; state.city = s.city; state.type = s.type; state.subtype = s.subtype;
      renderPanel(); updateHub();
      var v = s.view;
      if(v === 'view1' || v === 'viewHub'){ goView('viewHub','ac-red'); return; }
      if(v === 'viewCams'){ renderCamDir(); goView('viewCams','ac-amber'); return; }
      if(v === 'viewMine'){ renderMine(); goView('viewMine','ac-lime'); return; }
      if(v === 'viewSettings'){ $('#hubSettings').click(); return; }
      if(v === 'viewProfile' && s.profileId && CAMS_BY_ID[s.profileId]){ openProfile(CAMS_BY_ID[s.profileId]); return; }
      if((v === 'view3' || v === 'viewEvCams') && s.eventId && EVENTS_BY_ID[s.eventId]){
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
  restoreNav();
})();

