/* ==========================================================
   北京地铁挤车 · 四个关卡
   关卡接口: init / update / draw / down / move / up / key / hud
   ========================================================== */
(function () {
  'use strict';
  var B = window.BJ, U = B.U, D = B.D, FX = B.FX, sfx = B.sfx;
  var W = B.W, H = B.H, P = B.drawPerson, ST = B.drawStation;
  var INK = '#20242c', RED = '#d92b2b', YELLOW = '#f5c518', GREEN = '#2e9c6a';

  /* ---------------- 共用：主角（可逐部位缩骨） ---------------- */
  function hero(c, x, y, o) {
    o = o || {};
    var s = o.s || 1.45;
    var bw = 29 - 18 * (o.belly || 0);
    var sw = 30 - 16 * (o.shoulder || 0);
    var hw = 24 - 13 * (o.hip || 0);
    var sx = o.squash == null ? 1 : o.squash, sy = o.stretch == null ? 1 : o.stretch;
    c.save(); c.translate(x, y); c.scale(s * sx, s * sy);
    if (o.rot) c.rotate(o.rot);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    // 影子
    c.fillStyle = 'rgba(32,36,44,.18)';
    c.beginPath(); c.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2); c.fill();
    // 腿
    D.poly(c, [[-18, -42], [-2, -42], [-3, -2], [-20, -2]], '#3b4759', INK, 2.4);
    D.poly(c, [[2, -42], [18, -42], [20, -2], [3, -2]], '#3b4759', INK, 2.4);
    D.poly(c, [[-23, -5], [-1, -5], [-1, 2], [-26, 2]], '#262c36', INK, 2);
    D.poly(c, [[1, -5], [23, -5], [26, 2], [1, 2]], '#262c36', INK, 2);
    // 躯干：肩 / 肚 / 胯 可独立收缩
    D.poly(c, [[-sw, -88], [sw, -88], [bw, -66], [bw, -48], [hw, -40], [-hw, -40], [-bw, -48], [-bw, -66]], '#e4654b', INK, 2.6);
    D.poly(c, [[-sw, -88], [0, -88], [0, -40], [-hw, -40], [-bw, -48], [-bw, -66]], 'rgba(0,0,0,.09)', null);
    // 手臂
    var ax = sw + 2;
    D.poly(c, [[-ax - 8, -85], [-ax + 2, -86], [-ax + 1, -44], [-ax - 9, -41]], '#e4654b', INK, 2.4);
    D.poly(c, [[ax - 2, -86], [ax + 8, -85], [ax + 9, -41], [ax - 1, -44]], '#e4654b', INK, 2.4);
    c.fillStyle = '#f3c9a0';
    c.beginPath(); c.arc(-ax - 4, -41, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(ax + 4, -41, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    // 头
    D.poly(c, [[-16, -118], [16, -118], [21, -105], [15, -89], [-15, -89], [-21, -105]], '#f3c9a0', INK, 2.6);
    D.poly(c, [[-19, -108], [-13, -122], [12, -122], [19, -108], [8, -113], [-8, -111]], '#2e3038', INK, 2);
    c.fillStyle = INK;
    c.beginPath(); c.arc(-7, -104, 2.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(7, -104, 2.8, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2.2; c.strokeStyle = INK; c.beginPath();
    if (o.pain) { c.moveTo(-7, -95); c.lineTo(0, -100); c.lineTo(7, -95); c.stroke(); }
    else if (o.gasp) { c.ellipse(0, -95, 4, 6, 0, 0, Math.PI * 2); c.stroke(); }
    else { c.arc(0, -98, 5, .15 * Math.PI, .85 * Math.PI); c.stroke(); }
    if (o.sweat) { c.fillStyle = '#6cc4e8'; c.beginPath(); c.ellipse(24, -110, 3.5, 6, .4, 0, Math.PI * 2); c.fill(); }
    // 双肩包（未甩进去时）
    if (o.bag !== false) {
      c.save(); c.translate(-44, -68); c.rotate(o.bagRot || 0);
      D.rr(c, -13, -18, 26, 38, 8); c.fillStyle = '#d8b04a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke();
      c.beginPath(); c.moveTo(-13, -6); c.lineTo(13, -6); c.stroke();
      c.restore();
    }
    c.restore();
  }

  function button(c, x, y, w, h, text, hot, sub) {
    c.save();
    D.rr(c, x, y, w, h, 12);
    c.fillStyle = hot ? '#d92b2b' : '#fffdf7'; c.fill();
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.shadowColor = 'rgba(32,36,44,.25)'; c.shadowOffsetY = 5; c.shadowBlur = 0;
    D.T(c, text, x + w / 2, y + (sub ? 27 : h / 2 + 8), sub ? 22 : 24, hot ? '#fff' : INK, 'center');
    c.shadowColor = 'transparent';
    if (sub) D.T(c, sub, x + w / 2, y + h - 13, 12, hot ? 'rgba(255,255,255,.85)' : '#7c828d', 'center', 800);
    c.restore();
  }
  function inRect(x, y, r) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }

  /* =========================================================
     关卡 1 · 缩骨功
     ========================================================= */
  var L1 = {
    key: 'shrink', tag: 'BONE', name: '缩骨功',
    desc: '门缝只剩 20cm，把自己拆成零件塞进去',
    brief: {
      lead: '车门即将关闭，缝隙只剩 20cm。你和车门之间，只差一点物理层面的不要脸。',
      lines: '依次点击主角身上的部位，把它「收」起来。每点对一处，门缝就会被你的不要脸撑开一点。点错？门会夹你一下，后面排队的大爷会开始现场解说。',
      quote: '🔍 线索：包比人先上车，是北京地铁第一条物理学定律。之后依次是 <b>肚子 → 肩膀 → 侧胯</b>。头和腿收不了，别费劲。',
      tip: '点击角色身上的虚线圆圈；收完四个部位后点「挤！」或按空格。'
    },
    init: function () {
      s1 = {
        t: 34, gap: 46, gapT: 46, step: 0, mistakes: 0, dignity: 100,
        shrink: { bag: 0, belly: 0, shoulder: 0, hip: 0 },
        clamp: 0, clampName: '', winT: -1, bagFly: 0,
        hx: 480, hy: 574, bubbleT: 0, shakeHero: 0, done: false
      };
      B.toast('门缝 20cm · 请先找到那个包');
    },
    update: function (dt) {
      var s = s1;
      s.t -= dt;
      s.gap = U.lerp(s.gap, s.gapT, Math.min(1, dt * 7));
      s.clamp = Math.max(0, s.clamp - dt);
      s.bubbleT += dt;
      s.shakeHero *= Math.pow(.02, dt);
      ['bag', 'belly', 'shoulder', 'hip'].forEach(function (k) {
        var target = s.shrinkOn && s.shrinkOn[k] ? 1 : 0;
        s.shrink[k] = U.lerp(s.shrink[k], s.shrinkOn && s.shrinkOn[k] ? 1 : 0, Math.min(1, dt * 8));
      });
      if (s.bagFly > 0) s.bagFly += dt;
      if (s.winT >= 0) {
        s.winT += dt;
        if (s.winT > 1.45) {
          s.winT = -2;
          B.win({
            mistakes: s.mistakes, dignity: s.dignity,
            title: s.mistakes === 0 ? '无夹通关 · 软组织工程师' : (s.mistakes < 3 ? '门缝艺术家' : '被夹出经验的人'),
            comment: s.mistakes === 0 ? '全程零夹伤。大爷没捞着开口，显得有点失落。' : '你以 ' + (20 + s.step * 5) + 'cm 的非官方宽度通过了标准车门。',
            announce: '本次列车开往……您先别急，让后面那位大爷也收收肚子。'
          });
        }
      }
      if (s.t <= 0 && s.winT < 0) B.lose({ reason: '车门关了。你还保持着收腹的姿势，站台上多了一尊雕塑。', mistakes: s.mistakes, dignity: s.dignity, taunt: '「他刚才是不是想把自己叠起来？」' });
    },
    down: function (x, y) {
      var s = s1;
      if (s.winT >= 0 || s.t <= 0) return;
      if (s.step >= 4) {
        if (inRect(x, y, [50, 500, 210, 66])) launchL1();
        return;
      }
      var parts = L1.parts();
      var hit = null, best = 1e9;
      parts.forEach(function (p) {
        var d = U.dist(x, y, p.x, p.y);
        if (d < p.r && d < best) { best = d; hit = p; }
      });
      if (!hit) return;
      var order = ['bag', 'belly', 'shoulder', 'hip'];
      if (hit.key === order[s.step]) {
        if (!s.shrinkOn) s.shrinkOn = {};
        s.shrinkOn[hit.key] = 1;
        s.step++; s.gapT += 27;
        sfx.pop(); FX.float(hit.x, hit.y - 30, ['包进去了！', '收！', '肩宽 -12cm', '侧身！'][s.step - 1], GREEN, 20);
        FX.burst(hit.x, hit.y, '#f5c518', 10, { star: true, maxSpeed: 150 });
        if (hit.key === 'bag') s.bagFly = .01;
        else if (hit.key === 'belly') FX.bubble(s.hx + 90, s.hy - 190, '对不起，我暂时没有肚子了。', { life: 1.8, side: 'left' });
        else if (hit.key === 'shoulder') FX.bubble(s.hx + 90, s.hy - 220, '锁骨：我尽力了。', { life: 1.6, side: 'left' });
        else FX.bubble(s.hx + 90, s.hy - 190, '现在我是一张纸。', { life: 1.8, side: 'left' });
        if (s.step === 4) { sfx.ding(); B.toast('零件已收齐 · 点右侧「挤！」'); }
      } else {
        s.clamp = .42; s.clampName = hit.name; s.mistakes++; s.dignity = Math.max(0, s.dignity - 9);
        s.t = Math.max(1, s.t - 2.5); s.shakeHero = 8;
        sfx.clampDoor(); FX.shake(9);
        FX.float(480, 300, '吱————！', RED, 34);
        FX.burst(480, 400, '#ffffff', 14, { star: true, maxSpeed: 190 });
        var taunts = [
          '哎哟喂！你这肚子是带了独立户口吗？',
          '小伙子，往后稍稍，我六点半就排这儿了！',
          '挤不进去就等下一趟，别在这儿练气功！',
          '我孙子都上车了你还在收肩膀！',
          '这车门是让你过的，不是让你表演的！',
          '收头？你当自己是行李架啊！',
          '腿！他居然在收腿！哈哈哈哈哈',
          '我这辈子没见过这么不服输的胯。'
        ];
        FX.bubble(770, 420, U.choice(taunts), { life: 2.3, side: 'left', bg: '#fff0d8' });
      }
    },
    key: function (code, down) {
      if (down && code === 'Space' && s1.step >= 4 && s1.winT < 0) launchL1();
    },
    parts: function () {
      var x = s1.hx, y = s1.hy;
      return [
        { key: 'bag', name: '包', x: x - 52, y: y - 93, r: 25, label: '包' },
        { key: 'belly', name: '肚子', x: x, y: y - 90, r: 24, label: '肚' },
        { key: 'shoulder', name: '肩膀', x: x, y: y - 128, r: 23, label: '肩' },
        { key: 'hip', name: '胯', x: x, y: y - 56, r: 23, label: '胯' },
        { key: 'head', name: '头', x: x, y: y - 160, r: 22, label: '头' },
        { key: 'leg', name: '腿', x: x, y: y - 20, r: 22, label: '腿' }
      ];
    },
    hud: function () {
      return { meter: s1.dignity / 100, meterText: Math.round(s1.dignity) + '%', meterLabel: '尊严值', danger: s1.dignity < 35, timer: Math.max(0, s1.t), tip: '已收 ' + s1.step + '/4 个部位 · 点错会被门夹' };
    },
    draw: function (c) {
      var s = s1;
      ST(c, { gap: s.gap, station: '西二旗', english: "XI'ERQI", alarm: s.t < 8 });
      // 门缝宽度标注
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = RED; c.lineWidth = 2;
      c.beginPath(); c.moveTo(480 - s.gap / 2, 452); c.lineTo(480 + s.gap / 2, 452); c.stroke();
      c.setLineDash([]); c.restore();
      D.label(c, (s.gap / 2.3).toFixed(0) + ' cm', 480, 440, { bg: RED, size: 12 });
      // 主角
      var sq = s.clamp > 0 ? .58 + .42 * (1 - s.clamp / .42) : 1;
      var ox = s.shakeHero > .3 ? U.rand(-s.shakeHero, s.shakeHero) : 0;
      var hx = s.hx + ox, hy = s.hy;
      var winP = s.winT >= 0 ? U.clamp(s.winT / 1.2, 0, 1) : 0;
      if (winP > 0) { hx = U.lerp(hx, 480, winP); hy -= winP * 90; }
      c.save();
      if (winP > 0) { c.globalAlpha = 1 - winP * .85; }
      hero(c, hx, hy, {
        s: 1.45 * (1 - winP * .75), squash: sq * (1 - winP * .45), stretch: 1 / sq,
        belly: s.shrink.belly, shoulder: s.shrink.shoulder, hip: s.shrink.hip,
        bag: !(s.shrink.bag > .5), bagRot: s.bagFly * 6,
        pain: s.clamp > 0, sweat: s.t < 10, gasp: s.winT >= 0
      });
      c.restore();
      // 飞进去的包
      if (s.bagFly > 0 && s.bagFly < 1.4 && s.shrink.bag < .9) {
        var bp = U.clamp(s.bagFly / .8, 0, 1);
        c.save(); c.translate(U.lerp(s.hx - 46, 480, bp), U.lerp(s.hy - 93, 300, bp) - Math.sin(bp * Math.PI) * 60);
        c.rotate(bp * 9); D.rr(c, -13, -18, 26, 38, 8); c.fillStyle = '#d8b04a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke(); c.restore();
      }
      // 可点部位提示
      if (s.winT < 0) {
        var doneMap = { bag: s.shrink.bag > .5, belly: s.shrink.belly > .5, shoulder: s.shrink.shoulder > .5, hip: s.shrink.hip > .5 };
        L1.parts().forEach(function (p) {
          var done = doneMap[p.key];
          c.save();
          var dim = p.key === 'head' || p.key === 'leg';
          c.setLineDash([4, 4]); c.lineWidth = 1.8;
          c.strokeStyle = done ? 'rgba(46,156,106,.7)' : (dim ? 'rgba(32,36,44,.22)' : 'rgba(217,43,43,.55)');
          c.beginPath(); c.arc(p.x, p.y, p.r - 4, 0, Math.PI * 2); c.stroke();
          c.setLineDash([]);
          c.beginPath(); c.arc(p.x, p.y, 13, 0, Math.PI * 2);
          c.fillStyle = done ? GREEN : (dim ? '#98a0a8' : RED); c.fill();
          c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
          D.T(c, done ? '✓' : p.label, p.x, p.y + 5, 13, '#fff', 'center');
          c.restore();
        });
      }
      // 排队大爷
      P(c, 800, 596, { s: 1.05, seed: 3, elbow: true, thermos: true, squash: .92 });
      D.label(c, '排队大爷 · 已等候 47 分钟', 800, 420, { bg: '#fffdf7', color: INK, size: 11 });
      // 关门警告
      if (s.t < 8) {
        c.save(); c.globalAlpha = .5 + Math.sin(s.bubbleT * 12) * .35;
        D.label(c, '车门即将关闭 · 请勿强行上下车', 480, 178, { bg: RED, size: 15 }); c.restore();
      }
      if (s.step >= 4 && s.winT < 0) button(c, 50, 500, 210, 66, '挤！！', true, '或按空格');
      if (s.winT >= 0) {
        c.save(); c.globalAlpha = .8;
        D.T(c, '身体穿过了门缝，尊严留在了站台上', 480, 200, 25, '#fff', 'center');
        c.restore();
      }
    }
  };
  var s1;
  function launchL1() {
    if (s1.winT >= 0) return;
    s1.winT = 0; sfx.whoosh(); FX.shake(5);
    FX.burst(480, 350, '#f5c518', 24, { star: true, maxSpeed: 320 });
    FX.bubble(770, 420, '……行吧，算你狠。', { life: 2, side: 'left', bg: '#fff0d8' });
  }
  B.registerLevel(L1);

  /* =========================================================
     关卡 2 · 气流借力
     ========================================================= */
  var L2 = {
    key: 'vacuum', tag: 'VACUUM', name: '气流借力',
    desc: '长按蓄力，靠一口气把自己吸进门缝',
    brief: {
      lead: '人太多，物理意义上已经挤不进去了。但空气还没放弃你。',
      lines: '长按屏幕或空格蓄力，松开瞬间角色会深吸一口气、把肚子收成真空，利用车厢内外的负压把自己「吸」进门缝。蓄力要落在金色甜区里。',
      quote: '⚠️ 力度不够会被人群弹回来；憋太久会缺氧当场晕倒，还会把前面大爷的假发吹飞。总共只有 <b>3 口气</b>。',
      tip: '长按 = 蓄力，松手 = 吸气。金色区间 62%~78% 是负压甜区。'
    },
    init: function () {
      s2 = {
        charge: 0, charging: false, phase: 'idle', tries: 3, mistakes: 0, dignity: 100,
        t: 45, faint: 0, anim: 0, msg: '', lo: 62, hi: 78, heroX: 480, rot: 0, wave: 0, swirl: 0
      };
      B.toast('长按蓄力 · 松手吸气');
    },
    update: function (dt) {
      var s = s2;
      s.t -= dt; s.wave += dt; s.swirl += dt;
      if (s.phase === 'idle') {
        if (s.charging) {
          s.charge = Math.min(100, s.charge + 57 * dt);
          if (s.charge >= 100) {
            s.faint += dt;
            if (s.faint > 1.05) L2.finish(false, '缺氧', '你憋了太久，眼前一黑，在站台上完成了一次短暂的冥想。', 'faint');
          }
        }
      } else if (s.phase === 'anim') {
        s.anim += dt;
        if (s.anim > 1.6) {
          if (s.animKind === 'win') {
            s.phase = 'end';
            B.win({
              mistakes: s.mistakes, dignity: s.dignity,
              title: s.mistakes === 0 ? '一口气 · 负压天才' : '人体吸尘器',
              comment: '你证明了「吸气」在通勤场景下属于一种推进技术。',
              announce: '请车内乘客注意收腹，车门外还有一位正在做深呼吸。'
            });
          } else { s.phase = 'idle'; s.charge = 0; s.anim = 0; }
        }
      }
      if (s.t <= 0 && s.phase !== 'end') B.lose({ reason: '列车开走了。你深吸的三口气，最终都变成了叹气。', mistakes: s.mistakes, dignity: s.dignity });
    },
    down: function () { if (s2.phase === 'idle') { s2.charging = true; s2.faint = 0; sfx.gasp(); } },
    up: function () {
      var s = s2;
      if (s.phase !== 'idle' || !s.charging) return;
      s.charging = false;
      var v = s.charge;
      if (v >= s.lo && v <= s.hi) {
        L2.finish(true, '负压成功！', '「呼——」你和 0.3 个大气压达成了共识。', 'win');
      } else if (v < s.lo) {
        L2.finish(false, '气压不足', U.choice(['这口气，连吸管都吹不动。', '你只是叹了口气。', '空气看了你一眼，没搭理你。']), 'bounce');
      } else {
        L2.finish(false, '放气事故', U.choice(['打了个嗝，把前面大爷的假发吹飞了。', '气太足，你在原地转了三圈。', '车厢里的人集体往后仰了一下。']), 'burp');
      }
    },
    key: function (code, down) {
      if (code !== 'Space') return;
      if (down) L2.down(); else L2.up();
    },
    finish: function (ok, title, msg, kind) {
      var s = s2;
      s.phase = 'anim'; s.anim = 0; s.animKind = kind; s.msg = msg;
      if (!ok) {
        s.tries--; s.mistakes++; s.dignity = Math.max(0, s.dignity - 10);
        if (kind === 'bounce') { sfx.boing(); FX.shake(7); FX.burst(480, 400, '#ffffff', 14); }
        else if (kind === 'burp') { sfx.burp(); FX.shake(5); FX.burst(480, 350, '#c8e0a0', 16); }
        else { sfx.fail(); FX.shake(9); }
        FX.bubble(760, 380, title + '：' + msg, { life: 2.2, side: 'left', bg: '#fff0d8' });
        FX.float(480, 300, title, RED, 28);
        if (s.tries <= 0 && kind !== 'win') {
          setTimeout(function () {
            if (s2.phase !== 'end' && s2.tries <= 0 && s2.animKind !== 'win') B.lose({ reason: '三口气全用完了。空气建议你改坐公交。', mistakes: s.mistakes, dignity: s.dignity, taunt: '「他刚才是不是想把自己吸进去？」' });
          }, 1700);
        }
      } else {
        sfx.whoosh(); sfx.success(); FX.shake(4);
        FX.float(480, 280, '负压甜区！', GREEN, 30);
        for (var i = 0; i < 30; i++) FX.burst(480 + U.rand(-120, 120), U.rand(180, 480), '#8fd0e8', 1, { gravity: -120, maxSpeed: 40 });
      }
      s.charging = false; s.faint = 0;
    },
    hud: function () {
      return { meter: s2.dignity / 100, meterText: Math.round(s2.dignity) + '%', meterLabel: '尊严值', danger: s2.dignity < 35, timer: Math.max(0, s2.t), tip: '剩余 ' + s2.tries + ' 口气 · 甜区 ' + s2.lo + '~' + s2.hi + '%' };
    },
    draw: function (c) {
      var s = s2;
      ST(c, { gap: 34, station: '国贸', english: 'GUOMAO', alarm: false, capacity: 100 });
      // 门缝前的人墙
      for (var i = 0; i < 7; i++) P(c, 480 + (i - 3) * 34, 470, { s: .92, squash: .48, seed: i + 4, alpha: .85, sleep: i % 2 === 0, bag: i === 2 });
      D.label(c, '人墙 · 密度 9.8 人/㎡', 290, 246, { bg: '#20242c', size: 12 });
      // 负压吸入动画
      var p = s.phase === 'anim' ? U.clamp(s.anim / 1.15, 0, 1) : 0;
      var sucking = s.animKind === 'win';
      var hx = s.heroX, hy = 470, sq = 1, rot = 0, alpha = 1;
      if (s.charging) {
        sq = 1 + Math.sin(s.wave * 14) * .035 + s.charge / 100 * .06;
        hy = 470 + Math.sin(s.wave * 10) * 2;
      }
      if (s.phase === 'anim') {
        if (sucking) { hx = 480; hy = 470 - p * 200; sq = .5 - p * .3; alpha = 1 - p * .9; }
        else if (s.animKind === 'bounce') { hx = 480 + Math.sin(p * Math.PI) * 240; rot = Math.sin(p * Math.PI) * .8; sq = .8; }
        else if (s.animKind === 'burp') { rot = Math.sin(p * 18) * .3; sq = 1.25 - p * .3; }
        else { rot = p * 1.5; hy = 470 + p * 40; }
      }
      // 漩涡粒子（蓄力时）
      if (s.charging && s.charge > 20) {
        c.save(); c.globalAlpha = .55;
        for (var k = 0; k < 8; k++) {
          var a = s.swirl * 2.6 + k * Math.PI / 4;
          var rr = 60 + s.charge * .5 - (s.swirl * 40 % 55);
          c.fillStyle = '#8fd0e8';
          c.beginPath(); c.arc(480 + Math.cos(a) * rr * 1.5, 400 + Math.sin(a) * rr * .55, 4, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      }
      hero(c, hx, hy, { s: 1.35, squash: sq, stretch: 1 / sq, rot: rot, alpha: alpha, gasp: sucking, pain: s.animKind === 'faint' && s.phase === 'anim', sweat: s.charge > 80, bag: false });
      // 假发飞走
      if (s.animKind === 'burp' && s.phase === 'anim') {
        c.save(); c.translate(700 - p * 260, 340 - Math.sin(p * Math.PI) * 130); c.rotate(p * 12);
        c.fillStyle = '#4a3b33'; c.beginPath(); c.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); c.fill(); c.restore();
        FX.float(760, 300, '大爷的假发', '#8a6a4a', 16);
      }
      // 蓄力槽
      var bx = 180, by = 522, bw = 600, bh = 30;
      D.rr(c, bx - 8, by - 30, bw + 16, bh + 52, 12);
      c.fillStyle = 'rgba(255,253,247,.92)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      D.T(c, '负压蓄力槽', bx, by - 12, 13, INK, 'left');
      D.T(c, '长按屏幕 / 空格 · 松手吸气', bx + bw, by - 12, 12, '#7c828d', 'right', 800);
      D.rr(c, bx, by, bw, bh, 8); c.fillStyle = '#e6e1d4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      // 甜区
      var sx = bx + bw * s.lo / 100, sw = bw * (s.hi - s.lo) / 100;
      c.fillStyle = 'rgba(46,156,106,.35)'; c.fillRect(sx, by + 2, sw, bh - 4);
      c.strokeStyle = GREEN; c.lineWidth = 2; c.strokeRect(sx, by + 2, sw, bh - 4);
      // 缺氧区
      c.fillStyle = 'rgba(217,43,43,.2)'; c.fillRect(bx + bw * s.hi / 100, by + 2, bw * (100 - s.hi) / 100, bh - 4);
      // 填充
      c.save(); c.beginPath(); D.rr(c, bx + 2, by + 2, (bw - 4) * s.charge / 100, bh - 4, 6); c.clip();
      c.fillStyle = s.charge > s.hi ? 'rgba(217,43,43,.75)' : 'rgba(245,197,24,.75)';
      c.fillRect(bx, by, bw, bh);
      for (var q = 0; q < 12; q++) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(bx + ((q * 67 + s.wave * 90) % bw), by, 8, bh); }
      c.restore();
      // 刻度
      [0, 25, 50, 62, 78, 100].forEach(function (v) {
        var xx = bx + bw * v / 100;
        c.fillStyle = INK; c.fillRect(xx, by + bh, 1.5, 6);
      });
      D.T(c, '负压甜区', sx + sw / 2, by + bh + 20, 12, GREEN, 'center');
      D.T(c, '缺氧区 →', bx + bw - 8, by + bh + 20, 11, RED, 'right', 800);
      D.T(c, Math.round(s.charge) + '%', bx + bw / 2, by + bh + 20, 14, INK, 'center');
      if (s.faint > 0) D.label(c, '缺氧警告！马上松手！', 480, 250, { bg: RED, size: 16 });
      if (s.phase === 'anim' && s.msg) {
        D.rr(c, 260, 120, 440, 52, 10); c.fillStyle = 'rgba(32,36,44,.9)'; c.fill();
        D.T(c, s.msg, 480, 153, 16, '#fff', 'center');
      }
      D.label(c, '剩余 ' + s.tries + ' 口气', 108, 470, { bg: '#fffdf7', color: INK, size: 12 });
    }
  };
  var s2;
  B.registerLevel(L2);

  /* =========================================================
     关卡 3 · 道具流
     ========================================================= */
  var ITEMS = [
    { key: 'rod', name: '钓鱼竿', sub: '钩住车厢里的扶手', color: '#e8d9a8', icon: 'rod' },
    { key: 'balloon', name: '氢气球', sub: '从人群头顶飘进去', color: '#f7b7c8', icon: 'balloon' },
    { key: 'scooter', name: '折叠滑板车', sub: '低姿态滑进去', color: '#bcd6ea', icon: 'scooter' },
    { key: 'case', name: '巨型行李箱', sub: '把门缝撑开', color: '#d6c39a', icon: 'case' }
  ];
  var L3 = {
    key: 'items', tag: 'GADGET', name: '道具流',
    desc: '四个离谱道具，只有一个真的能把你弄进去',
    brief: {
      lead: '面对人墙，工具人决定借助工具。站台上散落着四件「看起来很有道理」的东西。',
      lines: '点击道具试试。大部分会以非常北京地铁的方式失败。其中一件需要先瞄准车厢里的扶手——按住钩子拖到黄色扶手上松手。',
      quote: '🎣 线索：车厢里有根扶手，它今天特别孤单。至于氢气球……安检大妈已经盯着它看了很久了。',
      tip: '先点道具卡片；选中钓鱼竿后，按住角色手里的钩子拖向摆动的扶手。'
    },
    init: function () {
      s3 = {
        t: 65, phase: 'choose', picked: null, mistakes: 0, dignity: 100,
        anim: 0, kind: '', msg: '', aim: { x: 480, y: 380 }, dragging: false,
        railX: 480, railT: 0, combo: 0, hitFx: 0
      };
      B.toast('四件道具 · 只有一个不是行为艺术');
    },
    update: function (dt) {
      var s = s3;
      s.t -= dt; s.railT += dt; s.hitFx = Math.max(0, s.hitFx - dt);
      s.railX = 480 + Math.sin(s.railT * 1.35) * 105;
      if (s.phase === 'anim') {
        s.anim += dt;
        if (s.kind === 'rod' && s.anim > .55 && s.anim < 1.5 && Math.random() < dt * 9) {
          s.combo++;
          FX.bubble(U.rand(160, 800), U.rand(220, 380), U.choice(['哎！我的包子！', '谁拽我裤腿？！', '这鱼竿哪儿买的？', '师傅，我到站了让我一下！']), { life: 1.1, bg: '#fff0d8' });
          FX.burst(U.rand(300, 660), U.rand(260, 420), '#f5c518', 5, { star: true, maxSpeed: 140 });
        }
        if (s.anim > 1.9) {
          if (s.kind === 'rod') {
            s.phase = 'end';
            B.win({
              mistakes: s.mistakes, dignity: s.dignity,
              title: s.mistakes === 0 ? '一竿入魂 · 不被安检看见的人' : '钓人者 · 反被人群钓',
              comment: '钓鱼竿原本是用来钓鱼的，今天钓到了一个上班的。',
              announce: '温馨提示：车厢内禁止垂钓，尤其禁止钓自己。'
            });
          } else {
            s.phase = 'choose'; s.anim = 0; s.kind = '';
          }
        }
      }
      if (s.t <= 0 && s.phase !== 'end') B.lose({ reason: '你在道具之间犹豫了整整一趟车的时间。', mistakes: s.mistakes, dignity: s.dignity });
    },
    down: function (x, y) {
      var s = s3;
      if (s.phase === 'aim') {
        if (U.dist(x, y, s.aim.x, s.aim.y) < 70) s.dragging = true;
        return;
      }
      if (s.phase !== 'choose') return;
      for (var i = 0; i < ITEMS.length; i++) {
        var r = L3.cardRect(i);
        if (inRect(x, y, r)) { L3.pick(ITEMS[i].key); return; }
      }
    },
    move: function (x, y, down) {
      if (s3.phase === 'aim' && s3.dragging && down) {
        s3.aim.x = U.clamp(x, 120, 840); s3.aim.y = U.clamp(y, 130, 440);
      }
    },
    up: function (x, y) {
      var s = s3;
      if (s.phase !== 'aim' || !s.dragging) return;
      s.dragging = false;
      var d = U.dist(s.aim.x, s.aim.y, s.railX, 218);
      s.aim.x = 480; s.aim.y = 380;
      if (d < 52) {
        s.phase = 'anim'; s.anim = 0; s.kind = 'rod'; s.combo = 0; s.msg = '钩住了！收线！！';
        sfx.whoosh(); sfx.ding(); FX.shake(5);
        FX.float(480, 250, '命中扶手！', GREEN, 28);
      } else {
        s.mistakes++; s.dignity = Math.max(0, s.dignity - 8); s.hitFx = 1;
        sfx.hit(); FX.shake(7);
        FX.bubble(760, 300, U.choice(['钩到大爷假发了，赶紧松手！', '钩到的是别人的手机充电线。', '钩子挂自己背包上了。', '这准头，建议先去钓点静水。']), { life: 2.2, side: 'left', bg: '#fff0d8' });
        FX.float(480, 300, '脱钩！', RED, 26);
      }
    },
    pick: function (k) {
      var s = s3;
      if (k === 'rod') {
        s.phase = 'aim'; s.picked = 'rod'; sfx.ding();
        B.toast('按住钩子，拖到摆动的黄色扶手上松手');
        return;
      }
      s.phase = 'anim'; s.anim = 0; s.kind = k; s.picked = k;
      s.mistakes++; s.dignity = Math.max(0, s.dignity - 9);
      if (k === 'balloon') {
        s.msg = '安检大妈：氢气球属于易燃易爆，没收。';
        sfx.pop(); FX.bubble(720, 300, '气球？易燃易爆。没收。', { life: 2.4, side: 'left', bg: '#ffe1e1' });
      } else if (k === 'scooter') {
        s.msg = '滑板车被「禁止代步工具入内」的牌子拦下了。';
        sfx.thud(); FX.bubble(720, 300, '牌子都写了，您还滑？', { life: 2.2, side: 'left', bg: '#fff0d8' });
      } else {
        s.msg = '箱子撑开了门缝，然后被人群原样弹了回来。';
        sfx.boing(); FX.bubble(720, 300, '谁的行李箱！砸我脚了！', { life: 2.2, side: 'left', bg: '#fff0d8' });
      }
      FX.float(480, 280, '道具失效', RED, 26); FX.shake(6);
    },
    cardRect: function (i) { return [20 + i * 235, 476, 215, 110]; },
    hud: function () {
      return { meter: s3.dignity / 100, meterText: Math.round(s3.dignity) + '%', meterLabel: '尊严值', danger: s3.dignity < 35, timer: Math.max(0, s3.t), tip: s3.phase === 'aim' ? '拖动钩子命中扶手' : '选一件「有道理」的道具' };
    },
    draw: function (c) {
      var s = s3;
      ST(c, { gap: 56, station: '国贸', english: 'GUOMAO', capacity: 100 });
      // 扶手（aim 阶段可见）
      var showRail = s.phase === 'aim' || s.phase === 'anim' && s.kind === 'rod';
      if (showRail) {
        c.save(); c.strokeStyle = YELLOW; c.lineWidth = 11; c.lineCap = 'round';
        c.beginPath(); c.arc(s.railX, 218, 30, Math.PI, 0); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        c.restore();
        c.save(); c.setLineDash([6, 6]); c.strokeStyle = GREEN; c.lineWidth = 2.5;
        c.beginPath(); c.arc(s.railX, 218, 52, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore();
        D.label(c, '扶手（会动）', s.railX, 168, { bg: YELLOW, color: INK, size: 11 });
      }
      // 鱼线
      if (s.phase === 'aim' || (s.phase === 'anim' && s.kind === 'rod')) {
        var tx = s.phase === 'anim' ? s.railX : s.aim.x;
        var ty = s.phase === 'anim' ? 218 : s.aim.y;
        c.save(); c.strokeStyle = INK; c.lineWidth = 2; c.setLineDash([4, 3]);
        c.beginPath(); c.moveTo(430, 412); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]); c.restore();
        if (s.phase === 'aim') {
          c.save(); c.translate(s.aim.x, s.aim.y); c.rotate(.5);
          c.strokeStyle = '#8b6b3d'; c.lineWidth = 7; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-20, -26); c.lineTo(0, 0); c.stroke();
          c.strokeStyle = INK; c.lineWidth = 3;
          c.beginPath(); c.arc(2, 6, 9, -.4, Math.PI * 1.35); c.stroke();
          c.restore();
          D.label(c, s.dragging ? '松手放钩！' : '按住这里拖', s.aim.x, s.aim.y + 34, { bg: INK, size: 11 });
        }
      }
      // 主角
      var p = s.phase === 'anim' ? U.clamp(s.anim / 1.2, 0, 1) : 0;
      var hx = 430, hy = 460, alpha = 1, rot = 0, sq = 1;
      if (s.phase === 'anim') {
        if (s.kind === 'balloon') { hy = 460 - Math.sin(p * Math.PI * .9) * 210; if (p > .72) hy += (p - .72) * 700; }
        else if (s.kind === 'scooter') { hx = 430 + p * 120; rot = p * 1.2; }
        else if (s.kind === 'case') { hx = 430 - Math.sin(p * Math.PI) * 190; rot = -Math.sin(p * Math.PI); }
        else if (s.kind === 'rod') { hy = 460 - p * 300; sq = 1 - p * .65; alpha = 1 - p * .8; }
      }
      hero(c, hx, hy, { s: 1.28, squash: sq, rot: rot, alpha: alpha, gasp: s.kind === 'rod', pain: s.kind === 'scooter' || s.kind === 'case', bag: false });
      // 道具特效
      if (s.phase === 'anim') {
        if (s.kind === 'balloon') {
          c.save(); c.translate(hx + 40, hy - 210 + (p > .72 ? 0 : 0)); c.rotate(Math.sin(p * 8) * .2);
          c.fillStyle = '#f0768f'; c.beginPath(); c.ellipse(0, 0, 26, 33, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
          c.restore();
          if (p > .68) {
            P(c, 690 - p * 60, 466, { s: .82, seed: 9, squash: 1 });
            D.label(c, '安检 · 没收', 690 - p * 60, 330, { bg: RED, size: 13 });
          }
        } else if (s.kind === 'scooter') {
          c.save(); c.translate(hx + 20, 462); c.rotate(p * 1.1);
          c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(-25, 0); c.lineTo(30, -20); c.stroke();
          c.fillStyle = '#4a5563'; c.beginPath(); c.arc(-25, 0, 9, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(32, -20, 9, 0, Math.PI * 2); c.fill();
          c.restore();
          D.rr(c, 560, 300, 44, 70, 4); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = RED; c.lineWidth = 4; c.stroke();
          D.T(c, '禁', 582, 345, 24, RED, 'center');
        } else if (s.kind === 'case') {
          c.save(); c.translate(480 + Math.sin(p * Math.PI) * 90, 440); c.rotate(Math.sin(p * 12) * .25);
          D.rr(c, -38, -46, 76, 92, 8); c.fillStyle = '#a98c5c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.restore();
        } else if (s.kind === 'rod') {
          c.save(); c.globalAlpha = .8;
          D.T(c, '连撞 ' + s.combo + ' 人', 480, 180, 26, '#fff', 'center'); c.restore();
        }
      }
      // 道具卡片
      ITEMS.forEach(function (it, i) {
        var r = L3.cardRect(i), hot = s.picked === it.key;
        c.save();
        D.rr(c, r[0], r[1], r[2], r[3], 12);
        c.fillStyle = hot ? '#fff4cf' : '#fffdf7'; c.fill();
        c.lineWidth = 3; c.strokeStyle = hot ? RED : INK; c.stroke();
        D.rr(c, r[0] + 10, r[1] + 10, 44, 44, 8); c.fillStyle = it.color; c.fill();
        drawItemIcon(c, it.icon, r[0] + 32, r[1] + 32, .78);
        D.T(c, it.name, r[0] + 62, r[1] + 30, 16, INK);
        D.T(c, it.sub, r[0] + 12, r[1] + 76, 12, '#6b7280', 'left', 800);
        D.T(c, hot ? '已选中' : '点击试用 →', r[0] + 12, r[1] + 99, 11, hot ? RED : '#9aa0a8', 'left', 800);
        c.restore();
      });
      if (s.phase === 'anim' && s.msg) {
        D.rr(c, 200, 108, 560, 46, 10); c.fillStyle = 'rgba(32,36,44,.9)'; c.fill();
        D.T(c, s.msg, 480, 138, 15, '#fff', 'center');
      }
    }
  };
  function drawItemIcon(c, type, x, y, k) {
    c.save(); c.translate(x, y); if (k) c.scale(k, k);
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 2.5;
    if (type === 'rod') {
      c.strokeStyle = '#8b6b3d'; c.lineWidth = 4; c.beginPath(); c.moveTo(-16, 16); c.lineTo(14, -16); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(-12, -12, 7, -.5, Math.PI * 1.4); c.stroke();
    } else if (type === 'balloon') {
      c.fillStyle = '#e2506f'; c.beginPath(); c.ellipse(0, -4, 12, 16, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(6, 20, 0, 24); c.stroke();
    } else if (type === 'scooter') {
      c.beginPath(); c.moveTo(-16, 10); c.lineTo(10, -12); c.stroke();
      c.beginPath(); c.arc(-16, 12, 6, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(13, -12, 6, 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = '#8a6a3c'; c.fillRect(-14, -12, 28, 26); c.strokeRect(-14, -12, 28, 26);
      c.beginPath(); c.moveTo(-6, -12); c.lineTo(-6, 14); c.moveTo(6, -12); c.lineTo(6, 14); c.stroke();
    }
    c.restore();
  }
  var s3;
  B.registerLevel(L3);

  /* =========================================================
     关卡 4 · 西二旗 / 国贸早高峰
     ========================================================= */
  var TYPES = [
    { k: 'elbow', name: '大爷的胳膊肘', color: '#c97b4a', line: ['我这胳膊肘，练过太极。', '小伙子，往哪儿钻呢！', '别挤别挤，我这儿有支架！'], push: 1.6 },
    { k: 'hair', name: '小姐姐的头发', color: '#8f6bb0', line: ['我的头发！这可是刚接的！', '你压到我刘海了！！', '这头发三千八，你赔得起吗？'], push: .55 },
    { k: 'bag', name: '双肩包', color: '#5b84b8', line: ['包里有电脑！轻点！', '我这包能装下整个工位。', '别挤了，我包先上！'], push: 1.2 },
    { k: 'thermos', name: '保温杯大爷', color: '#6b9c72', line: ['枸杞水洒了，这事儿没完。', '我这杯子里泡的是人生。', '哎哟，烫！'], push: 1.0 },
    { k: 'sleep', name: '睡着的上班族', color: '#9a8fa8', line: ['嗯……到站叫我……', '再睡五分钟，就五分钟……', '别晃，我梦见下班了。'], push: .7 }
  ];
  var NICE = ['这缝隙，量身定做。', '丝滑，太丝滑了。', '你是液体吗？', '人体导航已重新规划。', '这波走位值一个升职加薪。'];
  var L4 = {
    key: 'rush', tag: 'RUSH HOUR', name: '西二旗早高峰',
    desc: '在 151 个人之间找一条人体缝隙路径',
    brief: {
      lead: '车厢里已经有 151 个人（游戏虚构数据）。车门上贴着「额定载客 100 人」。你需要穿过静止的人体，挤到车门。',
      lines: '左右滑动或 A / D 在人群缝隙间穿梭，角色会自动向前推进。按住空格 / 屏幕右下角的「缩」按钮可以缩骨变瘦，但会消耗体力、速度变慢。碰到不同部位会触发不同的物理反馈和台词。',
      quote: '📢 别碰大爷的胳膊肘，别碰小姐姐的头发，别碰任何人的保温杯。被撞 3 次，你会被人群礼貌地请回站台。',
      tip: '鼠标/触摸左右拖动，或 A D / ← →；按住空格缩骨；R 重来。'
    },
    init: function () {
      s4 = {
        t: 80, dist: 0, total: 1700, x: 480, vx: 0, hearts: 3, combo: 0, maxCombo: 0,
        mistakes: 0, dignity: 100, energy: 100, shrink: false, cool: 0, rows: [],
        passed: 0, reached: false, doorT: 0, speed: 96, jitter: 0, bob: 0, shrinkBtn: [812, 470, 112, 88]
      };
      var gx = 480;
      for (var i = 0; i < 18; i++) {
        var half = Math.max(50, 82 - i * 1.7);
        gx = U.clamp(gx + U.rand(-230, 230), 130, 830);
        var ppl = [];
        for (var px = 52; px <= 908; px += U.rand(100, 128)) {
          if (Math.abs(px - gx) < half + 34) continue;
          var r = U.rand(30, 42);
          ppl.push({ x: px + U.rand(-8, 8), r: r, type: U.choice(TYPES), seed: U.rnd(0, 7), squash: 1, wob: U.rand(0, 6) });
        }
        s4.rows.push({ yw: 120 + i * 94, gap: gx, half: half, ppl: ppl, done: false, hit: false });
      }
      s4.total = 120 + 17 * 94 + 190;
      B.toast('额定载客 100 人 · 实际 151 人 · 开始钻');
    },
    update: function (dt) {
      var s = s4;
      s.t -= dt; s.bob += dt; s.jitter *= Math.pow(.02, dt);
      s.cool = Math.max(0, s.cool - dt);
      // 缩骨（空格或按钮）
      var wantShrink = !!(B.keys.Space || B.keys.ShiftLeft || B.keys.ShiftRight || s.btnHold);
      s.shrink = wantShrink && s.energy > 1;
      s.energy = U.clamp(s.energy + (s.shrink ? -22 : 15) * dt, 0, 100);
      var pr = s.shrink ? 13 : 22;
      // 横向输入
      var dir = 0;
      if (B.keys.KeyA || B.keys.ArrowLeft) dir -= 1;
      if (B.keys.KeyD || B.keys.ArrowRight) dir += 1;
      if (B.pointer.down && !s.btnHold && B.pointer.y > 180 && U.dist(B.pointer.x, B.pointer.y, s.shrinkBtn[0] + 56, s.shrinkBtn[1] + 44) > 80) {
        var dx = B.pointer.x - s.x;
        if (Math.abs(dx) > 4) dir = U.clamp(dx / 60, -1, 1);
      }
      s.vx = U.lerp(s.vx, dir * 330, Math.min(1, dt * 9));
      s.x = U.clamp(s.x + s.vx * dt, 46, 914);
      // 前进
      var sp = s.speed + Math.min(s.combo, 8) * 3.5;
      if (s.shrink) sp *= .72;
      if (!s.reached) s.dist += sp * dt;
      // 碰撞 / 过缝
      s.rows.forEach(function (row) {
        var sy = 470 - row.yw + s.dist;
        if (sy > -90 && sy < 690) {
          for (var i = 0; i < row.ppl.length; i++) {
            var p = row.ppl[i];
            var d = U.dist(s.x, 470, p.x, sy);
            var need = p.r + pr + 4;
            if (d < need) {
              p.squash = U.lerp(p.squash, .72, Math.min(1, dt * 12));
              if (s.cool <= 0 && sy > 380 && sy < 560) L4.bump(p, row);
            } else p.squash = U.lerp(p.squash, 1, Math.min(1, dt * 5));
          }
        }
        if (!row.done && sy > 500) {
          row.done = true; s.passed++;
          if (!row.hit) {
            s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
            FX.float(s.x, 400, '+' + (10 + s.combo * 2), GREEN, 20);
            if (s.combo % 3 === 0) FX.bubble(s.x + 90, 380, U.choice(NICE), { life: 1.5, side: 'left' });
            FX.burst(s.x, 470, YELLOW, 6, { star: true, maxSpeed: 120, gravity: 60 });
            sfx.pop();
          }
        }
      });
      // 到达车门
      if (!s.reached && s.dist >= s.total) {
        s.reached = true; s.doorT = 0; sfx.clampDoor(); FX.shake(10);
      }
      if (s.reached) {
        s.doorT += dt;
        if (s.doorT > 1.5 && !s.broadcasted) {
          s.broadcasted = true;
          B.broadcast({
            mistakes: s.mistakes, dignity: Math.round(s.dignity),
            title: s.maxCombo >= 8 ? '西二旗之字形战士' : (s.mistakes === 0 ? '人体润滑油' : '额定载客 152 / 100'),
            comment: '你穿过了 151 个人，抵达车门。然后车门关上了，理由：超载。',
            announce: '本次列车因超载未能关门，已为您自动播放下一站：迟到。'
          });
        }
      }
      if (s.t <= 0 && !s.broadcasted) B.lose({ reason: '早高峰结束了，你还在第 4 排。人群已经开始讨论晚上吃什么。', mistakes: s.mistakes, dignity: s.dignity });
      if (s.hearts <= 0 && !s.broadcasted) B.lose({ reason: '你被三个人体部位联合请回了站台。', mistakes: s.mistakes, dignity: s.dignity, taunt: '「年轻人，缝隙是要用眼睛找的，不是用脸。」' });
    },
    bump: function (p, row) {
      var s = s4;
      s.cool = .72; s.mistakes++; s.hearts--; s.rowHit = true; row.hit = true;
      s.combo = 0; s.dignity = Math.max(0, s.dignity - 11);
      s.dist = Math.max(0, s.dist - 30); s.jitter = 8;
      s.vx += (s.x < p.x ? -1 : 1) * 300 * p.type.push;
      sfx.hit(); FX.shake(9);
      FX.burst(p.x, 470, p.type.color, 16, { star: true, maxSpeed: 230 });
      FX.float(p.x, 400, '咚！', RED, 26);
      FX.bubble(p.x + (p.x > 480 ? -30 : 30), 380, U.choice(p.type.line), { life: 2, side: p.x > 480 ? 'left' : 'right', bg: '#fff0d8' });
      if (p.type.k === 'thermos') for (var i = 0; i < 8; i++) FX.burst(p.x, 460, '#d8913a', 1, { maxSpeed: 120, gravity: 200 });
      if (p.type.k === 'hair') { s.vx *= .3; FX.float(p.x, 350, '黏住了…', '#8f6bb0', 18); }
    },
    down: function (x, y) {
      if (inRect(x, y, s4.shrinkBtn)) { s4.btnHold = true; return; }
    },
    up: function () { s4.btnHold = false; },
    key: function (code, down) { },
    hud: function () {
      var s = s4;
      return {
        meter: s.hearts / 3, meterText: '♥'.repeat(Math.max(0, s.hearts)) + '♡'.repeat(3 - Math.max(0, s.hearts)),
        meterLabel: '剩余体面', danger: s.hearts <= 1, timer: Math.max(0, s.t), timerLabel: '发车倒计时',
        tip: '连击 ' + s.combo + ' · 穿过 ' + s.passed + '/18 排 · 体力 ' + Math.round(s.energy) + '%'
      };
    },
    draw: function (c) {
      var s = s4;
      // 车厢地板（俯视 2.5D）
      c.fillStyle = '#d9dedb'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#cbd2ce'; c.fillRect(0, 0, W, 92);
      c.strokeStyle = 'rgba(32,36,44,.09)'; c.lineWidth = 2;
      for (var gx = 0; gx <= W; gx += 60) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, H); c.stroke(); }
      for (var gy = (s.dist % 60); gy <= H; gy += 60) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }
      // 两侧车壁
      c.fillStyle = '#b9c5c9'; c.fillRect(0, 0, 34, H); c.fillRect(W - 34, 0, 34, H);
      c.fillStyle = '#8fa2a9'; c.fillRect(30, 0, 4, H); c.fillRect(W - 34, 0, 4, H);
      // 车门（远端）
      var doorY = 470 - s.total + s.dist;
      if (doorY > -160) {
        c.fillStyle = '#8fa2a9'; c.fillRect(40, doorY - 90, W - 80, 90);
        var close = s.reached ? U.clamp(s.doorT / .9, 0, 1) : 0;
        var openW = (W - 80) / 2 * (1 - close) + 2;
        c.fillStyle = '#dfe7e9'; c.fillRect(40, doorY - 84, openW, 84); c.fillRect(W - 40 - openW, doorY - 84, openW, 84);
        c.strokeStyle = '#6f8087'; c.lineWidth = 5; c.strokeRect(40, doorY - 84, openW, 84); c.strokeRect(W - 40 - openW, doorY - 84, openW, 84);
        c.fillStyle = YELLOW; c.fillRect(40 + openW - 10, doorY - 84, 10, 84); c.fillRect(W - 40 - openW, doorY - 84, 10, 84);
        D.label(c, close > .8 ? '车门关闭 · 超载' : '车门 · 请有序拥挤', 480, doorY - 110, { bg: close > .8 ? RED : YELLOW, color: close > .8 ? '#fff' : INK, size: 13 });
      }
      // 人群（按屏幕 y 从远到近）
      var visible = s.rows.filter(function (r) { var sy = 470 - r.yw + s.dist; return sy > -80 && sy < 680; });
      visible.sort(function (a, b) { return (470 - a.yw + s.dist) - (470 - b.yw + s.dist); });
      visible.forEach(function (row) {
        var sy = 470 - row.yw + s.dist;
        // 缝隙光带
        c.save(); c.globalAlpha = .25;
        var grad = c.createLinearGradient(row.gap - row.half, 0, row.gap + row.half, 0);
        grad.addColorStop(0, 'rgba(245,197,24,0)'); grad.addColorStop(.5, 'rgba(245,197,24,.9)'); grad.addColorStop(1, 'rgba(245,197,24,0)');
        c.fillStyle = grad; c.fillRect(row.gap - row.half, sy - 46, row.half * 2, 92); c.restore();
        row.ppl.forEach(function (p) { drawCrowd(c, p, sy, s.bob); });
      });
      // 玩家
      var jitter = s.jitter > .3 ? U.rand(-s.jitter, s.jitter) : 0;
      var px = s.x + jitter, py = 470 + Math.sin(s.bob * 9) * 2;
      var pr = s.shrink ? 13 : 22;
      c.save();
      c.fillStyle = 'rgba(32,36,44,.22)'; c.beginPath(); c.ellipse(px, py + pr + 8, pr * 1.2, 7, 0, 0, Math.PI * 2); c.fill();
      c.translate(px, py);
      D.poly(c, [[-pr, -pr * .6], [pr, -pr * .6], [pr * .8, pr], [-pr * .8, pr]], '#e4654b', INK, 2.5);
      c.fillStyle = RED; c.beginPath(); c.arc(0, -pr * .5, pr * .62, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#f3c9a0'; c.beginPath(); c.arc(0, -pr * .85, pr * .45, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK;
      c.beginPath(); c.arc(-pr * .16, -pr * .9, 1.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(pr * .16, -pr * .9, 1.8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -pr * .78, 3, .1 * Math.PI, .9 * Math.PI); c.stroke();
      c.restore();
      if (s.shrink) D.label(c, '缩骨中 · 速度↓', px, py - 52, { bg: GREEN, size: 10 });
      // 缩骨按钮
      var b = s.shrinkBtn;
      D.rr(c, b[0], b[1], b[2], b[3], 14);
      c.fillStyle = s.btnHold || s.shrink ? GREEN : '#fffdf7'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
      D.T(c, '缩', b[0] + b[2] / 2, b[1] + 40, 30, s.btnHold || s.shrink ? '#fff' : INK, 'center');
      D.T(c, '按住变瘦', b[0] + b[2] / 2, b[1] + 64, 11, s.btnHold || s.shrink ? '#e7fff2' : '#6b7280', 'center', 800);
      // 体力环
      D.T(c, '体力 ' + Math.round(s.energy) + '%', 90, 545, 13, INK, 'left');
      D.rr(c, 34, 556, 160, 12, 6); c.fillStyle = '#e6e1d4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      D.rr(c, 36, 558, 156 * s.energy / 100, 8, 4); c.fillStyle = s.energy < 30 ? RED : GREEN; c.fill();
      // 撞人提示
      if (s.cool > .35) {
        c.save(); c.globalAlpha = .14; c.fillStyle = RED; c.fillRect(0, 0, W, H); c.restore();
      }
      if (s.reached) {
        c.save(); c.globalAlpha = .9;
        D.T(c, '您已抵达车门', 480, 300, 34, RED, 'center');
        D.T(c, '系统正在判定是否超载…', 480, 336, 17, INK, 'center');
        c.restore();
      }
      // 顶部信息牌放在最后，避免被人群圆块压住
      D.rr(c, 250, 12, 460, 58, 8); c.fillStyle = '#123b6b'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
      D.T(c, '额定载客 100 人', 480, 38, 19, '#fff', 'center');
      D.T(c, '游戏虚构数据  ·  实际 151 人  ·  下一站：迟到  ·  进度 ' + Math.round(U.clamp(s.dist / s.total, 0, 1) * 100) + '%', 480, 59, 11, '#a9c6e8', 'center', 800);
      D.label(c, '▲ 车门方向', 480, 94, { bg: '#fffdf7', color: '#123b6b', size: 11 });
    }
  };
  function drawCrowd(c, p, y, t) {
    var r = p.r, sq = p.squash, col = p.type.color;
    var wob = Math.sin(t * 2 + p.wob) * 1.5;
    c.save(); c.translate(p.x + wob, y);
    c.fillStyle = 'rgba(32,36,44,.16)'; c.beginPath(); c.ellipse(0, r * .72, r * 1.05, r * .34, 0, 0, Math.PI * 2); c.fill();
    // low-poly 八边形身体
    var pts = [];
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 + Math.PI / 8; pts.push([Math.cos(a) * r * sq, Math.sin(a) * r * .86]); }
    D.poly(c, pts, col, INK, 2.6);
    D.poly(c, [pts[4], pts[5], pts[6], [0, 0]], 'rgba(0,0,0,.10)', null);
    // 头
    c.fillStyle = '#f0c69c'; c.beginPath(); c.arc(0, -r * .52, r * .42, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#2e3038'; c.beginPath(); c.arc(0, -r * .62, r * .42, Math.PI, 0); c.fill();
    c.fillStyle = INK;
    c.beginPath(); c.arc(-r * .14, -r * .5, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * .14, -r * .5, 1.8, 0, Math.PI * 2); c.fill();
    // 类型装饰
    if (p.type.k === 'elbow') {
      c.strokeStyle = col; c.lineWidth = 11; c.lineCap = 'round';
      c.beginPath(); c.moveTo(r * .5, -r * .2); c.lineTo(r * 1.35, -r * .55); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else if (p.type.k === 'hair') {
      c.strokeStyle = '#3b2c2c'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, -r * .45, r * .55, .1 * Math.PI, .9 * Math.PI); c.stroke();
      c.beginPath(); c.moveTo(-r * .52, -r * .4); c.quadraticCurveTo(-r * .8, r * .4, -r * .5, r * .8); c.stroke();
    } else if (p.type.k === 'bag') {
      D.rr(c, -r * .95, -r * .15, r * .5, r * .8, 4); c.fillStyle = '#3b5375'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else if (p.type.k === 'thermos') {
      D.rr(c, r * .45, -r * .2, r * .3, r * .6, 3); c.fillStyle = '#c6d0d4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else if (p.type.k === 'sleep') {
      D.T(c, 'z', r * .5, -r * .8, 14, '#4a5563', 'center');
      D.T(c, 'Z', r * .8, -r * 1.1, 11, '#4a5563', 'center');
    }
    c.restore();
  }
  var s4;
  B.registerLevel(L4);
})();
