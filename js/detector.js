/* ══════════════════════════════════════════════════════════════════════════
   DETECTOR DE CANCIONES — window.Detector
   Port del motor de bachata-detector (proyecto hermano) al formato de la app:
   clase desacoplada del DOM (callbacks), SOLO modo micrófono + AudD.

   Estrategia (la "time-window" probada en el original):
   1. Graba un clip de 12 s del micro y lo manda a api.audd.io (fingerprint).
   2. Con título + duración (Spotify/Apple) + timecode se calcula cuándo
      EMPEZÓ la canción y cuánto le queda.
   3. Se programan comprobaciones: validación a los 8 s, mid-check en canciones
      largas y end-check al fin previsto (+3 s). Si AudD dice que sigue la
      misma, se recalibra el timing (drift) y se reintenta.
   4. Un cambio de canción se confirma al instante si llega en la ventana de
      fin esperada; si es inesperado, pasa por fase de candidato (25 s; 90 s si
      parece un mix/recopilatorio) para no dispararse con falsos matches.

   La API key vive en localStorage 'audd_key' (la MISMA clave que usa el
   proyecto original: si ya la pegaste allí, aquí funciona directamente).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var CLIP_SEC = 12;

/* ── helpers de identificación ── */
function parseTimecode(tc){
  if(!tc) return 0;
  var p = tc.split(':').map(Number);
  if(p.length === 2) return p[0] * 60 + p[1];
  if(p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return 0;
}
function normalizeTitle(s){
  if(!s) return '';
  return s.toLowerCase()
    .replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s-\s.*$/g, '')
    .replace(/\b(remix|mix|version|bachata version|extended|edit|radio edit)\b/g, '')
    .replace(/[^\w\sáéíóúüñ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeArtist(s){
  if(!s) return '';
  return s.toLowerCase()
    .replace(/\bfeat\..*/g, '').replace(/\bft\..*/g, '').replace(/\bfeaturing.*/g, '')
    .replace(/[^\w\sáéíóúüñ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function songIdOf(r){ return normalizeArtist(r.artist) + '::' + normalizeTitle(r.title); }
function durationOf(r){
  var ms = (r.spotify && r.spotify.duration_ms) ||
           (r.apple_music && (r.apple_music.duration_in_millis || r.apple_music.duration_ms));
  return ms ? ms / 1000 : 210;   // sin dato: 3:30, media de una bachata
}
/* heurística de recopilatorios: canciones >6 min o títulos tipo "Mix 2025" */
var MIX_TITLE = [/\bmix\b/i, /\bcompilation\b/i, /\bgreatest\s+hits\b/i, /\bsolo\s+éxitos\b/i];
function looksLikeCompilation(r){
  if(!r) return false;
  var dur = ((r.spotify && r.spotify.duration_ms) ||
             (r.apple_music && (r.apple_music.duration_in_millis || r.apple_music.duration_ms)) || 0) / 1000;
  if(dur > 360) return true;
  var t = (r.title || '').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
  return MIX_TITLE.some(function(re){ return re.test(t); });
}

/* graba `seconds` del stream con medición de RMS máximo (clips silenciosos
   se saltan la llamada a la API: ahorra cuota y errores de fingerprint) */
function recordMicClip(stream, seconds, analyser){
  return new Promise(function(resolve, reject){
    var rec;
    try{ rec = new MediaRecorder(stream); }
    catch(e){ return reject(e); }
    var chunks = [], maxRMS = 0, rafId = null;
    if(analyser){
      var buf = new Float32Array(analyser.fftSize);
      var sample = function(){
        analyser.getFloatTimeDomainData(buf);
        var s = 0;
        for(var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        var rms = Math.sqrt(s / buf.length);
        if(rms > maxRMS) maxRMS = rms;
        rafId = requestAnimationFrame(sample);
      };
      sample();
    }
    rec.ondataavailable = function(e){ if(e.data.size) chunks.push(e.data); };
    rec.onstop = function(){
      if(rafId) cancelAnimationFrame(rafId);
      var blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
      blob._maxRMS = maxRMS;
      resolve(blob);
    };
    rec.onerror = function(e){ if(rafId) cancelAnimationFrame(rafId); reject(e.error || new Error('MediaRecorder error')); };
    rec.start();
    setTimeout(function(){ try{ rec.stop(); }catch(_e){} }, seconds * 1000);
  });
}

function callAuddApi(blob, apiKey){
  var fd = new FormData();
  fd.append('file', blob, 'clip.webm');
  fd.append('api_token', apiKey);
  fd.append('return', 'spotify,apple_music,timecode');
  return fetch('https://api.audd.io/', { method:'POST', body: fd }).then(function(res){
    if(!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    return res.json();
  }).then(function(json){
    if(json.status === 'error') throw new Error((json.error && json.error.error_message) || 'API error');
    return json.result;   // null si no identificada
  });
}

/* ── el identificador ──────────────────────────────────────────────────── */
/* opts: { onLog(text), onStatus(text, cls), onSong(song, isFirst),
           onChange(song), onUpdate() } — todos opcionales */
function Identifier(apiKey, opts){
  this.apiKey = apiKey;
  this.o = opts || {};
  this.micStream = null;
  this.audioCtx = null;
  this.analyser = null;
  this.currentSong = null;   // { id,title,artist,duration,startedAtSec,identifiedAtSec }
  this.candidate = null;
  this.identifiedSongs = [];
  this.running = false;
  this.songCount = 0;
  this.consecutiveFails = 0;
  this.lastFailReason = null;
  this.justChangedAt = null;
  this.checkCount = 0;
  this.endRetries = 0;
  this.endBufferSec = 3;
  this._timers = [];
  this._wakeLock = null;
}
Identifier.prototype = {
  log: function(t){ if(this.o.onLog) this.o.onLog(t); },
  status: function(t, c){ if(this.o.onStatus) this.o.onStatus(t, c || ''); },
  nowSec: function(){ return performance.now() / 1000; },

  start: function(){
    var self = this;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      return Promise.reject(new Error('Este navegador no da acceso al micrófono'));
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    }).then(function(stream){
      self.micStream = stream;
      self.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      self.analyser = self.audioCtx.createAnalyser();
      self.analyser.fftSize = 2048;
      self.audioCtx.createMediaStreamSource(stream).connect(self.analyser);
      self.running = true;
      if('wakeLock' in navigator){
        navigator.wakeLock.request('screen').then(function(wl){ self._wakeLock = wl; }).catch(function(){});
      }
      self.log('🎙 Micrófono activo — primera identificación…');
      return self.checkSong();
    });
  },

  stop: function(){
    this.running = false;
    this._timers.forEach(clearTimeout);
    this._timers = [];
    if(this.micStream) this.micStream.getTracks().forEach(function(t){ t.stop(); });
    this.micStream = null;
    if(this.audioCtx){ try{ this.audioCtx.close(); }catch(_e){} }
    this.audioCtx = null; this.analyser = null;
    if(this._wakeLock){ try{ this._wakeLock.release(); }catch(_e){} this._wakeLock = null; }
    this.status('Parado', '');
  },

  _after: function(seconds, fn){
    var self = this;
    var id = setTimeout(function(){ if(self.running) fn(); }, seconds * 1000);
    this._timers.push(id);
    return id;
  },
  _clearTimers: function(){ this._timers.forEach(clearTimeout); this._timers = []; },

  isInEndWindow: function(){
    if(!this.currentSong) return false;
    return (this.nowSec() - this.currentSong.startedAtSec) >= this.currentSong.duration - 6;
  },

  scheduleNext: function(seconds){
    var self = this;
    if(!this.running) return;
    this._after(seconds, function(){ self.checkSong(); });
  },

  /* validación a 8 s del primer match + mid-check en canciones largas +
     end-check al fin previsto (+buffer) */
  scheduleAfterIdentification: function(remaining){
    var self = this;
    this._clearTimers();
    if(remaining <= 0){ this.scheduleNext(2); return; }
    var shouldValidate = !this._validatedOnce && remaining > 25;
    if(shouldValidate){
      this._validatedOnce = true;
      this._after(8, function(){ self.log('🔁 Validación rápida (2ª comprobación)'); self.checkSong(); });
    } else if(remaining > 60){
      var midDelay = Math.min(remaining / 2, 60);
      this._after(midDelay, function(){ self.log('🔍 Mid-check (revalidando a mitad)'); self.checkSong(); });
    }
    this._after(remaining + this.endBufferSec, function(){
      self.endRetries = 0;
      self.log('⏰ End-check (fin previsto + ' + self.endBufferSec + 's)');
      self.checkSong();
    });
  },

  checkSong: function(){
    var self = this;
    if(!this.running) return Promise.resolve();
    this.checkCount++;
    this.status('Identificando #' + this.checkCount + '…', 'busy');
    var sampleStartedAt = this.nowSec();
    this.log('🎙 Grabando ' + CLIP_SEC + 's…');
    return recordMicClip(this.micStream, CLIP_SEC, this.analyser).then(function(blob){
      if(typeof blob._maxRMS === 'number' && blob._maxRMS < 0.005){
        self.log('⏭ Clip silencioso (RMS ' + blob._maxRMS.toFixed(3) + ') — sin gastar llamada');
        self.status('Mic silencioso', '');
        self.consecutiveFails++;
        self.lastFailReason = 'silent-clip';
        if(self.o.onUpdate) self.o.onUpdate();
        self.scheduleNext(15);
        return;
      }
      return callAuddApi(blob, self.apiKey).then(function(result){
        self.handleResult(result, sampleStartedAt);
      });
    }).catch(function(e){
      self.log('⚠️ Error: ' + e.message);
      self.status('Error', 'error');
      self.consecutiveFails++;
      self.lastFailReason = 'api-error';
      if(self.o.onUpdate) self.o.onUpdate();
      self.scheduleNext(20);
    });
  },

  handleResult: function(result, sampleStartedAt){
    var refTime = sampleStartedAt != null ? sampleStartedAt : this.nowSec();
    this._refTime = refTime;
    if(!result){
      this.log('🤷 AudD: canción no identificada');
      this.status('Sin match', '');
      this.consecutiveFails++;
      this.lastFailReason = 'no-match';
      if(this.o.onUpdate) this.o.onUpdate();
      this.scheduleNext(20);
      return;
    }
    this.consecutiveFails = 0;
    var id = songIdOf(result), dur = durationOf(result), tc = parseTimecode(result.timecode);
    var looksMix = looksLikeCompilation(result);

    /* CASO 1: sigue la misma canción */
    if(this.currentSong && this.currentSong.id === id){
      if(this.candidate){ this.log('✗ Falso candidato descartado'); this.candidate = null; }
      var remaining = dur - tc;
      if(this.isInEndWindow()){
        this.endRetries++;
        if(this.endRetries > 6){ this.scheduleAfterIdentification(remaining); return; }
        var nextDelay = remaining > 5 ? remaining + this.endBufferSec : 4;
        this.log('⏱ Canción extendida (quedan ' + remaining.toFixed(0) + 's) — re-check en ' + nextDelay.toFixed(0) + 's');
        this.status('Re-check +' + nextDelay.toFixed(0) + 's', 'busy');
        var self1 = this;
        this._after(nextDelay, function(){ self1.checkSong(); });
        return;
      }
      /* recalibrar el inicio con el timecode fresco (AudD confunde estribillos) */
      var TC_OFFSET = Math.max(2, CLIP_SEC - 1.8);
      var newStart = refTime + TC_OFFSET - tc;
      if(Math.abs(newStart - this.currentSong.startedAtSec) > 3){
        this.log('⚠️ Recalibrando timing (drift ' + (newStart - this.currentSong.startedAtSec).toFixed(1) + 's)');
        this.currentSong.startedAtSec = newStart;
      }
      this.log('✓ Sigue: "' + result.title + '"');
      this.status('Sigue ' + (result.title || '').substring(0, 18) + '…', 'ok');
      this.scheduleAfterIdentification(remaining);
      return;
    }

    /* CASO 2: primera identificación de la sesión */
    if(!this.currentSong){
      if(looksMix){
        this.candidate = { id:id, result:result, dur:dur, tc:tc, firstSeenAt:refTime, looksMix:true };
        this.log('⏳ Primer match parece mix: "' + result.title + '" — esperando confirmación');
        this.status('Candidato (¿mix?)…', 'busy');
        this.scheduleNext(15);
      } else {
        this.confirmNewSong(result, id, dur, tc, true);
      }
      return;
    }

    /* CASO 3: coincide con el candidato en curso */
    if(this.candidate && this.candidate.id === id){
      var persisted = this.nowSec() - this.candidate.firstSeenAt;
      var reqSec = this.candidate.looksMix ? 90 : 25;
      if(persisted >= reqSec){
        this.log('✅ Confirmado tras ' + persisted.toFixed(0) + 's: "' + result.title + '"');
        this.confirmNewSong(result, id, dur, tc, false);
        this.candidate = null;
      } else {
        this.log('⏳ Confirmando "' + result.title + '" (' + persisted.toFixed(0) + 's/' + reqSec + 's)');
        this.status('Confirmando ' + persisted.toFixed(0) + 's/' + reqSec + 's', 'busy');
        this.scheduleNext(15);
      }
      return;
    }

    /* CASO 4: candidato nuevo. En ventana de fin esperada → cambio inmediato */
    if(this.isInEndWindow() && !looksMix){
      this.log('⚡ Cambio en ventana de fin esperada → confirmado');
      this.confirmNewSong(result, id, dur, tc, false);
      this.candidate = null;
      return;
    }
    this.candidate = { id:id, result:result, dur:dur, tc:tc, firstSeenAt:refTime, looksMix:looksMix };
    this.log('🟡 Posible cambio a "' + result.title + '"' + (looksMix ? ' (¿mix?)' : '') + ' — confirmando…');
    this.status('Candidato…', 'busy');
    this.scheduleNext(15);
  },

  confirmNewSong: function(result, id, dur, tc, isFirst){
    if(this.currentSong) this.identifiedSongs.push(this.currentSong);
    var refTime = this._refTime != null ? this._refTime : this.nowSec();
    /* el timecode de AudD apunta ~1.8 s antes del final del clip grabado */
    var TC_OFFSET = Math.max(2, CLIP_SEC - 1.8);
    var songStart = refTime + TC_OFFSET - tc;
    this.currentSong = {
      id:id, title:result.title, artist:result.artist, album:result.album,
      duration:dur, startedAtSec:songStart, identifiedAtSec:refTime
    };
    this.justChangedAt = this.nowSec();
    this._validatedOnce = false;
    this.songCount = isFirst ? 1 : this.songCount + 1;
    this.log((isFirst ? '🎵' : '🔄 ¡CAMBIO!') + ' #' + this.songCount + ': "' + result.title + '" — ' + result.artist);
    this.status('OK — #' + this.songCount, 'ok');
    if(this.o.onSong) this.o.onSong(this.currentSong, isFirst);
    if(!isFirst && this.o.onChange) this.o.onChange(this.currentSong);
    this.endRetries = 0;
    this.scheduleAfterIdentification(dur - tc);
  }
};

window.Detector = {
  create: function(apiKey, opts){ return new Identifier(apiKey, opts); },
  getKey: function(){ try{ return localStorage.getItem('audd_key') || ''; }catch(e){ return ''; } },
  setKey: function(k){ try{ localStorage.setItem('audd_key', (k || '').trim()); }catch(e){} }
};
})();
