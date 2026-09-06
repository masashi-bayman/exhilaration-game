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
    over: document.getElementById('screen-over')
  };

  function showScreen(name) {
    for (var k in screens) {
      if (screens[k]) screens[k].classList.toggle('on', k === name);
    }
    document.getElementById('overlay').classList.toggle('on', !!name);
  }

  function refreshTitleBests() {
    document.getElementById('best-easy').textContent = Game.fmt(Game.loadBest('easy'));
    document.getElementById('best-hard').textContent = Game.fmt(Game.loadBest('hard'));
  }

  function startMode(mode) {
    Sfx.init();
    Sfx.ui();
    Game.start(mode);
    showScreen(null);
  }

  global.onGameOver = function () {
    document.getElementById('over-score').textContent = Game.fmt(G.score);
    document.getElementById('over-wave').textContent = G.wave;
    document.getElementById('over-combo').textContent = G.comboBest;
    document.getElementById('over-balls').textContent = G.maxBallsSeen;
    document.getElementById('over-plates').textContent = G.totalSmashed;
    document.getElementById('over-perfect').textContent = G.perfectCount;
    document.getElementById('over-burst').textContent = G.burstUsed;
    document.getElementById('over-best').textContent = Game.fmt(G.best);
    document.getElementById('over-newbest').style.display = G.newBest ? 'block' : 'none';
    document.getElementById('over-mode').textContent = G.cfg.label;
    setTimeout(function () { showScreen('over'); }, 900);
  };

  function togglePause() {
    if (G.state === 'paused') {
      G.state = pausedFrom;
      showScreen(null);
    } else if (['ready', 'play', 'waveclear', 'dead'].indexOf(G.state) >= 0) {
      pausedFrom = G.state;
      G.state = 'paused';
      showScreen('pause');
    }
  }

  function backToTitle() {
    Game.quitToTitle();
    refreshTitleBests();
    showScreen('title');
  }

  /* ---------- 入力 ---------- */
  function canvasX(clientX) {
    var r = canvas.getBoundingClientRect();
    return (clientX - r.left) / r.width * Game.W;
  }

  canvas.addEventListener('mousemove', function (e) {
    input.pointerActive = true;
    input.pointerX = canvasX(e.clientX);
  });
  canvas.addEventListener('mouseleave', function () { input.pointerActive = false; });

  canvas.addEventListener('mousedown', function (e) {
    Sfx.init();
    if (e.button === 2) { Game.pressGuard(); e.preventDefault(); return; }
    if (G.state === 'ready') Game.launch();
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
    if (c === 'ArrowLeft' || c === 'KeyA') { input.left = true; input.pointerActive = false; }
    if (c === 'ArrowRight' || c === 'KeyD') { input.right = true; input.pointerActive = false; }
    if (c === 'Space') {
      e.preventDefault();
      Sfx.init();
      if (G.state === 'title') startMode('easy');
      else if (G.state === 'gameover') startMode(G.mode);
      else if (G.state === 'ready') Game.launch();
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
