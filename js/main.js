/* ============================================================
   main.js  --  ループ / 入力 / 画面遷移
   ============================================================ */
(function (global) {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var G = Game.G;

  var input = { pointerActive: false, pointerX: Game.W / 2, left: false, right: false };
  var pausedFrom = 'play';

  var isTouch = ('ontouchstart' in global) ||
                (global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  var isStandalone = (global.matchMedia && global.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) ||
                     global.navigator.standalone === true;

  // タッチ端末はボール上限を下げて安定させる
  if (isTouch) {
    Game.MODES.easy.ballCap = 40;
    Game.MODES.hard.ballCap = 28;
  }

  /* ---------- 画面 ---------- */
  var screens = {
    title: document.getElementById('screen-title'),
    pause: document.getElementById('screen-pause'),
    over: document.getElementById('screen-over'),
    levelup: document.getElementById('screen-levelup')
  };

  function showScreen(name) {
    for (var k in screens) {
      if (screens[k]) screens[k].classList.toggle('on', k === name);
    }
    document.getElementById('overlay').classList.toggle('on', !!name);
  }

  function refreshTitleBests() {
    document.getElementById('best-easy').textContent = Game.fmtS(Game.loadBest('easy'));
    document.getElementById('best-hard').textContent = Game.fmtS(Game.loadBest('hard'));
  }

  function startMode(mode) {
    Sfx.init();
    Sfx.ui();
    Game.start(mode);
    showScreen(null);
  }

  /* ---------- レベルアップ（3択強化） ---------- */
  var cardsEl = document.getElementById('lv-cards');
  var rerollBtn = document.getElementById('lv-reroll');

  /** 取得済み強化をチップで並べる */
  function renderHave(el) {
    if (!el) return;
    var ids = Object.keys(G.upLv);
    el.innerHTML = '';
    ids.forEach(function (id) {
      var u = Upgrades.get(id);
      if (!u || !G.upLv[id]) return;
      var d = document.createElement('div');
      d.className = 'have-item';
      d.innerHTML = '<span class="hi-icon"></span><span class="hi-name"></span>' +
                    '<span class="hi-lv"></span>';
      d.querySelector('.hi-icon').textContent = u.icon;
      d.querySelector('.hi-name').textContent = u.name;
      d.querySelector('.hi-lv').textContent = 'Lv.' + G.upLv[id];
      el.appendChild(d);
    });
  }

  function renderCards(choices) {
    cardsEl.innerHTML = '';
    choices.forEach(function (u, i) {
      var cur = G.upLv[u.id] || 0;
      var next = cur + 1;
      var btn = document.createElement('button');
      btn.className = 'card t' + (u.tier || 1) + (next >= u.max && u.id !== 'bonus' ? ' maxed' : '');
      btn.innerHTML =
        '<span class="card-key"></span>' +
        '<span class="card-icon"></span>' +
        '<span class="card-name"></span>' +
        '<span class="card-lv"></span>' +
        '<span class="card-desc"></span>' +
        '<span class="card-pips"></span>';
      btn.querySelector('.card-key').textContent = (i + 1);
      btn.querySelector('.card-icon').textContent = u.icon;
      btn.querySelector('.card-name').textContent = u.name;
      btn.querySelector('.card-lv').textContent =
        (u.id === 'bonus') ? 'ボーナス'
          : (cur === 0 ? 'NEW!' : 'Lv.' + cur + ' → Lv.' + next);
      btn.querySelector('.card-desc').textContent = u.desc(next);

      // 上限までの段階をピップで表示
      if (u.id !== 'bonus') {
        var pips = btn.querySelector('.card-pips');
        for (var k = 0; k < u.max; k++) {
          var pip = document.createElement('span');
          pip.className = 'card-pip' + (k < cur ? ' on' : (k === cur ? ' next' : ''));
          pips.appendChild(pip);
        }
      }
      btn.addEventListener('click', function () { Game.pickUpgrade(i); });
      cardsEl.appendChild(btn);
    });
  }

  global.onLevelUp = function (choices) {
    document.getElementById('lv-num').textContent = G.level;
    document.getElementById('lv-rerolls').textContent = G.rerolls;
    rerollBtn.disabled = G.rerolls <= 0;
    renderCards(choices);
    renderHave(document.getElementById('lv-have'));
    showScreen('levelup');
  };

  global.onLevelUpClose = function () { showScreen(null); requestLock(); };

  rerollBtn.addEventListener('click', function () { Game.rerollChoices(); });

  global.onGameOver = function () {
    document.getElementById('over-score').textContent = Game.fmtS(G.score);
    document.getElementById('over-level').textContent = G.level;
    document.getElementById('over-wave').textContent = G.wave;
    document.getElementById('over-combo').textContent = G.comboBest;
    document.getElementById('over-balls').textContent = G.maxBallsSeen;
    document.getElementById('over-plates').textContent = G.totalSmashed;
    document.getElementById('over-perfect').textContent = G.perfectCount;
    document.getElementById('over-burst').textContent = G.burstUsed;
    document.getElementById('over-best').textContent = Game.fmtS(G.best);
    document.getElementById('over-newbest').style.display = G.newBest ? 'block' : 'none';
    document.getElementById('over-mode').textContent = G.cfg.label;
    renderHave(document.getElementById('over-have'));
    setTimeout(function () { showScreen('over'); }, 900);
  };

  function togglePause() {
    if (G.state === 'paused') {
      G.state = pausedFrom;
      showScreen(null);
      requestLock();
    } else if (['ready', 'play', 'waveclear', 'dead'].indexOf(G.state) >= 0) {
      pausedFrom = G.state;
      G.state = 'paused';
      renderHave(document.getElementById('pause-have'));
      showScreen('pause');
    }
  }

  function backToTitle() {
    Game.quitToTitle();
    refreshTitleBests();
    showScreen('title');
  }

  /* ---------- ポインタロック ----------
     弾が動いている間（state === 'play'）はカーソルを画面内に閉じ込める。
     ポーズ中・強化の3択中・発射待ちなど、弾が止まっているときは解放する。 */
  var pointerLocked = false;
  var canLock = !isTouch && !!canvas.requestPointerLock;

  function requestLock() {
    if (!canLock || pointerLocked) return;
    if (G.state !== 'play') return;
    try {
      var pr = canvas.requestPointerLock();
      if (pr && pr.catch) pr.catch(function () {});   // 連打などで弾かれても無視
    } catch (e) {}
  }
  function releaseLock() {
    if (!pointerLocked) return;
    try { document.exitPointerLock(); } catch (e) {}
  }
  document.addEventListener('pointerlockchange', function () {
    pointerLocked = (document.pointerLockElement === canvas);
  });
  document.addEventListener('pointerlockerror', function () { pointerLocked = false; });

  // ロック中は絶対座標が来ないので、移動量を積算する
  document.addEventListener('mousemove', function (e) {
    if (!pointerLocked) return;
    var r = canvas.getBoundingClientRect();
    var scale = r.width ? Game.W / r.width : 1;
    input.pointerActive = true;
    input.pointerX = Game.clamp(input.pointerX + e.movementX * scale, 0, Game.W);
  });

  /* ---------- 入力 ---------- */
  function canvasX(clientX) {
    var r = canvas.getBoundingClientRect();
    return (clientX - r.left) / r.width * Game.W;
  }

  canvas.addEventListener('mousemove', function (e) {
    if (pointerLocked) return;   // ロック中は document 側で処理する
    input.pointerActive = true;
    input.pointerX = canvasX(e.clientX);
  });
  canvas.addEventListener('mouseleave', function () { input.pointerActive = false; });

  canvas.addEventListener('mousedown', function (e) {
    Sfx.init();
    if (e.button === 2) { Game.pressGuard(); e.preventDefault(); return; }
    if (G.state === 'ready') Game.launch();
    requestLock();   // クリックはユーザー操作なのでロックを掛けられる
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('touchstart', function (e) {
    Sfx.init();
    var t = e.changedTouches[0];
    input.pointerActive = true;
    input.pointerX = canvasX(t.clientX);
    if (G.state === 'ready') Game.launch();
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    var t = e.changedTouches[0];
    input.pointerActive = true;
    input.pointerX = canvasX(t.clientX);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    var c = e.code;

    // レベルアップ中は 1/2/3 と引き直しだけ受け付ける
    if (G.state === 'levelup') {
      if (c === 'Digit1' || c === 'Numpad1') { e.preventDefault(); Game.pickUpgrade(0); return; }
      if (c === 'Digit2' || c === 'Numpad2') { e.preventDefault(); Game.pickUpgrade(1); return; }
      if (c === 'Digit3' || c === 'Numpad3') { e.preventDefault(); Game.pickUpgrade(2); return; }
      if (c === 'KeyR') { e.preventDefault(); Game.rerollChoices(); return; }
      if (c === 'Space') { e.preventDefault(); return; }
    }

    if (c === 'ArrowLeft' || c === 'KeyA') { input.left = true; input.pointerActive = false; }
    if (c === 'ArrowRight' || c === 'KeyD') { input.right = true; input.pointerActive = false; }
    if (c === 'Space') {
      e.preventDefault();
      Sfx.init();
      if (G.state === 'title') startMode('easy');
      else if (G.state === 'gameover') startMode(G.mode);
      else if (G.state === 'ready') { Game.launch(); requestLock(); }
    }
    if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyJ') Game.pressGuard();
    if (c === 'KeyE' || c === 'KeyF' || c === 'KeyK') Game.triggerBurst();
    if (c === 'Escape' || c === 'KeyP') { e.preventDefault(); togglePause(); }
    if (c === 'KeyM') {
      Sfx.init();
      Sfx.setMuted(!Sfx.isMuted());
      FX.setHaptics(!Sfx.isMuted());
      document.getElementById('mute').textContent = Sfx.isMuted() ? '🔇' : '🔊';
    }
    if (c === 'KeyR' && (G.state === 'gameover' || G.state === 'paused')) startMode(G.mode);
    if (c === 'KeyT' && G.state !== 'title') backToTitle();
  });

  document.addEventListener('keyup', function (e) {
    var c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') input.left = false;
    if (c === 'ArrowRight' || c === 'KeyD') input.right = false;
  });

  // ボタン類
  document.querySelectorAll('[data-mode]').forEach(function (el) {
    el.addEventListener('click', function () { startMode(el.getAttribute('data-mode')); });
  });
  document.querySelectorAll('[data-act]').forEach(function (el) {
    var act = el.getAttribute('data-act');
    var fire = function (e) {
      e.preventDefault();
      Sfx.init();
      if (act === 'resume') togglePause();
      else if (act === 'retry') startMode(G.mode);
      else if (act === 'title') backToTitle();
      else if (act === 'guard') Game.pressGuard();
      else if (act === 'burst') Game.triggerBurst();
      else if (act === 'pause') togglePause();
      else if (act === 'mute') {
        Sfx.setMuted(!Sfx.isMuted());
        FX.setHaptics(!Sfx.isMuted());
        document.getElementById('mute').textContent = Sfx.isMuted() ? '🔇' : '🔊';
      }
    };
    el.addEventListener('click', fire);
    el.addEventListener('touchstart', fire, { passive: false });
  });

  /* ---------- タッチ用ボタン（ガチモードのみ表示） ---------- */
  var touchpad = document.getElementById('touchpad');
  var padOn = null;
  var IN_GAME = ['ready', 'play', 'waveclear', 'dead'];
  function syncTouchPad() {
    var want = isTouch && G.cfg.guard && IN_GAME.indexOf(G.state) >= 0;
    if (want !== padOn) {
      padOn = want;
      touchpad.classList.toggle('on', want);
    }
  }

  /* ---------- PWA インストール導線 ---------- */
  var installBtn = document.getElementById('install');
  var deferredPrompt = null;

  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) installBtn.classList.add('on');
  });

  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      installBtn.classList.remove('on');
    });
  });

  global.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    installBtn.classList.remove('on');
  });

  // iOS は beforeinstallprompt が無いので手順を案内する
  (function () {
    var iOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS && !isStandalone) document.getElementById('ios-tip').classList.add('on');
  })();

  /* ---------- Service Worker（オフライン再生） ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* ---------- ループ ---------- */
  var last = performance.now();
  var fpsAvg = 60, qual = 1;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // 端末が重いときは粒子を自動的に減らす
    if (dt > 0.0005) {
      fpsAvg += (1 / dt - fpsAvg) * 0.04;
      var want = qual;
      if (fpsAvg < 34) want = 0.35;
      else if (fpsAvg < 46) want = 0.6;
      else if (fpsAvg > 56) want = 1;
      if (want !== qual) { qual = want; FX.setQuality(qual); }
    }

    if (G.state !== 'title') Game.update(dt, input);
    else { G.elapsed += dt; FX.update(dt); }
    Renderer.render(ctx);
    syncTouchPad();
    if (pointerLocked && G.state !== 'play') releaseLock();
    requestAnimationFrame(frame);
  }

  // ページ全体のスクロール／ピンチを抑止（スマホ用）
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // タイトル用にデモ的な初期状態を作っておく
  Game.start('easy');
  G.plates.forEach(function (p) { p.drop = 1; });
  G.state = 'title';
  refreshTitleBests();
  showScreen('title');
  requestAnimationFrame(frame);
})(window);
