/* ============================================================
   levels.js  --  ウェーブごとの皿の並べ方
   0:なし 1:普通の皿 2:厚皿(耐久2) 3:鉄皿(耐久3) 4:爆発皿
   ============================================================ */
(function (global) {
  'use strict';

  var COLS = 11;

  var SHAPES = [
    { name: 'FULL', rows: 5, f: function () { return 1; } },
    { name: 'CHECKER', rows: 6, f: function (c, r) { return (c + r) % 2 ? 1 : 0; } },
    { name: 'PYRAMID', rows: 6, f: function (c, r, cols, rows) {
        var half = (cols - 1) / 2;
        return Math.abs(c - half) <= r * (half / (rows - 1)) ? 1 : 0;
      } },
    { name: 'ARCH', rows: 6, f: function (c, r, cols, rows) {
        var half = (cols - 1) / 2;
        return Math.abs(c - half) >= (rows - 1 - r) * (half / (rows - 1)) ? 1 : 0;
      } },
    { name: 'STRIPES', rows: 6, f: function (c) { return c % 3 === 1 ? 0 : 1; } },
    { name: 'DIAMOND', rows: 7, f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        return (Math.abs(c - hc) / hc + Math.abs(r - hr) / hr) <= 1.05 ? 1 : 0;
      } },
    { name: 'FRAME', rows: 6, f: function (c, r, cols, rows) {
        return (c === 0 || c === cols - 1 || r === 0 || r === rows - 1) ? 1 : 0;
      } },
    { name: 'CROSS', rows: 7, f: function (c, r, cols, rows) {
        var hc = (cols - 1) / 2, hr = (rows - 1) / 2;
        return (Math.abs(c - hc) <= 1 || Math.abs(r - hr) <= 1) ? 1 : 0;
      } },
    { name: 'ZIGZAG', rows: 6, f: function (c, r, cols) {
        return ((c + (r % 2 ? cols - 1 : 0)) % 4) < 3 ? 1 : 0;
      } },
    { name: 'TOWER', rows: 7, f: function (c, r, cols, rows) {
        var half = (cols - 1) / 2;
        return Math.abs(c - half) <= 2 || r >= rows - 2 ? 1 : 0;
      } }
  ];

  /**
   * ウェーブ番号から皿レイアウト（type の二次元配列）を作る
   */
  function build(wave) {
    var shape = SHAPES[(wave - 1) % SHAPES.length];
    // 周回するごとに1行ずつ厚くなる（上限8行）
    var lap = Math.floor((wave - 1) / SHAPES.length);
    var rows = Math.min(8, shape.rows + lap);

    var grid = [];
    var total = 0;
    for (var r = 0; r < rows; r++) {
      var line = [];
      for (var c = 0; c < COLS; c++) {
        var t = shape.f(c, r, COLS, rows) ? 1 : 0;
        line.push(t);
        if (t) total++;
      }
      grid.push(line);
    }

    // 硬い皿の混入率（ウェーブが進むほど増える）
    var hardRate = Math.min(0.34, Math.max(0, (wave - 2) * 0.045));
    var steelRate = Math.min(0.16, Math.max(0, (wave - 5) * 0.028));
    // 爆発皿は必ず1個以上。ウェーブが進むと少し増える
    var bombs = 1 + Math.floor(wave / 4);

    var cells = [];
    for (r = 0; r < rows; r++) {
      for (c = 0; c < COLS; c++) if (grid[r][c]) cells.push([r, c]);
    }

    // 上の行ほど硬くする（下から崩す気持ちよさを作る）
    for (var i = 0; i < cells.length; i++) {
      var rr = cells[i][0], cc = cells[i][1];
      var depth = 1 - rr / Math.max(1, rows - 1); // 上=1
      if (Math.random() < steelRate * (0.4 + depth)) grid[rr][cc] = 3;
      else if (Math.random() < hardRate * (0.4 + depth * 1.4)) grid[rr][cc] = 2;
    }

    // 爆発皿はなるべく内側に置く
    for (var b = 0; b < bombs && cells.length; b++) {
      var pick = cells[(Math.random() * cells.length) | 0];
      grid[pick[0]][pick[1]] = 4;
    }

    return { grid: grid, rows: rows, cols: COLS, name: shape.name, total: total };
  }

  global.Levels = { build: build, COLS: COLS, SHAPES: SHAPES };
})(window);
