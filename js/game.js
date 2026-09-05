/* ============================================================
   game.js  --  EXHILARATION / 皿割りブレイカー 本体
   ============================================================ */
(function (global) {
  'use strict';

  var W = 960, H = 720;

  var HUD_H = 74;
  var PLATE_TOP = 150;
  var PLATE_W = 74, PLATE_H = 26, GAP_X = 6, GAP_Y = 9;
  var PADDLE_Y = H - 58, PADDLE_H = 14;
  var BALL_R = 8;

  var MODES = {
    easy: {
      key: 'easy', label: 'おきらく', sub: '落ちない。ただひたすら割る。',
      lives: Infinity, floorBounce: true,
      paddleW: 172, ballSpeed: 395, speedUp: 0.020, maxSpeed: 760,
      gaugeRate: 1.75, autoBurst: true, guard: false,
      comboTime: 2.6, ballCap: 64, keepAfterBurst: 5, scoreScale: 1.0
    },
    hard: {
      key: 'hard', label: 'ガチ', sub: 'ジャストガードを決めろ。',
      lives: 3, floorBounce: false,
      paddleW: 116, ballSpeed: 468, speedUp: 0.034, maxSpeed: 920,
      gaugeRate: 1.0, autoBurst: false, guard: true,
      comboTime: 1.9, ballCap: 44, keepAfterBurst: 3, scoreScale: 1.6
    }
  };

  var PLATE_VALUE = { 1: 1, 2: 2.2, 3: 3.6, 4: 3.0 };
  var PLATE_HP = { 1: 1, 2: 2, 3: 3, 4: 1 };

  var BURST_TIME = 6.5;
  var GUARD_WINDOW = 0.14;
  var GUARD_COOLDOWN = 0.45;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }

  var G = {
    W: W, H: H,
    state: 'title',      // title | ready | play | waveclear | dead | gameover | paused
    mode: 'easy',
    cfg: MODES.easy,

    score: 0, shownScore: 0, best: 0,
    wave: 1, waveMul: 1, lives: 3,
    combo: 0, comboTimer: 0, comboBest: 0,
    totalSmashed: 0, maxBallsSeen: 1, perfectCount: 0,
    gauge: 0, gaugeReadyPulse: 0,
    burst: 0, burstUsed: 0, burstScore: 0,

    plates: [], remaining: 0, layoutName: '',
    balls: [], paddle: null,

    timeScale: 1, stateTimer: 0, elapsed: 0,
    guardWindow: 0, guardCd: 0, guardFlash: 0, guardArmed: false,
    hype: 0,              // 背景の盛り上がり 0..1
    bannerText: '', bannerSub: '', bannerTimer: 0,
    newBest: false
  };

  /* ---------------------------------------------------------
     初期化
     --------------------------------------------------------- */

  function loadBest(mode) {
    try { return parseInt(localStorage.getItem('exhil.best.' + mode) || '0', 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest(mode, v) {
    try { localStorage.setItem('exhil.best.' + mode, String(v)); } catch (e) {}
  }

  function start(modeKey) {
    G.mode = modeKey;
    G.cfg = MODES[modeKey];
    G.best = loadBest(modeKey);
    G.score = 0; G.shownScore = 0;
    G.wave = 1; G.lives = G.cfg.lives;
    G.combo = 0; G.comboTimer = 0; G.comboBest = 0;
    G.totalSmashed = 0; G.maxBallsSeen = 1; G.perfectCount = 0;
    G.gauge = 0; G.burst = 0; G.burstUsed = 0; G.burstScore = 0;
    G.timeScale = 1; G.elapsed = 0;
    G.guardWindow = 0; G.guardCd = 0; G.guardFlash = 0;
    G.hype = 0; G.newBest = false;
    G.paddle = { x: W / 2, w: G.cfg.paddleW, vx: 0, glow: 0, squash: 0 };
    FX.reset();
    buildWave(1);
    resetBall();
    G.state = 'ready';
  }

  function buildWave(wave) {
    var L = Levels.build(wave);
    G.layoutName = L.name;
    G.plates = [];
    var totalW = L.cols * PLATE_W + (L.cols - 1) * GAP_X;
    var ox = (W - totalW) / 2;
    for (var r = 0; r < L.rows; r++) {
      for (var c = 0; c < L.cols; c++) {
        var t = L.grid[r][c];
        if (!t) continue;
        G.plates.push({
          x: ox + c * (PLATE_W + GAP_X),
          y: PLATE_TOP + r * (PLATE_H + GAP_Y),
          w: PLATE_W, h: PLATE_H,
          type: t, hp: PLATE_HP[t], maxhp: PLATE_HP[t],
          alive: true, row: r, col: c,
          hue: t === 4 ? 45 : (t === 3 ? 205 : (t === 2 ? 22 : 172 + r * 21)),
          shine: 0, drop: -rnd(0.05, 0.45)   // 登場アニメ用
        });
      }
    }
    G.remaining = G.plates.length;
    G.waveMul = Math.pow(1.28, wave - 1);
  }

  function resetBall() {
    G.balls = [{
      x: G.paddle.x, y: PADDLE_Y - BALL_R - 2,
      vx: 0, vy: 0, r: BALL_R,
      speed: G.cfg.ballSpeed * (1 + (G.wave - 1) * G.cfg.speedUp),
      pierce: 0, charged: 0, stuck: true, trail: [], hue: 190, born: 0
    }];
  }

  function launch() {
    var launched = false;
    for (var i = 0; i < G.balls.length; i++) {
      var b = G.balls[i];
      if (b.stuck) {
        var a = -Math.PI / 2 + rnd(-0.32, 0.32);
        b.vx = Math.cos(a) * b.speed;
        b.vy = Math.sin(a) * b.speed;
        b.stuck = false;
        launched = true;
      }
    }
    if (launched) {
      Sfx.paddle(0);
      G.state = 'play';
      if (G.mode === 'easy' && G.balls.length === 1) {
        var b0 = G.balls[0];
        spawnBall(b0.x, b0.y - 4, 320);
        spawnBall(b0.x, b0.y - 4, 90);
      }
    }
  }

  /* ---------------------------------------------------------
     皿を割る
     --------------------------------------------------------- */

  function plateCenter(p) { return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; }

  function addCombo(n) {
    G.combo += n;
    G.comboTimer = G.cfg.comboTime;
    if (G.combo > G.comboBest) G.comboBest = G.combo;
  }

  function spawnBall(x, y, hue) {
    if (G.balls.length >= G.cfg.ballCap) return null;
    var base = G.cfg.ballSpeed * (1 + (G.wave - 1) * G.cfg.speedUp);
    var a = y > H * 0.55 ? (-Math.PI / 2 + rnd(-1.05, 1.05)) : rnd(0, Math.PI * 2);
    var b = {
      x: x, y: y, vx: Math.cos(a), vy: Math.sin(a), r: BALL_R,
      speed: clamp(base * rnd(0.95, 1.15), 200, G.cfg.maxSpeed),
      pierce: 0, charged: 0, stuck: false, trail: [], hue: hue == null ? rnd(0, 360) : hue, born: 0.12
    };
    b.vx *= b.speed; b.vy *= b.speed;
    G.balls.push(b);
    if (G.balls.length > G.maxBallsSeen) G.maxBallsSeen = G.balls.length;
    Sfx.spawn(G.balls.length, (x / W) * 2 - 1);
    FX.ring(x, y, 2, 26, 'hsl(' + b.hue + ',100%,70%)', 0.28, 3);
    return b;
  }

  function damagePlate(p, ball) {
    var c = plateCenter(p);
    p.hp--;
    p.shine = 1;
    G.comboTimer = Math.max(G.comboTimer, 0.5);
    Sfx.clink((c.x / W) * 2 - 1);
    FX.spark(c.x, c.y, 5, p.hue, null, 200);
    FX.shake(1.5);
    FX.stop(0.01);
    G.score += Math.round(40 * G.waveMul * G.cfg.scoreScale);
  }

  function smash(p, depth) {
    if (!p.alive) return;
    p.alive = false;
    G.remaining--;
    G.totalSmashed++;
    depth = depth || 0;

    var c = plateCenter(p);
    var pan = (c.x / W) * 2 - 1;
    var val = PLATE_VALUE[p.type];

    addCombo(1);

    var mul = (1 + G.combo * 0.12) * (G.burst > 0 ? 3 : 1);
    var gain = Math.round(100 * val * G.waveMul * mul * G.cfg.scoreScale);
    G.score += gain;
    if (G.burst > 0) G.burstScore += gain;

    if (G.burst <= 0) {
      G.gauge = Math.min(100, G.gauge + val * G.cfg.gaugeRate * 1.35);
      if (G.gauge >= 100 && !G.burstReadyNotified) {
        G.burstReadyNotified = true;
        G.gaugeReadyPulse = 1;
        Sfx.ding();
        if (G.cfg.autoBurst) triggerBurst();
        else FX.pop(W / 2, PADDLE_Y - 120, 'BURST READY!  [E]', '#ffe66d', 26, -40);
      }
    }

    // 見た目・音
    var power = 0.8 + Math.min(1.1, G.combo / 22) + (G.burst > 0 ? 0.4 : 0);
    var crowded = G.balls.length > 18;   // 多球時は破片を減らして軽さを保つ
    FX.shatter(c.x, c.y, p.w, p.h, p.hue, crowded ? 5 : 10 + Math.round(val * 4), power);
    FX.spark(c.x, c.y, crowded ? 3 : 6 + Math.round(val * 3), p.hue);
    FX.shake(1.2 + Math.min(6, G.combo * 0.16) + (G.burst > 0 ? 1.5 : 0));
    FX.stop(0.012 + Math.min(0.028, G.combo * 0.0009));
    Sfx.smash(G.combo, pan, G.burst > 0);

    if (G.burst <= 0 || Math.random() < 0.22) {
      var popCol = G.burst > 0 ? 'hsl(' + ((G.elapsed * 400 + c.x) % 360) + ',100%,70%)'
                               : (G.combo >= 10 ? '#ffe66d' : '#ffffff');
      FX.pop(c.x, c.y, '+' + fmt(gain), popCol,
             (G.burst > 0 ? 13 : 15) + Math.min(20, G.combo * 0.65));
    }

    // BURST 中は割るたびにボールが増える → ねずみ算
    if (G.burst > 0) spawnBall(c.x, c.y, (G.elapsed * 220 + G.balls.length * 37) % 360);

    // 通常時もコンボ25ごとにご褒美ボール
    if (G.burst <= 0 && G.combo % 25 === 0 && G.balls.length < 8) {
      spawnBall(c.x, c.y, 50);
      FX.pop(c.x, c.y - 26, 'EXTRA BALL!', '#7CFFCB', 22, -60);
    }

    if (p.type === 4) explode(c.x, c.y, depth);
  }

  function explode(x, y, depth) {
    var R = 108;
    Sfx.boom((x / W) * 2 - 1);
    FX.ring(x, y, 8, R * 1.25, '#ffd166', 0.45, 9);
    FX.ring(x, y, 4, R * 0.7, '#ffffff', 0.3, 5);
    FX.spark(x, y, 34, 45, null, 620);
    FX.flash(0.3, '255,205,90');
    FX.shake(16);
    FX.stop(0.07);
    FX.punch(0.02);
    if (depth > 3) return;
    for (var i = 0; i < G.plates.length; i++) {
      var q = G.plates[i];
      if (!q.alive) continue;
      var c = plateCenter(q);
      var dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy <= R * R) {
        q.hp = 1;
        smash(q, depth + 1);
      }
    }
  }

  /* ---------------------------------------------------------
     BURST（ボール指数増殖モード）
     --------------------------------------------------------- */

  function triggerBurst() {
    if (G.gauge < 100 || G.burst > 0) return;
    G.gauge = 0;
    G.burstReadyNotified = false;
    G.burstScore = 0;
    G.burst = BURST_TIME;
    G.burstUsed++;
    Sfx.burst();
    FX.flash(0.85, '255,255,255');
    FX.shake(26);
    FX.stop(0.16);
    FX.punch(0.05);
    FX.ring(W / 2, H / 2, 20, 700, '#ffffff', 0.6, 14);
    FX.pop(W / 2, H / 2 - 40, 'B U R S T !', '#fff', 62, -30);
    // 起点のボールを一気に3つに
    if (G.balls.length) {
      var b = G.balls[0];
      spawnBall(b.x, b.y, 0);
      spawnBall(b.x, b.y, 120);
    }
  }

  function endBurst() {
    Sfx.burstEnd();
    FX.flash(0.3, '160,200,255');
    FX.pop(W / 2, H * 0.42, 'BURST TOTAL', '#fff', 26, -30);
    FX.pop(W / 2, H * 0.42 + 44, '+' + fmt(G.burstScore), '#ffe66d', 50, -20);
    var keep = G.cfg.keepAfterBurst;
    // 余ったボールはスコアに変換して消える（後片付けも気持ちよく）
    while (G.balls.length > keep) {
      var b = G.balls.pop();
      var bonus = Math.round(2500 * G.waveMul * G.cfg.scoreScale);
      G.score += bonus;
      FX.spark(b.x, b.y, 10, b.hue);
      FX.pop(b.x, b.y, '+' + fmt(bonus), '#9ad', 16);
    }
    for (var i = 0; i < G.balls.length; i++) G.balls[i].stuck = false;
  }

  /* ---------------------------------------------------------
     ジャストガード
     --------------------------------------------------------- */

  function pressGuard() {
    if (!G.cfg.guard || G.state !== 'play') return;
    if (G.guardCd > 0 || G.guardWindow > 0) return;
    G.guardWindow = GUARD_WINDOW;
    G.guardArmed = true;
  }

  function doPerfectGuard(b) {
    G.perfectCount++;
    G.guardWindow = 0;
    G.guardArmed = false;
    G.guardCd = 0.12;
    G.guardFlash = 1;

    addCombo(4);
    b.pierce = 5;
    b.charged = 1.4;
    b.speed = clamp(b.speed * 1.09, 200, G.cfg.maxSpeed);
    G.gauge = Math.min(100, G.gauge + 14);

    var bonus = Math.round(3000 * G.waveMul * (1 + G.combo * 0.1) * G.cfg.scoreScale);
    G.score += bonus;

    Sfx.perfect();
    FX.flash(0.5, '255,225,120');
    FX.shake(14);
    FX.stop(0.1);
    FX.punch(0.028);
    FX.ring(b.x, b.y, 10, 190, '#ffe66d', 0.5, 8);
    FX.streak(b.x, b.y - 60, Math.PI / 2, 260, '#fff6c0');
    FX.pop(b.x, b.y - 40, 'JUST GUARD!', '#ffe66d', 34, -80);
    FX.pop(b.x, b.y - 8, '+' + fmt(bonus), '#fff', 20, -50);
    G.paddle.glow = 1;
  }

  /* ---------------------------------------------------------
     更新
     --------------------------------------------------------- */

  function update(dt, input) {
    G.elapsed += dt;

    // ヒットストップ
    var eaten = FX.consumeHitstop(dt);
    var sim = dt - eaten;

    // スローモー演出（ガチ・最後の1個が落ちそうな時）
    var target = 1;
    if (G.state === 'play' && !G.cfg.floorBounce && G.balls.length === 1) {
      var b0 = G.balls[0];
      if (b0.vy > 0 && b0.y > H - 190) {
        var far = Math.abs(b0.x - G.paddle.x) / (W * 0.5);
        target = 0.52 + 0.4 * (1 - clamp(far, 0, 1));
      }
    }
    if (G.state === 'waveclear' || G.state === 'dead') target = 0.45;
    G.timeScale += (target - G.timeScale) * Math.min(1, dt * 9);

    sim *= G.timeScale;

    FX.update(dt * (G.state === 'paused' ? 0 : 1));

    if (G.state === 'paused' || G.state === 'title' || G.state === 'gameover') {
      G.shownScore += (G.score - G.shownScore) * Math.min(1, dt * 6);
      return;
    }

    // 皿の登場アニメ
    for (var i = 0; i < G.plates.length; i++) {
      var p = G.plates[i];
      if (p.drop < 1) p.drop = Math.min(1, p.drop + dt * 2.6);
      if (p.shine > 0) p.shine = Math.max(0, p.shine - dt * 4);
    }

    updatePaddle(sim, input);

    if (G.state === 'ready' || G.state === 'play') {
      updateBalls(sim);
    }

    // コンボ減衰
    if (G.comboTimer > 0) {
      G.comboTimer -= sim;
      if (G.comboTimer <= 0) {
        if (G.combo >= 15) FX.pop(W / 2, PADDLE_Y - 150, 'CHAIN END  x' + G.combo, '#88a', 20, -40);
        G.combo = 0;
      }
    }

    // ガード
    if (G.guardWindow > 0) {
      G.guardWindow -= dt;
      if (G.guardWindow <= 0 && G.guardArmed) {
        G.guardArmed = false;
        G.guardCd = GUARD_COOLDOWN;
        Sfx.whiff();
        FX.pop(G.paddle.x, PADDLE_Y - 26, 'miss', '#667', 15, -40);
      }
    }
    if (G.guardCd > 0) G.guardCd -= dt;
    if (G.guardFlash > 0) G.guardFlash = Math.max(0, G.guardFlash - dt * 2.5);
    if (G.paddle.glow > 0) G.paddle.glow = Math.max(0, G.paddle.glow - dt * 1.8);
    if (G.paddle.squash > 0) G.paddle.squash = Math.max(0, G.paddle.squash - dt * 5);
    if (G.gaugeReadyPulse > 0) G.gaugeReadyPulse = Math.max(0, G.gaugeReadyPulse - dt * 1.5);

    // BURST
    if (G.burst > 0) {
      G.burst -= sim;
      if (G.burst <= 0) { G.burst = 0; endBurst(); }
    }

    // 盛り上がり係数
    var hypeTarget = clamp(G.combo / 30, 0, 1) * 0.7 + (G.burst > 0 ? 0.6 : 0);
    G.hype += (clamp(hypeTarget, 0, 1.2) - G.hype) * Math.min(1, dt * 4);

    // スコア表示のカウントアップ
    var diff = G.score - G.shownScore;
    G.shownScore += diff * Math.min(1, dt * 7) + Math.min(Math.abs(diff), dt * 60) * Math.sign(diff);

    // 状態遷移
    if (G.state === 'play' && G.remaining <= 0) {
      waveClear();
    }
    if (G.state === 'waveclear' || G.state === 'dead') {
      G.stateTimer -= dt;
      if (G.stateTimer <= 0) {
        if (G.state === 'waveclear') nextWave();
        else respawn();
      }
    }
    if (G.bannerTimer > 0) G.bannerTimer -= dt;
  }

  function updatePaddle(dt, input) {
    var pd = G.paddle;
    var prev = pd.x;
    var targetW = G.cfg.paddleW * (G.burst > 0 ? 1.18 : 1);
    pd.w += (targetW - pd.w) * Math.min(1, dt * 8);

    if (input.pointerActive) {
      pd.x += (input.pointerX - pd.x) * Math.min(1, dt * 26);
    }
    var kx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (kx) pd.x += kx * 780 * dt;

    pd.x = clamp(pd.x, pd.w / 2, W - pd.w / 2);
    pd.vx = (pd.x - prev) / Math.max(0.0001, dt);

    // 未発射のボールはパドルに追従
    for (var i = 0; i < G.balls.length; i++) {
      var b = G.balls[i];
      if (b.stuck) { b.x = pd.x; b.y = PADDLE_Y - b.r - 2; }
    }
  }

  function updateBalls(dt) {
    for (var i = G.balls.length - 1; i >= 0; i--) {
      var b = G.balls[i];
      if (b.born > 0) b.born -= dt;
      if (b.stuck) { pushTrail(b); continue; }
      if (b.charged > 0) b.charged = Math.max(0, b.charged - dt);

      // 速度の正規化（角度が寝すぎるのを防ぐ）
      var sp = Math.hypot(b.vx, b.vy) || 1;
      var minVy = b.speed * 0.32;
      if (Math.abs(b.vy) < minVy) {
        b.vy = (b.vy >= 0 ? 1 : -1) * minVy;
        b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(1, b.speed * b.speed - b.vy * b.vy));
      } else {
        b.vx = b.vx / sp * b.speed;
        b.vy = b.vy / sp * b.speed;
      }

      // サブステップ移動（すり抜け防止）
      var dist = b.speed * dt;
      var steps = Math.max(1, Math.ceil(dist / (b.r * 0.8)));
      var sdt = dt / steps;
      var dead = false;
      for (var s = 0; s < steps && !dead; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        dead = collide(b);
      }
      pushTrail(b);

      if (dead) {
        G.balls.splice(i, 1);
        continue;
      }
    }

    if (G.balls.length === 0 && (G.state === 'play' || G.state === 'ready')) {
      loseLife();
    }
  }

  function pushTrail(b) {
    b.trail.push(b.x, b.y);
    var cap = (b.charged > 0 ? 16 : 9) * 2;
    while (b.trail.length > cap) b.trail.splice(0, 2);
  }

  function collide(b) {
    var pan = (b.x / W) * 2 - 1;

    // 壁
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); wallHit(b, pan); }
    else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); wallHit(b, pan); }
    if (b.y - b.r < HUD_H) { b.y = HUD_H + b.r; b.vy = Math.abs(b.vy); wallHit(b, pan); }

    // 床
    if (b.y - b.r > H) {
      if (G.cfg.floorBounce || G.burst > 0) {
        b.y = H - b.r;
        b.vy = -Math.abs(b.vy);
        FX.spark(b.x, H - 4, 8, 190, { a0: -Math.PI * 0.85, a1: -Math.PI * 0.15 }, 260);
        FX.ring(b.x, H, 4, 44, 'rgba(120,200,255,.8)', 0.3, 3);
        Sfx.wall(pan);
        return false;
      }
      Sfx.miss();
      FX.spark(b.x, H - 10, 14, 0, { a0: -Math.PI * 0.9, a1: -Math.PI * 0.1 }, 300);
      FX.shake(6);
      if (G.balls.length > 1) FX.pop(b.x, H - 60, 'LOST', '#f66', 18, -60);
      return true;
    }
    if ((G.cfg.floorBounce || G.burst > 0) && b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }

    // パドル
    var pd = G.paddle;
    var px = pd.x - pd.w / 2, py = PADDLE_Y;
    if (b.vy > 0 && b.y + b.r >= py && b.y - b.r <= py + PADDLE_H &&
        b.x + b.r >= px && b.x - b.r <= px + pd.w) {
      hitPaddle(b, pan);
    }

    // 皿
    for (var i = 0; i < G.plates.length; i++) {
      var p = G.plates[i];
      if (!p.alive || p.drop < 0.4) continue;
      var cx = clamp(b.x, p.x, p.x + p.w);
      var cy = clamp(b.y, p.y, p.y + p.h);
      var dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      var pierce = b.pierce > 0;
      if (!pierce) {
        var ox = (p.w / 2 + b.r) - Math.abs(b.x - (p.x + p.w / 2));
        var oy = (p.h / 2 + b.r) - Math.abs(b.y - (p.y + p.h / 2));
        if (ox < oy) {
          b.vx = -b.vx;
          b.x += (b.x < p.x + p.w / 2 ? -ox : ox);
        } else {
          b.vy = -b.vy;
          b.y += (b.y < p.y + p.h / 2 ? -oy : oy);
        }
      }

      if (p.hp > 1 && !pierce) {
        damagePlate(p, b);
      } else {
        if (pierce) {
          b.pierce--;
          FX.streak(b.x, b.y, Math.atan2(b.vy, b.vx), 120, '#fff2b0');
          addCombo(1);
        }
        smash(p, 0);
        b.speed = clamp(b.speed + 3, 200, G.cfg.maxSpeed);
      }
      break; // 1ステップ1皿まで（安定性のため）
    }
    return false;
  }

  function wallHit(b, pan) {
    Sfx.wall(pan);
    FX.spark(b.x, b.y, 4, b.hue, null, 160);
    FX.shake(0.8);
  }

  function hitPaddle(b, pan) {
    var pd = G.paddle;
    b.y = PADDLE_Y - b.r - 0.5;

    var off = clamp((b.x - pd.x) / (pd.w / 2), -1, 1);
    var perfect = G.cfg.guard && G.guardWindow > 0 && G.guardArmed;

    // 反射角。端ほど鋭角、ジャストガード時は少し立てる
    var maxAng = perfect ? 1.02 : 1.16;
    var ang = -Math.PI / 2 + off * maxAng;
    b.vx = Math.cos(ang) * b.speed + pd.vx * 0.16;
    b.vy = Math.sin(ang) * b.speed;
    var sp = Math.hypot(b.vx, b.vy) || 1;
    b.vx = b.vx / sp * b.speed;
    b.vy = b.vy / sp * b.speed;

    pd.squash = 1;

    if (perfect) {
      doPerfectGuard(b);
      return;
    }

    Sfx.paddle(pan);
    FX.spark(b.x, PADDLE_Y, 6, 200, { a0: -Math.PI * 0.85, a1: -Math.PI * 0.15 }, 200);
    FX.shake(1.6);

    // 端当て（テク）ボーナス
    if (Math.abs(off) > 0.74) {
      addCombo(1);
      b.speed = clamp(b.speed * 1.03, 200, G.cfg.maxSpeed);
      var bonus = Math.round(600 * G.waveMul * G.cfg.scoreScale);
      G.score += bonus;
      G.gauge = Math.min(100, G.gauge + 2);
      FX.pop(b.x, PADDLE_Y - 30, 'EDGE!', '#7CFFCB', 20, -70);
      FX.ring(b.x, PADDLE_Y, 6, 60, 'rgba(124,255,203,.9)', 0.3, 4);
      Sfx.ui();
    }
  }

  /* ---------------------------------------------------------
     ライフ / ウェーブ
     --------------------------------------------------------- */

  function loseLife() {
    if (G.state === 'dead' || G.state === 'waveclear' || G.state === 'gameover') return;
    G.combo = 0; G.comboTimer = 0;
    if (G.burst > 0) { G.burst = 0; }
    if (G.cfg.lives === Infinity) { // 保険（おきらくでは通常来ない）
      G.state = 'dead'; G.stateTimer = 0.8; return;
    }
    G.lives--;
    FX.flash(0.4, '255,80,80');
    FX.shake(20);
    FX.stop(0.12);
    if (G.lives <= 0) {
      gameOver();
    } else {
      G.state = 'dead';
      G.stateTimer = 1.0;
      FX.pop(W / 2, H / 2, 'BALL LOST', '#ff6b6b', 44, -20);
    }
  }

  function respawn() {
    resetBall();
    G.state = 'ready';
  }

  function waveClear() {
    G.state = 'waveclear';
    G.stateTimer = 1.9;
    if (G.burst > 0) { G.burst = 0; endBurst(); }

    var lifeBonus = (G.lives === Infinity ? 0 : G.lives * 8000);
    var bonus = Math.round((12000 + lifeBonus + G.comboBest * 1200) * G.waveMul * G.cfg.scoreScale);
    G.score += bonus;

    Sfx.waveClear();
    FX.flash(0.55, '255,255,255');
    FX.shake(18);
    FX.punch(0.03);
    FX.ring(W / 2, H / 2, 30, 820, '#8ef', 0.7, 12);
    FX.pop(W / 2, H / 2 - 60, 'WAVE ' + G.wave + ' CLEAR!', '#fff', 52, -20);
    FX.pop(W / 2, H / 2 + 10, 'BONUS +' + fmt(bonus), '#ffe66d', 30, -30);
    for (var i = 0; i < 60; i++) {
      FX.spark(rnd(0, W), rnd(HUD_H, H), 1, rnd(0, 360), null, 420);
    }
  }

  function nextWave() {
    G.wave++;
    buildWave(G.wave);
    G.balls = [];
    resetBall();
    G.state = 'ready';
    G.bannerText = 'WAVE ' + G.wave;
    G.bannerSub = G.layoutName + '  /  x' + G.waveMul.toFixed(2) + ' SCORE';
    G.bannerTimer = 1.6;
  }

  function gameOver() {
    G.state = 'gameover';
    G.newBest = G.score > G.best;
    if (G.newBest) { G.best = Math.floor(G.score); saveBest(G.mode, G.best); }
    Sfx.gameOver();
    FX.flash(0.6, '255,60,60');
    FX.shake(26);
    if (global.onGameOver) global.onGameOver();
  }

  function quitToTitle() {
    if (G.state !== 'title' && G.score > G.best) {
      G.best = Math.floor(G.score);
      saveBest(G.mode, G.best);
    }
    G.state = 'title';
  }

  global.Game = {
    W: W, H: H, HUD_H: HUD_H, PADDLE_Y: PADDLE_Y, PADDLE_H: PADDLE_H,
    MODES: MODES, G: G,
    start: start, update: update, launch: launch,
    pressGuard: pressGuard, triggerBurst: triggerBurst,
    loadBest: loadBest, quitToTitle: quitToTitle, fmt: fmt, clamp: clamp
  };
})(window);
