/* 豆绘 · 颜色引擎
 * sRGB -> CIELAB(D65)，CIEDE2000 色差，MARD 色卡最近色匹配。
 * 纯函数 + 一个小缓存，无第三方依赖。
 */
(function () {
  'use strict';

  var D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

  function srgbToLinear(v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function labF(t) {
    return t > 0.008856451679035631 ? Math.cbrt(t) : (903.2962962962963 * t + 16) / 116;
  }

  function rgbToLab(r, g, b) {
    var lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
    var x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / D65.x;
    var y = (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) / D65.y;
    var z = (0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb) / D65.z;
    var fx = labF(x), fy = labF(y), fz = labF(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function rad(deg) { return deg * Math.PI / 180; }

  /* CIEDE2000，参数为两个 Lab 三元组。 */
  function ciede2000(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

    var C1 = Math.sqrt(a1 * a1 + b1 * b1);
    var C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var Cbar = (C1 + C2) / 2;
    var Cbar7 = Math.pow(Cbar, 7);
    var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7

    var a1p = (1 + G) * a1;
    var a2p = (1 + G) * a2;
    var C1p = Math.sqrt(a1p * a1p + b1 * b1);
    var C2p = Math.sqrt(a2p * a2p + b2 * b2);

    var h1p = (C1p === 0) ? 0 : (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
    var h2p = (C2p === 0) ? 0 : (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;

    var dLp = L2 - L1;
    var dCp = C2p - C1p;
    var dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

    var Lbarp = (L1 + L2) / 2;
    var Cbarp = (C1p + C2p) / 2;
    var hbarp;
    if (C1p * C2p === 0) {
      hbarp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      hbarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      hbarp = (h1p + h2p + 360) / 2;
    } else {
      hbarp = (h1p + h2p - 360) / 2;
    }

    var T = 1
      - 0.17 * Math.cos(rad(hbarp - 30))
      + 0.24 * Math.cos(rad(2 * hbarp))
      + 0.32 * Math.cos(rad(3 * hbarp + 6))
      - 0.20 * Math.cos(rad(4 * hbarp - 63));

    var dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
    var Cbarp7 = Math.pow(Cbarp, 7);
    var Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625));
    var Sl = 1 + 0.015 * Math.pow(Lbarp - 50, 2) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
    var Sc = 1 + 0.045 * Cbarp;
    var Sh = 1 + 0.015 * Cbarp * T;
    var Rt = -Math.sin(rad(2 * dTheta)) * Rc;

    var t1 = dLp / Sl;
    var t2 = dCp / Sc;
    var t3 = dHp / Sh;
    return Math.sqrt(t1 * t1 + t2 * t2 + t3 * t3 + Rt * t2 * t3);
  }

  function clamp255(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  /* 按亮度选择黑/白文字，保证色号可读。 */
  function inkFor(rgb) {
    var L = 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
    return L > 0.42 ? 'rgba(28,25,20,.82)' : 'rgba(255,255,255,.9)';
  }

  function buildPalette(def) {
    var colors = def.colors;
    var n = colors.length;
    var rgb = new Uint8Array(n * 3);
    var labs = new Float64Array(n * 3);
    var labList = new Array(n);
    for (var i = 0; i < n; i++) {
      var hex = colors[i].hex;
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
      var lab = rgbToLab(r, g, b);
      labs[i * 3] = lab[0];
      labs[i * 3 + 1] = lab[1];
      labs[i * 3 + 2] = lab[2];
      labList[i] = lab;
      colors[i].rgb = [r, g, b];
      colors[i].index = i;
      colors[i].ink = inkFor(colors[i].rgb);
    }
    return {
      id: def.id,
      name: def.name,
      brand: def.brand,
      note: def.note,
      colors: colors,
      rgb: rgb,
      labs: labs,
      labList: labList,
      count: n
    };
  }

  var cache = new Map();
  var CACHE_LIMIT = 240000;
  var K = 16;
  var bestIdx = new Int32Array(K);
  var bestD = new Float64Array(K);

  /* 最近色：先用 Lab 欧氏距离取前 8 名，再用 CIEDE2000 精确比较。
   * 这样既保证观感准确，又避免 10k 格 × 221 色全量 CIEDE2000 的开销。 */
  function nearest(palette, r, g, b) {
    r = Math.round(clamp255(r));
    g = Math.round(clamp255(g));
    b = Math.round(clamp255(b));
    var key = (r << 16) | (g << 8) | b;
    var hit = cache.get(key);
    if (hit !== undefined) return hit;

    var lab = rgbToLab(r, g, b);
    var L = lab[0], A = lab[1], B = lab[2];
    var labs = palette.labs;
    var n = palette.count;

    for (var k = 0; k < K; k++) bestD[k] = Infinity;

    for (var i = 0; i < n; i++) {
      var i3 = i * 3;
      var dL = L - labs[i3];
      var dA = A - labs[i3 + 1];
      var dB = B - labs[i3 + 2];
      var d = dL * dL + dA * dA + dB * dB;
      if (d < bestD[K - 1]) {
        var p = K - 1;
        while (p > 0 && bestD[p - 1] > d) {
          bestD[p] = bestD[p - 1];
          bestIdx[p] = bestIdx[p - 1];
          p--;
        }
        bestD[p] = d;
        bestIdx[p] = i;
      }
    }

    var best = -1;
    var bestE = Infinity;
    for (var j = 0; j < K; j++) {
      if (bestD[j] === Infinity) continue;
      var idx = bestIdx[j];
      var e = ciede2000(lab, palette.labList[idx]);
      if (e < bestE) {
        bestE = e;
        best = idx;
      }
    }

    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, best);
    return best;
  }

  function applyAdjust(r, g, b, adjust) {
    var brightness = adjust.brightness || 0;
    var contrast = adjust.contrast || 0;
    var saturation = adjust.saturation || 0;

    if (brightness) {
      var add = brightness * 2.55;
      r += add; g += add; b += add;
    }
    if (contrast) {
      var c = contrast * 2.55;
      var f = (259 * (c + 255)) / (255 * (259 - c));
      r = f * (r - 128) + 128;
      g = f * (g - 128) + 128;
      b = f * (b - 128) + 128;
    }
    if (saturation) {
      var s = 1 + saturation / 100;
      var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * s;
      g = lum + (g - lum) * s;
      b = lum + (b - lum) * s;
    }
    return [clamp255(r), clamp255(g), clamp255(b)];
  }

  window.PindouColor = {
    rgbToLab: rgbToLab,
    ciede2000: ciede2000,
    inkFor: inkFor,
    buildPalette: buildPalette,
    nearest: nearest,
    applyAdjust: applyAdjust,
    clamp255: clamp255
  };
})();
