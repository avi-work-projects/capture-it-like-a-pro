
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
      openStep('result');
      resultTimer = setTimeout(function(){ r.classList.add('done'); }, 1400);
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

  /* ── transición genérica entre vistas ─────────────────────────────── */
  var VIEW_IDS = ['view1','viewHub','view2','viewCams','viewProfile','viewMine','view3'];
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
  VIEW_IDS.forEach(function(id){ addRubberBand($('#'+id)); });

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

  function renderResults(){
    var list = EVENTS.filter(function(ev){
      if(eventStatus(ev) === 'terminado') return false;   // el pasado no se busca
      if(!inFilter(state.country, ev.country)) return false;
      if(!inFilter(state.city, ev.city)) return false;
      if(!inFilter(state.type, ev.type)) return false;
      if(state.subtype && !inFilter(state.subtype, ev.sub)) return false;
      return true;
    });
    /* filtro opcional por día o rango de días */
    var fv = $('#dateFrom').value, tv = $('#dateTo').value;
    var from = fv ? new Date(fv + 'T00:00:00').getTime() : null;
    var to   = tv ? new Date(tv + 'T23:59:59').getTime() : null;
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
    /* el resto AGRUPADO POR FECHA (días sin eventos no aparecen) */
    var lastKey = null;
    rest.forEach(function(ev){
      var d = new Date(ev.startsAt);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if(key !== lastKey){ addHead(dateHeaderLabel(ev.startsAt)); lastKey = key; }
      addCard(ev);
    });
    $('#resCount').textContent = list.length === 1
      ? '1 evento encontrado' : list.length + ' eventos encontrados';
    $('#resEmpty').style.display = list.length ? 'none' : 'flex';
  }
  /* contenido interno de una tarjeta de evento (reutilizable) */
  function evtCardInner(ev){
    var n = camCountOf(ev);
    var foll = ev.camIds.filter(function(id){ return follows[id]; }).length;
    var multi = (ev.endsAt - ev.startsAt) > 86400000 * 1.1;   // ocupa varios días
    var when = multi ? (fmtDate(ev.startsAt) + ' – ' + fmtDate(ev.endsAt)) : evHours(ev);
    return '<div class="evt-head">' +
        '<span class="evt-name">' + ev.name + '</span>' +
        '<span class="evt-badges">' +
          (eventStatus(ev) === 'directo' ? '<span class="evt-live">Directo</span>' : '') +
          (foll ? '<span class="evt-follow" title="Camarógrafos que sigues">' + CAM_MINI_SVG + '×' + foll + '</span>' : '') +
          '<span class="evt-cams' + (n ? ' on' : '') + '">CAM ×' + n + '</span>' +
        '</span>' +
      '</div>' +
      '<span class="evt-meta">' + when + ' · ' + ev.venue + ' · ' + CITY_LABELS[ev.city] + '</span>';
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
  var evMode = 'prox', calYear = (new Date()).getFullYear(), calMonth = null, calSub = 'cal';
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
        onMonth: function(m){ calMonth = m; calSub = 'cal'; renderCalMode(); }
      });
    } else {
      Calendar.renderMonth(c, calYear, calMonth, eventsByFilter('oneoff', true), calSub, {
        onBack:  function(){ calMonth = null; renderCalMode(); },
        onSub:   function(s){ calSub = s; renderCalMode(); },
        onMonth: function(m, y){ calMonth = m; if(y != null) calYear = y; renderCalMode(); },
        onEvent: calEvent
      });
    }
  }
  function renderHorariosMode(){
    Calendar.renderHorarios($('#modeHorarios'), eventsByFilter('weekly', false), { onEvent: calEvent });
  }
  function setEvMode(mode){
    evMode = mode;
    document.querySelectorAll('#evModeTabs .fchip').forEach(function(t){ t.classList.toggle('on', t.dataset.mode === mode); });
    $('#modeProx').hidden     = mode !== 'prox';
    $('#modeCal').hidden      = mode !== 'cal';
    $('#modeHorarios').hidden = mode !== 'horarios';
    if(mode === 'prox')          renderResults();
    else if(mode === 'cal')      renderCalMode();
    else                         renderHorariosMode();
  }
  document.querySelectorAll('#evModeTabs .fchip').forEach(function(t){
    t.addEventListener('click', function(){ setEvMode(t.dataset.mode); });
  });

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
    a += '<button class="act' + (interest[key] ? ' done' : '') + '" data-act="interest" data-cam="' + c.id + '">' +
         (interest[key] ? '♥ Te interesa este evento ✓' : '♥ Me interesa grabar contigo') + '</button>';
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
    var cams = ev.camIds.map(function(id){ return CAMS_BY_ID[id]; });
    var youCard = joined[ev.id];
    var html = '';
    cams.forEach(function(c){
      /* misma tarjeta que el directorio (Seguir / Ver perfil) + subsección
         con la info de ESTE evento (llegada/salida, tasa, reserva) */
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
      : 'Aún no hay camarógrafos en este evento.';
    $('#camEmpty').style.display = total ? 'none' : 'flex';
    /* Seguir / Ver perfil (perfil vuelve aquí) */
    wireCamCards($('#camList'), renderEventDetail, function(){ renderEventDetail(); goView('view3','ac-red'); });
    /* acciones del bailarín por evento (interés / reserva / cola) */
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
          renderEventDetail();
        });
      });
    }
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
  }
  $('#hubBack').addEventListener('click', function(){ goView('view1','ac-red'); });
  $('#hubEvent').addEventListener('click', function(){
    goView('view2');
    advance();                       // retoma la búsqueda donde estuviera
  });
  $('#hubCams').addEventListener('click', function(){
    renderCamDir();
    goView('viewCams','ac-amber');
  });
  $('#hubMine').addEventListener('click', function(){
    renderMine();
    goView('viewMine','ac-lime');
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
    $('#profRevCount').textContent = '×' + c.reviews;
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
})();

