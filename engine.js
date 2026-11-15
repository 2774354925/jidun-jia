/* ==========================================================
   北京地铁挤车 · 引擎层
   Canvas 2D + 自研「软体人群」弹簧物理（零依赖，离线可玩）
   ========================================================== */
(function () {
  'use strict';

  var W = 960, H = 600;
  var canvas, ctx, stage, overlay, toastEl, hudEl;
  var dpr = 1, lastT = 0, rafId = 0;

  /* ---------------- 工具 ---------------- */
  var U = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    rnd: function (a, b) { return Math.floor(U.rand(a, b + 1)); },
    choice: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    dist: function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    ease: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 3); },
    approach: function (v, target, step) { return v < target ? Math.min(v + step, target) : Math.max(v - step, target); },
    wrapText: function (text, n) {
      var out = [], line = '';
      for (var i = 0; i < text.length; i++) {
        line += text[i];
        if (line.length >= n) { out.push(line); line = ''; }
      }
      if (line) out.push(line);
      return out;
    }
  };

  /* ---------------- 合成音效（WebAudio，无外部资源） ---------------- */
  var AC = null, muted = false;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (muted) return;
    var a = ac(); if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || .13, t0 + Math.min(.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(dur, vol, cut, delay) {
    if (muted) return;
    var a = ac(); if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(a.sampleRate * dur));
    var buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = a.createBufferSource(); s.buffer = buf;
    var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 1800;
    var g = a.createGain(); g.gain.value = vol || .1;
    s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(t0);
  }
  var sfx = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = m; },
    isMuted: function () { return muted; },
    squeak: function () { tone(420, .26, 'sawtooth', .09, 1150); tone(880, .2, 'square', .035, 1700); noise(.14, .05, 2600); },
    pop: function () { tone(180, .11, 'sine', .13, 420); noise(.05, .05, 900); },
    thud: function () { tone(120, .18, 'triangle', .17, 55); noise(.12, .07, 500); },
    boing: function () { tone(240, .38, 'sine', .13, 90); tone(480, .3, 'triangle', .05, 150); },
    hit: function () { noise(.1, .11, 700); tone(90, .14, 'square', .09, 50); },
    gasp: function () { noise(.5, .045, 1100); tone(300, .45, 'sine', .04, 520); },
    whoosh: function () { noise(.34, .085, 2400); tone(600, .3, 'sine', .03, 130); },
    ding: function () { tone(880, .1, 'sine', .1); tone(1320, .16, 'sine', .07, null, .09); },
    success: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, .22, 'triangle', .11, null, i * .09); }); },
    fail: function () { [400, 340, 270, 190].forEach(function (f, i) { tone(f, .2, 'sawtooth', .07, null, i * .1); }); },
    tick: function () { tone(1200, .045, 'square', .035); },
    clampDoor: function () { sfx.squeak(); sfx.thud(); },
    news: function () { tone(180, .8, 'sine', .05, 170); noise(.8, .02, 500); },
    burp: function () { tone(110, .35, 'sawtooth', .09, 62); noise(.2, .04, 400); }
  };

  /* ---------------- 特效：震屏 / 粒子 / 气泡 / 飘字 ---------------- */
  var FX = {
    shakeAmt: 0, shakeT: 0,
    parts: [], bubbles: [], floats: [],
    shake: function (n) { FX.shakeAmt = Math.max(FX.shakeAmt, n || 6); FX.shakeT = .32; },
    burst: function (x, y, color, count, opt) {
      opt = opt || {};
      for (var i = 0; i < (count || 12); i++) {
        var a = opt.angle != null ? opt.angle + U.rand(-.7, .7) : U.rand(0, Math.PI * 2);
        var sp = U.rand(opt.minSpeed || 60, opt.maxSpeed || 240);
        FX.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.lift || 0),
          life: U.rand(.35, .85), max: .85, color: color, size: U.rand(3, opt.size || 8),
          spin: U.rand(-8, 8), rot: 0, star: opt.star || false, gravity: opt.gravity == null ? 420 : opt.gravity
        });
      }
    },
    bubble: function (x, y, text, opt) {
      opt = opt || {};
      FX.bubbles.push({ x: x, y: y, text: text, life: opt.life || 2.4, max: opt.life || 2.4, color: opt.color || '#20242c', bg: opt.bg || '#fffdf7', w: opt.w || 0, side: opt.side || 'right', scale: 0 });
    },
    float: function (x, y, text, color, size) {
      FX.floats.push({ x: x, y: y, text: text, color: color || '#d92b2b', life: 1.1, max: 1.1, size: size || 22 });
    },
    clear: function () { FX.parts.length = 0; FX.bubbles.length = 0; FX.floats.length = 0; FX.shakeAmt = 0; FX.shakeT = 0; },
    update: function (dt) {
      if (FX.shakeT > 0) { FX.shakeT -= dt; FX.shakeAmt *= Math.pow(.02, dt); if (FX.shakeT <= 0) FX.shakeAmt = 0; }
      var i, p;
      for (i = FX.parts.length - 1; i >= 0; i--) {
        p = FX.parts[i]; p.life -= dt;
        if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
        p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      }
      for (i = FX.bubbles.length - 1; i >= 0; i--) {
        p = FX.bubbles[i]; p.life -= dt; p.scale = U.lerp(p.scale, 1, Math.min(1, dt * 14));
        if (p.life <= 0) FX.bubbles.splice(i, 1);
      }
      for (i = FX.floats.length - 1; i >= 0; i--) {
        p = FX.floats[i]; p.life -= dt; p.y -= 46 * dt;
        if (p.life <= 0) FX.floats.splice(i, 1);
      }
    },
    draw: function (c) {
      var i, p;
      for (i = 0; i < FX.parts.length; i++) {
        p = FX.parts[i];
        c.save(); c.globalAlpha = U.clamp(p.life / p.max * 1.4, 0, 1);
        c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
        if (p.star) {
          c.beginPath();
          for (var k = 0; k < 10; k++) {
            var r = k % 2 ? p.size * .45 : p.size;
            var a = k * Math.PI / 5 - Math.PI / 2;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath(); c.fill();
        } else { c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); }
        c.restore();
      }
      for (i = 0; i < FX.floats.length; i++) {
        p = FX.floats[i];
        c.save(); c.globalAlpha = U.clamp(p.life / p.max, 0, 1);
        c.font = '900 ' + p.size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,.9)';
        c.strokeText(p.text, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
        c.restore();
      }
      for (i = 0; i < FX.bubbles.length; i++) {
        p = FX.bubbles[i];
        var lines = U.wrapText(p.text, 13);
        c.save();
        c.globalAlpha = U.clamp(p.life / .35, 0, 1);
        c.translate(p.x, p.y); c.scale(.6 + .4 * p.scale, .6 + .4 * p.scale);
        c.font = '800 14px "PingFang SC","Microsoft YaHei",sans-serif';
        var w = 0;
        lines.forEach(function (l) { w = Math.max(w, c.measureText(l).width); });
        w = Math.max(w + 26, p.w);
        var h = lines.length * 21 + 18;
        var bx = p.side === 'left' ? -w : 0;
        c.fillStyle = p.bg; c.strokeStyle = p.color; c.lineWidth = 2.5;
        c.beginPath(); c.roundRect ? c.roundRect(bx, -h, w, h, 12) : (function () {
          var x = bx, y = -h, r = 12;
          c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
          c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
        })();
        c.fill(); c.stroke();
        c.beginPath();
        if (p.side === 'left') { c.moveTo(-6, -8); c.lineTo(6, -2); c.lineTo(-6, 4); }
        else { c.moveTo(0, -8); c.lineTo(-13, -2); c.lineTo(0, 4); }
        c.fillStyle = p.bg; c.fill(); c.stroke();
        c.fillStyle = p.color; c.textAlign = 'left';
        lines.forEach(function (l, j) { c.fillText(l, bx + 13, -h + 24 + j * 21); });
        c.restore();
      }
    }
  };

  /* ---------------- 绘图工具 ---------------- */
  var D = {
    T: function (c, text, x, y, size, color, align, weight, baseline) {
      c.font = (weight || 900) + ' ' + size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      c.textAlign = align || 'left'; c.textBaseline = baseline || 'alphabetic';
      c.fillStyle = color || '#20242c'; c.fillText(text, x, y);
    },
    rr: function (c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    },
    poly: function (c, pts, fill, stroke, lw) {
      c.beginPath();
      for (var i = 0; i < pts.length; i++) { if (i === 0) c.moveTo(pts[i][0], pts[i][1]); else c.lineTo(pts[i][0], pts[i][1]); }
      c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
    },
    label: function (c, text, x, y, opt) {
      opt = opt || {};
      c.save(); c.font = '900 ' + (opt.size || 13) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      var w = c.measureText(text).width + 20;
      D.rr(c, x - w / 2, y - 14, w, 26, 6);
      c.fillStyle = opt.bg || '#20242c'; c.fill();
      if (opt.border) { c.lineWidth = 2; c.strokeStyle = opt.border; c.stroke(); }
      c.fillStyle = opt.color || '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, x, y); c.restore();
    }
  };

  var SHIRTS = ['#e4654b', '#4d8bb8', '#68a56e', '#e0a63c', '#8f72b5', '#d8668e', '#4aa8a0', '#c9754b'];
  var SKINS = ['#f3c9a0', '#e8b489', '#f7d7b5', '#dba476'];

  /* low-poly 卡通人物：以 (x,y) 为脚底中心，高约 118*s */
  function drawPerson(c, x, y, o) {
    o = o || {};
    var s = o.s == null ? 1 : o.s;
    var sx = (o.squash == null ? 1 : o.squash) * s;   // 横向挤压
    var sy = (o.stretch == null ? 1 : o.stretch) * s;  // 纵向拉伸
    var shirt = o.shirt || SHIRTS[o.seed % SHIRTS.length || 0];
    var skin = o.skin || SKINS[(o.seed || 0) % SKINS.length];
    var hair = o.hair || '#2e3038';
    var ink = '#20242c';
    c.save();
    c.translate(x, y);
    c.scale(sx, sy);
    if (o.rot) c.rotate(o.rot);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    // 影子
    c.save(); c.scale(1 / Math.max(.001, sx), 1 / Math.max(.001, sy));
    c.fillStyle = 'rgba(30,36,44,.16)';
    c.beginPath(); c.ellipse(0, -2, 34 * s, 8 * s, 0, 0, Math.PI * 2); c.fill(); c.restore();
    // 腿
    D.poly(c, [[-19, -40], [-3, -40], [-4, -3], [-21, -3]], '#3a4354', ink, 2);
    D.poly(c, [[3, -40], [19, -40], [21, -3], [4, -3]], '#3a4354', ink, 2);
    D.poly(c, [[-24, -6], [-1, -6], [-1, 1], [-27, 1]], '#262c36', ink, 2);
    D.poly(c, [[1, -6], [24, -6], [27, 1], [1, 1]], '#262c36', ink, 2);
    // 身体（梯形 low-poly）
    D.poly(c, [[-26, -86], [26, -86], [21, -38], [-21, -38]], shirt, ink, 2.5);
    D.poly(c, [[-26, -86], [0, -86], [0, -38], [-21, -38]], o.shade || 'rgba(0,0,0,.10)', null);
    // 手臂
    if (o.elbow) { // 大爷的胳膊肘：支出去
      c.save();
      c.translate(-24, -80); c.rotate(-.95);
      D.poly(c, [[-6, -6], [6, -8], [40, -3], [38, 8], [4, 8]], shirt, ink, 2.5);
      c.fillStyle = skin; c.beginPath(); c.arc(40, 2, 8, 0, Math.PI * 2); c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
      c.restore();
      D.poly(c, [[24, -82], [32, -78], [29, -43], [21, -46]], shirt, ink, 2.5);
    } else {
      D.poly(c, [[-31, -83], [-22, -84], [-25, -45], [-34, -42]], shirt, ink, 2.5);
      D.poly(c, [[22, -84], [31, -83], [34, -42], [25, -45]], shirt, ink, 2.5);
      c.fillStyle = skin; c.beginPath(); c.arc(-30, -40, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(30, -40, 6, 0, Math.PI * 2); c.fill();
    }
    // 头（六边形）
    D.poly(c, [[-15, -116], [15, -116], [20, -104], [15, -88], [-15, -88], [-20, -104]], skin, ink, 2.5);
    // 头发
    if (o.longhair) {
      D.poly(c, [[-19, -108], [-12, -121], [12, -121], [19, -108], [22, -72], [12, -76], [12, -110], [-12, -110], [-12, -76], [-22, -72]], '#3b2c2c', ink, 2);
    } else {
      D.poly(c, [[-18, -108], [-13, -120], [12, -120], [18, -108], [8, -112], [-8, -110]], hair, ink, 2);
    }
    // 表情
    c.fillStyle = ink;
    if (o.sleep) {
      c.lineWidth = 2.2; c.strokeStyle = ink;
      c.beginPath(); c.moveTo(-11, -102); c.lineTo(-4, -102); c.moveTo(4, -102); c.lineTo(11, -102); c.stroke();
      c.beginPath(); c.arc(0, -94, 3, 0, Math.PI); c.stroke();
      D.T(c, 'z', 24, -122, 15, '#5b6270', 'center');
    } else {
      c.beginPath(); c.arc(-7, -103, 2.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(7, -103, 2.6, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = ink; c.beginPath();
      if (o.pain) { c.moveTo(-6, -93); c.lineTo(0, -98); c.lineTo(6, -93); }
      else { c.arc(0, -97, 5, .15 * Math.PI, .85 * Math.PI); }
      c.stroke();
    }
    // 附件
    if (o.bag) {
      D.rr(c, -42, -84, 22, 40, 7); c.fillStyle = '#d8b04a'; c.fill(); c.strokeStyle = ink; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.moveTo(-42, -72); c.lineTo(-20, -72); c.stroke();
    }
    if (o.thermos) {
      D.rr(c, 26, -56, 13, 21, 4); c.fillStyle = '#b8c2c9'; c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    }
    c.restore();
  }

  /* 站台 / 车厢 / 车门 通用场景 */
  function drawStation(c, o) {
    o = o || {};
    var gap = o.gap == null ? 60 : o.gap;
    var gl = W / 2 - gap / 2, gr = W / 2 + gap / 2;
    // 背景墙
    c.fillStyle = '#e9e5da'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#dcd8cd'; c.fillRect(0, 0, W, 92);
    for (var i = 0; i < 24; i++) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(i * 44, 0, 3, 92); }
    // 站牌
    D.rr(c, 30, 20, 250, 52, 8); c.fillStyle = '#123b6b'; c.fill(); c.strokeStyle = '#20242c'; c.lineWidth = 3; c.stroke();
    D.T(c, o.station || '西二旗', 46, 47, 24, '#fff', 'left', 900);
    D.T(c, (o.english || "XI'ERQI") + '  ·  虚构早高峰专线', 46, 64, 10, '#a9c6e8', 'left', 800);
    D.rr(c, 690, 26, 240, 42, 6); c.fillStyle = '#fffdf7'; c.fill(); c.strokeStyle = '#20242c'; c.lineWidth = 2.5; c.stroke();
    D.T(c, '额定载客 ' + (o.capacity || 100) + ' 人', 810, 53, 18, '#d92b2b', 'center');
    // 车厢主体
    c.fillStyle = '#c5ced2'; c.fillRect(0, 92, W, 378);
    c.fillStyle = '#b3bec3'; c.fillRect(0, 92, W, 16);
    c.fillStyle = '#e8eef0'; c.fillRect(0, 108, W, 6);
    // 车窗
    [0, 1].forEach(function (k) {
      var wx = k === 0 ? 70 : 640, ww = 250;
      D.rr(c, wx, 138, ww, 168, 12); c.fillStyle = '#25333d'; c.fill(); c.strokeStyle = '#8e9ba2'; c.lineWidth = 6; c.stroke();
      c.save(); c.beginPath(); c.rect(wx + 6, 144, ww - 12, 156); c.clip();
      c.fillStyle = 'rgba(255,255,255,.10)';
      D.poly(c, [[wx + 20, 300], [wx + 100, 144], [wx + 140, 144], [wx + 60, 300]], 'rgba(255,255,255,.09)', null);
      D.poly(c, [[wx + 150, 300], [wx + 220, 144], [wx + 245, 144], [wx + 175, 300]], 'rgba(255,255,255,.06)', null);
      c.restore();
    });
    // 车厢内人群剪影（挤满）
    c.save(); c.beginPath(); c.rect(0, 120, gl, 350); c.clip();
    for (var a = 0; a < 14; a++) drawPerson(c, 10 + a * 32 + Math.sin(a * 3) * 5, 455, { s: .86, squash: .62, seed: a + 2, alpha: .92, sleep: a % 5 === 0 });
    c.restore();
    c.save(); c.beginPath(); c.rect(gr, 120, W - gr, 350); c.clip();
    for (var b = 0; b < 14; b++) drawPerson(c, gr + 10 + b * 32, 455, { s: .86, squash: .62, seed: b + 6, alpha: .92, bag: b % 4 === 0 });
    c.restore();
    // 门洞（里面也塞满了人）
    c.fillStyle = '#1b252c'; c.fillRect(gl, 108, gap, 362);
    c.save(); c.beginPath(); c.rect(gl, 108, gap, 362); c.clip();
    for (var m = 0; m < 3; m++) drawPerson(c, 480 + (m - 1) * 19, 470, { s: .92, squash: .3, seed: m + 11, alpha: .55, sleep: m % 2 === 0 });
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(gl + 4, 108, 4, 362);
    // 门板：不翻转 = 画在左侧，翻转 = 画在右侧，中间留出真正的门缝
    function door(x, flip) {
      c.save(); c.translate(x, 0); if (flip) c.scale(-1, 1);
      D.rr(c, -160, 110, 160, 360, 4); c.fillStyle = '#d9e0e3'; c.fill(); c.strokeStyle = '#7c8a91'; c.lineWidth = 4; c.stroke();
      D.rr(c, -148, 145, 133, 140, 8); c.fillStyle = '#2b3d47'; c.fill(); c.strokeStyle = '#95a3aa'; c.lineWidth = 5; c.stroke();
      c.save(); c.beginPath(); c.rect(-144, 149, 125, 132); c.clip();
      D.poly(c, [[-140, 281], [-95, 149], [-75, 149], [-120, 281]], 'rgba(255,255,255,.10)', null);
      c.restore();
      c.fillStyle = '#b9c4c9'; c.fillRect(-160, 330, 160, 8);
      c.fillStyle = '#e8b53a'; c.fillRect(-5, 110, 5, 360);
      c.fillStyle = '#5d6a71'; c.fillRect(-160, 452, 160, 18);
      c.restore();
    }
    door(gl, false); door(gr, true);
    // 门楣 / 指示灯
    c.fillStyle = '#3f4b52'; c.fillRect(gl - 30, 96, gap + 60, 16);
    c.fillStyle = o.alarm ? '#ff5a3c' : '#f5c518';
    c.beginPath(); c.arc(W / 2 - 18, 104, 6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(W / 2 + 18, 104, 6, 0, Math.PI * 2); c.fill();
    if (o.alarm) {
      c.save(); c.globalAlpha = .25 + Math.sin(performance.now() / 90) * .2;
      c.fillStyle = '#ff3b2f'; c.fillRect(0, 0, W, H); c.restore();
    }
    // 站台地面
    c.fillStyle = '#cfc8b8'; c.fillRect(0, 470, W, 130);
    c.fillStyle = '#c1b9a8'; c.fillRect(0, 470, W, 8);
    c.fillStyle = '#f5c518'; c.fillRect(0, 492, W, 12);
    c.fillStyle = 'rgba(32,36,44,.12)';
    for (var t = 0; t < 40; t++) { c.beginPath(); c.arc(14 + t * 25, 516, 4, 0, Math.PI * 2); c.fill(); }
    // 屏蔽门顶部反光
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 468, W, 3);
    return { gl: gl, gr: gr, gap: gap };
  }

  /* ---------------- 存档 ---------------- */
  var SAVE_KEY = 'bjmetro.save.v1';
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s === 'object') return { unlocked: s.unlocked || 1, best: s.best || {}, cleared: s.cleared || {}, runs: s.runs || 0 };
    } catch (e) { }
    return { unlocked: 1, best: {}, cleared: {}, runs: 0 };
  }
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
  var save = loadSave();

  /* ---------------- 游戏主控 ---------------- */
  var G = {
    W: W, H: H, U: U, D: D, FX: FX, sfx: sfx, drawPerson: drawPerson, drawStation: drawStation,
    levels: [], current: null, index: 0, state: 'title',
    keys: {}, pointer: { x: 0, y: 0, down: false },
    elapsed: 0, runStart: 0, runStats: [], muted: false,
    registerLevel: function (l) { G.levels.push(l); },
    ctx: function () { return ctx; },
    toast: function (text, ms) {
      toastEl.textContent = text; toastEl.classList.add('show');
      clearTimeout(G._toastT); G._toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1500);
    },
    hud: function (o) {
      if (!o) return;
      document.getElementById('hudLevel').textContent = '关卡 ' + ('0' + (G.index + 1)).slice(-2) + ' / 04';
      document.getElementById('hudTitle').textContent = G.current ? G.current.name : '';
      document.getElementById('meterLabel').textContent = o.meterLabel || '尊严值';
      document.getElementById('meterText').textContent = o.meterText || '';
      var f = document.getElementById('meterFill');
      f.style.width = (U.clamp(o.meter == null ? 1 : o.meter, 0, 1) * 100) + '%';
      f.classList.toggle('danger', !!o.danger);
      document.getElementById('hudTip').textContent = o.tip || '';
      var tm = document.getElementById('hudTimer'), tl = document.getElementById('hudTimerLabel');
      if (o.timer == null) { tm.textContent = ''; tl.textContent = ''; }
      else {
        tm.textContent = typeof o.timer === 'number' ? o.timer.toFixed(1) : o.timer;
        tm.classList.toggle('urgent', typeof o.timer === 'number' && o.timer < 8);
        tl.textContent = o.timerLabel || '关门倒计时';
      }
    },
    startLevel: function (i) {
      G.index = i; G.current = G.levels[i]; G.state = 'play'; G.elapsed = 0;
      G.keys = {}; FX.clear();
      hideOverlay(); hudEl.classList.remove('hide');
      try { G.current.init(); } catch (e) { console.error(e); }
      sfx.unlock(); sfx.ding();
    },
    win: function (info) {
      if (G.state !== 'play') return;
      G.state = 'result';
      info = info || {};
      G.runStats[G.index] = { time: G.elapsed, mistakes: info.mistakes || 0, dignity: info.dignity == null ? 100 : info.dignity, title: info.title || '门缝艺术家' };
      save.best[G.index] = Math.min(save.best[G.index] == null ? 9999 : save.best[G.index], G.elapsed);
      save.cleared[G.index] = true;
      if (G.index + 1 < G.levels.length) save.unlocked = Math.max(save.unlocked, G.index + 2);
      writeSave();
      sfx.success();
      showResult(true, info);
    },
    lose: function (info) {
      if (G.state !== 'play') return;
      G.state = 'result';
      sfx.fail();
      showResult(false, info || {});
    },
    broadcast: function (info) {
      if (G.state !== 'play') return;
      G.state = 'news';
      showNews(function () { G.state = 'play'; G.win(info); });
    },
    startRun: function (from) {
      G.runStart = performance.now(); G.runStats = [];
      G.startLevel(from || 0);
    },
    title: function () {
      G.state = 'title'; G.current = null; hudEl.classList.add('hide'); FX.clear();
      showTitle();
    }
  };
  window.BJ = G;

  function hideOverlay() { overlay.className = 'overlay'; overlay.innerHTML = ''; }
  function showOverlay(html) { overlay.className = 'overlay show'; overlay.innerHTML = html; }

  function panelBtn(id, label, cls) { return '<button class="btn ' + (cls || '') + '" data-act="' + id + '">' + label + '</button>'; }

  function showTitle() {
    var cards = G.levels.map(function (l, i) {
      var locked = i + 1 > save.unlocked;
      var best = save.best[i] != null ? '最佳 ' + save.best[i].toFixed(1) + 's' : (locked ? '尚未解锁' : '未挑战');
      return '<button class="lv ' + (locked ? 'locked' : '') + '" data-lv="' + i + '" ' + (locked ? 'disabled' : '') + '>' +
        (locked ? '<span class="lock">🔒</span>' : (save.cleared[i] ? '<span class="lock">✔</span>' : '')) +
        '<div class="n">0' + (i + 1) + ' / ' + l.tag.toUpperCase() + '</div>' +
        '<div class="t">' + l.name + '</div><div class="d">' + l.desc + '</div>' +
        '<div class="best">' + best + '</div></button>';
    }).join('');
    showOverlay('<div class="panel">' +
      '<span class="eyebrow">早高峰 · 行为艺术 · 物理沙雕</span>' +
      '<h1>北京地铁之<em>“挤门遁甲”</em><br>用最离谱的方式挤进去</h1>' +
      '<p class="lead">目标只有一个：<b>挤上车</b>。至于体面，那是下一站的事。</p>' +
      '<div class="quote">💡 本作核心爽点不是「挤进去」，而是「用物理层面的不要脸挤进去」。缩骨、负压、钓鱼竿、人体缝隙……四关，四种社死。</div>' +
      '<div class="levels">' + cards + '</div>' +
      '<p>已解锁 ' + Math.min(save.unlocked, 4) + '/4 关 · 通关记录 ' + Object.keys(save.cleared).length + ' 关 · 累计挤车 ' + save.runs + ' 次</p>' +
      '<p style="font-size:11px;color:#8a8f99;line-height:1.7">本作是虚构调侃作品：站名、人数、播报与人物均为游戏设定，与现实运营无关，也不指向任何地域或人群。献给每一个早高峰被挤成相片的人。</p>' +
      '<div class="btnrow">' + panelBtn('play', '▶ 从第一关开始') + panelBtn('help', '玩法说明', 'ghost small') + '</div>' +
      '</div>');
  }

  function showBrief(i) {
    var l = G.levels[i];
    showOverlay('<div class="panel">' +
      '<span class="eyebrow">关卡 0' + (i + 1) + ' · ' + l.tag + '</span>' +
      '<h2>' + l.name + '</h2>' +
      '<p class="lead">' + l.brief.lead + '</p>' +
      '<p>' + l.brief.lines + '</p>' +
      '<div class="quote">' + l.brief.quote + '</div>' +
      '<p style="font-size:12px;color:#8a8f99">操作提示：' + (l.brief.tip || '鼠标 / 触摸 / 键盘均可') + '</p>' +
      '<div class="btnrow">' + panelBtn('go', '▶ 开始挤') + panelBtn('home', '返回选关', 'ghost small') + '</div>' +
      '</div>');
  }

  function showHelp() {
    showOverlay('<div class="panel">' +
      '<span class="eyebrow">乘车须知</span><h2>怎么个挤法？</h2>' +
      '<p><b>① 缩骨功</b>　按正确顺序点击身体部位，把包先甩进去。点错会被门夹，后面的大爷会开始骂街。</p>' +
      '<p><b>② 气流借力</b>　长按屏幕 / 空格蓄力，松手瞬间靠「负压」把自己吸进门缝。憋太久会缺氧，力度不够会被弹回来。</p>' +
      '<p><b>③ 道具流</b>　四个离谱道具，只有一个真能把你弄进去。选中钓鱼竿后拖动瞄准车厢扶手。</p>' +
      '<p><b>④ 西二旗早高峰</b>　左右滑动 / A D 在静止的人体之间穿梭，按住空格缩骨变瘦。别碰胳膊肘，别碰头发。挤到车门会有惊喜播报。</p>' +
      '<div class="quote">快捷键：R 重来 · M 静音 · Esc 返回选关 · 空格蓄力/缩骨</div>' +
      '<div class="btnrow">' + panelBtn('back', '知道了', 'ghost') + '</div>' +
      '</div>');
  }

  function showResult(ok, info) {
    var l = G.current;
    var nextBtn = ok && G.index + 1 < G.levels.length ? panelBtn('next', '下一关 →') : (ok ? panelBtn('final', '查看通勤总结 →', 'yellow') : '');
    var stats = '<div class="stats">' +
      '<div class="stat"><b>' + G.elapsed.toFixed(1) + 's</b><span>本关用时</span></div>' +
      '<div class="stat"><b>' + (info.mistakes || 0) + '</b><span>社死次数</span></div>' +
      '<div class="stat"><b>' + (info.dignity == null ? 100 : Math.round(info.dignity)) + '</b><span>剩余尊严</span></div>' +
      '<div class="stat"><b>' + (ok ? '✔' : '✘') + '</b><span>是否上车</span></div></div>';
    showOverlay('<div class="panel">' +
      '<span class="eyebrow" style="background:' + (ok ? '#2e9c6a' : '#d92b2b') + '">' + (ok ? 'MISSION COMPLETE' : 'MISSION FAILED') + '</span>' +
      '<h2>' + (ok ? '挤进去了！' : '没挤上去。') + '</h2>' +
      '<p class="lead">' + (ok ? (info.comment || '你和车门达成了某种不体面但有效的共识。') : (info.reason || '车门无情地关上了，你和站台一起留在了原地。')) + '</p>' +
      (ok ? '<div style="margin:10px 0 4px"><span class="badge">🏅 ' + (info.title || '门缝艺术家') + '</span></div>' : '') +
      stats +
      '<div class="lines">' + (ok ? ('<b>列车广播：</b>' + (info.announce || '请勿倚靠车门，虽然你已经倚了。')) : ('<b>后车乘客：</b>' + (info.taunt || '「这哥们儿刚才是不是想用肚子吸进去？」'))) + '</div>' +
      '<div class="btnrow">' + nextBtn + panelBtn('retry', '↻ 再来一次', 'ghost small') + panelBtn('home', '选关', 'ghost small') + '</div>' +
      '</div>');
  }

  function finalTitle(stats) {
    var total = stats.reduce(function (a, b) { return a + (b ? b.time : 0); }, 0);
    var miss = stats.reduce(function (a, b) { return a + (b ? b.mistakes : 0); }, 0);
    if (miss === 0) return '零失误 · 人体润滑油';
    if (total < 55) return '西二旗之字形战士';
    if (miss > 10) return '社会学田野调查样本';
    return '额定载客 151 / 100';
  }
  function showFinale() {
    save.runs += 1; writeSave();
    var total = G.runStats.reduce(function (a, b) { return a + (b ? b.time : 0); }, 0);
    var miss = G.runStats.reduce(function (a, b) { return a + (b ? b.mistakes : 0); }, 0);
    var rows = G.levels.map(function (l, i) {
      var s = G.runStats[i];
      return '<p>· <b>0' + (i + 1) + ' ' + l.name + '</b>　' + (s ? (s.time.toFixed(1) + 's · 社死 ' + s.mistakes + ' 次 · 「' + s.title + '」') : '本次未挑战') + '</p>';
    }).join('');
    showOverlay('<div class="panel">' +
      '<span class="eyebrow">通勤总结报告</span>' +
      '<h2>恭喜，您已完成一次完整的早高峰</h2>' +
      '<p class="lead">全程 ' + total.toFixed(1) + ' 秒，社死 ' + miss + ' 次。您没有迟到，因为系统在播报里替您取消了「准时」这个概念。</p>' +
      '<div style="margin:12px 0"><span class="badge">🏆 ' + finalTitle(G.runStats) + '</span></div>' +
      '<div class="lines">' + rows + '</div>' +
      '<div class="quote">游戏提示：车门关闭时请勿强行上下车。当然，我们说了四关您也没听。</div>' +
      '<div class="btnrow">' + panelBtn('again', '↻ 再挤一次') + panelBtn('home', '选关', 'ghost small') + '</div>' +
      '</div>');
  }

  function showNews(done) {
    var text = '各位乘客，本次列车因超载未能关门。系统已为您自动播放下一站：迟到。';
    var ticker = '虚构快讯：本站今日共完成 3,412 次缩骨功 · 钓鱼竿收缴量同比上升 270% · 额定 100 人 / 实际 151 人（均为游戏设定）';
    showOverlay('<div class="news" id="newsBox">' +
      '<div class="news-head"><b>早高峰通勤台 · 虚构播报</b><span>本台并不存在 · 请勿当真</span></div>' +
      '<div class="news-body"><span id="newsText"></span><span class="cur" id="newsCur"></span></div>' +
      '<div class="news-foot">本播报为游戏内虚构内容，与任何现实机构、线路及运营数据无关 · 画面中人物均有正式工作</div>' +
      '<div class="news-ticker">' + ticker + '</div>' +
      '<div class="btnrow" id="newsBtn" style="display:none">' + panelBtn('newsdone', '领取我的迟到 →', 'yellow small') + '</div>' +
      '</div>');
    sfx.news();
    var el = document.getElementById('newsText'), cur = document.getElementById('newsCur'), i = 0;
    var timer = setInterval(function () {
      if (!document.getElementById('newsText')) { clearInterval(timer); return; }
      el.textContent = text.slice(0, ++i);
      if (i % 3 === 0) sfx.tick();
      if (i >= text.length) {
        clearInterval(timer); cur.style.display = 'none';
        var b = document.getElementById('newsBtn'); if (b) b.style.display = 'flex';
      }
    }, 78);
    document.getElementById('newsBox').addEventListener('click', function () {
      if (i < text.length) {
        clearInterval(timer); i = text.length; el.textContent = text; cur.style.display = 'none';
        var b = document.getElementById('newsBtn'); if (b) b.style.display = 'flex';
      }
    });
    G._newsDone = done || showFinale;
  }

  /* ---------------- 覆盖层事件委托 ---------------- */
  function onOverlay(e) {
    var lv = e.target.closest ? e.target.closest('[data-lv]') : null;
    if (lv && !lv.disabled) { G._pending = parseInt(lv.getAttribute('data-lv'), 10); showBrief(G._pending); return; }
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) return;
    var a = b.getAttribute('data-act');
    sfx.unlock();
    if (a === 'play' || a === 'again') { G.startRun(0); }
    else if (a === 'go') { hideOverlay(); G.startLevel(G._pending == null ? 0 : G._pending); }
    else if (a === 'next') { var n = G.index + 1; G._pending = n; showBrief(n); }
    else if (a === 'final') { showFinale(); }
    else if (a === 'newsdone') { if (G._newsDone) G._newsDone(); }
    else if (a === 'retry') { G.startLevel(G.index); }
    else if (a === 'home' || a === 'back') {
      if (G._helpFromPlay) { G._helpFromPlay = false; hideOverlay(); G.state = 'play'; }
      else G.title();
    }
    else if (a === 'help') { G._helpFromPlay = false; showHelp(); }
  }

  /* ---------------- 输入 ---------------- */
  function toLocal(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault(); sfx.unlock();
      var p = toLocal(e); G.pointer.x = p.x; G.pointer.y = p.y; G.pointer.down = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      if (G.state === 'play' && G.current && G.current.down) G.current.down(p.x, p.y);
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = toLocal(e); G.pointer.x = p.x; G.pointer.y = p.y;
      if (G.state === 'play' && G.current && G.current.move) G.current.move(p.x, p.y, G.pointer.down);
    });
    function up(e) {
      var p = toLocal(e); G.pointer.down = false; G.keys.Space = false;
      if (G.state === 'play' && G.current && G.current.up) G.current.up(p.x, p.y);
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0) e.preventDefault();
      sfx.unlock();
      G.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'KeyM') { toggleSound(); return; }
      if (e.code === 'KeyR' && G.state === 'play') { G.startLevel(G.index); return; }
      if (e.code === 'Escape') { G.title(); return; }
      if (G.state === 'play' && G.current && G.current.key) G.current.key(e.code, true);
    });
    window.addEventListener('keyup', function (e) {
      G.keys[e.code] = false;
      if (G.state === 'play' && G.current && G.current.key) G.current.key(e.code, false);
    });
    window.addEventListener('blur', function () { G.keys = {}; G.pointer.down = false; });
  }

  function toggleSound() {
    muted = !muted; sfx.setMuted(muted);
    var b = document.getElementById('btnSound');
    b.textContent = muted ? '♪ 音效 关' : '♪ 音效 开';
    b.classList.toggle('off', muted);
  }

  /* ---------------- 主循环 ---------------- */
  function tick(t) {
    var dt = Math.min((t - lastT) / 1000, .045); lastT = t;
    if (dt < 0) dt = 0;
    FX.update(dt);
    if (G.state === 'play' && G.current) {
      G.elapsed += dt;
      G.current.update(dt);
      if (G.current.hud) G.hud(G.current.hud());
    }
    // 绘制
    ctx.save();
    if (FX.shakeAmt > .2) ctx.translate(U.rand(-FX.shakeAmt, FX.shakeAmt), U.rand(-FX.shakeAmt, FX.shakeAmt));
    if ((G.state === 'play' || G.state === 'pause' || G.state === 'result' || G.state === 'news') && G.current && G.current.draw) {
      G.current.draw(ctx);
    } else {
      drawIdle(ctx);
    }
    FX.draw(ctx);
    ctx.restore();
    rafId = requestAnimationFrame(tick);
  }

  function drawIdle(c) {
    var s = drawStation(c, { gap: 78, station: '西二旗', capacity: 100 });
    c.fillStyle = 'rgba(255,253,247,.55)'; c.fillRect(0, 0, W, H);
    // 站台上的众生相
    for (var i = 0; i < 9; i++) drawPerson(c, 70 + i * 105, 596, { s: .9, squash: .8, seed: i, sleep: i % 4 === 0, bag: i % 3 === 0, alpha: .7 });
  }

  function boot() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
    stage = document.getElementById('stage'); overlay = document.getElementById('overlay');
    toastEl = document.getElementById('toast'); hudEl = document.getElementById('hud');
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    }
    resize(); window.addEventListener('resize', resize);
    overlay.addEventListener('click', onOverlay);
    document.getElementById('btnSound').addEventListener('click', toggleSound);
    document.getElementById('btnHome').addEventListener('click', function () { G.title(); });
    document.getElementById('btnHelp').addEventListener('click', function () {
      if (G.state === 'play') { G.state = 'pause'; G._helpFromPlay = true; }
      showHelp();
    });
    bindInput();
    G.title();
    lastT = performance.now(); rafId = requestAnimationFrame(tick);
  }

  // 等所有关卡脚本注册完毕后再启动
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
