/* ============================================================
   audio.js  --  WebAudio による効果音シンセ（外部ファイル不要）
   爽快感の8割は音。コンボに応じて音階が上がっていくのが肝。
   ============================================================ */
(function (global) {
  'use strict';

  // ペンタトニック（響きが濁らないので連打しても気持ちいい）
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;

  function now() { return ctx ? ctx.currentTime : 0; }

  function init() {
    if (ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    // ガラス破砕用のホワイトノイズ
    var len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function ready() {
    if (!ctx) init();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return !muted;
  }

  // 単音
  function tone(opt) {
    if (!ready()) return;
    var t = now() + (opt.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.freq, t);
    if (opt.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + (opt.dur || 0.2));
    var peak = opt.gain == null ? 0.25 : opt.gain;
    var atk = opt.attack == null ? 0.004 : opt.attack;
    var dur = opt.dur || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dur);
    osc.connect(g);
    if (opt.pan != null && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opt.pan));
      g.connect(p); p.connect(master);
    } else {
      g.connect(master);
    }
    osc.start(t);
    osc.stop(t + atk + dur + 0.05);
  }

  // ノイズ（破砕音）
  function noise(opt) {
    if (!ready() || !noiseBuf) return;
    var t = now() + (opt.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opt.rate || 1;
    var bp = ctx.createBiquadFilter();
    bp.type = opt.filter || 'bandpass';
    bp.frequency.setValueAtTime(opt.freq || 3000, t);
    if (opt.to) bp.frequency.exponentialRampToValueAtTime(Math.max(60, opt.to), t + (opt.dur || 0.15));
    bp.Q.value = opt.q == null ? 1.2 : opt.q;
    var g = ctx.createGain();
    var dur = opt.dur || 0.15;
    var peak = opt.gain == null ? 0.2 : opt.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g);
    if (opt.pan != null && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opt.pan));
      g.connect(p); p.connect(master);
    } else {
      g.connect(master);
    }
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function midi(semi) { return 220 * Math.pow(2, semi / 12); }

  var Sfx = {
    init: init,

    setMuted: function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; },
    isMuted: function () { return muted; },

    /* 皿を割る。combo が上がるほど音階が上へ駆け上がる = 脳汁 */
    smash: function (combo, pan, burst) {
      var idx = PENTA[Math.min(PENTA.length - 1, combo)] + (burst ? 12 : 0);
      var f = midi(idx + 24);
      noise({ freq: 5200, to: 1400, dur: 0.12, gain: 0.16, q: 0.7, rate: 1.4, pan: pan });
      tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.16, pan: pan });
      tone({ freq: f * 2, type: 'sine', dur: 0.09, gain: 0.08, delay: 0.01, pan: pan });
    },

    /* 硬い皿（耐久あり）に弾かれた */
    clink: function (pan) {
      noise({ freq: 2400, to: 900, dur: 0.07, gain: 0.1, q: 2, pan: pan });
      tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.06, pan: pan });
    },

    /* パドル反射 */
    paddle: function (pan) {
      tone({ freq: 300, to: 190, type: 'square', dur: 0.07, gain: 0.1, pan: pan });
    },

    /* 壁 */
    wall: function (pan) {
      tone({ freq: 210, to: 160, type: 'sine', dur: 0.05, gain: 0.07, pan: pan });
    },

    /* ジャストガード成功。金属的で高級な「キィン」 */
    perfect: function () {
      tone({ freq: midi(36), type: 'triangle', dur: 0.5, gain: 0.2 });
      tone({ freq: midi(43), type: 'triangle', dur: 0.5, gain: 0.16, delay: 0.03 });
      tone({ freq: midi(48), type: 'sine', dur: 0.6, gain: 0.14, delay: 0.06 });
      noise({ freq: 9000, to: 3000, dur: 0.25, gain: 0.1, q: 0.8 });
    },

    /* ガード空振り */
    whiff: function () {
      noise({ freq: 900, to: 300, dur: 0.12, gain: 0.06, q: 1 });
    },

    /* 爆発皿 */
    boom: function (pan) {
      noise({ freq: 700, to: 60, dur: 0.45, gain: 0.32, q: 0.5, rate: 0.6, pan: pan });
      tone({ freq: 90, to: 35, type: 'sine', dur: 0.4, gain: 0.28, pan: pan });
    },

    /* BURST 発動。上昇スイープ＋和音 */
    burst: function () {
      tone({ freq: 110, to: 1760, type: 'sawtooth', dur: 0.55, gain: 0.14 });
      [0, 4, 7, 12, 16, 19].forEach(function (s, i) {
        tone({ freq: midi(s + 24), type: 'square', dur: 0.5, gain: 0.09, delay: 0.35 + i * 0.03 });
      });
      noise({ freq: 300, to: 12000, dur: 0.5, gain: 0.09, q: 0.4 });
    },

    burstEnd: function () {
      tone({ freq: 880, to: 220, type: 'sawtooth', dur: 0.4, gain: 0.09 });
    },

    /* ボール増殖 */
    spawn: function (n, pan) {
      tone({ freq: midi(24 + (n % 12)) * 2, type: 'sine', dur: 0.07, gain: 0.06, pan: pan });
    },

    /* ボールロスト */
    miss: function () {
      tone({ freq: 380, to: 70, type: 'sawtooth', dur: 0.5, gain: 0.16 });
    },

    /* ウェーブクリア */
    waveClear: function () {
      [0, 4, 7, 12, 19, 24].forEach(function (s, i) {
        tone({ freq: midi(s + 24), type: 'triangle', dur: 0.45, gain: 0.15, delay: i * 0.07 });
      });
    },

    gameOver: function () {
      [12, 8, 5, 0].forEach(function (s, i) {
        tone({ freq: midi(s + 24), type: 'triangle', dur: 0.6, gain: 0.15, delay: i * 0.16 });
      });
    },

    ui: function () {
      tone({ freq: 660, type: 'square', dur: 0.06, gain: 0.08 });
      tone({ freq: 990, type: 'square', dur: 0.06, gain: 0.06, delay: 0.05 });
    },

    /* ゲージ満タン通知 */
    ding: function () {
      tone({ freq: midi(36), type: 'sine', dur: 0.3, gain: 0.14 });
      tone({ freq: midi(48), type: 'sine', dur: 0.35, gain: 0.1, delay: 0.05 });
    }
  };

  global.Sfx = Sfx;
})(window);
