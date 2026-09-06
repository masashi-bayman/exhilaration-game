/* ============================================================
   fx.js  --  爽快感の見た目担当
   破片 / 火花 / 飛び散る数字 / 衝撃波リング / 画面揺れ /
   ヒットストップ / フラッシュ
   ============================================================ */
(function (global) {
  'use strict';

  function rnd(a, b) { return a + Math.random() * (b - a); }

  var shards = [];
  var sparks = [];
  var pops = [];
  var rings = [];
  var streaks = [];

  var shakeAmt = 0, shakeDecay = 6;
  var hitstop = 0;
  var flashAmt = 0, flashColor = '255,255,255';
  var zoom = 0; // 画面パンチ用の追加ズーム

  var MAX_SHARDS = 900, MAX_SPARKS = 900, MAX_POPS = 44;
  var quality = 1;      // 0.3〜1。フレームレートに応じて main.js が調整する
  var haptics = true;   // スマホの振動

  var FX = {
    reset: function () {
      shards.length = 0; sparks.length = 0; pops.length = 0;
      rings.length = 0; streaks.length = 0;
      shakeAmt = 0; hitstop = 0; flashAmt = 0; zoom = 0;
    },

    /* --- 生成 --------------------------------------------- */

    // 皿の破片。角ばった多角形が回転しながら落ちる
    shatter: function (x, y, w, h, hue, count, power) {
      count = Math.max(2, Math.round((count || 12) * quality));
      power = power || 1;
      if (shards.length > MAX_SHARDS) shards.splice(0, shards.length - MAX_SHARDS);
      for (var i = 0; i < count; i++) {
        var pts = [];
        var n = 3 + (Math.random() * 3 | 0);
        var rad = rnd(3, 9) * (0.7 + power * 0.3);
        for (var j = 0; j < n; j++) {
          var a = (j / n) * Math.PI * 2 + rnd(-0.4, 0.4);
          var r = rad * rnd(0.5, 1.2);
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        shards.push({
          x: x + rnd(-w / 2, w / 2),
          y: y + rnd(-h / 2, h / 2),
          vx: rnd(-260, 260) * power,
          vy: rnd(-320, 80) * power,
          rot: rnd(0, 6.28),
          vr: rnd(-14, 14),
          life: rnd(0.6, 1.3),
          max: 1.3,
          pts: pts,
          hue: hue + rnd(-12, 12),
          lig: rnd(58, 88)
        });
      }
    },

    // 小さい火花（軌跡つきの点）
    spark: function (x, y, count, hue, spread, speed) {
      count = Math.max(1, Math.round((count || 8) * quality));
      speed = speed || 320;
      if (sparks.length > MAX_SPARKS) sparks.splice(0, sparks.length - MAX_SPARKS);
      for (var i = 0; i < count; i++) {
        var a = spread ? rnd(spread.a0, spread.a1) : rnd(0, Math.PI * 2);
        var s = rnd(0.35, 1) * speed;
        sparks.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: rnd(0.25, 0.6), max: 0.6,
          hue: hue + rnd(-20, 20),
          size: rnd(1.5, 3.6),
          grav: rnd(200, 700)
        });
      }
    },

    // 飛び出す数字・文字
    pop: function (x, y, text, color, size, vy) {
      if (pops.length > MAX_POPS) pops.splice(0, pops.length - MAX_POPS);
      pops.push({
        x: x, y: y, text: text, color: color || '#fff',
        size: size || 20, life: 0.9, max: 0.9,
        vx: rnd(-30, 30), vy: vy == null ? -90 : vy, t: 0
      });
    },

    // 衝撃波リング
    ring: function (x, y, r0, r1, color, life, width) {
      rings.push({
        x: x, y: y, r0: r0, r1: r1, color: color || '#fff',
        life: life || 0.4, max: life || 0.4, w: width || 4
      });
    },

    // 直線の閃光（貫通・ジャストガード演出）
    streak: function (x, y, angle, len, color) {
      streaks.push({ x: x, y: y, a: angle, len: len, color: color, life: 0.25, max: 0.25 });
    },

    setQuality: function (q) { quality = q; },
    getQuality: function () { return quality; },
    setHaptics: function (h) { haptics = h; },

    // スマホの振動（Android 系のみ。iOS Safari は無視される）
    buzz: function (pattern) {
      if (!haptics) return;
      try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
    },

    /* --- 画面演出 ----------------------------------------- */
    shake: function (amt) { shakeAmt = Math.min(48, shakeAmt + amt); },
    stop: function (sec) { hitstop = Math.max(hitstop, sec); },
    flash: function (amt, color) {
      flashAmt = Math.min(1, flashAmt + amt);
      if (color) flashColor = color;
    },
    punch: function (amt) { zoom = Math.max(zoom, amt); },

    consumeHitstop: function (dt) {
      if (hitstop <= 0) return 0;
      var used = Math.min(hitstop, dt);
      hitstop -= used;
      return used;
    },
    get hitstopActive() { return hitstop > 0; },

    /* --- 更新 --------------------------------------------- */
    update: function (dt) {
      var i, p;
      for (i = shards.length - 1; i >= 0; i--) {
        p = shards[i];
        p.vy += 1500 * dt;
        p.vx *= (1 - 1.2 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        if (p.life <= 0) shards.splice(i, 1);
      }
      for (i = sparks.length - 1; i >= 0; i--) {
        p = sparks[i];
        p.vy += p.grav * dt;
        p.vx *= (1 - 2.4 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) sparks.splice(i, 1);
      }
      for (i = pops.length - 1; i >= 0; i--) {
        p = pops[i];
        p.t += dt;
        p.vy += 120 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) pops.splice(i, 1);
      }
      for (i = rings.length - 1; i >= 0; i--) {
        p = rings[i]; p.life -= dt;
        if (p.life <= 0) rings.splice(i, 1);
      }
      for (i = streaks.length - 1; i >= 0; i--) {
        p = streaks[i]; p.life -= dt;
        if (p.life <= 0) streaks.splice(i, 1);
      }

      shakeAmt *= Math.pow(0.0025, dt);
      if (shakeAmt < 0.05) shakeAmt = 0;
      flashAmt -= dt * 2.6;
      if (flashAmt < 0) flashAmt = 0;
      zoom *= Math.pow(0.002, dt);
      if (zoom < 0.0005) zoom = 0;
    },

    /* --- 描画 --------------------------------------------- */
    applyCamera: function (ctx, w, h) {
      var s = 1 + zoom;
      var ox = (Math.random() * 2 - 1) * shakeAmt;
      var oy = (Math.random() * 2 - 1) * shakeAmt;
      ctx.translate(w / 2 + ox, h / 2 + oy);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
    },

    drawWorld: function (ctx) {
      var i, p, k;

      // リング
      ctx.lineCap = 'round';
      for (i = 0; i < rings.length; i++) {
        p = rings[i];
        k = 1 - p.life / p.max;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w * (1 - k * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 2)), 0, 6.2832);
        ctx.stroke();
      }

      // 閃光
      for (i = 0; i < streaks.length; i++) {
        p = streaks[i];
        k = p.life / p.max;
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + 8 * k;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(p.a) * p.len * 0.5, p.y - Math.sin(p.a) * p.len * 0.5);
        ctx.lineTo(p.x + Math.cos(p.a) * p.len * 0.5, p.y + Math.sin(p.a) * p.len * 0.5);
        ctx.stroke();
      }

      // 破片
      for (i = 0; i < shards.length; i++) {
        p = shards[i];
        k = Math.min(1, p.life / 0.4);
        ctx.globalAlpha = k;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = 'hsl(' + p.hue + ',80%,' + p.lig + '%)';
        ctx.beginPath();
        ctx.moveTo(p.pts[0][0], p.pts[0][1]);
        for (var j = 1; j < p.pts.length; j++) ctx.lineTo(p.pts[j][0], p.pts[j][1]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 火花
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < sparks.length; i++) {
        p = sparks[i];
        k = p.life / p.max;
        ctx.globalAlpha = k;
        ctx.fillStyle = 'hsl(' + p.hue + ',100%,' + (60 + 30 * k) + '%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.6, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },

    drawText: function (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < pops.length; i++) {
        var p = pops[i];
        var k = p.life / p.max;
        // 出現時にポンッと膨らむ
        var grow = p.t < 0.12 ? 0.5 + (p.t / 0.12) * 0.8 : 1.3 - Math.min(0.3, (p.t - 0.12) * 1.2);
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.font = '900 ' + (p.size * grow).toFixed(1) + 'px "Arial Black", Impact, sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    },

    drawFlash: function (ctx, w, h) {
      if (flashAmt <= 0) return;
      ctx.fillStyle = 'rgba(' + flashColor + ',' + (flashAmt * 0.75).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    },

    count: function () { return shards.length + sparks.length + pops.length; }
  };

  global.FX = FX;
})(window);
