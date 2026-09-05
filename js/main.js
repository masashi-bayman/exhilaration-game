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
        document.getElementById('mute').textContent = Sfx.isMuted() ? '🔇' : '🔊';
      }
    };
    el.addEventListener('click', fire);
    el.addEventListener('touchstart', fire, { passive: false });
  });

  // タッチ端末なら操作ボタンを出す
  if ('ontouchstart' in global) {
    document.getElementById('touchbar').classList.add('on');
  }

  /* ---------- ループ ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state !== 'title') Game.update(dt, input);
    else { G.elapsed += dt; FX.update(dt); }
    Renderer.render(ctx);
    requestAnimationFrame(frame);
  }

  // タイトル用にデモ的な初期状態を作っておく
  Game.start('easy');
  G.plates.forEach(function (p) { p.drop = 1; });
  G.state = 'title';
  refreshTitleBests();
  showScreen('title');
  requestAnimationFrame(frame);
})(window);
