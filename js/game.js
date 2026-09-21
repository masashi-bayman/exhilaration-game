/* ============================================================
   game.js  --  EXHILARATION / 皿割りブレイカー 本体
   ============================================================ */
(function (global) {
  'use strict';

  var W = 1280, H = 720;   // 16:9。横長スマホにもぴったり収まる

  var HUD_H = 74;
  var PLATE_TOP = 150;
  var PLATE_W = 74, PLATE_H = 26, GAP_X = 6, GAP_Y = 9;
  var FLOOR_MARGIN = 150;   // 最下段の皿とパドルの間に必ず空ける余白
  var PADDLE_Y = H - 72, PADDLE_H = 14;   // 下に HUD 帯を置くぶん少し上げる
  var BALL_R = 8;

  var MODES = {
    easy: {
      key: 'easy', label: 'おきらく', sub: '落ちない。ただひたすら割る。',
      lives: Infinity, floorBounce: true,
      paddleW: 208, ballSpeed: 428, speedUp: 0.021, maxSpeed: 840,
      gaugeRate: 1.75, autoBurst: true, guard: false,
      comboTime: 2.6, ballCap: 64, keepAfterBurst: 5, scoreScale: 1.0
    },
    hard: {
      key: 'hard', label: 'ガチ', sub: 'ジャストガードを決めろ。',
      lives: 3, floorBounce: false,
      paddleW: 138, ballSpeed: 512, speedUp: 0.036, maxSpeed: 1010,
      gaugeRate: 1.0, autoBurst: false, guard: true,
      comboTime: 1.9, ballCap: 44, keepAfterBurst: 3, scoreScale: 1.6
    }
  };

  var PLATE_VALUE = { 1: 1, 2: 2.2, 3: 3.6, 4: 3.0, 5: 0 };
  var PLATE_HP = { 1: 1, 2: 2, 3: 3, 4: 1, 5: 1 };
  var WALL = 5;   // 壊せないブロック

  function isWall(p) { return p.type === WALL; }

  var BURST_TIME = 6.5;
  // 壊せない壁の間で往復し続けて戻ってこないのを防ぐ仕掛け。
  // 「戻ってこない」＝パドルの高さまで降りてこない、で判定する。
  // 皿に当たるか、パドルの高さまで降りてくれば 0 に戻る。
  var STALL_SOFT = 3.0;    // これを超えたらパドルの方へ진行方向を寄せ始める
  var STALL_HARD = 6.5;    // それでも駄目なら強制的にパドルの上へ戻す
  var WALL_SCATTER = 0.20; // 壊せない壁で跳ねるたびに角度を散らす量（ラジアン）
  var LEVELUP_LEAD = 1.6;   // 経験値が満タンになってから、カードが出るまで
  var GUARD_WINDOW = 0.14;
  var GUARD_COOLDOWN = 0.45;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /** 速さを保ったまま進行方向を少しだけずらす（完全な往復軌道を壊すため） */
  function scatter(b, amount) {
    var a = Math.atan2(b.vy, b.vx) + (Math.random() * 2 - 1) * amount;
    var sp = Math.hypot(b.vx, b.vy) || b.speed;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }

  // 桁が増えても HUD を圧迫しないよう、100万以上は SI 接頭辞に畳む
  //   999,999 → "999,999" ／ 1,234,567 → "1.23M" ／ 10^33 → "1000Q"
  var SI = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];
  function fmtS(n) {
    n = Math.floor(n);
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmtS(-n);
    if (n < 1000000) return n.toLocaleString('en-US');
    var i = 0, v = n;
    while (v >= 1000 && i < SI.length - 1) { v /= 1000; i++; }
    return v.toFixed(v < 10 ? 2 : (v < 100 ? 1 : 0)) + SI[i];
  }

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

    plates: [], remaining: 0, layoutName: '', plateTop: 150,
    // 皿はきれいな格子に並ぶので、格子を索引しておけば
    // 皿が何百枚あってもボール1個あたり数枚の判定で済む
    cellW: 74, cellH: 26, gapX: 6, gapY: 9,
    gridOx: 0, gridOy: 0, gridCols: 0, gridRows: 0, gridCells: null,
    balls: [], paddle: null,

    // --- レベルアップ（3択強化） ---
    level: 1, xp: 0, xpNeed: 6, pendingLevels: 0,
    upLv: {}, choices: [], rerolls: 0, resumeState: 'play',
    levelUpArmed: false, levelUpTimer: 0,
    safety: 0, comboMax: 2.6, burstMax: 6.5,

    timeScale: 1, stateTimer: 0, elapsed: 0,
    guardWindow: 0, guardCd: 0, guardFlash: 0, guardArmed: false,
    hype: 0,              // 背景の盛り上がり 0..1
    bannerText: '', bannerSub: '', bannerTimer: 0,
    newBest: false
  };

  /* ---------------------------------------------------------
     強化（upLv）から導かれる実際の数値
     --------------------------------------------------------- */

  function lv(id) { return G.upLv[id] || 0; }

  function paddleWidth() {
    return G.cfg.paddleW * (1 + 0.13 * lv('paddle')) * (G.burst > 0 ? 1.18 : 1);
  }
  function ballRadius() {
    // 後半は皿が細かくなるので、ボールも一緒に小さくする
    var shrink = 1 - Math.min(0.38, Math.max(0, G.wave - 5) * 0.02);
    return Math.max(4.5, BALL_R * shrink) * (1 + 0.18 * lv('size'));
  }
  function ballBaseSpeed() {
    return G.cfg.ballSpeed * (1 + (G.wave - 1) * G.cfg.speedUp) * (1 + 0.07 * lv('speed'));
  }
  function scoreMul() {
    return G.cfg.scoreScale * (1 + 0.22 * lv('score')) * (1 + 0.08 * lv('speed'));
  }
  function comboTime() { return G.cfg.comboTime + 0.35 * lv('comboTime'); }
  function gaugeRate() { return G.cfg.gaugeRate * (1 + 0.28 * lv('gauge')); }
  function burstTime() { return BURST_TIME + 1.6 * lv('burstTime'); }
  function guardWindowLen() { return GUARD_WINDOW * (1 + 0.35 * lv('guardWin')); }

  function xpNeedFor(level) { return Math.round(6 * Math.pow(1.16, level - 1)); }
  function xpValue(type) { return type === 1 ? 1 : (type === 2 ? 2 : (type === 3 ? 3 : 2)); }

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
    G.level = 1; G.xp = 0; G.xpNeed = xpNeedFor(1); G.pendingLevels = 0;
    G.upLv = {}; G.choices = []; G.rerolls = 0; G.safety = 0;
    G.levelUpArmed = false; G.levelUpTimer = 0;
    G.comboMax = G.cfg.comboTime; G.burstMax = BURST_TIME;
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
    // ウェーブが進むほどセルが小さくなり、的の数が増える
    var cw = L.cellW, ch = L.cellH, gx = L.gapX, gy = L.gapY;
    G.cellW = cw; G.cellH = ch; G.gapX = gx; G.gapY = gy;

    var totalW = L.cols * cw + (L.cols - 1) * gx;
    var ox = (W - totalW) / 2;

    // ウェーブが進むほど盤面が下がってくる（＝事故りやすくなる）。
    // ただしパドルの上には必ず FLOOR_MARGIN を残すので、理不尽にはならない。
    var gridH = L.rows * ch + (L.rows - 1) * gy;
    var sink = Math.min(96, Math.floor(wave / 2) * 6);
    var top = Math.min(PLATE_TOP + sink, PADDLE_Y - FLOOR_MARGIN - gridH);
    top = Math.max(HUD_H + 34, top);
    G.plateTop = top;

    G.gridOx = ox; G.gridOy = top;
    G.gridCols = L.cols; G.gridRows = L.rows;
    G.gridCells = new Array(L.cols * L.rows).fill(null);

    for (var r = 0; r < L.rows; r++) {
      for (var c = 0; c < L.cols; c++) {
        var t = L.grid[r][c];
        if (!t) continue;
        var plate = {
          x: ox + c * (cw + gx),
          y: top + r * (ch + gy),
          w: cw, h: ch,
          type: t, hp: PLATE_HP[t], maxhp: PLATE_HP[t],
          alive: true, row: r, col: c,
          hue: t === WALL ? 220 : (t === 4 ? 45 : (t === 3 ? 205 : (t === 2 ? 22 :
                172 + r * (150 / Math.max(1, L.rows - 1))))),
          shine: 0, drop: -rnd(0.05, 0.45)   // 登場アニメ用
        };
        G.plates.push(plate);
        G.gridCells[r * L.cols + c] = plate;
      }
    }
    // 強化「爆発皿の増設」
    var extraBombs = 2 * lv('bomb');
    for (var e = 0; e < extraBombs; e++) {
      var cands = G.plates.filter(function (q) { return q.type !== 4 && !isWall(q); });
      if (!cands.length) break;
      var pick = cands[(Math.random() * cands.length) | 0];
      pick.type = 4; pick.hp = 1; pick.maxhp = 1; pick.hue = 45;
    }

    G.remaining = 0;
    for (var m = 0; m < G.plates.length; m++) if (!isWall(G.plates[m])) G.remaining++;
    G.waveMul = Math.pow(1.28, wave - 1);
    G.safety = lv('safety');   // 安全ネットはウェーブごとに回復
  }

  function resetBall() {
    G.balls = [{
      x: G.paddle.x, y: PADDLE_Y - ballRadius() - 2,
      vx: 0, vy: 0, r: ballRadius(),
      speed: ballBaseSpeed(),
      pierce: 0, charged: 0, stuck: true, trail: [], hue: 190, born: 0, idle: 0
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
      var extra = (G.mode === 'easy' ? 2 : 0) + lv('balls');
      if (extra > 0 && G.balls.length === 1) {
        var b0 = G.balls[0];
        for (var k = 0; k < extra; k++) spawnBall(b0.x, b0.y - 4, (90 + k * 77) % 360);
      }
    }
  }

  /* ---------------------------------------------------------
     皿を割る
     --------------------------------------------------------- */

  function plateCenter(p) { return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; }

  function addCombo(n) {
    G.combo += n;
    G.comboMax = comboTime();
    G.comboTimer = G.comboMax;
    if (G.combo > G.comboBest) G.comboBest = G.combo;
  }

  function spawnBall(x, y, hue) {
    if (G.balls.length >= G.cfg.ballCap) return null;
    var base = ballBaseSpeed();
    var a = y > H * 0.55 ? (-Math.PI / 2 + rnd(-1.05, 1.05)) : rnd(0, Math.PI * 2);
    var b = {
      x: x, y: y, vx: Math.cos(a), vy: Math.sin(a), r: ballRadius(),
      speed: clamp(base * rnd(0.95, 1.15), 200, G.cfg.maxSpeed),
      pierce: 0, charged: 0, stuck: false, trail: [], hue: hue == null ? rnd(0, 360) : hue, born: 0.12, idle: 0
    };
    b.vx *= b.speed; b.vy *= b.speed;
    G.balls.push(b);
    if (G.balls.length > G.maxBallsSeen) G.maxBallsSeen = G.balls.length;
    Sfx.spawn(G.balls.length, (x / W) * 2 - 1);
    FX.ring(x, y, 2, 26, 'hsl(' + b.hue + ',100%,70%)', 0.28, 3);
    return b;
  }

  function damagePlate(p, ball, dmg) {
    var c = plateCenter(p);
    p.hp -= (dmg || 1);
    p.shine = 1;
    G.comboTimer = Math.max(G.comboTimer, 0.5);
    Sfx.clink((c.x / W) * 2 - 1);
    FX.spark(c.x, c.y, 5, p.hue, null, 200);
    FX.shake(1.5);
    FX.stop(0.01);
    G.score += Math.round(40 * G.waveMul * scoreMul());
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
    var gain = Math.round(100 * val * G.waveMul * mul * scoreMul());
    G.score += gain;
    if (G.burst > 0) G.burstScore += gain;

    G.xp += xpValue(p.type) * (1 + 0.3 * lv('xp'));

    if (G.burst <= 0) {
      G.gauge = Math.min(100, G.gauge + val * gaugeRate() * 1.35);
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
      FX.pop(c.x, c.y, '+' + fmtS(gain), popCol,
             (G.burst > 0 ? 13 : 15) + Math.min(20, G.combo * 0.65));
    }

    // BURST 中は割るたびにボールが増える → ねずみ算
    if (G.burst > 0) spawnBall(c.x, c.y, (G.elapsed * 220 + G.balls.length * 37) % 360);

    // 通常時もコンボ25ごとにご褒美ボール
    if (G.burst <= 0 && G.combo % 25 === 0 && G.balls.length < 8) {
      spawnBall(c.x, c.y, 50);
      FX.pop(c.x, c.y - 26, 'EXTRA BALL!', '#7CFFCB', 22, -60);
    }

    // 強化「分裂」
    if (G.burst <= 0 && lv('split') && G.balls.length < G.cfg.ballCap &&
        Math.random() < 0.09 * lv('split')) {
      spawnBall(c.x, c.y, 285);
    }

    // 強化「電撃連鎖」
    if (lv('chain') && depth < 3 && Math.random() < 0.20 * lv('chain')) {
      var q = nearestPlate(c.x, c.y, 210 * clamp(G.cellW / 74, 0.55, 1.15), p);
      if (q) {
        var qc = plateCenter(q);
        FX.streak((c.x + qc.x) / 2, (c.y + qc.y) / 2,
                  Math.atan2(qc.y - c.y, qc.x - c.x),
                  Math.hypot(qc.x - c.x, qc.y - c.y), '#aee9ff');
        FX.spark(qc.x, qc.y, 6, 195);
        q.hp = 1;
        smash(q, depth + 1);
      }
    }

    // 強化「衝撃波」
    if (p.type !== 4 && lv('explode') && depth < 3 &&
        Math.random() < 0.12 * lv('explode')) {
      explode(c.x, c.y, depth, 76);
    }

    if (p.type === 4) explode(c.x, c.y, depth);
  }

  /** (x,y) から range 内でいちばん近い生きている皿 */
  function nearestPlate(x, y, range, except) {
    var best = null, bd = range * range;
    for (var i = 0; i < G.plates.length; i++) {
      var q = G.plates[i];
      if (!q.alive || q === except || q.drop < 0.4 || isWall(q)) continue;
      var c = plateCenter(q);
      var dx = c.x - x, dy = c.y - y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  function explode(x, y, depth, radius) {
    var scale = clamp(G.cellW / 74, 0.55, 1.15);
    var R = (radius || 108) * scale;
    Sfx.boom((x / W) * 2 - 1);
    FX.ring(x, y, 8, R * 1.25, '#ffd166', 0.45, 9);
    FX.ring(x, y, 4, R * 0.7, '#ffffff', 0.3, 5);
    FX.spark(x, y, Math.round(34 * R / 108), 45, null, 620);
    FX.flash(0.3, '255,205,90');
    FX.shake(16);
    FX.stop(0.07);
    FX.punch(0.02);
    FX.buzz(30);
    if (depth > 3) return;
    for (var i = 0; i < G.plates.length; i++) {
      var q = G.plates[i];
      if (!q.alive || isWall(q)) continue;
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
    G.burstMax = burstTime();
    G.burst = G.burstMax;
    G.burstUsed++;
    Sfx.burst();
    FX.flash(0.85, '255,255,255');
    FX.shake(26);
    FX.stop(0.16);
    FX.punch(0.05);
    FX.ring(W / 2, H / 2, 20, 700, '#ffffff', 0.6, 14);
    FX.buzz([0, 45, 35, 70, 35, 110]);
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
    FX.pop(W / 2, H * 0.42 + 44, '+' + fmtS(G.burstScore), '#ffe66d', 50, -20);
    var keep = G.cfg.keepAfterBurst;
    // 余ったボールはスコアに変換して消える（後片付けも気持ちよく）
    while (G.balls.length > keep) {
      var b = G.balls.pop();
      var bonus = Math.round(2500 * G.waveMul * scoreMul());
      G.score += bonus;
      FX.spark(b.x, b.y, 10, b.hue);
      FX.pop(b.x, b.y, '+' + fmtS(bonus), '#9ad', 16);
    }
    for (var i = 0; i < G.balls.length; i++) G.balls[i].stuck = false;
  }

  /* ---------------------------------------------------------
     ジャストガード
     --------------------------------------------------------- */

  function pressGuard() {
    if (!G.cfg.guard || G.state !== 'play') return;
    if (G.guardCd > 0 || G.guardWindow > 0) return;
    G.guardWindow = guardWindowLen();
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

    var bonus = Math.round(3000 * G.waveMul * (1 + G.combo * 0.1) * scoreMul());
    G.score += bonus;

    Sfx.perfect();
    FX.flash(0.5, '255,225,120');
    FX.shake(14);
    FX.stop(0.1);
    FX.punch(0.028);
    FX.ring(b.x, b.y, 10, 190, '#ffe66d', 0.5, 8);
    FX.buzz([0, 16, 22, 45]);
    FX.streak(b.x, b.y - 60, Math.PI / 2, 260, '#fff6c0');
    FX.pop(b.x, b.y - 40, 'JUST GUARD!', '#ffe66d', 34, -80);
    FX.pop(b.x, b.y - 8, '+' + fmtS(bonus), '#fff', 20, -50);
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
    if (G.levelUpArmed) target = Math.min(target, 0.42);   // 予告中はゆっくりに
    G.timeScale += (target - G.timeScale) * Math.min(1, dt * 9);

    sim *= G.timeScale;

    var frozen = (G.state === 'paused' || G.state === 'levelup');
    FX.update(dt * (frozen ? 0 : 1));

    if (frozen || G.state === 'title' || G.state === 'gameover') {
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

    // コンボ減衰。ウェーブクリア中・発射待ち・ミス後の待機中は止める
    // （プレイヤーが操作できない時間で繋ぎが切れるのは理不尽なので）
    if (G.comboTimer > 0 && G.state === 'play') {
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

    // レベルアップ判定（一気に複数上がることもある）
    while (G.xp >= G.xpNeed) {
      G.xp -= G.xpNeed;
      G.level++;
      G.xpNeed = xpNeedFor(G.level);
      G.pendingLevels++;
    }

    // いきなり画面を止めると操作感を失うので、まず予告を出してから開く。
    // BURST 中は水を差さないので、終わってからまとめて選ばせる。
    var canOpen = (G.state === 'play' || G.state === 'ready') && G.burst <= 0;
    if (G.pendingLevels > 0 && canOpen && !G.levelUpArmed) {
      G.levelUpArmed = true;
      G.levelUpTimer = LEVELUP_LEAD;
      Sfx.levelWarn();
      FX.ring(W / 2, HUD_H + 56, 10, 320, '#7CFFCB', 0.7, 6);
      FX.flash(0.18, '124,255,203');
    }
    if (G.levelUpArmed) {
      if (canOpen) G.levelUpTimer -= dt;
      if (G.levelUpTimer <= 0 && canOpen) {
        G.levelUpArmed = false;
        G.levelUpTimer = 0;
        openLevelUp();
      }
    }
  }

  function updatePaddle(dt, input) {
    var pd = G.paddle;
    var prev = pd.x;
    var targetW = paddleWidth();
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
      if (b.stuck) { b.idle = 0; pushTrail(b); continue; }
      if (b.charged > 0) b.charged = Math.max(0, b.charged - dt);

      // 速度の正規化（角度が寝すぎるのを防ぐ）
      // ただし詰まっているときは横move も許して、壁の隙間を探せるようにする
      var stalling = (b.idle || 0) > STALL_SOFT;
      var sp = Math.hypot(b.vx, b.vy) || 1;
      var minVy = b.speed * (stalling ? 0.10 : 0.32);
      if (Math.abs(b.vy) < minVy) {
        b.vy = (b.vy >= 0 ? 1 : -1) * minVy;
        b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(1, b.speed * b.speed - b.vy * b.vy));
      } else {
        b.vx = b.vx / sp * b.speed;
        b.vy = b.vy / sp * b.speed;
      }

      // --- 進行不能（壁の間で往復し続けている）の検出 ---
      // 皿を割る・パドルに当たる、のどちらかが起きれば 0 に戻る
      b.idle = (b.idle || 0) + dt;
      if (stalling) {
        // 進行方向をパドルの方へ少しずつ向け直す。
        // 「下向きの速度を足す」だと上の最低縦速度の補正に打ち消されるので、
        // 速さは変えずに角度だけ回す。
        var cur = Math.atan2(b.vy, b.vx);
        var want = Math.atan2(PADDLE_Y - b.y, G.paddle.x - b.x);
        var diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        var rate = 0.9 * Math.min(3.5, (b.idle - STALL_SOFT) / 1.2);   // rad/秒
        var na = cur + clamp(diff, -1, 1) * rate * dt;
        b.vx = Math.cos(na) * b.speed;
        b.vy = Math.sin(na) * b.speed;
      }
      if (b.idle > STALL_HARD) {
        b.x = clamp(G.paddle.x, b.r + 2, W - b.r - 2);
        b.y = PADDLE_Y - b.r - 8;
        var back = -Math.PI / 2 + rnd(-0.45, 0.45);
        b.vx = Math.cos(back) * b.speed;
        b.vy = Math.sin(back) * b.speed;
        b.idle = 0;
        FX.pop(b.x, b.y - 34, 'RETURN', '#9fe4ff', 20, -70);
        FX.ring(b.x, b.y, 6, 110, '#9fe4ff', 0.45, 5);
        Sfx.ui();
      }

      // 強化「皿レーダー」：上昇中のボールが皿へ寄っていく
      var mg = lv('magnet');
      if (mg && b.vy < 0) {
        var t = nearestPlate(b.x, b.y, 1200, null);
        if (t) {
          var tc = plateCenter(t);
          b.vx += (tc.x > b.x ? 1 : -1) * 300 * mg * dt;
          var s2 = Math.hypot(b.vx, b.vy) || 1;
          b.vx = b.vx / s2 * b.speed;
          b.vy = b.vy / s2 * b.speed;
        }
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
      // 強化「安全ネット」
      if (G.safety > 0) {
        G.safety--;
        b.y = H - b.r;
        b.vy = -Math.abs(b.vy);
        Sfx.ding();
        FX.ring(b.x, H, 6, 150, '#7CFFCB', 0.5, 7);
        FX.spark(b.x, H - 4, 14, 150, { a0: -Math.PI * 0.85, a1: -Math.PI * 0.15 }, 320);
        FX.pop(b.x, H - 80, 'SAFE!  x' + G.safety, '#7CFFCB', 26, -70);
        FX.flash(0.22, '124,255,203');
        FX.shake(9);
        FX.buzz(25);
        return false;
      }
      Sfx.miss();
      FX.spark(b.x, H - 10, 14, 0, { a0: -Math.PI * 0.9, a1: -Math.PI * 0.1 }, 300);
      FX.shake(6);
      if (G.balls.length > 1) FX.pop(b.x, H - 60, 'LOST', '#f66', 18, -60);
      return true;
    }
    if ((G.cfg.floorBounce || G.burst > 0) && b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }

    // パドルの高さまで降りてきたら「ちゃんと戻ってきた」とみなす。
    // （拾えたかどうかは関係ない。プレイヤーの手が届く位置に来たかどうか）
    if (b.y + b.r >= PADDLE_Y) b.idle = 0;

    // パドル
    var pd = G.paddle;
    var px = pd.x - pd.w / 2, py = PADDLE_Y;
    if (b.vy > 0 && b.y + b.r >= py && b.y - b.r <= py + PADDLE_H &&
        b.x + b.r >= px && b.x - b.r <= px + pd.w) {
      hitPaddle(b, pan);
    }

    // 皿（格子索引で、ボールが重なりうる升だけを調べる）
    var stepX = G.cellW + G.gapX, stepY = G.cellH + G.gapY;
    var c0 = Math.floor((b.x - b.r - G.gridOx) / stepX);
    var c1 = Math.floor((b.x + b.r - G.gridOx) / stepX);
    var r0 = Math.floor((b.y - b.r - G.gridOy) / stepY);
    var r1 = Math.floor((b.y + b.r - G.gridOy) / stepY);
    if (c0 < 0) c0 = 0;
    if (r0 < 0) r0 = 0;
    if (c1 > G.gridCols - 1) c1 = G.gridCols - 1;
    if (r1 > G.gridRows - 1) r1 = G.gridRows - 1;

    for (var gr = r0; gr <= r1; gr++) {
    for (var gc = c0; gc <= c1; gc++) {
      var p = G.gridCells ? G.gridCells[gr * G.gridCols + gc] : null;
      if (!p || !p.alive || p.drop < 0.4) continue;
      var cx = clamp(b.x, p.x, p.x + p.w);
      var cy = clamp(b.y, p.y, p.y + p.h);
      var dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      var wall = isWall(p);
      var hasPierce = !wall && b.pierce > 0;
      var luckyPierce = !wall && !hasPierce && lv('pierce') > 0 &&
                        Math.random() < 0.14 * lv('pierce');
      var pierce = hasPierce || luckyPierce;
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

      if (wall) {
        p.shine = 1;
        Sfx.clink((b.x / W) * 2 - 1);
        FX.spark(b.x, b.y, 4, 210, null, 170);
        FX.shake(2);
        // 壁はザラついている、という扱いにして毎回角度を散らす。
        // これで「天井と壁の間を真上下に往復し続ける」状態が続かない。
        // 戻ってこない時間が長いほど強く散らして、早く抜け出させる。
        scatter(b, WALL_SCATTER * (1 + Math.min(2.5, (b.idle || 0))));
        return false;   // 入れ子ループなので break ではなく抜ける
      }

      b.idle = 0;   // 皿に触れたので「進行中」
      var dmg = 1 + lv('power');
      if (p.hp > dmg && !pierce) {
        damagePlate(p, b, dmg);
      } else {
        if (pierce) {
          if (hasPierce) b.pierce--;
          FX.streak(b.x, b.y, Math.atan2(b.vy, b.vx), 120, '#fff2b0');
          addCombo(1);
        }
        smash(p, 0);
        b.speed = clamp(b.speed + 3, 200, G.cfg.maxSpeed);
      }
      return false; // 1ステップ1皿まで（安定性のため）
    }
    }
    return false;
  }

  function wallHit(b, pan) {
    Sfx.wall(pan);
    FX.spark(b.x, b.y, 4, b.hue, null, 160);
    FX.shake(0.8);
    // ごくわずかに角度を散らす。完全に同じ軌道を往復し続けるのを防ぐ。
    scatter(b, (b.idle || 0) > 1.5 ? 0.06 : 0.015);
  }

  function hitPaddle(b, pan) {
    var pd = G.paddle;
    b.idle = 0;   // パドルに返ってきたので「進行中」
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
      var bonus = Math.round(600 * G.waveMul * scoreMul());
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
    FX.buzz(140);
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
    var bonus = Math.round((12000 + lifeBonus + G.comboBest * 1200) * G.waveMul * scoreMul());
    G.score += bonus;

    Sfx.waveClear();
    FX.flash(0.55, '255,255,255');
    FX.shake(18);
    FX.punch(0.03);
    FX.ring(W / 2, H / 2, 30, 820, '#8ef', 0.7, 12);
    FX.buzz([0, 30, 45, 60]);
    FX.pop(W / 2, H / 2 - 60, 'WAVE ' + G.wave + ' CLEAR!', '#fff', 52, -20);
    FX.pop(W / 2, H / 2 + 10, 'BONUS +' + fmtS(bonus), '#ffe66d', 30, -30);
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
    G.bannerSub = G.layoutName + '  /  スコア x' +
                  (G.waveMul < 1000 ? G.waveMul.toFixed(2) : fmtS(G.waveMul));
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

  /* ---------------------------------------------------------
     レベルアップ（3択強化）
     --------------------------------------------------------- */

  function openLevelUp() {
    G.resumeState = (G.state === 'ready') ? 'ready' : 'play';
    G.state = 'levelup';
    G.choices = Upgrades.roll(G.mode, G.upLv, 3);
    Sfx.levelUp();
    FX.flash(0.45, '170,230,255');
    FX.shake(10);
    FX.punch(0.02);
    FX.buzz([0, 25, 30, 25]);
    if (global.onLevelUp) global.onLevelUp(G.choices);
  }

  function applyUpgrade(u) {
    var n = (G.upLv[u.id] || 0) + 1;
    G.upLv[u.id] = n;

    switch (u.id) {
      case 'life':
        if (G.lives !== Infinity) G.lives++;
        break;
      case 'reroll':
        G.rerolls++;
        break;
      case 'safety':
        G.safety = n;
        break;
      case 'balls': {
        var b0 = G.balls[0];
        if (b0 && !b0.stuck) spawnBall(b0.x, b0.y - 6, 200);
        break;
      }
      case 'bonus': {
        var bo = Math.round(50000 * G.waveMul * scoreMul());
        G.score += bo;
        FX.pop(W / 2, H * 0.5, '+' + fmtS(bo), '#ffe66d', 46, -30);
        break;
      }
    }

    // 既存のボール・パドルにも即反映
    var r = ballRadius();
    for (var i = 0; i < G.balls.length; i++) {
      var b = G.balls[i];
      b.r = r;
      if (u.id === 'speed') b.speed = clamp(b.speed * 1.07, 200, G.cfg.maxSpeed);
    }
    G.paddle.w = paddleWidth();
    G.comboMax = comboTime();

    FX.pop(W / 2, H * 0.40, u.icon + ' ' + u.name + '  Lv.' + n, '#7CFFCB', 30, -50);
    FX.ring(W / 2, H * 0.45, 20, 420, '#7CFFCB', 0.5, 7);
  }

  function pickUpgrade(i) {
    if (G.state !== 'levelup') return;
    var u = G.choices[i];
    if (!u) return;
    applyUpgrade(u);
    G.pendingLevels = Math.max(0, G.pendingLevels - 1);
    Sfx.ui();
    if (G.pendingLevels > 0) {
      G.choices = Upgrades.roll(G.mode, G.upLv, 3);
      if (global.onLevelUp) global.onLevelUp(G.choices);
    } else {
      G.state = G.resumeState;
      if (global.onLevelUpClose) global.onLevelUpClose();
    }
  }

  function rerollChoices() {
    if (G.state !== 'levelup' || G.rerolls <= 0) return;
    G.rerolls--;
    G.choices = Upgrades.roll(G.mode, G.upLv, 3);
    Sfx.ui();
    if (global.onLevelUp) global.onLevelUp(G.choices);
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
    MODES: MODES, G: G, LEVELUP_LEAD: LEVELUP_LEAD,
    start: start, update: update, launch: launch,
    pressGuard: pressGuard, triggerBurst: triggerBurst,
    pickUpgrade: pickUpgrade, rerollChoices: rerollChoices,
    loadBest: loadBest, quitToTitle: quitToTitle,
    fmt: fmt, fmtS: fmtS, clamp: clamp, isWall: isWall, WALL: WALL
  };
})(window);
