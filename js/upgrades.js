/* ============================================================
   upgrades.js  --  レベルアップ時の3択強化（ヴァンサバ方式）

   皿を割ると経験値が溜まり、レベルが上がるたびに時間が止まって
   3枚のカードから1つを選ぶ。選んだ強化はその1プレイの間ずっと残り、
   重ねるほど画面が壊れていく。
   ============================================================ */
(function (global) {
  'use strict';

  // rare が小さいほど出にくい（重み）
  var LIST = [
    {
      id: 'paddle', name: '大皿トレイ', icon: '🧺', max: 5, w: 10, tier: 1,
      desc: function (n) { return 'パドルの幅 +13%（合計 +' + (13 * n) + '%）'; }
    },
    {
      id: 'balls', name: '追加注文', icon: '🍽️', max: 5, w: 5, tier: 3,
      desc: function (n) { return '持ちボール +1（合計 ' + (1 + n) + ' 個）'; }
    },
    {
      id: 'pierce', name: 'ダイヤカッター', icon: '💎', max: 5, w: 6, tier: 2,
      desc: function (n) { return '割るとき ' + (14 * n) + '% で貫通（跳ね返らず突き抜ける）'; }
    },
    {
      id: 'explode', name: '衝撃波', icon: '💥', max: 5, w: 6, tier: 2,
      desc: function (n) { return '割るとき ' + (12 * n) + '% で小爆発。巻き込んで連鎖する'; }
    },
    {
      id: 'chain', name: '電撃連鎖', icon: '⚡', max: 4, w: 5, tier: 2,
      desc: function (n) { return '割るとき ' + (20 * n) + '% で近くの皿にも連鎖する'; }
    },
    {
      id: 'split', name: '分裂', icon: '🧬', max: 4, w: 5, tier: 3,
      desc: function (n) { return '割るとき ' + (9 * n) + '% でボールが1個増える'; }
    },
    {
      id: 'comboTime', name: '連鎖の呼吸', icon: '🌀', max: 4, w: 9, tier: 1,
      desc: function (n) { return 'コンボ持続 +0.35秒（合計 +' + (0.35 * n).toFixed(2) + '秒）'; }
    },
    {
      id: 'score', name: '高級皿', icon: '💰', max: 5, w: 9, tier: 1,
      desc: function (n) { return '獲得スコア +22%（合計 +' + (22 * n) + '%）'; }
    },
    {
      id: 'gauge', name: '速充電', icon: '🔌', max: 4, w: 8, tier: 1,
      desc: function (n) { return 'BURST ゲージの溜まり +28%（合計 +' + (28 * n) + '%）'; }
    },
    {
      id: 'burstTime', name: '延長コード', icon: '⏱️', max: 4, w: 7, tier: 2,
      desc: function (n) { return 'BURST 時間 +1.6秒（合計 ' + (6.5 + 1.6 * n).toFixed(1) + '秒）'; }
    },
    {
      id: 'speed', name: '加速装置', icon: '🚀', max: 5, w: 7, tier: 2,
      desc: function (n) { return 'ボール速度 +7% ／ スコア +8%（速いほど難しい）'; }
    },
    {
      id: 'size', name: '特大ボール', icon: '⚪', max: 4, w: 8, tier: 1,
      desc: function (n) { return 'ボールの大きさ +18%（合計 +' + (18 * n) + '%）'; }
    },
    {
      id: 'magnet', name: '皿レーダー', icon: '🧲', max: 3, w: 6, tier: 2,
      desc: function (n) { return '上がっていくボールが皿へ吸い寄せられる（強さ ' + n + '/3）'; }
    },
    {
      id: 'power', name: '怪力', icon: '💪', max: 2, w: 6, tier: 2,
      desc: function (n) { return '硬い皿へのダメージ +1（' + (1 + n) + 'ダメージ）'; }
    },
    {
      id: 'bomb', name: '爆発皿の増設', icon: '✸', max: 3, w: 6, tier: 2,
      desc: function (n) { return '各ウェーブの爆発皿 +2（合計 +' + (2 * n) + '枚）'; }
    },
    {
      id: 'xp', name: '経験の蓄積', icon: '📘', max: 4, w: 8, tier: 1,
      desc: function (n) { return '獲得経験値 +30%（レベルが早く上がる）'; }
    },
    {
      id: 'reroll', name: '引き直し券', icon: '🔄', max: 3, w: 5, tier: 1,
      desc: function (n) { return '強化の引き直しが +1 回（所持 ' + n + ' 回）'; }
    },
    // --- ガチモード専用 ---
    {
      id: 'life', name: '予備の皿', icon: '❤️', max: 3, w: 4, tier: 3, modes: ['hard'],
      desc: function (n) { return '残機 +1（いますぐ1つ増える）'; }
    },
    {
      id: 'guardWin', name: '見切り', icon: '👁️', max: 3, w: 6, tier: 2, modes: ['hard'],
      desc: function (n) { return 'ジャストガードの受付時間 +35%（合計 +' + (35 * n) + '%）'; }
    },
    {
      id: 'safety', name: '安全ネット', icon: '🕸️', max: 3, w: 5, tier: 3, modes: ['hard'],
      desc: function (n) { return '落下を ' + n + ' 回まで防ぐ。ウェーブごとに回復'; }
    },
    // --- 保険（すべて上限に達したとき用。重みが小さいので普段は出ない） ---
    {
      id: 'bonus', name: 'ごほうび', icon: '💠', max: 99, w: 1, tier: 1,
      desc: function () { return 'いますぐ大量スコア（ウェーブ倍率つき）'; }
    }
  ];

  var BY_ID = {};
  for (var i = 0; i < LIST.length; i++) BY_ID[LIST[i].id] = LIST[i];

  /** いま選択肢に出せる強化 */
  function pool(mode, levels) {
    return LIST.filter(function (u) {
      if (u.id === 'bonus') return false;          // 保険は別枠
      if (u.modes && u.modes.indexOf(mode) < 0) return false;
      return (levels[u.id] || 0) < u.max;
    });
  }

  /** 重み付きで n 個、重複なしで引く */
  function roll(mode, levels, n) {
    n = n || 3;
    var cand = pool(mode, levels);
    // 取り切って枚数が足りないときだけ「ごほうび」で埋める
    while (cand.length < n) cand.push(BY_ID.bonus);
    cand = cand.slice();
    var out = [];
    while (out.length < n && cand.length) {
      var total = 0, k;
      for (k = 0; k < cand.length; k++) total += cand[k].w;
      var r = Math.random() * total;
      for (k = 0; k < cand.length; k++) {
        r -= cand[k].w;
        if (r <= 0) break;
      }
      if (k >= cand.length) k = cand.length - 1;
      out.push(cand[k]);
      cand.splice(k, 1);
    }
    return out;
  }

  global.Upgrades = {
    LIST: LIST,
    get: function (id) { return BY_ID[id]; },
    roll: roll,
    pool: pool
  };
})(window);
