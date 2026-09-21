/* ============================================================
   levels.js  --  ウェーブごとの盤面を「法則に沿って」自動生成する

   セルの種類
     0: なし  1: 普通の皿  2: 厚皿(2)  3: 鉄皿(3)  4: 爆発皿  5: 壁(破壊不可)

   生成の流れ
     1. ウェーブ番号から決まる乱数（＝毎回同じ盤面になる）
     2. 18種の基本形 × 左右対称化 × 密度 × 穴あけ
     3. 9種の壁パターンを重ねる
     4. **詰み検査** … 壁で囲まれて到達できない皿が出ないことを保証する
     5. 硬い皿・爆発皿を配置

   基本形18 × 壁9 × 密度3 で 400通り以上の見た目になる。
   ============================================================ */
(function (global) {
  'use strict';

  var COLS = 15;            // ウェーブ1〜5の列数（以降は増えていく）
  var MIN_PLATES = 16;

  // 盤面に使える領域（game.js の W=1280 / 皿の帯 348px と揃えてある）
  var FIELD_W = 1200;
  var BAND_H = 348;

  /**
   * ウェーブが進むほど「皿を小さく・数を多く」する。
   * 序盤は今までどおりの大きさ、6ウェーブ目あたりから少しずつ細かくなる。
   */
  function metrics(wave) {
    var extra = Math.max(0, Math.floor((wave - 5) / 2));
    var cols = Math.min(34, COLS + extra);
    var gapX = Math.max(3, 6 * COLS / cols);
    var cellW = (FIELD_W - (cols - 1) * gapX) / cols;
    var cellH = Math.max(11, cellW / 2.85);
    var gapY = Math.max(4, 9 * cellH / 26);
    var rowCap = Math.floor((BAND_H + gapY) / (cellH + gapY));
    var maxRows = Math.max(4, Math.min(rowCap, 8 + Math.floor(wave / 3)));
    return {
      cols: cols, cellW: cellW, cellH: cellH,
      gapX: gapX, gapY: gapY, maxRows: maxRows
    };
  }

  /* ---------- 決定的な乱数（mulberry32） ---------- */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 基本形 ----------
     f(c, r, cols, rows) が真なら皿を置く。
     左右対称は後段で強制するので、ここでは片側だけ考えればよい。      */
  var SHAPES = [
    { name: 'FULL', rows: [5, 8], f: function () { return 1; } },

    { name: 'CHECKER', rows: [6, 9], f: function (c, r) { return (c + r) % 2; } },

    { name: 'PYRAMID', rows: [6, 9], f: function (c, r, cols, rows) {
        var h = (cols - 1) / 2;
        return Math.abs(c - h) <= r * (h / Math.max(1, rows - 1)) ? 1 : 0;
      } },

    { name: 'ARCH', rows: [6, 9], f: function (c, r, cols, rows) {
        var h = (cols - 1) / 2;
        return Math.abs(c - h) >= (rows - 1 - r) * (h / Math.max(1, rows - 1)) ? 1 : 0;
      } },

    { name: 'STRIPES', rows: [6, 9], f: function (c) { return c % 3 === 1 ? 0 : 1; } },

    { name: 'DIAMOND', rows: [7, 10], f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        return (Math.abs(c - hc) / hc + Math.abs(r - hr) / Math.max(0.5, hr)) <= 1.05 ? 1 : 0;
      } },

    { name: 'FRAME', rows: [6, 9], f: function (c, r, cols, rows) {
        return (c === 0 || c === cols - 1 || r === 0 || r === rows - 1) ? 1 : 0;
      } },

    { name: 'CROSS', rows: [7, 10], f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        return (Math.abs(c - hc) <= 1 || Math.abs(r - hr) <= 1) ? 1 : 0;
      } },

    { name: 'ZIGZAG', rows: [6, 9], f: function (c, r, cols) {
        return ((c + (r % 2 ? cols - 1 : 0)) % 4) < 3 ? 1 : 0;
      } },

    { name: 'TOWER', rows: [7, 10], f: function (c, r, cols, rows) {
        var h = (cols - 1) / 2;
        return (Math.abs(c - h) <= 2 || r >= rows - 2) ? 1 : 0;
      } },

    { name: 'WAVE', rows: [6, 9], f: function (c, r, cols, rows) {
        var y = (rows - 1) * (0.5 + 0.42 * Math.sin(c / cols * Math.PI * 2.2));
        return Math.abs(r - y) <= 1.6 ? 1 : 0;
      } },

    { name: 'RINGS', rows: [7, 10], f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        var d = Math.sqrt(Math.pow((c - hc) / hc, 2) + Math.pow((r - hr) / Math.max(0.5, hr), 2));
        return (Math.round(d * 3) % 2 === 0) ? 1 : 0;
      } },

    { name: 'HOURGLASS', rows: [7, 10], f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        var k = Math.abs(r - hr) / Math.max(0.5, hr);
        return Math.abs(c - hc) <= hc * (0.25 + 0.75 * k) ? 1 : 0;
      } },

    { name: 'COLUMNS', rows: [6, 10], f: function (c, r, cols, rows) {
        return (c % 2 === 0) || r === 0 || r === rows - 1 ? 1 : 0;
      } },

    { name: 'STAIRS', rows: [7, 10], f: function (c, r, cols, rows) {
        var step = Math.floor(c / 2);
        return r >= Math.min(rows - 1, step) ? 1 : 0;
      } },

    { name: 'HEART', rows: [8, 10], f: function (c, r, cols, rows) {
        var x = (c - (cols - 1) / 2) / ((cols - 1) / 2) * 1.25;
        var y = (1 - r / Math.max(1, rows - 1)) * 2.1 - 0.95;
        var v = Math.pow(x * x + y * y - 0.62, 3) - x * x * y * y * y;
        return v <= 0 ? 1 : 0;
      } },

    { name: 'BRICK', rows: [6, 9], f: function (c, r) {
        return ((c + (r % 2 ? 1 : 0)) % 4) !== 3 ? 1 : 0;
      } },

    { name: 'FUNNEL', rows: [7, 10], f: function (c, r, cols, rows) {
        var h = (cols - 1) / 2;
        var k = r / Math.max(1, rows - 1);
        return Math.abs(c - h) >= h * k * 0.9 ? 1 : 0;
      } }
  ];

  /* ---------- 壁パターン ----------
     w(c, r, cols, rows) が真なら壁。あとで詰み検査にかける。 */
  var WALLS = [
    { name: '', w: null },                                   // 壁なし
    { name: 'PILLARS', w: function (c, r, cols, rows) {
        return (c % 4 === 2 && r % 2 === 1) ? 1 : 0;
      } },
    { name: 'BARS', w: function (c, r, cols, rows) {
        return (r % 3 === 1 && c % 5 !== 0) ? 1 : 0;
      } },
    { name: 'DIAGONAL', w: function (c, r, cols, rows) {
        return ((c + r) % 5 === 0) ? 1 : 0;
      } },
    { name: 'CORE', w: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        return (Math.abs(c - hc) <= 1 && Math.abs(r - hr) <= 1) ? 1 : 0;
      } },
    { name: 'GATE', w: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2;
        return (r === Math.floor(rows / 2) && Math.abs(c - hc) > 2) ? 1 : 0;
      } },
    { name: 'CAGE', w: function (c, r, cols, rows) {
        return ((c === 1 || c === cols - 2) && r > 0 && r < rows - 1) ? 1 : 0;
      } },
    { name: 'SPIKES', w: function (c, r, cols, rows) {
        return (c % 3 === 0 && r === rows - 1) ? 1 : 0;
      } },
    { name: 'LATTICE', w: function (c, r, cols, rows) {
        return (c % 3 === 1 && r % 3 === 1) ? 1 : 0;
      } }
  ];

  /* ---------- 詰み検査 ----------
     盤面の外周（上下左右の外側）からボールが入れる前提で、
     壁でない升を4方向にたどる。たどり着けない皿があれば、
     境目の壁を壊して道を作る。それでも駄目なら皿を消す。      */
  function floodReachable(grid, rows, cols) {
    var seen = [];
    for (var r = 0; r < rows; r++) { seen.push(new Array(cols).fill(false)); }
    var q = [];
    function push(r, c) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return;
      if (seen[r][c] || grid[r][c] === 5) return;
      seen[r][c] = true;
      q.push(r, c);
    }
    // 盤面は上下左右に余白があるので、外周のどの升からでも侵入できる
    for (var c0 = 0; c0 < cols; c0++) { push(0, c0); push(rows - 1, c0); }
    for (var r0 = 0; r0 < rows; r0++) { push(r0, 0); push(r0, cols - 1); }
    var i = 0;
    while (i < q.length) {
      var r1 = q[i++], c1 = q[i++];
      push(r1 - 1, c1); push(r1 + 1, c1); push(r1, c1 - 1); push(r1, c1 + 1);
    }
    return seen;
  }

  function unreachablePlates(grid, rows, cols, seen) {
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c] !== 5 && !seen[r][c]) out.push([r, c]);
      }
    }
    return out;
  }

  /** 到達できない皿がなくなるまで壁に穴を開ける。最後の保険として皿を消す。 */
  function ensureReachable(grid, rows, cols) {
    var removedWalls = 0;
    for (var guard = 0; guard < 80; guard++) {
      var seen = floodReachable(grid, rows, cols);
      var bad = unreachablePlates(grid, rows, cols, seen);
      if (!bad.length) return { walls: removedWalls, dropped: 0 };

      // 到達済みと未到達の両方に接している壁を1枚壊す
      var target = null;
      for (var r = 0; r < rows && !target; r++) {
        for (var c = 0; c < cols && !target; c++) {
          if (grid[r][c] !== 5) continue;
          var touchesIn = false, touchesOut = false;
          var n = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
          for (var k = 0; k < 4; k++) {
            var rr = n[k][0], cc = n[k][1];
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) { touchesIn = true; continue; }
            if (grid[rr][cc] === 5) continue;
            if (seen[rr][cc]) touchesIn = true; else touchesOut = true;
          }
          if (touchesIn && touchesOut) target = [r, c];
        }
      }
      if (!target) break;
      grid[target[0]][target[1]] = 0;
      removedWalls++;
    }

    // ここまで来たら諦めて、残った到達不能な皿を消す（詰み回避を最優先）
    var seen2 = floodReachable(grid, rows, cols);
    var rest = unreachablePlates(grid, rows, cols, seen2);
    for (var j = 0; j < rest.length; j++) grid[rest[j][0]][rest[j][1]] = 0;
    return { walls: removedWalls, dropped: rest.length };
  }

  function countPlates(grid, rows, cols) {
    var n = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) if (grid[r][c] && grid[r][c] !== 5) n++;
    }
    return n;
  }

  /* ---------- 本体 ---------- */
  function generate(wave, salt, m) {
    var rand = makeRng((wave * 2654435761 + salt * 40503) >>> 0);
    var cols = m.cols;

    var shape = SHAPES[Math.floor(rand() * SHAPES.length) % SHAPES.length];

    // 形の縦横比を保ったまま、細かくなったぶん行数も増やす
    var growth = Math.min(4, Math.floor((wave - 1) / 3));
    var baseRows = Math.round(shape.rows[0] * cols / COLS);
    var rows = baseRows + growth + (rand() < 0.35 ? 1 : 0);
    rows = Math.max(4, Math.min(m.maxRows, rows));

    var grid = [];
    for (var r = 0; r < rows; r++) grid.push(new Array(cols).fill(0));

    // 基本形（左右対称に畳む：どちらかが皿ならその位置は皿）
    for (r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var mi = cols - 1 - c;
        var v = shape.f(c, r, cols, rows) || shape.f(mi, r, cols, rows);
        grid[r][c] = v ? 1 : 0;
      }
    }

    // 密度（間引き）も左右対称に
    var density = [1.0, 0.86, 0.72][Math.floor(rand() * 3)];
    if (density < 1) {
      for (r = 0; r < rows; r++) {
        for (c = 0; c <= (cols - 1) / 2; c++) {
          if (grid[r][c] && rand() > density) {
            grid[r][c] = 0;
            grid[r][cols - 1 - c] = 0;
          }
        }
      }
    }

    // 壁（ウェーブ4から。序盤は素直な盤面にしておく）
    var wallDef = WALLS[0];
    if (wave >= 4) {
      var wallChance = Math.min(0.85, 0.35 + wave * 0.04);
      if (rand() < wallChance) {
        wallDef = WALLS[1 + Math.floor(rand() * (WALLS.length - 1))];
      }
    }
    if (wallDef.w) {
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          var mc = cols - 1 - c;
          if (wallDef.w(c, r, cols, rows) || wallDef.w(mc, r, cols, rows)) grid[r][c] = 5;
        }
      }
    }

    // ★ 詰みが起きないことを保証する
    var fix = ensureReachable(grid, rows, cols);

    return { grid: grid, rows: rows, cols: cols, shape: shape, wallDef: wallDef, fix: fix };
  }

  /**
   * ウェーブ番号から盤面を作る。
   * 皿が少なすぎる盤面になったら種を変えて引き直す。
   */
  function build(wave) {
    var m = metrics(wave);
    var g = null;
    for (var salt = 0; salt < 8; salt++) {
      g = generate(wave, salt, m);
      if (countPlates(g.grid, g.rows, g.cols) >= MIN_PLATES) break;
    }

    var grid = g.grid, rows = g.rows, cols = g.cols;
    var rand = makeRng((wave * 971 + 12345) >>> 0);

    // 硬い皿（上の行ほど硬い＝下から崩す気持ちよさ）
    var hardRate = Math.min(0.36, Math.max(0, (wave - 2) * 0.045));
    var steelRate = Math.min(0.18, Math.max(0, (wave - 5) * 0.028));
    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) if (grid[r][c] === 1) cells.push([r, c]);
    }
    for (var i = 0; i < cells.length; i++) {
      var rr = cells[i][0], cc = cells[i][1];
      var depth = 1 - rr / Math.max(1, rows - 1);
      if (rand() < steelRate * (0.4 + depth)) grid[rr][cc] = 3;
      else if (rand() < hardRate * (0.4 + depth * 1.4)) grid[rr][cc] = 2;
    }

    // 爆発皿
    var bombs = 1 + Math.floor(wave / 4);
    for (var b = 0; b < bombs && cells.length; b++) {
      var pick = cells[Math.floor(rand() * cells.length)];
      grid[pick[0]][pick[1]] = 4;
    }

    var name = g.shape.name + (g.wallDef.name ? ' · ' + g.wallDef.name : '');
    return {
      grid: grid, rows: rows, cols: cols, name: name,
      cellW: m.cellW, cellH: m.cellH, gapX: m.gapX, gapY: m.gapY,
      total: countPlates(grid, rows, cols),
      hasWalls: !!g.wallDef.w,
      fix: g.fix
    };
  }

  global.Levels = {
    build: build,
    metrics: metrics,
    FIELD_W: FIELD_W,
    BAND_H: BAND_H,
    COLS: COLS,
    SHAPES: SHAPES,
    WALLS: WALLS,
    // テスト用
    _floodReachable: floodReachable,
    _unreachablePlates: unreachablePlates
  };
})(window);
