/* ============================================================
   render.js  --  描画
   ============================================================ */
(function (global) {
  'use strict';

  var W = Game.W, H = Game.H, HUD_H = Game.HUD_H;
  var PADDLE_Y = Game.PADDLE_Y, PADDLE_H = Game.PADDLE_H;
  var G = Game.G;
  var clamp = Game.clamp, fmt = Game.fmtS, isWall = Game.isWall;

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 背景 ---------- */
  function drawBackground(ctx) {
    var hype = G.hype;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    var base = 6 + hype * 10;
    g.addColorStop(0, 'rgb(' + (10 + base) + ',' + (12 + base) + ',' + (26 + base * 2) + ')');
    g.addColorStop(0.55, 'rgb(' + (8 + base * 0.6) + ',' + (9 + base * 0.6) + ',' + (20 + base) + ')');
    g.addColorStop(1, 'rgb(' + (16 + base) + ',' + (8 + base * 0.4) + ',' + (28 + base) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 流れる斜めストライプ
    var t = G.elapsed;
    ctx.save();
    ctx.globalAlpha = 0.045 + hype * (G.burst > 0 ? 0.05 : 0.11);
    ctx.globalCompositeOperation = 'lighter';
    var span = 84;
    for (var i = -12; i < W / span + 12; i++) {
      var x = i * span + ((t * (60 + hype * 260)) % span);
      var hue = G.burst > 0 ? (t * 220 + i * 26) % 360 : 205 + Math.sin(t * 0.4 + i) * 26;
      ctx.fillStyle = 'hsl(' + hue + ',80%,' + (26 + hype * 16) + '%)';
      ctx.beginPath();
      ctx.moveTo(x, H); ctx.lineTo(x + 34, H);
      ctx.lineTo(x + 34 + 210, HUD_H); ctx.lineTo(x + 210, HUD_H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // BURST 中の虹オーバーレイ
    if (G.burst > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 14);
      var rg = ctx.createRadialGradient(W / 2, H * 0.6, 40, W / 2, H * 0.6, W * 0.8);
      rg.addColorStop(0, 'hsl(' + ((t * 300) % 360) + ',100%,60%)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 床。BURST 中は安全床になる
    if (G.burst > 0 || G.cfg.floorBounce) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var fg = ctx.createLinearGradient(0, H - 60, 0, H);
      var fh = G.burst > 0 ? (t * 300) % 360 : 195;
      fg.addColorStop(0, 'hsla(' + fh + ',100%,60%,0)');
      fg.addColorStop(1, 'hsla(' + fh + ',100%,60%,.35)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, H - 60, W, 60);
      ctx.restore();
    }
    if (!G.cfg.floorBounce && G.burst <= 0) {
      ctx.save();
      var a = 0.16 + 0.12 * Math.sin(t * 3);
      ctx.strokeStyle = 'rgba(255,80,90,' + a.toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.moveTo(0, H - 6); ctx.lineTo(W, H - 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 巨大コンボ数字（背景） ---------- */
  function drawComboGhost(ctx) {
    if (G.combo < 3) return;
    var k = clamp(G.comboTimer / (G.comboMax || 1), 0, 1);
    var pulse = 1 + 0.06 * Math.sin(G.elapsed * 22);
    var size = (110 + Math.min(180, G.combo * 5)) * pulse;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.10 + 0.16 * k + (G.burst > 0 ? 0.1 : 0);
    ctx.globalCompositeOperation = 'lighter';
    var hue = G.burst > 0 ? (G.elapsed * 300) % 360 : (G.combo >= 20 ? 45 : 195);
    ctx.fillStyle = 'hsl(' + hue + ',100%,65%)';
    ctx.font = '900 ' + size.toFixed(0) + 'px "Arial Black", Impact, sans-serif';
    var jitter = G.combo > 15 ? (Math.random() - 0.5) * (G.combo * 0.14) : 0;
    ctx.fillText(G.combo + '', W / 2 + jitter, H * 0.55 + jitter);
    ctx.font = '900 ' + (size * 0.18).toFixed(0) + 'px "Arial Black", sans-serif';
    ctx.fillText('COMBO', W / 2, H * 0.55 + size * 0.42);
    ctx.restore();

    // BURST 中の累計スコア（どんどん増える数字）
    if (G.burst > 0) {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 44px "Arial Black", Impact, sans-serif';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      var ty = H * 0.55 - size * 0.55;
      ctx.strokeText('+' + fmt(G.burstScore), W / 2, ty);
      ctx.fillStyle = '#ffe66d';
      ctx.fillText('+' + fmt(G.burstScore), W / 2, ty);
      ctx.restore();
    }
  }

  /* ---------- 皿 ----------
     皿は何百枚も並ぶので、見た目ごとに1枚だけオフスクリーンに描いて
     あとは drawImage で貼る。毎フレーム grad を作り直すと一気に重くなる。 */
  var SPRITE_PAD = 4;
  var plateSprites = {};
  var spriteWave = -1;

  function plateKey(p) {
    return p.type + '|' + (p.hue | 0) + '|' + p.hp + '|' + p.maxhp +
           '|' + (p.w * 2 | 0) + '|' + (p.h * 2 | 0);
  }

  /** 静的な見た目だけを描く（脈動や被弾フラッシュは本体側で毎フレーム描く） */
  function paintPlate(ctx, p) {
    var rad = Math.max(2, Math.min(7, p.h * 0.28));
    var inset = Math.max(1.5, p.h * 0.14);

    // 壊せない壁
    if (isWall(p)) {
      var wg = ctx.createLinearGradient(0, 0, 0, p.h);
      wg.addColorStop(0, '#59627a');
      wg.addColorStop(0.5, '#394154');
      wg.addColorStop(1, '#232a3c');
      ctx.fillStyle = wg;
      roundRect(ctx, 0, 0, p.w, p.h, rad * 0.6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,175,215,.55)';
      ctx.lineWidth = Math.max(1, p.h * 0.075);
      ctx.stroke();
      // ハッチングで「硬い」感じを出す
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, 0, 0, p.w, p.h, rad * 0.6);
      ctx.clip();
      ctx.strokeStyle = 'rgba(180,200,235,.16)';
      ctx.lineWidth = Math.max(1.5, p.h * 0.11);
      for (var hx = -p.h; hx < p.w; hx += Math.max(6, p.h * 0.4)) {
        ctx.beginPath();
        ctx.moveTo(hx, p.h);
        ctx.lineTo(hx + p.h, 0);
        ctx.stroke();
      }
      ctx.restore();
      // 四隅のリベット
      if (p.h >= 15) {
        var rv = Math.max(3, p.h * 0.19);
        ctx.fillStyle = 'rgba(210,225,255,.55)';
        [[rv, rv], [p.w - rv, rv], [rv, p.h - rv], [p.w - rv, p.h - rv]].forEach(function (q) {
          ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.2, p.h * 0.07), 0, 6.2832); ctx.fill();
        });
      }
      return;
    }

    var lig, sat;
    if (p.type === 3) { sat = 12; lig = 62 - (p.maxhp - p.hp) * 12; }
    else if (p.type === 4) { sat = 100; lig = 60; }
    else if (p.type === 2) { sat = 78; lig = 58 - (p.maxhp - p.hp) * 12; }
    else { sat = 70; lig = 62; }

    // 本体
    var grad = ctx.createLinearGradient(0, 0, 0, p.h);
    grad.addColorStop(0, 'hsl(' + p.hue + ',' + sat + '%,' + (lig + 14) + '%)');
    grad.addColorStop(1, 'hsl(' + p.hue + ',' + sat + '%,' + (lig - 14) + '%)');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, p.w, p.h, rad);
    ctx.fill();

    // 皿のフチ（内側の楕円）
    ctx.strokeStyle = 'hsla(' + p.hue + ',' + sat + '%,' + (lig + 26) + '%,.85)';
    ctx.lineWidth = Math.max(1, p.h * 0.077);
    ctx.beginPath();
    ctx.ellipse(p.w / 2, p.h / 2, p.w * 0.34, p.h * 0.28, 0, 0, 6.2832);
    ctx.stroke();

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,.20)';
    roundRect(ctx, inset, inset * 0.7, p.w - inset * 2, p.h * 0.34, rad * 0.7);
    ctx.fill();

    // ヒビ
    if (p.hp < p.maxhp) {
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = Math.max(1, p.h * 0.062);
      ctx.beginPath();
      var n = (p.maxhp - p.hp) * 2 + 1;
      for (var k = 0; k < n; k++) {
        var sx = (p.w / (n + 1)) * (k + 1);
        ctx.moveTo(sx - p.h * 0.23, 2);
        ctx.lineTo(sx + p.h * 0.12, p.h / 2);
        ctx.lineTo(sx - p.h * 0.15, p.h - 2);
      }
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 爆発皿マーク
    if (p.type === 4) {
      ctx.fillStyle = 'rgba(80,40,0,.85)';
      ctx.font = '900 ' + Math.max(8, p.h * 0.6).toFixed(0) + 'px sans-serif';
      ctx.fillText('✸', p.w / 2, p.h / 2 + 1);
    }
    // 鉄皿マーク
    if (p.type === 3) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = '900 ' + Math.max(7, p.h * 0.45).toFixed(0) + 'px sans-serif';
      ctx.fillText(p.hp + '', p.w / 2, p.h / 2 + 1);
    }
  }

  function plateSprite(p) {
    // ウェーブが変わるとセルの大きさも色も変わるので作り直す
    if (spriteWave !== G.wave) { plateSprites = {}; spriteWave = G.wave; }
    var key = plateKey(p);
    var cv = plateSprites[key];
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(p.w) + SPRITE_PAD * 2;
    cv.height = Math.ceil(p.h) + SPRITE_PAD * 2;
    var c = cv.getContext('2d');
    c.translate(SPRITE_PAD, SPRITE_PAD);
    paintPlate(c, p);
    plateSprites[key] = cv;
    return cv;
  }

  function drawPlates(ctx) {
    for (var i = 0; i < G.plates.length; i++) {
      var p = G.plates[i];
      if (!p.alive) continue;
      var d = clamp(p.drop, 0, 1);
      if (d <= 0) continue;
      var ease = 1 - Math.pow(1 - d, 3);
      var oy = (1 - ease) * -40;
      var x = p.x - SPRITE_PAD, y = p.y + oy - SPRITE_PAD;

      ctx.globalAlpha = ease;
      ctx.drawImage(plateSprite(p), x, y);

      // ここから下は時間で変わるので都度描く
      var rad = Math.max(2, Math.min(7, p.h * 0.28));
      if (p.type === 4) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = ease * (0.35 + 0.25 * Math.sin(G.elapsed * 7 + p.col));
        ctx.fillStyle = '#ffcc55';
        ctx.translate(p.x, p.y + oy);
        roundRect(ctx, -2, -2, p.w + 4, p.h + 4, rad + 2);
        ctx.fill();
        ctx.restore();
      }
      if (p.shine > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.shine * (isWall(p) ? 0.5 : 0.8);
        ctx.fillStyle = isWall(p) ? '#aecbff' : '#fff';
        ctx.translate(p.x, p.y + oy);
        roundRect(ctx, 0, 0, p.w, p.h, isWall(p) ? rad * 0.6 : rad);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ボール ---------- */
  // グローはスプライトを使い回す（多球時のコスト削減）
  var GLOW_STEPS = 24, GLOW_SIZE = 96;
  var glowSprites = (function () {
    var arr = [];
    for (var i = 0; i < GLOW_STEPS; i++) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = GLOW_SIZE;
      var c = cv.getContext('2d');
      var hue = i * (360 / GLOW_STEPS);
      var g = c.createRadialGradient(GLOW_SIZE / 2, GLOW_SIZE / 2, 1, GLOW_SIZE / 2, GLOW_SIZE / 2, GLOW_SIZE / 2);
      g.addColorStop(0, 'hsla(' + hue + ',100%,78%,1)');
      g.addColorStop(0.45, 'hsla(' + hue + ',100%,62%,.45)');
      g.addColorStop(1, 'hsla(' + hue + ',100%,60%,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
      arr.push(cv);
    }
    return arr;
  })();
  function glowOf(hue) {
    var i = Math.round(((hue % 360) + 360) % 360 / (360 / GLOW_STEPS)) % GLOW_STEPS;
    return glowSprites[i];
  }

  function drawBalls(ctx) {
    var many = G.balls.length > 14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.balls.length; i++) {
      var b = G.balls[i];
      var hue = b.charged > 0 ? 48 : b.hue;
      // 軌跡（多球時は間引く）
      var n = b.trail.length / 2;
      var stepJ = many ? 2 : 1;
      for (var j = many ? 1 : 0; j < n; j += stepJ) {
        var t = j / Math.max(1, n - 1);
        ctx.globalAlpha = t * 0.45;
        ctx.fillStyle = 'hsl(' + hue + ',100%,' + (55 + t * 25) + '%)';
        ctx.beginPath();
        ctx.arc(b.trail[j * 2], b.trail[j * 2 + 1], b.r * (0.25 + t * 0.85), 0, 6.2832);
        ctx.fill();
      }
      // グロー
      ctx.globalAlpha = b.charged > 0 ? 0.6 : (many ? 0.28 : 0.4);
      var gr = b.r * (b.charged > 0 ? 5.5 : 3.4);
      ctx.drawImage(glowOf(hue), b.x - gr, b.y - gr, gr * 2, gr * 2);
    }
    ctx.restore();

    for (var m = 0; m < G.balls.length; m++) {
      var ball = G.balls[m];
      var h2 = ball.charged > 0 ? 48 : ball.hue;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = 'hsl(' + h2 + ',100%,70%)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (ball.pierce > 0) {
        ctx.fillStyle = 'rgba(60,40,0,.9)';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ball.pierce + '', ball.x, ball.y + 0.5);
      }
    }
  }

  /* ---------- パドル ---------- */
  function drawPaddle(ctx) {
    var pd = G.paddle;
    if (!pd) return;
    var w = pd.w * (1 + pd.squash * 0.06);
    var h = PADDLE_H * (1 - pd.squash * 0.25);
    var x = pd.x - w / 2, y = PADDLE_Y + (PADDLE_H - h) / 2;

    // ガード待機リング
    if (G.guardWindow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffe66d';
      ctx.lineWidth = 3;
      roundRect(ctx, x - 9, y - 9, w + 18, h + 18, 14);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (pd.glow > 0) {
      ctx.shadowColor = 'rgba(255,225,110,' + pd.glow + ')';
      ctx.shadowBlur = 34 * pd.glow;
    }
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (G.burst > 0) {
      g.addColorStop(0, 'hsl(' + ((G.elapsed * 300) % 360) + ',100%,72%)');
      g.addColorStop(1, 'hsl(' + ((G.elapsed * 300 + 60) % 360) + ',100%,52%)');
    } else {
      g.addColorStop(0, '#eaf6ff');
      g.addColorStop(1, '#7fb6e6');
    }
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 端当てゾーンの目印
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#7CFFCB';
    roundRect(ctx, x + 2, y + h * 0.3, w * 0.11, h * 0.4, 3); ctx.fill();
    roundRect(ctx, x + w - 2 - w * 0.11, y + h * 0.3, w * 0.11, h * 0.4, 3); ctx.fill();
    ctx.restore();

    // ガードクールダウン
    if (G.guardCd > 0) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(255,90,90,.85)';
      var cw = w * (G.guardCd / 0.45);
      ctx.fillRect(pd.x - cw / 2, y + h + 5, cw, 3);
      ctx.restore();
    }
  }

  /* ---------- HUD ---------- */
  function drawHUD(ctx) {
    ctx.save();
    // 上バー
    var g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, 'rgba(4,6,16,.96)');
    g.addColorStop(1, 'rgba(4,6,16,.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = 'rgba(120,190,255,.35)';
    ctx.fillRect(0, HUD_H - 2, W, 2);

    // 経験値バー（画面最上段いっぱい）
    var xk = clamp(G.xp / (G.xpNeed || 1), 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, 0, W, 6);
    var xg = ctx.createLinearGradient(0, 0, W, 0);
    xg.addColorStop(0, '#7CFFCB');
    xg.addColorStop(1, '#5fd0ff');
    ctx.fillStyle = xg;
    ctx.fillRect(0, 0, W * xk, 6);
    if (xk > 0.985) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(G.elapsed * 18)).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, 6);
    }

    ctx.textBaseline = 'middle';

    // SCORE（左）
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7CFFCB';
    ctx.font = '900 13px "Arial Black", sans-serif';
    ctx.fillText('LV ' + G.level, 22, 20);
    ctx.fillStyle = 'rgba(150,180,220,.75)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('SCORE', 76, 20);
    ctx.fillStyle = (G.score - G.shownScore > 1) ? '#ffe66d' : '#ffffff';
    ctx.font = '900 32px "Arial Black", Impact, sans-serif';
    ctx.fillText(fmt(G.shownScore), 22, 43);
    // BEST はスコアの下に小さく（右上はボタン用に空けておく）
    ctx.fillStyle = 'rgba(150,180,220,.62)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('BEST  ' + fmt(Math.max(G.best, G.score)), 22, 63);

    // WAVE（中央）
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150,180,220,.75)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('WAVE', W / 2, 20);
    ctx.fillStyle = '#9fe4ff';
    ctx.font = '900 30px "Arial Black", Impact, sans-serif';
    ctx.fillText(G.wave + '', W / 2, 43);
    ctx.fillStyle = 'rgba(150,180,220,.6)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(G.cfg.label + '  /  x' + (G.waveMul < 1000 ? G.waveMul.toFixed(2) : fmt(G.waveMul)) +
                 '  /  ' + G.layoutName, W / 2, 63);

    ctx.restore();
  }

  function drawBottomBar(ctx) {
    ctx.save();
    ctx.textBaseline = 'middle';

    // ライフ
    if (G.cfg.lives !== Infinity) {
      ctx.textAlign = 'left';
      for (var i = 0; i < G.lives; i++) {
        ctx.fillStyle = '#ff6b8b';
        ctx.beginPath();
        ctx.arc(28 + i * 22, H - 26, 7, 0, 6.2832);
        ctx.fill();
      }
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(160,200,255,.55)';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText('∞ おきらくモード', 22, H - 26);
    }

    // 安全ネットの残量
    if (G.safety > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7CFFCB';
      ctx.font = '900 13px "Arial Black", sans-serif';
      ctx.fillText('🕸 x' + G.safety, 110, H - 26);
    }

    // ゲージ / BURST タイマー
    var bw = 380, bx = W / 2 - bw / 2, by = H - 24, bh = 11;
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();

    if (G.burst > 0) {
      var k = G.burst / (G.burstMax || 6.5);
      var gg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      gg.addColorStop(0, 'hsl(' + ((G.elapsed * 300) % 360) + ',100%,60%)');
      gg.addColorStop(0.5, 'hsl(' + ((G.elapsed * 300 + 120) % 360) + ',100%,60%)');
      gg.addColorStop(1, 'hsl(' + ((G.elapsed * 300 + 240) % 360) + ',100%,60%)');
      ctx.fillStyle = gg;
      roundRect(ctx, bx, by, bw * k, bh, 6); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '900 13px "Arial Black", sans-serif';
      ctx.fillText('B U R S T !   BALLS ' + G.balls.length, W / 2, by - 13);
    } else {
      var full = G.gauge >= 100;
      var col = full ? '#ffe66d' : '#5fd0ff';
      ctx.fillStyle = col;
      if (full) {
        ctx.shadowColor = '#ffe66d';
        ctx.shadowBlur = 14 + 10 * Math.sin(G.elapsed * 12);
      }
      roundRect(ctx, bx, by, bw * (G.gauge / 100), bh, 6); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = full ? '#ffe66d' : 'rgba(160,200,255,.65)';
      ctx.font = '900 12px "Arial Black", sans-serif';
      ctx.fillText(full ? (G.cfg.autoBurst ? 'BURST!' : 'PRESS  [E]  →  BURST') : 'BURST GAUGE', W / 2, by - 13);
    }

    // コンボ（数値表示）
    ctx.textAlign = 'right';
    if (G.combo > 0) {
      var kk = clamp(G.comboTimer / (G.comboMax || 1), 0, 1);
      ctx.fillStyle = G.combo >= 20 ? '#ffe66d' : '#9fe4ff';
      ctx.font = '900 22px "Arial Black", sans-serif';
      ctx.fillText(G.combo + ' COMBO', W - 22, H - 28);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(W - 22 - 130, H - 12, 130, 3);
      ctx.fillStyle = G.combo >= 20 ? '#ffe66d' : '#9fe4ff';
      ctx.fillRect(W - 22 - 130 * kk, H - 12, 130 * kk, 3);
    }

    // ボール数
    if (G.balls.length > 1) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(160,200,255,.7)';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText('BALLS  ' + G.balls.length, 22, H - 48);
    }
    ctx.restore();
  }

  // 経験値が満タンになってから、カードが出るまでの予告。
  // （2回目以降が連続で来るときは予告なしで即カードが出る）
  function drawLevelUpTelegraph(ctx) {
    if (!G.levelUpArmed) return;

    var lead = Game.LEVELUP_LEAD || 1.6;
    var k = clamp(G.levelUpTimer / lead, 0, 1);   // 1 → 0
    var appear = Math.min(1, (1 - k) * 6);        // 出てくるときの気持ちいい伸び
    var y = HUD_H + 56;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 帯
    ctx.globalAlpha = 0.92 * appear;
    var bg = ctx.createLinearGradient(0, y - 56, 0, y + 56);
    bg.addColorStop(0, 'rgba(8,26,20,0)');
    bg.addColorStop(0.5, 'rgba(12,52,40,.92)');
    bg.addColorStop(1, 'rgba(8,26,20,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, y - 56, W, 112);

    // 上下の走る線
    ctx.globalAlpha = appear;
    ctx.fillStyle = '#7CFFCB';
    ctx.fillRect(0, y - 54, W, 2);
    ctx.fillRect(0, y + 52, W, 2);

    // 本文
    var pulse = 1 + 0.06 * Math.sin(G.elapsed * 18);
    var size = 52 * pulse * (0.75 + 0.25 * appear);
    ctx.font = '900 ' + size.toFixed(0) + 'px "Arial Black", Impact, sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText('LEVEL UP!', W / 2, y - 12);
    var grd = ctx.createLinearGradient(0, y - 34, 0, y + 10);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.5, '#7CFFCB');
    grd.addColorStop(1, '#3fd3a8');
    ctx.fillStyle = grd;
    ctx.fillText('LEVEL UP!', W / 2, y - 12);

    ctx.fillStyle = '#dff7ec';
    ctx.font = '900 15px system-ui, sans-serif';
    var more = G.pendingLevels > 1 ? '  ×' + G.pendingLevels : '';
    ctx.fillText('強化を選びます' + more, W / 2, y + 22);

    // 残り時間
    var bw = 300;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(W / 2 - bw / 2, y + 40, bw, 5);
    ctx.fillStyle = '#7CFFCB';
    ctx.fillRect(W / 2 - bw / 2, y + 40, bw * (1 - k), 5);

    ctx.restore();
  }

  function drawPrompts(ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (G.state === 'ready') {
      var a = 0.55 + 0.45 * Math.sin(G.elapsed * 6);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.font = '900 20px "Arial Black", sans-serif';
      ctx.fillText('SPACE / クリック で発射', W / 2, PADDLE_Y - 36);
    }
    if (G.bannerTimer > 0) {
      // 皿とパドルの間には必ず余白があるので、そこに出せば盤面と被らない
      var k = clamp(G.bannerTimer / 1.6, 0, 1);
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = '#fff';
      ctx.font = '900 46px "Arial Black", Impact, sans-serif';
      ctx.fillText(G.bannerText, W / 2, PADDLE_Y - 112);
      ctx.fillStyle = '#9fe4ff';
      ctx.font = '900 17px "Arial Black", sans-serif';
      ctx.fillText(G.bannerSub, W / 2, PADDLE_Y - 76);
    }
    ctx.restore();
  }

  function drawVignette(ctx) {
    var rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.86);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // 盛り上がると縁が光る
    if (G.hype > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (G.hype - 0.15) * 0.5;
      var hue = G.burst > 0 ? (G.elapsed * 300) % 360 : 45;
      var eg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.8);
      eg.addColorStop(0, 'rgba(0,0,0,0)');
      eg.addColorStop(1, 'hsl(' + hue + ',100%,55%)');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function render(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx);

    ctx.save();
    FX.applyCamera(ctx, W, H);
    drawComboGhost(ctx);
    drawPlates(ctx);
    FX.drawWorld(ctx);
    drawBalls(ctx);
    drawPaddle(ctx);
    FX.drawText(ctx);
    ctx.restore();

    drawVignette(ctx);
    drawLevelUpTelegraph(ctx);
    drawHUD(ctx);
    drawBottomBar(ctx);
    drawPrompts(ctx);
    FX.drawFlash(ctx, W, H);
  }

  global.Renderer = { render: render, roundRect: roundRect };
})(window);
