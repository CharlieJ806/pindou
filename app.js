/* 拼斯特豆豆 · 拼豆图纸
 * 纯前端：图片只在本机处理，不上传服务器。
 */
(function () {
  'use strict';

  var EMPTY = 255;
  var BOARD_SIZE = 52;
  var MIN_SIZE = 8;
  var MAX_SIZE = 208;
  var ALPHA_CUT = 100;
  var MAX_HISTORY = 60;
  var STORE_KEY = 'pindou.studio.v1';
  var LAST_KEY = 'pindou.studio.last';
  var PREFS_KEY = 'pindou.studio.prefs';
  var MAX_PROJECTS = 12;

  var MONO = '"SFMono-Regular", "Cascadia Mono", "Roboto Mono", Consolas, monospace';
  var SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", -apple-system, sans-serif';

  if (!window.PINDOU_PALETTES || !window.PINDOU_PALETTES.mard221 || !window.PindouColor) {
    document.body.innerHTML = '<p style="padding:40px;font:16px sans-serif">色卡数据加载失败，请确认 palettes.js 和 color.js 与 index.html 在同一目录。</p>';
    return;
  }

  var palette = window.PindouColor.buildPalette(window.PINDOU_PALETTES.mard221);
  var paletteColors = palette.colors;

  function byId(id) { return document.getElementById(id); }

  var els = {
    projectName: byId('projectName'),
    saveState: byId('saveState'),
    btnProjects: byId('btnProjects'),
    btnSave: byId('btnSave'),
    btnExport: byId('btnExport'),

    dropZone: byId('dropZone'),
    dropEmpty: byId('dropEmpty'),
    fileInput: byId('fileInput'),
    imagePreview: byId('imagePreview'),
    previewImg: byId('previewImg'),
    imageName: byId('imageName'),
    imageSize: byId('imageSize'),
    btnChangeImage: byId('btnChangeImage'),
    btnPickImage: byId('btnPickImage'),
    btnPickImage3: byId('btnPickImage3'),
    btnCompose: byId('btnCompose'),
    btnSample: byId('btnSample'),

    boardSummary: byId('boardSummary'),

    fitSeg: byId('fitSeg'),
    adjBrightness: byId('adjBrightness'),
    adjContrast: byId('adjContrast'),
    adjSaturation: byId('adjSaturation'),
    outBrightness: byId('outBrightness'),
    outContrast: byId('outContrast'),
    outSaturation: byId('outSaturation'),
    btnResetAdjust: byId('btnResetAdjust'),
    optDither: byId('optDither'),

    optGrid: byId('optGrid'),
    optCoords: byId('optCoords'),
    optCodes: byId('optCodes'),
    optBoards: byId('optBoards'),

    stage: byId('stage'),
    canvasShell: byId('canvasShell'),
    canvas: byId('patternCanvas'),
    toolbar: byId('toolbar'),
    btnUndo: byId('btnUndo'),
    btnRedo: byId('btnRedo'),
    btnClear: byId('btnClear'),
    btnZoomOut: byId('btnZoomOut'),
    btnZoomFit: byId('btnZoomFit'),
    btnZoomIn: byId('btnZoomIn'),
    zoomLabel: byId('zoomLabel'),
    cursorStatus: byId('cursorStatus'),
    selectedChip: byId('selectedChip'),
    selectedSwatch: byId('selectedSwatch'),
    selectedCode: byId('selectedCode'),
    emptyStage: byId('emptyStage'),

    statTotal: byId('statTotal'),
    statColors: byId('statColors'),
    statBoards: byId('statBoards'),

    legendSummary: byId('legendSummary'),
    legendSearch: byId('legendSearch'),
    legendList: byId('legendList'),

    projectsDialog: byId('projectsDialog'),
    projectList: byId('projectList'),
    btnNewProject: byId('btnNewProject'),
    btnCloseProjects: byId('btnCloseProjects'),

    dropOverlay: byId('dropOverlay'),
    toast: byId('toast'),

    composer: byId('composer'),
    composerStage: byId('composerStage'),
    cropCanvas: byId('cropCanvas'),
    composerSizes: byId('composerSizes'),
    composerBadge: byId('composerBadge'),
    composerCropSize: byId('composerCropSize'),
    composerBoardSize: byId('composerBoardSize'),
    composerPreview: byId('composerPreview'),
    composerW: byId('composerW'),
    composerH: byId('composerH'),
    composerMirror: byId('composerMirror'),
    bgEnabled: byId('bgEnabled'),
    bgControls: byId('bgControls'),
    bgColor: byId('bgColor'),
    bgHex: byId('bgHex'),
    bgTolerance: byId('bgTolerance'),
    outBgTolerance: byId('outBgTolerance'),
    bgModeSeg: byId('bgModeSeg'),
    btnBgPick: byId('btnBgPick'),
    btnBgReset: byId('btnBgReset'),
    btnComposerSizeApply: byId('btnComposerSizeApply'),
    btnComposerCancel: byId('btnComposerCancel'),
    btnComposerApply: byId('btnComposerApply'),
    btnCropContain: byId('btnCropContain'),
    btnCropCover: byId('btnCropCover'),
    btnCropStretch: byId('btnCropStretch')
  };

  var canvas = els.canvas;
  var ctx = canvas.getContext('2d');
  var patternCanvas = document.createElement('canvas');
  var patternCtx = patternCanvas.getContext('2d');

  var cropCanvas = els.cropCanvas;
  var cropCtx = cropCanvas.getContext('2d');
  var composer = {
    open: false,
    width: 52,
    height: 52,
    frame: null,
    mirror: false,
    bg: defaultBg(),
    pickColor: false,
    preview: false,
    previewCells: null,
    previewPattern: null,
    view: { scale: 1, ox: 0, oy: 0 },
    drag: null,
    pointers: new Map(),
    pinch: null,
    interacting: false,
    previewTimer: 0,
    viewTimer: 0,
    bgTimer: 0,
    cssW: 0,
    cssH: 0,
    dpr: 1
  };

  var state = {
    projectId: null,
    name: '',
    createdAt: 0,
    updatedAt: 0,

    sourceData: null,
    sourceImage: null,
    sourceW: 0,
    sourceH: 0,
    sourceURL: '',
    imgW: 0,
    imgH: 0,
    imgName: '',
    imgFileSize: 0,

    settings: defaultSettings(),
    frame: null,
    base: null,
    cells: null,
    counts: new Int32Array(palette.count),
    total: 0,
    used: 0,
    selected: -1,
    tool: 'brush',

    view: { zoom: 10, x: 0, y: 0, fit: true },
    cssW: 0,
    cssH: 0,
    dpr: 1,

    showGrid: true,
    showCoords: true,
    showCodes: true,
    showBoards: true,

    hover: null,
    history: [],
    future: [],
    stroke: null,

    dirty: false,
    busy: false,
    loading: false
  };

  var projects = [];
  var saveTimer = null;
  var regenTimer = null;
  var toastTimer = null;
  var renderRaf = 0;
  var searchTimer = 0;

  var pointers = new Map();
  var pinch = null;
  var panning = null;
  var spaceDown = false;
  var dragDepth = 0;

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                           */
  /* ------------------------------------------------------------------ */

  function defaultBg() {
    return { enabled: false, color: '#FFFFFF', tolerance: 24, mode: 'connected' };
  }

  function normalizeBg(input) {
    var b = input || {};
    var color = typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color.toUpperCase() : '#FFFFFF';
    return {
      enabled: !!b.enabled,
      color: color,
      tolerance: clamp(Number(b.tolerance) || 0, 0, 100),
      mode: b.mode === 'global' ? 'global' : 'connected'
    };
  }

  function defaultSettings() {
    return {
      width: 52,
      height: 52,
      fit: 'contain',
      brightness: 0,
      contrast: 0,
      saturation: 0,
      dither: false,
      mirror: false,
      bg: defaultBg()
    };
  }

  function clamp(n, min, max) { return n < min ? min : (n > max ? max : n); }
  function clampInt(n, min, max) { return Math.round(clamp(Number(n) || min, min, max)); }
  function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }

  function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function timeLabel(ts) {
    var d = new Date(ts || Date.now());
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function dateLabel(ts) {
    var d = new Date(ts || Date.now());
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fullDateLabel(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fileStamp(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 2400);
  }

  function setSaveState(text) {
    els.saveState.textContent = text;
  }

  function setBusy(on) {
    state.busy = !!on;
    document.body.classList.toggle('is-busy', !!on);
  }

  function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function nameFromFile(filename) {
    var n = String(filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (!n) n = '未命名图纸';
    return n.slice(0, 36);
  }

  function boardCount(w, h) {
    return Math.ceil(w / BOARD_SIZE) * Math.ceil(h / BOARD_SIZE);
  }

  function getUsedColors() {
    var used = [];
    for (var i = 0; i < palette.count; i++) {
      if (state.counts[i] > 0) {
        used.push({ index: i, count: state.counts[i], color: paletteColors[i] });
      }
    }
    used.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.color.code.localeCompare(b.color.code, 'zh-CN', { numeric: true });
    });
    return used;
  }

  function recomputeCounts() {
    state.counts.fill(0);
    var total = 0;
    if (state.cells) {
      for (var i = 0; i < state.cells.length; i++) {
        var c = state.cells[i];
        if (c !== EMPTY) {
          state.counts[c]++;
          total++;
        }
      }
    }
    state.total = total;
    var used = 0;
    for (var k = 0; k < palette.count; k++) if (state.counts[k] > 0) used++;
    state.used = used;
  }

  /* ------------------------------------------------------------------ */
  /* 画布                                                               */
  /* ------------------------------------------------------------------ */

  function resizeCanvas() {
    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.round(cw * dpr);
    var ph = Math.round(ch * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    state.cssW = cw;
    state.cssH = ch;
    state.dpr = dpr;
    if (state.view.fit) fitView(false);
    else clampView();
    render();
  }

  function fitView(doRender) {
    if (!state.cssW || !state.cssH) return;
    var w = state.settings.width;
    var h = state.settings.height;
    var padX = state.cssW < 620 ? 28 : 58;
    var top = state.cssH < 430 ? 62 : 88;
    var bottom = 54;
    var z = Math.min((state.cssW - padX * 2) / w, (state.cssH - top - bottom) / h);
    z = clamp(z, 1.2, 36);
    state.view.zoom = z;
    state.view.x = (state.cssW - w * z) / 2;
    state.view.y = top + (state.cssH - top - bottom - h * z) / 2;
    state.view.fit = true;
    updateZoomLabel();
    if (doRender !== false) render();
  }

  function clampView() {
    var w = state.settings.width;
    var h = state.settings.height;
    var z = state.view.zoom;
    var pw = w * z;
    var ph = h * z;
    var pad = 28;
    if (pw <= state.cssW - pad * 2) {
      state.view.x = (state.cssW - pw) / 2;
    } else {
      state.view.x = Math.min(state.cssW - pad, Math.max(pad - pw, state.view.x));
    }
    if (ph <= state.cssH - pad * 2) {
      state.view.y = (state.cssH - ph) / 2;
    } else {
      state.view.y = Math.min(state.cssH - pad, Math.max(pad - ph, state.view.y));
    }
  }

  function zoomAt(factor, cx, cy) {
    var z0 = state.view.zoom;
    var z1 = clamp(z0 * factor, 1.2, 46);
    if (Math.abs(z1 - z0) < 0.0001) return;
    state.view.x = cx - (cx - state.view.x) * (z1 / z0);
    state.view.y = cy - (cy - state.view.y) * (z1 / z0);
    state.view.zoom = z1;
    state.view.fit = false;
    clampView();
    updateZoomLabel();
    render();
  }

  function updateZoomLabel() {
    var pct = Math.round(state.view.zoom / 8 * 100);
    els.zoomLabel.textContent = pct + '%';
  }

  function render() {
    if (renderRaf) return;
    renderRaf = requestAnimationFrame(function () {
      renderRaf = 0;
      draw();
    });
  }

  function draw() {
    if (!state.cssW || !state.cssH) return;
    var w = state.settings.width;
    var h = state.settings.height;
    var v = state.view;
    var dpr = state.dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.cssW, state.cssH);

    if (!state.cells || !w || !h) {
      updateZoomLabel();
      return;
    }

    var pw = w * v.zoom;
    var ph = h * v.zoom;
    var x = v.x;
    var y = v.y;

    ctx.save();
    ctx.shadowColor = 'rgba(64, 46, 22, .22)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(x, y, pw, ph);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, pw, ph);
    ctx.clip();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(patternCanvas, x, y, pw, ph);
    ctx.imageSmoothingEnabled = true;

    drawGrid(x, y, w, h, v.zoom);
    drawCodes(x, y, w, h, v.zoom);
    ctx.restore();

    ctx.strokeStyle = 'rgba(70, 52, 26, .35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(pw), Math.round(ph));

    drawRulers(x, y, w, h, v.zoom);

    if (state.hover) {
      var gx = state.hover.gx;
      var gy = state.hover.gy;
      if (gx >= 0 && gy >= 0 && gx < w && gy < h) {
        var hx = x + gx * v.zoom;
        var hy = y + gy * v.zoom;
        ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
        ctx.lineWidth = 3;
        ctx.strokeRect(hx + 1.5, hy + 1.5, v.zoom - 3, v.zoom - 3);
        ctx.strokeStyle = '#d45a38';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx + 1.5, hy + 1.5, v.zoom - 3, v.zoom - 3);
      }
    }

    updateZoomLabel();
  }

  function drawGrid(x, y, w, h, z) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w * z, h * z);
    ctx.clip();

    if (state.showGrid && z >= 9) {
      ctx.strokeStyle = 'rgba(52, 42, 25, .12)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (var gx = 1; gx < w; gx++) {
        var px = Math.round(x + gx * z) + 0.5;
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h * z);
      }
      for (var gy = 1; gy < h; gy++) {
        var py = Math.round(y + gy * z) + 0.5;
        ctx.moveTo(x, py);
        ctx.lineTo(x + w * z, py);
      }
      ctx.stroke();
    }

    if (z >= 3.2) {
      ctx.strokeStyle = 'rgba(52, 42, 25, .22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx5 = 5; gx5 < w; gx5 += 5) {
        var px5 = Math.round(x + gx5 * z) + 0.5;
        ctx.moveTo(px5, y);
        ctx.lineTo(px5, y + h * z);
      }
      for (var gy5 = 5; gy5 < h; gy5 += 5) {
        var py5 = Math.round(y + gy5 * z) + 0.5;
        ctx.moveTo(x, py5);
        ctx.lineTo(x + w * z, py5);
      }
      ctx.stroke();
    }

    if (state.showBoards && (w > BOARD_SIZE || h > BOARD_SIZE)) {
      ctx.strokeStyle = 'rgba(196, 82, 52, .62)';
      ctx.lineWidth = Math.max(1.4, Math.min(2.4, z * 0.075));
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (var bx = BOARD_SIZE; bx < w; bx += BOARD_SIZE) {
        var bpx = Math.round(x + bx * z) + 0.5;
        ctx.moveTo(bpx, y);
        ctx.lineTo(bpx, y + h * z);
      }
      for (var by = BOARD_SIZE; by < h; by += BOARD_SIZE) {
        var bpy = Math.round(y + by * z) + 0.5;
        ctx.moveTo(x, bpy);
        ctx.lineTo(x + w * z, bpy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawCodes(x, y, w, h, z) {
    if (!state.showCodes || z < 24) return;
    var left = Math.max(0, Math.floor((0 - x) / z));
    var right = Math.min(w, Math.ceil((state.cssW - x) / z));
    var top = Math.max(0, Math.floor((0 - y) / z));
    var bottom = Math.min(h, Math.ceil((state.cssH - y) / z));
    var fontSize = clamp(z * 0.37, 6.5, 11);
    ctx.font = '600 ' + fontSize.toFixed(1) + 'px ' + MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var gy = top; gy < bottom; gy++) {
      for (var gx = left; gx < right; gx++) {
        var idx = state.cells[gy * w + gx];
        if (idx === EMPTY) continue;
        var color = paletteColors[idx];
        ctx.fillStyle = color.ink;
        ctx.fillText(color.code, x + (gx + 0.5) * z, y + (gy + 0.5) * z + 0.5);
      }
    }
  }

  function drawRulers(x, y, w, h, z) {
    if (!state.showCoords) return;
    var step = z >= 12 ? 1 : (z >= 5 ? 5 : (z >= 3.2 ? 10 : 20));
    ctx.font = '500 ' + (step === 1 ? 8 : 9) + 'px ' + MONO;
    ctx.fillStyle = 'rgba(78, 64, 44, .66)';
    ctx.textBaseline = 'middle';

    if (y > 18) {
      ctx.textAlign = 'center';
      for (var gx = 0; gx <= w; gx++) {
        if (gx % step !== 0 && gx !== w) continue;
        var px = x + gx * z;
        if (px < 8 || px > state.cssW - 8) continue;
        ctx.fillText(String(gx), px, y - 6);
      }
    }

    if (x > 28) {
      ctx.textAlign = 'right';
      for (var gy = 0; gy <= h; gy++) {
        if (gy % step !== 0 && gy !== h) continue;
        var py = y + gy * z;
        if (py < 10 || py > state.cssH - 10) continue;
        ctx.fillText(String(gy), x - 7, py);
      }
    }

    if (state.showBoards && (w > BOARD_SIZE || h > BOARD_SIZE)) {
      ctx.fillStyle = 'rgba(196, 82, 52, .9)';
      ctx.font = '700 8.5px ' + SANS;
      var bcols = Math.ceil(w / BOARD_SIZE);
      var brows = Math.ceil(h / BOARD_SIZE);
      if (y > 34) {
        ctx.textAlign = 'center';
        for (var b = 0; b < bcols; b++) {
          var span = Math.min(BOARD_SIZE, w - b * BOARD_SIZE);
          var bx = x + (b * BOARD_SIZE + span / 2) * z;
          if (bx > 12 && bx < state.cssW - 12) {
            ctx.fillText(String.fromCharCode(65 + b), bx, y - 20);
          }
        }
      }
      if (x > 42) {
        ctx.textAlign = 'right';
        for (var r = 0; r < brows; r++) {
          var spanY = Math.min(BOARD_SIZE, h - r * BOARD_SIZE);
          var by = y + (r * BOARD_SIZE + spanY / 2) * z;
          if (by > 12 && by < state.cssH - 12) {
            ctx.fillText(String(r + 1), x - 21, by);
          }
        }
      }
    }
  }

  function syncPattern() {
    var w = state.settings.width;
    var h = state.settings.height;
    if (!w || !h) return;
    if (patternCanvas.width !== w || patternCanvas.height !== h) {
      patternCanvas.width = w;
      patternCanvas.height = h;
    }
    var img = patternCtx.createImageData(w, h);
    var data = img.data;
    if (state.cells) {
      var rgb = palette.rgb;
      var count = Math.min(state.cells.length, w * h);
      for (var i = 0; i < count; i++) {
        var idx = state.cells[i];
        if (idx === EMPTY) continue;
        var o = i * 4;
        var p = idx * 3;
        data[o] = rgb[p];
        data[o + 1] = rgb[p + 1];
        data[o + 2] = rgb[p + 2];
        data[o + 3] = 255;
      }
    }
    patternCtx.putImageData(img, 0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* 图片与采样                                                         */
  /* ------------------------------------------------------------------ */

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('image decode failed')); };
      img.src = src;
    });
  }

  function prepareSource(img, encode) {
    var maxDim = 1200;
    var nw = img.naturalWidth || img.width;
    var nh = img.naturalHeight || img.height;
    if (!nw || !nh) throw new Error('图片尺寸无效');
    var scale = Math.min(1, maxDim / Math.max(nw, nh));
    var w = Math.max(1, Math.round(nw * scale));
    var h = Math.max(1, Math.round(nh * scale));

    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);

    var data = cx.getImageData(0, 0, w, h);
    var url = '';
    if (encode) {
      try {
        url = c.toDataURL('image/webp', 0.82);
        if (url.indexOf('data:image/webp') !== 0) url = c.toDataURL('image/png');
      } catch (e) {
        url = '';
      }
    }
    return { data: data, w: w, h: h, url: url, canvas: c };
  }

  /* frame：整张图片在豆板坐标系里的位置和大小，单位是「格」。
   * 板子固定 0..wBoard × 0..hBoard；图片可以比板小（四周留空）或比板大（板外被裁掉）。 */
  function containFrame(wBoard, hBoard) {
    var sw = state.sourceW;
    var sh = state.sourceH;
    if (!sw || !sh) return null;
    var scale = Math.min(wBoard / sw, hBoard / sh);
    var w = sw * scale;
    var h = sh * scale;
    return { x: (wBoard - w) / 2, y: (hBoard - h) / 2, w: w, h: h };
  }

  function coverFrame(wBoard, hBoard) {
    var sw = state.sourceW;
    var sh = state.sourceH;
    if (!sw || !sh) return null;
    var scale = Math.max(wBoard / sw, hBoard / sh);
    var w = sw * scale;
    var h = sh * scale;
    return { x: (wBoard - w) / 2, y: (hBoard - h) / 2, w: w, h: h };
  }

  function stretchFrame(wBoard, hBoard) {
    return { x: 0, y: 0, w: wBoard, h: hBoard };
  }

  function fitFrame(mode, wBoard, hBoard) {
    if (mode === 'cover') return coverFrame(wBoard, hBoard);
    if (mode === 'stretch') return stretchFrame(wBoard, hBoard);
    return containFrame(wBoard, hBoard);
  }

  function clampFrame(frame, wBoard, hBoard) {
    if (!frame || !isFinite(frame.w) || !isFinite(frame.h) || frame.w <= 0 || frame.h <= 0) {
      return null;
    }
    var maxW = Math.max(wBoard, hBoard) * 6;
    var w = clamp(frame.w, 1, maxW);
    var h = clamp(frame.h, 1, maxW);
    // 允许拖到板外，但至少要留 2 格在板上，避免图片完全飞走。
    var x = clamp(frame.x, 2 - w, wBoard - 2);
    var y = clamp(frame.y, 2 - h, hBoard - 2);
    return { x: x, y: y, w: w, h: h };
  }

  /* 旧版保存的是「原图裁切区域」，迁移成新版的图片占位框。 */
  function frameFromLegacyCrop(crop, wBoard, hBoard) {
    if (!crop || !state.sourceW) return containFrame(wBoard, hBoard);
    var sw = state.sourceW;
    var sh = state.sourceH;
    return clampFrame({
      x: -(crop.x / crop.w) * wBoard,
      y: -(crop.y / crop.h) * hBoard,
      w: (sw / crop.w) * wBoard,
      h: (sh / crop.h) * hBoard
    }, wBoard, hBoard);
  }

  function frameKey(frame) {
    if (!frame) return '-';
    return frame.x.toFixed(2) + ',' + frame.y.toFixed(2) + ',' +
      frame.w.toFixed(2) + ',' + frame.h.toFixed(2);
  }

  function frameClose(a, b) {
    if (!a || !b) return false;
    var tol = 0.5;
    return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol &&
      Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;
  }

  function normalizeFrame(input, wBoard, hBoard) {
    if (!input) return containFrame(wBoard, hBoard);
    var f = clampFrame({
      x: Number(input.x) || 0,
      y: Number(input.y) || 0,
      w: Number(input.w) || 0,
      h: Number(input.h) || 0
    }, wBoard, hBoard);
    return f || containFrame(wBoard, hBoard);
  }

  /* ---------------- 纯色背景去除 ---------------- */

  var bgCache = new Map();

  function hexToRgb(hex) {
    var h = String(hex || '#FFFFFF').replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0
    };
  }

  function rgbToHex(r, g, b) {
    function p(n) {
      var s = Math.round(clamp(n, 0, 255)).toString(16).toUpperCase();
      return s.length < 2 ? '0' + s : s;
    }
    return '#' + p(r) + p(g) + p(b);
  }

  function bgKey(bg) {
    if (!bg || !bg.enabled) return '-';
    return String(bg.color).toUpperCase() + ':' + bg.tolerance + ':' + bg.mode;
  }

  function detectBackgroundColor() {
    var src = state.sourceData;
    if (!src) return '#FFFFFF';
    var w = src.width;
    var h = src.height;
    var d = src.data;
    var band = Math.max(2, Math.min(20, Math.round(Math.min(w, h) * 0.015)));
    var counts = new Map();

    function add(x, y) {
      var o = (y * w + x) * 4;
      if (d[o + 3] < 16) return;
      var r = d[o], g = d[o + 1], b = d[o + 2];
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var e = counts.get(key);
      if (!e) {
        e = { n: 0, r: 0, g: 0, b: 0 };
        counts.set(key, e);
      }
      e.n++;
      e.r += r;
      e.g += g;
      e.b += b;
    }

    for (var x = 0; x < w; x++) {
      for (var y = 0; y < band; y++) {
        add(x, y);
        add(x, h - 1 - y);
      }
    }
    for (var y2 = band; y2 < h - band; y2++) {
      for (var x2 = 0; x2 < band; x2++) {
        add(x2, y2);
        add(w - 1 - x2, y2);
      }
    }

    var best = null;
    counts.forEach(function (e) {
      if (!best || e.n > best.n) best = e;
    });
    if (!best) return '#FFFFFF';
    return rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n);
  }

  /* 相似色 mask：1 = 背景。相连模式只去掉和板边连通的背景，
   * 这样白衣服、眼睛高光这类封闭的近似色不会被误删。 */
  function computeBgMask(src, bg) {
    var w = src.width;
    var h = src.height;
    var d = src.data;
    var n = w * h;
    var target = hexToRgb(bg.color);
    var threshold = bg.tolerance * 2.2;
    var t2 = threshold * threshold;
    var similar = new Uint8Array(n);

    for (var i = 0; i < n; i++) {
      var o = i * 4;
      if (d[o + 3] < 8) continue;
      var dr = d[o] - target.r;
      var dg = d[o + 1] - target.g;
      var db = d[o + 2] - target.b;
      var dist = (dr * dr + dg * dg + db * db) / 3;
      if (dist <= t2) similar[i] = 1;
    }

    if (bg.mode === 'global') return similar;

    var mask = new Uint8Array(n);
    var stack = new Int32Array(n);
    var top = 0;

    function seed(idx) {
      if (similar[idx] && !mask[idx]) {
        mask[idx] = 1;
        stack[top++] = idx;
      }
    }

    for (var x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (var y = 1; y < h - 1; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }

    while (top > 0) {
      var idx = stack[--top];
      var xx = idx % w;
      if (xx > 0) seed(idx - 1);
      if (xx < w - 1) seed(idx + 1);
      if (idx >= w) seed(idx - w);
      if (idx < n - w) seed(idx + w);
    }
    return mask;
  }

  function buildBackgroundSource(bg) {
    if (!bg || !bg.enabled || !state.sourceData) return null;
    var key = bgKey(bg);
    var hit = bgCache.get(key);
    if (hit) return hit;

    var src = state.sourceData;
    var mask = computeBgMask(src, bg);
    var data = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
    var out = data.data;
    for (var i = 0; i < mask.length; i++) {
      if (mask[i]) out[i * 4 + 3] = 0;
    }

    var c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').putImageData(data, 0, 0);

    if (bgCache.size >= 2) bgCache.clear();
    var result = { key: key, data: data, canvas: c };
    bgCache.set(key, result);
    return result;
  }

  /* 换板型时保持图片中心与相对大小，避免突然改变构图。 */
  function scaleFrameToBoard(frame, oldW, oldH, newW, newH) {
    if (!frame || !oldW || !oldH) return containFrame(newW, newH);
    var scale = Math.min(newW / oldW, newH / oldH);
    var nw = frame.w * scale;
    var nh = frame.h * scale;
    var cx = (frame.x + frame.w / 2) / oldW * newW;
    var cy = (frame.y + frame.h / 2) / oldH * newH;
    return clampFrame({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }, newW, newH);
  }

  /* 把整张 source 图片按 frame 放到 w×h 的豆板上，再做面积平均降采样。
   * frame 外的豆格（图片没覆盖到）保持空白。 */
  function sampleGrid(w, h, frame, mirror, srcData) {
    var src = srcData || state.sourceData;
    var sw = src.width;
    var sh = src.height;
    var sd = src.data;
    var sxPerCell = sw / frame.w;
    var syPerCell = sh / frame.h;

    var xr = new Array(w);
    for (var gx = 0; gx < w; gx++) {
      var a0 = (gx - frame.x) * sxPerCell;
      var b0 = (gx + 1 - frame.x) * sxPerCell;
      var a = mirror ? sw - b0 : a0;
      var b = mirror ? sw - a0 : b0;
      if (b <= 0 || a >= sw) { xr[gx] = null; continue; }
      var ia = Math.max(0, Math.floor(a));
      var ib = Math.min(sw, Math.ceil(b));
      if (ia >= ib) { xr[gx] = null; continue; }
      var list = [];
      for (var sx = ia; sx < ib; sx++) {
        var wgt = Math.min(sx + 1, b) - Math.max(sx, a);
        if (wgt > 0) list.push(sx, wgt);
      }
      xr[gx] = { list: list, span: b - a };
    }

    var out = new Float32Array(w * h * 4);
    for (var gy = 0; gy < h; gy++) {
      var y0 = (gy - frame.y) * syPerCell;
      var y1 = (gy + 1 - frame.y) * syPerCell;
      if (y1 <= 0 || y0 >= sh) continue;
      var iy0 = Math.max(0, Math.floor(y0));
      var iy1 = Math.min(sh, Math.ceil(y1));
      if (iy0 >= iy1) continue;
      var yspan = y1 - y0;
      for (var gx2 = 0; gx2 < w; gx2++) {
        var xrr = xr[gx2];
        if (!xrr) continue;
        var ar = 0, ag = 0, ab = 0, aa = 0;
        var list2 = xrr.list;
        for (var sy = iy0; sy < iy1; sy++) {
          var wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
          if (wy <= 0) continue;
          var row = sy * sw * 4;
          for (var j = 0; j < list2.length; j += 2) {
            var sx2 = list2[j];
            var wx = list2[j + 1];
            var o = row + sx2 * 4;
            var al = sd[o + 3];
            if (!al) continue;
            var wt = wx * wy * al;
            ar += sd[o] * wt;
            ag += sd[o + 1] * wt;
            ab += sd[o + 2] * wt;
            aa += wt;
          }
        }
        var area = xrr.span * yspan;
        if (aa > 0 && area > 0) {
          var oo = (gy * w + gx2) * 4;
          out[oo] = ar / aa;
          out[oo + 1] = ag / aa;
          out[oo + 2] = ab / aa;
          out[oo + 3] = Math.min(255, aa / area);
        }
      }
    }
    return out;
  }

  function ensureBase() {
    var w = state.settings.width;
    var h = state.settings.height;
    var frame = state.frame || containFrame(w, h);
    var mirror = !!state.settings.mirror;
    var processed = buildBackgroundSource(state.settings.bg);
    var key = w + 'x' + h + ':' + frameKey(frame) + ':m' + (mirror ? 1 : 0) +
      ':bg' + bgKey(state.settings.bg);
    if (state.base && state.base.key === key) return state.base.data;
    var data = sampleGrid(w, h, frame, mirror, processed ? processed.data : null);
    state.base = { key: key, data: data };
    return data;
  }

  function cellsFromBase(w, h, base, adj) {
    var n = w * h;
    var cells = new Uint8Array(n);
    cells.fill(EMPTY);
    var i;

    if (adj.dither) {
      var fr = new Float32Array(n);
      var fg = new Float32Array(n);
      var fb = new Float32Array(n);
      var ok = new Uint8Array(n);
      for (i = 0; i < n; i++) {
        if (base[i * 4 + 3] < ALPHA_CUT) continue;
        var ac = window.PindouColor.applyAdjust(base[i * 4], base[i * 4 + 1], base[i * 4 + 2], adj);
        fr[i] = ac[0];
        fg[i] = ac[1];
        fb[i] = ac[2];
        ok[i] = 1;
      }

      function addErr(idx, er, eg, eb, weight) {
        if (idx < 0 || idx >= n || !ok[idx]) return;
        fr[idx] += er * weight;
        fg[idx] += eg * weight;
        fb[idx] += eb * weight;
      }

      for (var yy = 0; yy < h; yy++) {
        var dir = (yy % 2 === 0) ? 1 : -1;
        for (var kk = 0; kk < w; kk++) {
          var xx = dir === 1 ? kk : w - 1 - kk;
          var ci = yy * w + xx;
          if (!ok[ci]) continue;
          var pi = window.PindouColor.nearest(palette, fr[ci], fg[ci], fb[ci]);
          cells[ci] = pi;
          var pr = palette.rgb[pi * 3];
          var pg = palette.rgb[pi * 3 + 1];
          var pb = palette.rgb[pi * 3 + 2];
          var er = fr[ci] - pr;
          var eg = fg[ci] - pg;
          var eb = fb[ci] - pb;
          if (dir === 1) {
            if (xx < w - 1) addErr(ci + 1, er, eg, eb, 7 / 16);
            if (xx > 0) addErr(ci - 1 + w, er, eg, eb, 3 / 16);
            addErr(ci + w, er, eg, eb, 5 / 16);
            if (xx < w - 1) addErr(ci + 1 + w, er, eg, eb, 1 / 16);
          } else {
            if (xx > 0) addErr(ci - 1, er, eg, eb, 7 / 16);
            if (xx < w - 1) addErr(ci + 1 + w, er, eg, eb, 3 / 16);
            addErr(ci + w, er, eg, eb, 5 / 16);
            if (xx > 0) addErr(ci - 1 + w, er, eg, eb, 1 / 16);
          }
        }
      }
    } else {
      for (i = 0; i < n; i++) {
        if (base[i * 4 + 3] < ALPHA_CUT) continue;
        var c = window.PindouColor.applyAdjust(base[i * 4], base[i * 4 + 1], base[i * 4 + 2], adj);
        cells[i] = window.PindouColor.nearest(palette, c[0], c[1], c[2]);
      }
    }
    return cells;
  }

  function computeCells() {
    if (!state.sourceData) return null;
    var w = state.settings.width;
    var h = state.settings.height;
    var base = ensureBase();
    return cellsFromBase(w, h, base, state.settings);
  }

  function computeCellsFor(w, h, frame, adjust, mirror, bg) {
    if (!state.sourceData) return null;
    var m = (typeof mirror === 'boolean') ? mirror : !!(adjust && adjust.mirror);
    var processed = buildBackgroundSource(bg);
    var base = sampleGrid(w, h, frame, m, processed ? processed.data : null);
    return cellsFromBase(w, h, base, adjust || state.settings);
  }

  function ensureSelected() {
    if (state.selected >= 0) return;
    var best = -1;
    var bestScore = -1;
    for (var i = 0; i < palette.count; i++) {
      var n = state.counts[i];
      if (!n) continue;
      var rgb = paletteColors[i].rgb;
      var mx = Math.max(rgb[0], rgb[1], rgb[2]);
      var mn = Math.min(rgb[0], rgb[1], rgb[2]);
      var sat = mx ? (mx - mn) / mx : 0;
      var lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
      // 优先选有彩度、亮度适中的主色，避免默认选中大面积白底/奶油底。
      var score = n * (0.22 + sat * 1.9) * (lum > 0.08 && lum < 0.92 ? 1 : 0.4);
      if (lum > 0.8 && sat < 0.3) score *= 0.06;
      else if (lum > 0.72 && sat < 0.2) score *= 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    state.selected = best;
  }

  function afterPatternChange(opts) {
    opts = opts || {};
    recomputeCounts();
    ensureSelected();
    syncPattern();
    updateUI();
    if (opts.fit) fitView(false);
    render();
    if (opts.save !== false) scheduleSave();
  }

  function generate(opts) {
    if (!state.sourceData) return;
    var cells = computeCells();
    if (!cells) return;
    state.cells = cells;
    state.history.length = 0;
    state.future.length = 0;
    afterPatternChange(opts || {});
  }

  /* ------------------------------------------------------------------ */
  /* 界面状态                                                           */
  /* ------------------------------------------------------------------ */

  function applySettingsToControls() {
    var s = state.settings;

    var fits = els.fitSeg.querySelectorAll('button');
    for (var j = 0; j < fits.length; j++) {
      fits[j].classList.toggle('active', fits[j].dataset.fit === s.fit);
    }

    els.adjBrightness.value = s.brightness;
    els.adjContrast.value = s.contrast;
    els.adjSaturation.value = s.saturation;
    els.outBrightness.textContent = s.brightness;
    els.outContrast.textContent = s.contrast;
    els.outSaturation.textContent = s.saturation;
    setRangeFill(els.adjBrightness);
    setRangeFill(els.adjContrast);
    setRangeFill(els.adjSaturation);
    els.optDither.checked = s.dither;

    els.optGrid.checked = state.showGrid;
    els.optCoords.checked = state.showCoords;
    els.optCodes.checked = state.showCodes;
    els.optBoards.checked = state.showBoards;
  }

  function setRangeFill(input) {
    var min = Number(input.min) || 0;
    var max = Number(input.max) || 100;
    var val = Number(input.value) || 0;
    var pct = (val - min) / (max - min) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function idleHint() {
    if (!state.cells) return '上传图片后，把鼠标移到图纸上';
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return '单指画豆 · 双指缩放';
    return '把鼠标移到图纸上';
  }

  function updateUI() {
    applySettingsToControls();
    updateWorkspaceEnabled();
    updateBoardSummary();
    updateStats();
    updateSelectedChip();
    rebuildLegend();
    updateUndoButtons();
    if (!state.hover) els.cursorStatus.textContent = idleHint();
  }

  function updateWorkspaceEnabled() {
    var hasSource = !!state.sourceData;
    var hasPattern = !!state.cells;

    els.adjBrightness.disabled = !hasSource;
    els.adjContrast.disabled = !hasSource;
    els.adjSaturation.disabled = !hasSource;
    els.optDither.disabled = !hasSource;

    var fits = els.fitSeg.querySelectorAll('button');
    for (var j = 0; j < fits.length; j++) fits[j].disabled = !hasSource;

    els.btnExport.disabled = !hasPattern;
    els.btnSave.disabled = !state.projectId || !hasPattern;
    els.projectName.disabled = !hasPattern;
    els.legendSearch.disabled = !hasPattern;
    els.btnClear.disabled = !hasPattern;
    els.emptyStage.hidden = hasPattern;
    els.btnChangeImage.hidden = !hasPattern;
    if (els.btnCompose) els.btnCompose.disabled = !hasSource || !hasPattern;
  }

  function updateBoardSummary() {
    if (!els.boardSummary) return;
    var w = state.settings.width;
    var h = state.settings.height;
    var boards = boardCount(w, h);
    els.boardSummary.textContent = w + ' × ' + h + ' · ' + boards + ' 块板 · ' + fmtNum(state.total) + ' 颗';
  }

  function updateStats() {
    var boards = boardCount(state.settings.width, state.settings.height);
    els.statTotal.textContent = fmtNum(state.total);
    els.statColors.textContent = fmtNum(state.used);
    els.statBoards.textContent = fmtNum(boards);
  }

  function updateSelectedChip() {
    var show = state.selected >= 0 && !!state.cells;
    els.selectedChip.hidden = !show;
    if (!show) return;
    var c = paletteColors[state.selected];
    els.selectedSwatch.style.background = c.hex;
    els.selectedCode.textContent = c.code;
  }

  function updateUndoButtons() {
    els.btnUndo.disabled = state.history.length === 0;
    els.btnRedo.disabled = state.future.length === 0;
  }

  function rebuildLegend() {
    var used = getUsedColors();
    els.legendSummary.textContent = used.length + ' 色';
    var q = (els.legendSearch.value || '').trim().toUpperCase();
    var filtered = q ? used.filter(function (u) { return u.color.code.toUpperCase().indexOf(q) !== -1; }) : used;
    var scroll = els.legendList.scrollTop;

    while (els.legendList.firstChild) els.legendList.removeChild(els.legendList.firstChild);

    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'legend-empty';
      empty.textContent = used.length ? '没有匹配的色号。' : '上传图片后，这里会列出每种颜色的颗数。';
      els.legendList.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < filtered.length; i++) {
      var u = filtered[i];
      var c = u.color;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'legend-item' + (u.index === state.selected ? ' selected' : '');
      btn.dataset.index = String(u.index);
      btn.title = c.code + ' · ' + u.count + ' 颗';

      var sw = document.createElement('span');
      sw.className = 'legend-swatch';
      sw.style.background = c.hex;

      var code = document.createElement('span');
      code.className = 'legend-code';
      code.textContent = c.code;

      var meta = document.createElement('span');
      meta.className = 'legend-meta';
      var cnt = document.createElement('span');
      cnt.className = 'legend-count';
      cnt.textContent = fmtNum(u.count);
      var pct = document.createElement('span');
      pct.className = 'legend-pct';
      var p = state.total ? (u.count / state.total * 100) : 0;
      pct.textContent = (p > 0 && p < 0.1 ? '<0.1' : p.toFixed(1)) + '%';
      meta.appendChild(cnt);
      meta.appendChild(pct);

      btn.appendChild(sw);
      btn.appendChild(code);
      btn.appendChild(meta);
      frag.appendChild(btn);
    }
    els.legendList.appendChild(frag);
    if (!q) els.legendList.scrollTop = scroll;
  }

  function selectColor(index, switchTool) {
    if (index < 0 || index >= palette.count) return;
    state.selected = index;
    updateSelectedChip();
    var items = els.legendList.querySelectorAll('.legend-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', +items[i].dataset.index === index);
    }
    if (switchTool && state.tool !== 'brush') setTool('brush');
    scheduleSave();
  }

  function setTool(tool) {
    state.tool = tool;
    var btns = document.querySelectorAll('.tool[data-tool]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.tool === tool);
    }
    updateCursor();
  }

  function updateCursor() {
    if (state.busy) { canvas.style.cursor = 'progress'; return; }
    if (spaceDown || panning) { canvas.style.cursor = 'grabbing'; return; }
    var c = 'crosshair';
    if (state.tool === 'pan') c = 'grab';
    else if (state.tool === 'eraser') c = 'cell';
    else if (state.tool === 'fill') c = 'copy';
    else if (state.tool === 'dropper') c = 'crosshair';
    canvas.style.cursor = c;
  }

  /* ------------------------------------------------------------------ */
  /* 编辑与历史                                                         */
  /* ------------------------------------------------------------------ */

  function pushHistory(snapshot) {
    state.history.push(snapshot);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.future.length = 0;
    updateUndoButtons();
  }

  function setCell(gx, gy, val) {
    var w = state.settings.width;
    var h = state.settings.height;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return false;
    var i = gy * w + gx;
    if (state.cells[i] === val) return false;
    if (state.stroke && !state.stroke.changed) {
      pushHistory(state.stroke.snapshot);
      state.stroke.changed = true;
    }
    state.cells[i] = val;
    syncPattern();
    render();
    return true;
  }

  function paintAt(gx, gy, erase) {
    if (!erase && state.selected < 0) {
      toast('先在右侧色号清单里选一个颜色');
      return;
    }
    setCell(gx, gy, erase ? EMPTY : state.selected);
  }

  function startStroke(gx, gy, erase) {
    if (!erase && state.selected < 0) {
      toast('先在右侧色号清单里选一个颜色');
      return;
    }
    state.stroke = {
      snapshot: state.cells.slice(),
      changed: false,
      lastGX: gx,
      lastGY: gy,
      erase: !!erase
    };
    paintAt(gx, gy, erase);
  }

  function strokeTo(gx, gy) {
    var s = state.stroke;
    if (!s) return;
    var x0 = s.lastGX;
    var y0 = s.lastGY;
    var x1 = gx;
    var y1 = gy;
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    while (true) {
      setCell(x0, y0, s.erase ? EMPTY : state.selected);
      if (x0 === x1 && y0 === y1) break;
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    s.lastGX = gx;
    s.lastGY = gy;
  }

  function endStroke() {
    if (!state.stroke) return;
    var changed = state.stroke.changed;
    state.stroke = null;
    if (changed) markEdited();
  }

  function cancelStroke() {
    if (!state.stroke) return;
    if (state.stroke.changed) {
      state.history.pop();
      state.cells = state.stroke.snapshot;
      syncPattern();
      updateUndoButtons();
      render();
    }
    state.stroke = null;
  }

  function markEdited() {
    recomputeCounts();
    ensureSelected();
    syncPattern();
    updateStats();
    updateBoardSummary();
    updateSelectedChip();
    rebuildLegend();
    updateUndoButtons();
    render();
    scheduleSave();
  }

  function undo() {
    if (!state.history.length || !state.cells) return;
    state.future.push(state.cells.slice());
    state.cells = state.history.pop();
    markEdited();
  }

  function redo() {
    if (!state.future.length || !state.cells) return;
    state.history.push(state.cells.slice());
    state.cells = state.future.pop();
    markEdited();
  }

  function clearAll() {
    if (!state.cells || !state.total) {
      toast('图纸已经是空的');
      return;
    }
    if (!window.confirm('清空所有豆子？清空后可以用 Ctrl+Z 撤销。')) return;
    pushHistory(state.cells.slice());
    state.cells.fill(EMPTY);
    markEdited();
  }

  function floodFill(gx, gy) {
    if (state.selected < 0) return;
    var w = state.settings.width;
    var h = state.settings.height;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return;
    var start = gy * w + gx;
    var target = state.cells[start];
    var replacement = state.selected;
    if (target === replacement) return;

    var snapshot = state.cells.slice();
    var stack = [start];
    while (stack.length) {
      var idx = stack.pop();
      if (state.cells[idx] !== target) continue;
      state.cells[idx] = replacement;
      var x = idx % w;
      if (x > 0) stack.push(idx - 1);
      if (x < w - 1) stack.push(idx + 1);
      if (idx >= w) stack.push(idx - w);
      if (idx < w * (h - 1)) stack.push(idx + w);
    }
    pushHistory(snapshot);
    markEdited();
  }

  function pickAt(gx, gy) {
    var w = state.settings.width;
    var h = state.settings.height;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return;
    var idx = state.cells[gy * w + gx];
    if (idx === EMPTY) {
      toast('这里是空白格');
      return;
    }
    selectColor(idx, true);
  }

  /* ------------------------------------------------------------------ */
  /* 指针 / 缩放 / 平移                                                 */
  /* ------------------------------------------------------------------ */

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function cellAtPoint(px, py) {
    var w = state.settings.width;
    var h = state.settings.height;
    var gx = Math.floor((px - state.view.x) / state.view.zoom);
    var gy = Math.floor((py - state.view.y) / state.view.zoom);
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    return { gx: gx, gy: gy };
  }

  function updateHover(cell) {
    state.hover = cell;
    if (!cell) {
      els.cursorStatus.textContent = idleHint();
      render();
      return;
    }
    var idx = state.cells[cell.gy * state.settings.width + cell.gx];
    var code = idx === EMPTY ? '空白' : paletteColors[idx].code;
    els.cursorStatus.textContent = '第 ' + (cell.gx + 1) + ' 列 · 第 ' + (cell.gy + 1) + ' 行 · ' + code;
    render();
  }

  function startPan(p) {
    panning = { sx: p.x, sy: p.y, vx: state.view.x, vy: state.view.y };
    state.view.fit = false;
    updateCursor();
  }

  function startPinch() {
    cancelStroke();
    panning = null;
    var pts = Array.from(pointers.values());
    if (pts.length < 2) return;
    var a = pts[0], b = pts[1];
    pinch = {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2
    };
    updateCursor();
  }

  function onPointerDown(e) {
    if (!state.cells || state.busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1 && e.button !== 2) return;

    var p = canvasPoint(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      startPinch();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      return;
    }
    if (pointers.size > 2) return;

    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}

    if (e.button === 1 || spaceDown || state.tool === 'pan') {
      startPan(p);
      e.preventDefault();
      return;
    }

    var cell = cellAtPoint(p.x, p.y);
    if (!cell) return;

    if (e.button === 2) {
      startStroke(cell.gx, cell.gy, true);
      e.preventDefault();
      return;
    }
    if (e.altKey || state.tool === 'dropper') {
      pickAt(cell.gx, cell.gy);
      e.preventDefault();
      return;
    }
    if (state.tool === 'fill') {
      floodFill(cell.gx, cell.gy);
      e.preventDefault();
      return;
    }
    startStroke(cell.gx, cell.gy, state.tool === 'eraser');
    e.preventDefault();
  }

  function onPointerMove(e) {
    var p = canvasPoint(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);

    if (pinch && pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      var a = pts[0], b = pts[1];
      var dist = Math.hypot(b.x - a.x, b.y - a.y);
      var midX = (a.x + b.x) / 2;
      var midY = (a.y + b.y) / 2;
      if (pinch.dist > 2) {
        var factor = dist / pinch.dist;
        var z0 = state.view.zoom;
        var z1 = clamp(z0 * factor, 1.2, 46);
        state.view.x = midX - (midX - state.view.x) * (z1 / z0);
        state.view.y = midY - (midY - state.view.y) * (z1 / z0);
        state.view.zoom = z1;
        state.view.fit = false;
      }
      state.view.x += midX - pinch.midX;
      state.view.y += midY - pinch.midY;
      pinch.dist = dist;
      pinch.midX = midX;
      pinch.midY = midY;
      clampView();
      updateZoomLabel();
      render();
      return;
    }

    if (panning) {
      state.view.x = panning.vx + (p.x - panning.sx);
      state.view.y = panning.vy + (p.y - panning.sy);
      clampView();
      render();
      return;
    }

    var cell = cellAtPoint(p.x, p.y);
    if (state.stroke) {
      if (cell) strokeTo(cell.gx, cell.gy);
    }
    if (state.hover !== cell && (!state.hover || !cell || state.hover.gx !== cell.gx || state.hover.gy !== cell.gy)) {
      updateHover(cell);
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) {
        pinch = null;
        updateCursor();
      }
      return;
    }
    if (panning) {
      panning = null;
      updateCursor();
      return;
    }
    if (state.stroke) endStroke();
  }

  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    pinch = null;
    panning = null;
    endStroke();
    updateCursor();
  }

  /* ------------------------------------------------------------------ */
  /* 构图 / 参数                                                        */
  /* ------------------------------------------------------------------ */

  function setFramePreset(mode) {
    if (!state.sourceData) return;
    state.settings.fit = mode;
    state.frame = fitFrame(mode, state.settings.width, state.settings.height);
    state.base = null;
    state.view.fit = true;
    state.history.length = 0;
    state.future.length = 0;
    generate({ fit: true });
  }

  function queueRegenerate() {
    clearTimeout(regenTimer);
    regenTimer = setTimeout(function () {
      if (state.sourceData) generate({});
    }, 130);
  }

  function resetAdjustments() {
    state.settings.brightness = 0;
    state.settings.contrast = 0;
    state.settings.saturation = 0;
    applySettingsToControls();
    if (state.sourceData) generate({});
  }

  /* ------------------------------------------------------------------ */
  /* 项目保存                                                           */
  /* ------------------------------------------------------------------ */

  function u8ToB64(u8) {
    var s = '';
    var chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  function b64ToU8(b64) {
    var bin = atob(b64);
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function makeThumb() {
    if (!state.cells) return '';
    var size = 240;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var cx = c.getContext('2d');
    cx.fillStyle = '#fffdf8';
    cx.fillRect(0, 0, size, size);
    var w = state.settings.width;
    var h = state.settings.height;
    var pad = 12;
    var scale = Math.min((size - pad * 2) / w, (size - pad * 2) / h);
    var dw = w * scale;
    var dh = h * scale;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(patternCanvas, (size - dw) / 2, (size - dh) / 2, dw, dh);
    try {
      return c.toDataURL('image/jpeg', 0.78);
    } catch (e) {
      return '';
    }
  }

  function buildRecord() {
    var now = Date.now();
    return {
      id: state.projectId,
      name: state.name || '未命名图纸',
      createdAt: state.createdAt || now,
      updatedAt: now,
      width: state.settings.width,
      height: state.settings.height,
      settings: JSON.parse(JSON.stringify(state.settings)),
      frame: state.frame ? {
        x: state.frame.x, y: state.frame.y, w: state.frame.w, h: state.frame.h
      } : null,
      selected: state.selected,
      palette: 'mard221',
      cells: state.cells ? u8ToB64(state.cells) : '',
      source: state.sourceURL || '',
      thumb: makeThumb(),
      imgName: state.imgName,
      imgW: state.imgW,
      imgH: state.imgH,
      imgFileSize: state.imgFileSize,
      total: state.total,
      used: state.used
    };
  }

  function writeStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, projects: projects }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistProjects() {
    projects.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (projects.length > MAX_PROJECTS) projects.length = MAX_PROJECTS;

    if (writeStore()) return true;

    // 空间不足：先丢弃旧图纸的原图，再淘汰旧图纸，最后才丢当前原图。
    for (var i = projects.length - 1; i >= 0; i--) {
      var p = projects[i];
      if (p.id === state.projectId) continue;
      if (p.source) {
        p.source = '';
        if (writeStore()) return true;
      }
    }
    while (projects.length > 1) {
      var idx = projects.length - 1;
      if (projects[idx].id === state.projectId) idx--;
      if (idx < 0) break;
      projects.splice(idx, 1);
      if (writeStore()) return true;
    }
    var cur = null;
    for (var k = 0; k < projects.length; k++) {
      if (projects[k].id === state.projectId) cur = projects[k];
    }
    if (cur && cur.source) {
      cur.source = '';
      if (writeStore()) {
        toast('本机存储空间不足，已只保存图纸（原图未缓存）');
        return true;
      }
    }
    return false;
  }

  function readProjectIndex() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) { projects = []; return; }
      var obj = JSON.parse(raw);
      projects = obj && Array.isArray(obj.projects) ? obj.projects : [];
    } catch (e) {
      projects = [];
    }
  }

  function scheduleSave() {
    if (!state.projectId || !state.cells) return;
    state.dirty = true;
    setSaveState('未保存');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(false, true); }, 1100);
  }

  function saveNow(manual, silent) {
    if (!state.projectId || !state.cells) {
      if (manual && !state.cells) toast('先上传一张图片');
      return false;
    }
    clearTimeout(saveTimer);
    var now = Date.now();
    var rec;
    try {
      rec = buildRecord();
    } catch (e) {
      setSaveState('保存失败');
      if (manual && !silent) toast('保存失败：无法生成图纸数据');
      return false;
    }

    var idx = -1;
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id === rec.id) { idx = i; break; }
    }
    if (idx >= 0) projects[idx] = rec;
    else projects.unshift(rec);
    projects.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (projects.length > MAX_PROJECTS) projects.length = MAX_PROJECTS;

    var ok = persistProjects();
    state.dirty = !ok;
    try { localStorage.setItem(LAST_KEY, state.projectId); } catch (e) {}
    if (ok) setSaveState('已保存 ' + timeLabel(now));
    else setSaveState('保存失败');
    if (els.projectsDialog.open) renderProjectList();

    if (manual && !silent) {
      toast(ok ? '已保存到本机' : '保存失败：本机存储空间不足');
    }
    return ok;
  }

  /* ------------------------------------------------------------------ */
  /* 项目读取                                                           */
  /* ------------------------------------------------------------------ */

  function normalizeSettings(input, fallbackW, fallbackH) {
    var s = defaultSettings();
    var src = input || {};
    s.width = clampInt(src.width || fallbackW || 52, MIN_SIZE, MAX_SIZE);
    s.height = clampInt(src.height || fallbackH || 52, MIN_SIZE, MAX_SIZE);
    if (src.fit === 'full') s.fit = 'stretch';
    else if (src.fit === 'contain' || src.fit === 'cover' || src.fit === 'stretch' || src.fit === 'custom') s.fit = src.fit;
    else s.fit = 'contain';
    s.brightness = clamp(Number(src.brightness) || 0, -60, 60);
    s.contrast = clamp(Number(src.contrast) || 0, -60, 60);
    s.saturation = clamp(Number(src.saturation) || 0, -60, 60);
    s.dither = !!src.dither;
    s.mirror = !!src.mirror;
    s.bg = normalizeBg(src.bg);
    return s;
  }

  function setPreview(src, name, meta) {
    if (src) els.previewImg.src = src;
    else els.previewImg.removeAttribute('src');
    els.imageName.textContent = name || '';
    els.imageSize.textContent = meta || '';
  }

  function showWorkspace() {
    els.dropEmpty.hidden = true;
    els.imagePreview.hidden = false;
    els.btnChangeImage.hidden = false;
    els.emptyStage.hidden = true;
  }

  function resetToEmpty() {
    state.projectId = null;
    state.name = '';
    state.createdAt = 0;
    state.updatedAt = 0;
    state.sourceData = null;
    state.sourceImage = null;
    bgCache.clear();
    state.sourceW = 0;
    state.sourceH = 0;
    state.sourceURL = '';
    state.imgW = 0;
    state.imgH = 0;
    state.imgName = '';
    state.imgFileSize = 0;
    state.settings = defaultSettings();
    state.frame = null;
    state.base = null;
    state.cells = null;
    state.counts.fill(0);
    state.total = 0;
    state.used = 0;
    state.selected = -1;
    state.history.length = 0;
    state.future.length = 0;
    state.stroke = null;
    state.hover = null;
    state.dirty = false;
    if (composer.open) closeComposer(true);

    els.projectName.value = '';
    els.imagePreview.hidden = true;
    els.dropEmpty.hidden = false;
    els.btnChangeImage.hidden = true;
    els.emptyStage.hidden = false;
    setPreview('', '', '');
    setSaveState('图片只在本机处理');
    try { localStorage.removeItem(LAST_KEY); } catch (e) {}
    setTool('brush');
    syncPattern();
    updateUI();
    updateHover(null);
    render();
  }

  async function startNewDesign(img, meta) {
    if (state.dirty && state.cells) saveNow(false, true);
    var prepared = prepareSource(img, true);
    var old = !!state.cells;
    var prevSettings = old ? JSON.parse(JSON.stringify(state.settings)) : null;

    state.projectId = newId();
    state.createdAt = Date.now();
    state.updatedAt = Date.now();
    state.name = meta.name || '未命名图纸';
    // 换图时沿用上一次的板子尺寸与调色，方便批量出图；构图重新从填满开始。
    state.settings = prevSettings || defaultSettings();
    state.settings.fit = 'contain';
    state.settings.bg = defaultBg();
    bgCache.clear();
    state.selected = -1;
    state.sourceData = prepared.data;
    state.sourceImage = prepared.canvas;
    state.sourceW = prepared.w;
    state.sourceH = prepared.h;
    state.sourceURL = prepared.url;
    state.imgW = meta.width || img.naturalWidth || prepared.w;
    state.imgH = meta.height || img.naturalHeight || prepared.h;
    state.imgName = meta.fileName || meta.name || 'image';
    state.imgFileSize = meta.fileSize || 0;
    state.frame = containFrame(state.settings.width, state.settings.height);
    state.base = null;
    state.cells = null;
    state.history.length = 0;
    state.future.length = 0;

    els.projectName.value = state.name;
    showWorkspace();
    setPreview(prepared.url, state.name,
      state.imgW + ' × ' + state.imgH + ' px' + (state.imgFileSize ? ' · ' + formatBytes(state.imgFileSize) : ''));
    applySettingsToControls();
    generate({ fit: true, save: true });
    setSaveState('未保存');
    setTimeout(function () {
      if (state.sourceImage && !composer.open) openComposer();
    }, 90);
  }

  async function openFile(file) {
    if (!file || state.busy) return;
    if (composer.open) {
      toast('先完成或取消当前构图');
      return;
    }
    var isImage = (file.type && file.type.indexOf('image/') === 0) ||
      /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '');
    if (!isImage) {
      toast('请选择 JPG / PNG / WebP 等图片文件');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast('图片超过 50MB，请先压缩一下');
      return;
    }

    setBusy(true);
    updateCursor();
    var url = '';
    try {
      url = URL.createObjectURL(file);
      var img = await loadImage(url);
      await startNewDesign(img, {
        name: nameFromFile(file.name),
        fileName: file.name,
        fileSize: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      URL.revokeObjectURL(url);
      url = '';
    } catch (err) {
      console.error(err);
      toast('图片读取失败，请换一张试试');
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
      updateCursor();
      els.fileInput.value = '';
    }
  }

  async function loadProject(record) {
    if (!record || !record.id) return;
    if (state.dirty && state.cells) saveNow(false, true);

    var prepared = null;
    var img = null;
    if (record.source) {
      try {
        img = await loadImage(record.source);
        prepared = prepareSource(img, false);
      } catch (e) {
        console.warn('project source failed', e);
        prepared = null;
      }
    }

    var w = clampInt(record.width || (record.settings && record.settings.width) || 52, MIN_SIZE, MAX_SIZE);
    var h = clampInt(record.height || (record.settings && record.settings.height) || 52, MIN_SIZE, MAX_SIZE);
    var cells = null;
    if (record.cells) {
      try {
        cells = b64ToU8(record.cells);
      } catch (e) {
        cells = null;
      }
    }
    var validCells = cells && cells.length === w * h ? cells : null;
    if (validCells) {
      for (var ci = 0; ci < validCells.length; ci++) {
        if (validCells[ci] !== EMPTY && validCells[ci] >= palette.count) validCells[ci] = EMPTY;
      }
    }
    if (!validCells && !prepared) {
      toast('这张图纸的数据不完整，无法打开');
      return;
    }

    state.projectId = record.id;
    state.name = record.name || '未命名图纸';
    state.createdAt = record.createdAt || Date.now();
    state.updatedAt = record.updatedAt || Date.now();
    state.settings = normalizeSettings(record.settings, w, h);
    state.settings.width = w;
    state.settings.height = h;
    state.sourceData = prepared ? prepared.data : null;
    state.sourceImage = prepared ? prepared.canvas : null;
    state.sourceW = prepared ? prepared.w : 0;
    state.sourceH = prepared ? prepared.h : 0;
    state.sourceURL = prepared ? (record.source || '') : '';
    bgCache.clear();
    state.imgW = record.imgW || state.sourceW;
    state.imgH = record.imgH || state.sourceH;
    state.imgName = record.imgName || record.name || '图纸';
    state.imgFileSize = record.imgFileSize || 0;
    state.base = null;
    if (prepared) {
      if (record.frame) {
        state.frame = normalizeFrame(record.frame, w, h);
      } else if (record.crop) {
        state.frame = frameFromLegacyCrop(record.crop, w, h);
      } else {
        state.frame = fitFrame(state.settings.fit, w, h);
      }
    } else {
      state.frame = null;
    }
    state.cells = validCells;
    state.selected = (Number.isInteger(record.selected) && record.selected >= 0 && record.selected < palette.count)
      ? record.selected : -1;
    state.history.length = 0;
    state.future.length = 0;
    state.stroke = null;
    state.hover = null;
    state.dirty = false;
    if (composer.open) closeComposer(true);

    if (!state.cells && prepared) state.cells = computeCells();

    els.projectName.value = state.name;
    showWorkspace();
    var previewSrc = state.sourceURL || record.thumb || '';
    var meta = state.imgW ? (state.imgW + ' × ' + state.imgH + ' px') : '未缓存原图';
    if (state.imgFileSize) meta += ' · ' + formatBytes(state.imgFileSize);
    setPreview(previewSrc, state.imgName, meta);
    applySettingsToControls();
    syncPattern();
    recomputeCounts();
    ensureSelected();
    updateUI();
    fitView(false);
    render();
    setSaveState('已保存 ' + dateLabel(state.updatedAt));
    try { localStorage.setItem(LAST_KEY, state.projectId); } catch (e) {}
    if (!state.sourceData) toast('原图未缓存，这张图纸仍可编辑和导出');

    if (els.projectsDialog.open) els.projectsDialog.close();
  }

  /* ------------------------------------------------------------------ */
  /* 项目列表                                                           */
  /* ------------------------------------------------------------------ */

  function renderProjectList() {
    while (els.projectList.firstChild) els.projectList.removeChild(els.projectList.firstChild);
    if (!projects.length) {
      var empty = document.createElement('div');
      empty.className = 'project-empty';
      empty.textContent = '还没有保存过图纸。上传一张图片，就会自动保存在这里。';
      els.projectList.appendChild(empty);
      return;
    }

    projects.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    for (var i = 0; i < projects.length; i++) {
      (function (p) {
        var item = document.createElement('div');
        item.className = 'project-item' + (p.id === state.projectId ? ' current' : '');
        item.dataset.id = p.id;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');

        var thumb = document.createElement('img');
        thumb.className = 'project-thumb';
        thumb.alt = '';
        thumb.src = p.thumb || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

        var info = document.createElement('div');
        info.className = 'project-info';
        var title = document.createElement('div');
        title.className = 'project-title';
        title.textContent = p.name || '未命名图纸';
        if (p.id === state.projectId) {
          var tag = document.createElement('span');
          tag.className = 'current-tag';
          tag.textContent = '当前';
          title.appendChild(tag);
        }
        var meta = document.createElement('div');
        meta.className = 'project-meta';
        meta.textContent = (p.width || '?') + '×' + (p.height || '?') + ' · ' +
          (p.used || 0) + ' 色 · ' + fmtNum(p.total || 0) + ' 颗';

        var date = document.createElement('div');
        date.className = 'project-date';
        date.textContent = dateLabel(p.updatedAt);

        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(date);

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'icon-btn project-del';
        del.title = '删除这张图纸';
        del.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';

        item.appendChild(thumb);
        item.appendChild(info);
        item.appendChild(del);
        els.projectList.appendChild(item);
      })(projects[i]);
    }
  }

  function openProjectsDialog() {
    if (state.dirty && state.cells) saveNow(false, true);
    renderProjectList();
    if (!els.projectsDialog.open) els.projectsDialog.showModal();
  }

  function deleteProject(id) {
    var rec = null;
    for (var i = 0; i < projects.length; i++) if (projects[i].id === id) rec = projects[i];
    if (!rec) return;
    if (!window.confirm('删除图纸「' + (rec.name || '未命名图纸') + '」？删除后无法恢复。')) return;

    projects = projects.filter(function (p) { return p.id !== id; });
    writeStore();
    if (state.projectId === id) resetToEmpty();
    renderProjectList();
    toast('已删除');
  }

  function loadProjectById(id) {
    var rec = null;
    for (var i = 0; i < projects.length; i++) if (projects[i].id === id) rec = projects[i];
    if (!rec) { toast('找不到这张图纸'); return; }
    loadProject(rec);
  }

  function newProject() {
    if (state.dirty && state.cells) saveNow(false, true);
    resetToEmpty();
    if (els.projectsDialog.open) els.projectsDialog.close();
    toast('已新建空白图纸');
  }

  /* ------------------------------------------------------------------ */
  /* 导出 PNG                                                           */
  /* ------------------------------------------------------------------ */

  function drawExportGrid(c, px, py, pw, ph, w, h, cell) {
    var i;
    c.strokeStyle = 'rgba(35, 28, 18, .16)';
    c.lineWidth = 0.7;
    c.beginPath();
    for (i = 1; i < w; i++) {
      var x = px + i * cell + 0.5;
      c.moveTo(x, py);
      c.lineTo(x, py + ph);
    }
    for (i = 1; i < h; i++) {
      var y = py + i * cell + 0.5;
      c.moveTo(px, y);
      c.lineTo(px + pw, y);
    }
    c.stroke();

    c.strokeStyle = 'rgba(35, 28, 18, .3)';
    c.lineWidth = 1;
    c.beginPath();
    for (i = 5; i < w; i += 5) {
      var x5 = px + i * cell + 0.5;
      c.moveTo(x5, py);
      c.lineTo(x5, py + ph);
    }
    for (i = 5; i < h; i += 5) {
      var y5 = py + i * cell + 0.5;
      c.moveTo(px, y5);
      c.lineTo(px + pw, y5);
    }
    c.stroke();

    if (w > BOARD_SIZE || h > BOARD_SIZE) {
      c.strokeStyle = 'rgba(188, 75, 45, .72)';
      c.lineWidth = 1.6;
      c.setLineDash([6, 4]);
      c.beginPath();
      for (i = BOARD_SIZE; i < w; i += BOARD_SIZE) {
        var bx = px + i * cell + 0.5;
        c.moveTo(bx, py);
        c.lineTo(bx, py + ph);
      }
      for (i = BOARD_SIZE; i < h; i += BOARD_SIZE) {
        var by = py + i * cell + 0.5;
        c.moveTo(px, by);
        c.lineTo(px + pw, by);
      }
      c.stroke();
      c.setLineDash([]);
    }
  }

  function drawExportRulers(c, px, py, pw, ph, w, h, cell) {
    var dense = Math.max(w, h) > 120;
    c.font = '500 ' + (dense ? 7.5 : 9) + 'px ' + MONO;
    c.fillStyle = 'rgba(90, 78, 60, .72)';
    c.textBaseline = 'middle';
    var i;

    /* 标的是格子线：0 … w / 0 … h，每一条线都标。 */
    c.textAlign = 'center';
    for (i = 0; i <= w; i++) {
      var x = px + i * cell;
      c.fillText(String(i), x, py - 9);
      c.fillText(String(i), x, py + ph + 11);
    }

    c.textAlign = 'right';
    for (i = 0; i <= h; i++) {
      var y = py + i * cell;
      c.fillText(String(i), px - 8, y);
    }

    c.textAlign = 'left';
    for (i = 0; i <= h; i++) {
      var y2 = py + i * cell;
      c.fillText(String(i), px + pw + 8, y2);
    }

    if (w > BOARD_SIZE || h > BOARD_SIZE) {
      c.fillStyle = 'rgba(188, 75, 45, .9)';
      c.font = '700 8px ' + SANS;
      var cols = Math.ceil(w / BOARD_SIZE);
      var rows = Math.ceil(h / BOARD_SIZE);
      c.textAlign = 'center';
      for (i = 0; i < cols; i++) {
        var span = Math.min(BOARD_SIZE, w - i * BOARD_SIZE);
        c.fillText(String.fromCharCode(65 + i), px + (i * BOARD_SIZE + span / 2) * cell, py - 25);
      }
      c.textAlign = 'right';
      for (i = 0; i < rows; i++) {
        var spanY = Math.min(BOARD_SIZE, h - i * BOARD_SIZE);
        c.fillText(String(i + 1), px - 24, py + (i * BOARD_SIZE + spanY / 2) * cell);
      }
    }
  }

  function drawExportCodes(c, px, py, w, h, cell) {
    if (cell < 13) return;
    c.font = '600 ' + clamp(cell * 0.36, 6.2, 9).toFixed(1) + 'px ' + MONO;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (var gy = 0; gy < h; gy++) {
      for (var gx = 0; gx < w; gx++) {
        var idx = state.cells[gy * w + gx];
        if (idx === EMPTY) continue;
        c.fillStyle = paletteColors[idx].ink;
        c.fillText(paletteColors[idx].code, px + (gx + 0.5) * cell, py + (gy + 0.5) * cell + 0.4);
      }
    }
  }

  function exportPNG() {
    if (!state.cells) { toast('先上传一张图片'); return; }
    if (!state.total) { toast('图纸还是空的'); return; }

    var w = state.settings.width;
    var h = state.settings.height;
    var used = getUsedColors();
    var cell = Math.max(12, Math.min(26, Math.floor(3800 / Math.max(w, h))));
    var pad = 40;
    var gutter = 44;
    var headerH = 96;
    var footerH = 54;
    var rowH = 20;
    var colW = 250;
    var gap = 18;

    var patternW = w * cell;
    var patternH = h * cell;
    var rowsCap = Math.max(8, Math.floor(patternH / rowH));
    var legendCols = Math.max(1, Math.ceil(used.length / rowsCap));
    var legendW = used.length ? legendCols * colW + (legendCols - 1) * gap : 0;
    var contentW = patternW + gutter * 2 + (used.length ? 40 + legendW : 0);
    var totalW = pad * 2 + contentW;
    var totalH = pad + headerH + patternH + gutter * 2 + footerH;

    if (totalW * totalH > 45e6) {
      toast('图纸太大，暂时无法导出');
      return;
    }

    var c = document.createElement('canvas');
    c.width = Math.ceil(totalW);
    c.height = Math.ceil(totalH);
    var xctx = c.getContext('2d');
    xctx.fillStyle = '#ffffff';
    xctx.fillRect(0, 0, c.width, c.height);

    var px = pad + gutter;
    var py = pad + headerH + gutter;

    xctx.fillStyle = '#2b2620';
    xctx.font = '800 28px ' + SANS;
    xctx.textBaseline = 'alphabetic';
    xctx.textAlign = 'left';
    xctx.fillText('拼豆图纸', pad, pad + 34);

    xctx.fillStyle = '#7b7264';
    xctx.font = '400 12px ' + SANS;
    xctx.fillText(w + ' × ' + h + '   ·   ' + fmtNum(state.total) + ' 颗豆   ·   ' +
      used.length + ' 色', pad, pad + 58);

    xctx.textAlign = 'right';
    xctx.fillStyle = '#d45a38';
    xctx.font = '800 16px ' + SANS;
    xctx.fillText('拼斯特豆豆', totalW - pad, pad + 30);
    xctx.fillStyle = '#9a9080';
    xctx.font = '400 10px ' + SANS;
    xctx.fillText('拼豆图纸工坊', totalW - pad, pad + 48);

    xctx.strokeStyle = '#e5dccd';
    xctx.lineWidth = 1;
    xctx.beginPath();
    xctx.moveTo(pad, pad + headerH - 14);
    xctx.lineTo(totalW - pad, pad + headerH - 14);
    xctx.stroke();

    xctx.imageSmoothingEnabled = false;
    xctx.drawImage(patternCanvas, px, py, patternW, patternH);
    xctx.imageSmoothingEnabled = true;

    drawExportGrid(xctx, px, py, patternW, patternH, w, h, cell);
    drawExportCodes(xctx, px, py, w, h, cell);
    drawExportRulers(xctx, px, py, patternW, patternH, w, h, cell);

    xctx.strokeStyle = '#d8cbb8';
    xctx.lineWidth = 1;
    xctx.strokeRect(px - 0.5, py - 0.5, patternW + 1, patternH + 1);

    if (used.length) {
      var lx = px + patternW + 40;
      var ly = py;
      xctx.textAlign = 'left';
      xctx.textBaseline = 'alphabetic';
      xctx.fillStyle = '#2b2620';
      xctx.font = '700 14px ' + SANS;
      xctx.fillText('色号清单', lx, ly + 2);
      xctx.fillStyle = '#8a8172';
      xctx.font = '400 10px ' + SANS;
      xctx.fillText(used.length + ' 种颜色 · 按用量排序', lx, ly + 20);

      var startY = ly + 42;
      xctx.font = '600 10px ' + MONO;
      xctx.fillStyle = '#9a9080';
      xctx.fillText('色号', lx, startY - 9);
      xctx.textAlign = 'right';
      xctx.fillText('颗数', lx + colW - 44, startY - 9);
      xctx.fillText('占比', lx + colW - 2, startY - 9);
      xctx.textAlign = 'left';

      for (var i = 0; i < used.length; i++) {
        var u = used[i];
        var col = Math.floor(i / rowsCap);
        var row = i % rowsCap;
        var rx = lx + col * (colW + gap);
        var ry = startY + row * rowH;

        if (row % 2 === 0) {
          xctx.fillStyle = '#faf7f1';
          xctx.fillRect(rx - 4, ry, colW, rowH);
        }

        xctx.fillStyle = u.color.hex;
        xctx.fillRect(rx, ry + 3, 13, 13);
        xctx.strokeStyle = 'rgba(40, 30, 15, .18)';
        xctx.lineWidth = 0.6;
        xctx.strokeRect(rx + 0.3, ry + 3.3, 13, 13);

        xctx.fillStyle = '#2b2620';
        xctx.font = '600 10px ' + MONO;
        xctx.textBaseline = 'middle';
        xctx.fillText(u.color.code, rx + 20, ry + 10);

        xctx.textAlign = 'right';
        xctx.fillStyle = '#3d362c';
        xctx.font = '500 10px ' + MONO;
        xctx.fillText(fmtNum(u.count), rx + colW - 44, ry + 10);
        xctx.fillStyle = '#9a9080';
        xctx.font = '400 9px ' + MONO;
        var pct = state.total ? (u.count / state.total * 100) : 0;
        xctx.fillText((pct > 0 && pct < 0.1 ? '<0.1' : pct.toFixed(1)) + '%', rx + colW - 2, ry + 10);
        xctx.textAlign = 'left';
        xctx.textBaseline = 'alphabetic';
      }
    }

    xctx.strokeStyle = '#e5dccd';
    xctx.lineWidth = 1;
    xctx.beginPath();
    xctx.moveTo(pad, totalH - footerH + 8);
    xctx.lineTo(totalW - pad, totalH - footerH + 8);
    xctx.stroke();

    xctx.fillStyle = '#8a8172';
    xctx.font = '400 9px ' + SANS;
    xctx.textBaseline = 'alphabetic';
    xctx.textAlign = 'left';
    xctx.fillText('拼斯特豆豆 · 拼豆图纸', pad, totalH - footerH + 28);
    xctx.textAlign = 'center';
    xctx.fillText('色值来自 MARD 221 公开色卡，实物颜色可能存在色差', totalW / 2, totalH - footerH + 28);
    xctx.textAlign = 'right';
    xctx.fillText('生成于 ' + fullDateLabel(), totalW - pad, totalH - footerH + 28);

    els.btnExport.disabled = true;
    c.toBlob(function (blob) {
      els.btnExport.disabled = !state.cells;
      if (!blob) {
        toast('PNG 生成失败，请调小图纸尺寸再试');
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '拼豆图纸_' + w + 'x' + h + '_' + fileStamp() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
      toast('PNG 图纸已导出');
    }, 'image/png');
  }

  /* ------------------------------------------------------------------ */
  /* 构图编辑器                                                         */
  /* ------------------------------------------------------------------ */

  var CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var CROP_CURSOR = {
    nw: 'nwse-resize', se: 'nwse-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize',
    e: 'ew-resize', w: 'ew-resize'
  };

  function composerBoardScreen() {
    var v = composer.view;
    return {
      x: v.ox,
      y: v.oy,
      w: composer.width * v.scale,
      h: composer.height * v.scale
    };
  }

  function composerFrameScreen() {
    var v = composer.view;
    var f = composer.frame;
    return {
      x: v.ox + f.x * v.scale,
      y: v.oy + f.y * v.scale,
      w: f.w * v.scale,
      h: f.h * v.scale
    };
  }

  function composerHandlePoints(fr) {
    var mx = fr.x + fr.w / 2;
    var my = fr.y + fr.h / 2;
    return [
      { id: 'nw', x: fr.x, y: fr.y },
      { id: 'n', x: mx, y: fr.y },
      { id: 'ne', x: fr.x + fr.w, y: fr.y },
      { id: 'e', x: fr.x + fr.w, y: my },
      { id: 'se', x: fr.x + fr.w, y: fr.y + fr.h },
      { id: 's', x: mx, y: fr.y + fr.h },
      { id: 'sw', x: fr.x, y: fr.y + fr.h },
      { id: 'w', x: fr.x, y: my }
    ];
  }

  function composerHitHandle(px, py, fr) {
    var pts = composerHandlePoints(fr);
    var radius = 14;
    var midVisible = fr.w > 90 && fr.h > 90;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.id.length === 1 && !midVisible) continue;
      if (Math.abs(px - p.x) <= radius && Math.abs(py - p.y) <= radius) return p.id;
    }
    return null;
  }

  function composerInside(px, py, fr) {
    return px >= fr.x && px <= fr.x + fr.w && py >= fr.y && py <= fr.y + fr.h;
  }

  function composerScreenToBoard(px, py) {
    var v = composer.view;
    return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
  }

  function fitComposerView() {
    var cw = composer.cssW;
    var ch = composer.cssH;
    if (!cw || !ch || !composer.frame) return;
    var f = composer.frame;
    var bw = composer.width;
    var bh = composer.height;
    var minX = Math.min(0, f.x);
    var maxX = Math.max(bw, f.x + f.w);
    var minY = Math.min(0, f.y);
    var maxY = Math.max(bh, f.y + f.h);
    var uw = Math.max(1, maxX - minX);
    var uh = Math.max(1, maxY - minY);
    var pad = Math.min(64, Math.max(22, Math.min(cw, ch) * 0.075));
    var scale = Math.min((cw - pad * 2) / uw, (ch - pad * 2) / uh);
    scale = clamp(scale, 0.05, 120);
    composer.view = {
      scale: scale,
      ox: (cw - uw * scale) / 2 - minX * scale,
      oy: (ch - uh * scale) / 2 - minY * scale
    };
  }

  function resizeComposer() {
    if (!composer.open) return;
    var cw = els.composerStage.clientWidth;
    var ch = els.composerStage.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.round(cw * dpr);
    var ph = Math.round(ch * dpr);
    if (cropCanvas.width !== pw || cropCanvas.height !== ph) {
      cropCanvas.width = pw;
      cropCanvas.height = ph;
    }
    composer.cssW = cw;
    composer.cssH = ch;
    composer.dpr = dpr;
    cropCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitComposerView();
    drawComposer();
  }

  function updateComposerSizeButtons() {
    var btns = els.composerSizes.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active',
        +btns[i].dataset.cw === composer.width && +btns[i].dataset.ch === composer.height);
    }
    if (document.activeElement !== els.composerW) els.composerW.value = composer.width;
    if (document.activeElement !== els.composerH) els.composerH.value = composer.height;
  }

  function updateComposerReadout() {
    if (!composer.frame) return;
    els.composerBadge.textContent = composer.width + ' × ' + composer.height + ' · ' +
      fmtNum(composer.width * composer.height) + ' 格';
    els.composerCropSize.textContent = Math.round(composer.frame.w) + ' × ' +
      Math.round(composer.frame.h) + ' 格';
    els.composerBoardSize.textContent = composer.width + ' × ' + composer.height;
  }

  function updateComposerBgControls() {
    var bg = composer.bg;
    els.bgEnabled.checked = !!bg.enabled;
    els.bgControls.hidden = !bg.enabled;
    els.bgColor.value = String(bg.color).toLowerCase();
    els.bgHex.textContent = String(bg.color).toUpperCase();
    els.bgTolerance.value = bg.tolerance;
    els.outBgTolerance.textContent = bg.tolerance;
    setRangeFill(els.bgTolerance);
    var btns = els.bgModeSeg.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.bgmode === bg.mode);
    }
    els.btnBgPick.classList.toggle('active', !!composer.pickColor);
  }

  function queueComposerBgUpdate() {
    composer.previewPattern = null;
    clearTimeout(composer.bgTimer);
    composer.bgTimer = setTimeout(function () {
      drawComposer();
      if (composer.preview) refreshComposerPreview();
    }, 130);
  }

  function applyComposerBgChange() {
    clearTimeout(composer.bgTimer);
    composer.previewPattern = null;
    drawComposer();
    if (composer.preview) refreshComposerPreview();
  }

  function setComposerBgColor(hex) {
    composer.bg.color = String(hex || '#FFFFFF').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(composer.bg.color)) composer.bg.color = '#FFFFFF';
    updateComposerBgControls();
    applyComposerBgChange();
  }

  function pickComposerBgAt(px, py) {
    if (!state.sourceData || !composer.frame) return;
    var bp = composerScreenToBoard(px, py);
    var f = composer.frame;
    var fx = (bp.x - f.x) / f.w;
    var fy = (bp.y - f.y) / f.h;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
      toast('点在图片上取背景色');
      return;
    }
    var sw = state.sourceW;
    var sh = state.sourceH;
    var sx = Math.floor(fx * sw);
    if (composer.mirror) sx = sw - 1 - sx;
    var sy = Math.floor(fy * sh);
    sx = clamp(sx, 0, sw - 1);
    sy = clamp(sy, 0, sh - 1);
    var o = (sy * sw + sx) * 4;
    var d = state.sourceData.data;
    if (d[o + 3] < 8) {
      toast('这里是透明区域');
      return;
    }
    composer.bg.enabled = true;
    composer.pickColor = false;
    cropCanvas.style.cursor = 'default';
    setComposerBgColor(rgbToHex(d[o], d[o + 1], d[o + 2]));
    toast('已取背景色 ' + composer.bg.color);
  }

  function openComposer() {
    if (!state.sourceData || !state.sourceImage || !state.cells) {
      toast('先上传一张图片，再来构图');
      return;
    }
    if (composer.open) return;

    composer.open = true;
    composer.width = state.settings.width;
    composer.height = state.settings.height;
    var mode = state.settings.fit === 'custom' ? 'contain' : state.settings.fit;
    composer.frame = state.frame
      ? normalizeFrame({ x: state.frame.x, y: state.frame.y, w: state.frame.w, h: state.frame.h },
          composer.width, composer.height)
      : fitFrame(mode, composer.width, composer.height);
    if (!composer.frame) {
      composer.open = false;
      toast('图片布局无效，请重新上传图片');
      return;
    }
    composer.preview = false;
    composer.mirror = !!state.settings.mirror;
    composer.bg = normalizeBg(state.settings.bg);
    composer.pickColor = false;
    if (!composer.bg.enabled) composer.bg.color = detectBackgroundColor();
    composer.previewCells = null;
    composer.previewPattern = null;
    composer.drag = null;
    composer.pinch = null;
    composer.pointers.clear();
    composer.interacting = false;
    clearTimeout(composer.previewTimer);
    clearTimeout(composer.viewTimer);
    clearTimeout(composer.bgTimer);

    els.composerPreview.checked = false;
    els.composerMirror.checked = composer.mirror;
    updateComposerBgControls();
    els.composer.hidden = false;
    document.body.classList.add('composing');
    try { els.composer.focus({ preventScroll: true }); } catch (e) {}
    updateComposerSizeButtons();
    updateComposerReadout();
    requestAnimationFrame(resizeComposer);
  }

  function closeComposer(silent) {
    if (!composer.open) return;
    composer.open = false;
    composer.drag = null;
    composer.pinch = null;
    composer.pointers.clear();
    composer.interacting = false;
    composer.pickColor = false;
    clearTimeout(composer.previewTimer);
    clearTimeout(composer.viewTimer);
    clearTimeout(composer.bgTimer);
    els.composer.hidden = true;
    document.body.classList.remove('composing');
    if (!silent) {
      try { els.btnCompose.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function readComposerDimension(input, fallback) {
    var v = parseInt(input.value, 10);
    if (!isFinite(v)) return fallback;
    return clampInt(v, MIN_SIZE, MAX_SIZE);
  }

  function applyComposer() {
    if (!composer.open) return;
    var typedW = readComposerDimension(els.composerW, composer.width);
    var typedH = readComposerDimension(els.composerH, composer.height);
    if (typedW !== composer.width || typedH !== composer.height) {
      setComposerSize(typedW, typedH);
    }
    var frame = clampFrame(composer.frame, composer.width, composer.height);
    if (!frame) {
      toast('图片布局无效');
      return;
    }
    if (state.history.length &&
        !window.confirm('应用构图会重新生成图纸，手动改豆会被覆盖。继续？')) {
      return;
    }
    state.settings.width = clampInt(composer.width, MIN_SIZE, MAX_SIZE);
    state.settings.height = clampInt(composer.height, MIN_SIZE, MAX_SIZE);
    var c = containFrame(state.settings.width, state.settings.height);
    var cov = coverFrame(state.settings.width, state.settings.height);
    var st = stretchFrame(state.settings.width, state.settings.height);
    state.settings.fit = frameClose(frame, c) ? 'contain'
      : (frameClose(frame, cov) ? 'cover'
        : (frameClose(frame, st) ? 'stretch' : 'custom'));
    state.settings.mirror = !!composer.mirror;
    state.settings.bg = normalizeBg(composer.bg);
    state.frame = frame;
    state.base = null;
    state.view.fit = true;
    state.history.length = 0;
    state.future.length = 0;
    closeComposer(true);
    generate({ fit: true });
    try { els.btnCompose.focus({ preventScroll: true }); } catch (e) {}
    toast('构图已应用');
  }

  function setComposerSize(w, h) {
    var nw = clampInt(w, MIN_SIZE, MAX_SIZE);
    var nh = clampInt(h, MIN_SIZE, MAX_SIZE);
    if (nw === composer.width && nh === composer.height) return;
    var oldW = composer.width;
    var oldH = composer.height;
    var mode = null;
    if (composer.frame) {
      if (frameClose(composer.frame, containFrame(oldW, oldH))) mode = 'contain';
      else if (frameClose(composer.frame, coverFrame(oldW, oldH))) mode = 'cover';
      else if (frameClose(composer.frame, stretchFrame(oldW, oldH))) mode = 'stretch';
    }
    composer.width = nw;
    composer.height = nh;
    composer.frame = mode
      ? fitFrame(mode, nw, nh)
      : scaleFrameToBoard(composer.frame, oldW, oldH, nw, nh);
    composer.previewPattern = null;
    composer.interacting = false;
    updateComposerSizeButtons();
    updateComposerReadout();
    fitComposerView();
    drawComposer();
    if (composer.preview) refreshComposerPreview();
  }

  function composerPreset(mode) {
    if (!composer.open || !state.sourceW) return;
    composer.frame = fitFrame(mode, composer.width, composer.height);
    composer.previewPattern = null;
    composer.interacting = false;
    updateComposerReadout();
    fitComposerView();
    drawComposer();
    if (composer.preview) refreshComposerPreview();
  }

  function composerSetFrame(frame) {
    var f = clampFrame(frame, composer.width, composer.height);
    if (!f) return;
    composer.frame = f;
    updateComposerReadout();
  }

  function refreshComposerPreview() {
    if (!composer.open || !composer.preview) return;
    clearTimeout(composer.previewTimer);
    try {
      var cells = computeCellsFor(composer.width, composer.height, composer.frame, state.settings, composer.mirror, composer.bg);
      if (!cells) return;
      var w = composer.width;
      var h = composer.height;
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var cx = c.getContext('2d');
      var img = cx.createImageData(w, h);
      var data = img.data;
      var rgb = palette.rgb;
      for (var i = 0; i < cells.length; i++) {
        var idx = cells[i];
        if (idx === EMPTY) continue;
        var o = i * 4;
        var p = idx * 3;
        data[o] = rgb[p];
        data[o + 1] = rgb[p + 1];
        data[o + 2] = rgb[p + 2];
        data[o + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      composer.previewCells = cells;
      composer.previewPattern = c;
      composer.interacting = false;
      drawComposer();
    } catch (e) {
      console.warn('preview failed', e);
      toast('预览生成失败，请重试');
    }
  }

  function queueComposerPreview() {
    if (!composer.preview) return;
    composer.interacting = true;
    clearTimeout(composer.previewTimer);
    composer.previewTimer = setTimeout(function () {
      if (!composer.drag && !composer.pinch) refreshComposerPreview();
    }, 190);
  }

  function drawComposerHandles(fr) {
    var pts = composerHandlePoints(fr);
    var midVisible = fr.w > 90 && fr.h > 90;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.id.length === 1 && !midVisible) continue;
      var half = p.id.length === 2 ? 4.5 : 3.8;
      cropCtx.beginPath();
      cropCtx.rect(p.x - half, p.y - half, half * 2, half * 2);
      cropCtx.fillStyle = '#fffaf0';
      cropCtx.fill();
      cropCtx.strokeStyle = 'rgba(28, 22, 16, .82)';
      cropCtx.lineWidth = 1.5;
      cropCtx.stroke();
    }
  }

  function drawComposerGrid(bs) {
    var w = composer.width;
    var h = composer.height;
    var cw = bs.w / w;
    var ch = bs.h / h;
    var minCell = Math.min(cw, ch);
    var step = minCell >= 7 ? 1 : (minCell >= 2.2 ? 5 : 10);

    cropCtx.save();
    cropCtx.beginPath();
    cropCtx.rect(bs.x, bs.y, bs.w, bs.h);
    cropCtx.clip();

    cropCtx.strokeStyle = 'rgba(255, 255, 255, .52)';
    cropCtx.lineWidth = 0.75;
    cropCtx.shadowColor = 'rgba(0, 0, 0, .55)';
    cropCtx.shadowBlur = 2;
    cropCtx.beginPath();
    for (var gx = step; gx < w; gx += step) {
      var x = bs.x + gx * cw;
      cropCtx.moveTo(x, bs.y);
      cropCtx.lineTo(x, bs.y + bs.h);
    }
    for (var gy = step; gy < h; gy += step) {
      var y = bs.y + gy * ch;
      cropCtx.moveTo(bs.x, y);
      cropCtx.lineTo(bs.x + bs.w, y);
    }
    cropCtx.stroke();
    cropCtx.shadowColor = 'transparent';
    cropCtx.shadowBlur = 0;

    if (step === 1) {
      cropCtx.strokeStyle = 'rgba(255, 255, 255, .2)';
      cropCtx.lineWidth = 1;
      cropCtx.beginPath();
      for (var gx5 = 5; gx5 < w; gx5 += 5) {
        var x5 = bs.x + gx5 * cw;
        cropCtx.moveTo(x5, bs.y);
        cropCtx.lineTo(x5, bs.y + bs.h);
      }
      for (var gy5 = 5; gy5 < h; gy5 += 5) {
        var y5 = bs.y + gy5 * ch;
        cropCtx.moveTo(bs.x, y5);
        cropCtx.lineTo(bs.x + bs.w, y5);
      }
      cropCtx.stroke();
    }

    if (w > BOARD_SIZE || h > BOARD_SIZE) {
      cropCtx.strokeStyle = 'rgba(255, 128, 88, .9)';
      cropCtx.lineWidth = 1.5;
      cropCtx.setLineDash([5, 3]);
      cropCtx.beginPath();
      for (var bx = BOARD_SIZE; bx < w; bx += BOARD_SIZE) {
        var bxp = bs.x + bx * cw;
        cropCtx.moveTo(bxp, bs.y);
        cropCtx.lineTo(bxp, bs.y + bs.h);
      }
      for (var by = BOARD_SIZE; by < h; by += BOARD_SIZE) {
        var byp = bs.y + by * ch;
        cropCtx.moveTo(bs.x, byp);
        cropCtx.lineTo(bs.x + bs.w, byp);
      }
      cropCtx.stroke();
      cropCtx.setLineDash([]);
    }
    cropCtx.restore();
  }

  var composerChecker = null;

  function drawComposerChecker(fr) {
    if (!composerChecker) {
      var p = document.createElement('canvas');
      p.width = 16;
      p.height = 16;
      var pc = p.getContext('2d');
      pc.fillStyle = '#f7f1e6';
      pc.fillRect(0, 0, 16, 16);
      pc.fillStyle = '#d8d0c2';
      pc.fillRect(0, 0, 8, 8);
      pc.fillRect(8, 8, 8, 8);
      composerChecker = cropCtx.createPattern(p, 'repeat');
    }
    if (!composerChecker) return;
    cropCtx.save();
    cropCtx.beginPath();
    cropCtx.rect(fr.x, fr.y, fr.w, fr.h);
    cropCtx.clip();
    cropCtx.fillStyle = composerChecker;
    cropCtx.fillRect(fr.x, fr.y, fr.w, fr.h);
    cropCtx.restore();
  }

  function drawComposer() {
    if (!composer.open || !composer.cssW || !composer.frame) return;
    var cw = composer.cssW;
    var ch = composer.cssH;
    cropCtx.setTransform(composer.dpr, 0, 0, composer.dpr, 0, 0);
    cropCtx.clearRect(0, 0, cw, ch);
    if (!state.sourceImage) return;

    var bs = composerBoardScreen();
    var fs = composerFrameScreen();
    var processed = buildBackgroundSource(composer.bg);
    var srcCanvas = processed ? processed.canvas : state.sourceImage;

    cropCtx.save();
    cropCtx.shadowColor = 'rgba(0, 0, 0, .35)';
    cropCtx.shadowBlur = 20;
    cropCtx.shadowOffsetY = 8;
    cropCtx.fillStyle = '#fffdf8';
    cropCtx.fillRect(bs.x, bs.y, bs.w, bs.h);
    cropCtx.restore();

    if (composer.bg.enabled) drawComposerChecker(fs);

    cropCtx.imageSmoothingEnabled = true;
    cropCtx.imageSmoothingQuality = 'high';
    if (composer.mirror) {
      cropCtx.save();
      cropCtx.translate(fs.x + fs.w, fs.y);
      cropCtx.scale(-1, 1);
      cropCtx.drawImage(srcCanvas, 0, 0, fs.w, fs.h);
      cropCtx.restore();
    } else {
      cropCtx.drawImage(srcCanvas, fs.x, fs.y, fs.w, fs.h);
    }

    if (composer.preview && composer.previewPattern && !composer.interacting) {
      cropCtx.fillStyle = '#fffdf8';
      cropCtx.fillRect(bs.x, bs.y, bs.w, bs.h);
      cropCtx.imageSmoothingEnabled = false;
      cropCtx.drawImage(composer.previewPattern, bs.x, bs.y, bs.w, bs.h);
      cropCtx.imageSmoothingEnabled = true;
    }

    cropCtx.save();
    cropCtx.beginPath();
    cropCtx.rect(0, 0, cw, ch);
    cropCtx.rect(bs.x, bs.y, bs.w, bs.h);
    cropCtx.fillStyle = 'rgba(13, 10, 8, .62)';
    cropCtx.fill('evenodd');
    cropCtx.restore();

    drawComposerGrid(bs);

    cropCtx.strokeStyle = 'rgba(255, 250, 242, .96)';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(bs.x + 1, bs.y + 1, Math.max(0, bs.w - 2), Math.max(0, bs.h - 2));

    cropCtx.strokeStyle = 'rgba(255, 170, 130, .92)';
    cropCtx.lineWidth = 1.4;
    cropCtx.setLineDash([6, 4]);
    cropCtx.strokeRect(fs.x + 0.5, fs.y + 0.5, Math.max(0, fs.w - 1), Math.max(0, fs.h - 1));
    cropCtx.setLineDash([]);

    drawComposerHandles(fs);
  }

  function composerCanvasPoint(e) {
    var r = cropCanvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function composerCursorFor(px, py) {
    if (composer.pickColor) return 'crosshair';
    var fr = composerFrameScreen();
    var handle = composerHitHandle(px, py, fr);
    if (handle) return CROP_CURSOR[handle];
    if (composerInside(px, py, fr)) return 'move';
    return 'default';
  }

  function startComposerPinch() {
    var pts = Array.from(composer.pointers.values());
    if (pts.length < 2) return;
    var a = pts[0], b = pts[1];
    composer.pinch = {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      frame: { x: composer.frame.x, y: composer.frame.y, w: composer.frame.w, h: composer.frame.h },
      centerX: composer.frame.x + composer.frame.w / 2,
      centerY: composer.frame.y + composer.frame.h / 2
    };
    composer.drag = null;
    composer.interacting = true;
  }

  function resizeFrameFromDrag(drag, bx, by) {
    var sc = drag.startFrame;
    var handle = drag.handle;
    var maxW = Math.max(composer.width, composer.height) * 6;
    var minW = 1;
    var f;

    if (handle === 'e' || handle === 'w' || handle === 'n' || handle === 's') {
      f = { x: sc.x, y: sc.y, w: sc.w, h: sc.h };
      if (handle === 'e') {
        f.w = clamp(bx - sc.x, minW, maxW);
      } else if (handle === 'w') {
        var right = sc.x + sc.w;
        f.w = clamp(right - bx, minW, maxW);
        f.x = right - f.w;
      } else if (handle === 's') {
        f.h = clamp(by - sc.y, minW, maxW);
      } else if (handle === 'n') {
        var bottom = sc.y + sc.h;
        f.h = clamp(bottom - by, minW, maxW);
        f.y = bottom - f.h;
      }
      return f;
    }

    var aspect = sc.w / sc.h;
    var ax, ay, dirX, dirY;
    if (handle === 'se') { ax = sc.x; ay = sc.y; dirX = 1; dirY = 1; }
    else if (handle === 'sw') { ax = sc.x + sc.w; ay = sc.y; dirX = -1; dirY = 1; }
    else if (handle === 'ne') { ax = sc.x; ay = sc.y + sc.h; dirX = 1; dirY = -1; }
    else { ax = sc.x + sc.w; ay = sc.y + sc.h; dirX = -1; dirY = -1; }

    var wantedW = Math.abs(bx - ax);
    var wantedH = Math.abs(by - ay);
    var newW = Math.max(wantedW, wantedH * aspect);
    newW = clamp(newW, minW, maxW);
    var newH = newW / aspect;
    return {
      x: dirX > 0 ? ax : ax - newW,
      y: dirY > 0 ? ay : ay - newH,
      w: newW,
      h: newH
    };
  }

  function onComposerPointerDown(e) {
    if (!composer.open) return;
    var p = composerCanvasPoint(e);
    if (composer.pickColor) {
      pickComposerBgAt(p.x, p.y);
      e.preventDefault();
      return;
    }
    composer.pointers.set(e.pointerId, p);

    if (composer.pointers.size === 2) {
      startComposerPinch();
      try { cropCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      return;
    }
    if (composer.pointers.size > 2) return;

    var fr = composerFrameScreen();
    var handle = composerHitHandle(p.x, p.y, fr);
    var bp = composerScreenToBoard(p.x, p.y);

    if (handle) {
      composer.drag = {
        type: 'resize',
        handle: handle,
        startFrame: { x: composer.frame.x, y: composer.frame.y, w: composer.frame.w, h: composer.frame.h },
        startBoard: bp
      };
      cropCanvas.style.cursor = CROP_CURSOR[handle];
    } else if (composerInside(p.x, p.y, fr)) {
      composer.drag = {
        type: 'move',
        startFrame: { x: composer.frame.x, y: composer.frame.y, w: composer.frame.w, h: composer.frame.h },
        startBoard: bp
      };
      cropCanvas.style.cursor = 'grabbing';
    } else {
      return;
    }

    composer.interacting = true;
    clearTimeout(composer.previewTimer);
    try { cropCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function onComposerPointerMove(e) {
    if (!composer.open) return;
    var p = composerCanvasPoint(e);
    if (composer.pointers.has(e.pointerId)) composer.pointers.set(e.pointerId, p);

    if (composer.pinch && composer.pointers.size >= 2) {
      var pts = Array.from(composer.pointers.values());
      var a = pts[0], b = pts[1];
      var dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      var ratio = dist / composer.pinch.dist;
      var maxW = Math.max(composer.width, composer.height) * 6;
      var minScale = Math.max(1 / composer.pinch.frame.w, 1 / composer.pinch.frame.h);
      var maxScale = Math.min(maxW / composer.pinch.frame.w, maxW / composer.pinch.frame.h);
      var s = clamp(ratio, minScale, maxScale);
      var nw = composer.pinch.frame.w * s;
      var nh = composer.pinch.frame.h * s;
      composerSetFrame({
        x: composer.pinch.centerX - nw / 2,
        y: composer.pinch.centerY - nh / 2,
        w: nw,
        h: nh
      });
      drawComposer();
      return;
    }

    if (!composer.drag) {
      cropCanvas.style.cursor = composerCursorFor(p.x, p.y);
      return;
    }

    var bp = composerScreenToBoard(p.x, p.y);
    var drag = composer.drag;
    var next;
    if (drag.type === 'move') {
      next = {
        x: drag.startFrame.x + (bp.x - drag.startBoard.x),
        y: drag.startFrame.y + (bp.y - drag.startBoard.y),
        w: drag.startFrame.w,
        h: drag.startFrame.h
      };
    } else {
      next = resizeFrameFromDrag(drag, bp.x, bp.y);
    }
    composerSetFrame(next);
    drawComposer();
  }

  function onComposerPointerUp(e) {
    composer.pointers.delete(e.pointerId);
    var wasInteracting = !!(composer.pinch || composer.drag);
    if (composer.pinch) {
      if (composer.pointers.size < 2) composer.pinch = null;
    }
    if (composer.drag) composer.drag = null;
    if (!wasInteracting) return;

    composer.interacting = false;
    fitComposerView();
    updateComposerReadout();
    if (composer.preview) refreshComposerPreview();
    else drawComposer();
  }

  function onComposerPointerCancel(e) {
    composer.pointers.delete(e.pointerId);
    composer.pinch = null;
    composer.drag = null;
    composer.interacting = false;
    fitComposerView();
    updateComposerReadout();
    if (composer.preview) refreshComposerPreview();
    else drawComposer();
  }

  function onComposerWheel(e) {
    if (!composer.open) return;
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 320;
    var factor = Math.exp(delta * 0.0015);
    var p = composerCanvasPoint(e);
    var bp = composerScreenToBoard(p.x, p.y);
    var c = composer.frame;
    var maxW = Math.max(composer.width, composer.height) * 6;
    var minScale = Math.max(1 / c.w, 1 / c.h);
    var maxScale = Math.min(maxW / c.w, maxW / c.h);
    var s = clamp(factor, minScale, maxScale);
    var nw = c.w * s;
    var nh = c.h * s;
    composerSetFrame({
      x: bp.x - (bp.x - c.x) * s,
      y: bp.y - (bp.y - c.y) * s,
      w: nw,
      h: nh
    });
    composer.interacting = true;
    drawComposer();
    if (composer.preview) queueComposerPreview();
    else composer.interacting = false;

    clearTimeout(composer.viewTimer);
    composer.viewTimer = setTimeout(function () {
      if (!composer.drag && !composer.pinch) {
        fitComposerView();
        updateComposerReadout();
        if (composer.preview) refreshComposerPreview();
        else drawComposer();
      }
    }, 240);
  }

  /* ------------------------------------------------------------------ */
  /* 偏好 / 事件绑定                                                    */
  /* ------------------------------------------------------------------ */

  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (typeof p.showGrid === 'boolean') state.showGrid = p.showGrid;
      if (typeof p.showCoords === 'boolean') state.showCoords = p.showCoords;
      if (typeof p.showCodes === 'boolean') state.showCodes = p.showCodes;
      if (typeof p.showBoards === 'boolean') state.showBoards = p.showBoards;
    } catch (e) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        showGrid: state.showGrid,
        showCoords: state.showCoords,
        showCodes: state.showCodes,
        showBoards: state.showBoards
      }));
    } catch (e) {}
  }

  function openFilePicker() {
    if (state.busy) return;
    els.fileInput.value = '';
    els.fileInput.click();
  }

  async function loadSample() {
    if (state.busy) return;
    var svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">',
      '<rect width="640" height="640" fill="#f2dfc8"/>',
      '<circle cx="320" cy="330" r="252" fill="#fbf3e6"/>',
      '<g transform="translate(320 292)">',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#e46146"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#f08a67" transform="rotate(45)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#d9504a" transform="rotate(90)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#f4a584" transform="rotate(135)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#e46146" transform="rotate(180)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#f08a67" transform="rotate(225)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#d9504a" transform="rotate(270)"/>',
      '<ellipse cx="0" cy="-116" rx="58" ry="112" fill="#f4a584" transform="rotate(315)"/>',
      '</g>',
      '<circle cx="320" cy="292" r="92" fill="#f3c74f"/>',
      '<circle cx="320" cy="292" r="68" fill="#f8dc86"/>',
      '<circle cx="292" cy="276" r="10" fill="#3f2d1f"/>',
      '<circle cx="348" cy="276" r="10" fill="#3f2d1f"/>',
      '<circle cx="288" cy="272" r="3" fill="#fff8ea"/>',
      '<circle cx="344" cy="272" r="3" fill="#fff8ea"/>',
      '<path d="M294 314 q26 22 52 0" fill="none" stroke="#4a3526" stroke-width="9" stroke-linecap="round"/>',
      '<path d="M320 400 C320 470 300 520 268 566" fill="none" stroke="#4f7d4d" stroke-width="18" stroke-linecap="round"/>',
      '<path d="M306 486 C260 456 218 470 202 508 C246 526 286 516 306 486 Z" fill="#6b9a5e"/>',
      '<path d="M326 512 C374 480 420 496 438 536 C392 552 348 540 326 512 Z" fill="#527f4d"/>',
      '<g fill="#f8e2b0">',
      '<path d="M112 150 l9 24 24 9 -24 9 -9 24 -9 -24 -24 -9 24 -9 Z"/>',
      '<path d="M530 188 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 Z"/>',
      '<path d="M170 500 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 Z"/>',
      '</g>',
      '</svg>'
    ].join('');
    var blob = new Blob([svg], { type: 'image/svg+xml' });
    var file = new File([blob], '示例-小花.svg', { type: 'image/svg+xml' });
    await openFile(file);
  }

  function bindUI() {
    [els.btnPickImage, els.btnPickImage3, els.btnChangeImage].forEach(function (b) {
      b.addEventListener('click', openFilePicker);
    });
    els.btnCompose.addEventListener('click', function () { openComposer(); });
    els.fileInput.addEventListener('change', function () {
      var f = els.fileInput.files && els.fileInput.files[0];
      if (f) openFile(f);
    });

    els.dropZone.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      if (!state.cells) openFilePicker();
    });

    els.btnSample.addEventListener('click', loadSample);

    els.btnComposerCancel.addEventListener('click', function () { closeComposer(); });
    els.btnComposerApply.addEventListener('click', applyComposer);
    els.btnCropContain.addEventListener('click', function () { composerPreset('contain'); });
    els.btnCropCover.addEventListener('click', function () { composerPreset('cover'); });
    els.btnCropStretch.addEventListener('click', function () { composerPreset('stretch'); });

    var csizeBtns = els.composerSizes.querySelectorAll('button');
    for (var ci = 0; ci < csizeBtns.length; ci++) {
      csizeBtns[ci].addEventListener('click', function () {
        setComposerSize(+this.dataset.cw, +this.dataset.ch);
      });
    }

    function applyComposerSizeInputs() {
      var w = readComposerDimension(els.composerW, composer.width);
      var h = readComposerDimension(els.composerH, composer.height);
      els.composerW.value = w;
      els.composerH.value = h;
      setComposerSize(w, h);
    }
    els.btnComposerSizeApply.addEventListener('click', applyComposerSizeInputs);
    [els.composerW, els.composerH].forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyComposerSizeInputs();
        }
      });
    });

    els.composerPreview.addEventListener('change', function () {
      composer.preview = els.composerPreview.checked;
      composer.interacting = false;
      if (composer.preview) refreshComposerPreview();
      else drawComposer();
    });

    els.composerMirror.addEventListener('change', function () {
      composer.mirror = els.composerMirror.checked;
      composer.previewPattern = null;
      composer.interacting = false;
      drawComposer();
      if (composer.preview) refreshComposerPreview();
    });

    els.bgEnabled.addEventListener('change', function () {
      composer.bg.enabled = els.bgEnabled.checked;
      if (composer.bg.enabled && !composer.bg.color) composer.bg.color = detectBackgroundColor();
      updateComposerBgControls();
      applyComposerBgChange();
    });
    els.bgColor.addEventListener('input', function () {
      composer.bg.color = String(els.bgColor.value).toUpperCase();
      updateComposerBgControls();
      applyComposerBgChange();
    });
    els.bgTolerance.addEventListener('input', function () {
      composer.bg.tolerance = clamp(+els.bgTolerance.value || 0, 0, 100);
      els.outBgTolerance.textContent = composer.bg.tolerance;
      setRangeFill(els.bgTolerance);
      queueComposerBgUpdate();
    });
    els.bgTolerance.addEventListener('change', function () {
      composer.bg.tolerance = clamp(+els.bgTolerance.value || 0, 0, 100);
      els.outBgTolerance.textContent = composer.bg.tolerance;
      applyComposerBgChange();
    });
    var bgModeBtns = els.bgModeSeg.querySelectorAll('button');
    for (var bmi = 0; bmi < bgModeBtns.length; bmi++) {
      bgModeBtns[bmi].addEventListener('click', function () {
        composer.bg.mode = this.dataset.bgmode === 'global' ? 'global' : 'connected';
        updateComposerBgControls();
        applyComposerBgChange();
      });
    }
    els.btnBgPick.addEventListener('click', function () {
      composer.pickColor = !composer.pickColor;
      updateComposerBgControls();
      cropCanvas.style.cursor = composer.pickColor ? 'crosshair' : 'default';
    });
    els.btnBgReset.addEventListener('click', function () {
      composer.bg.color = detectBackgroundColor();
      composer.bg.tolerance = 24;
      composer.bg.mode = 'connected';
      composer.bg.enabled = true;
      updateComposerBgControls();
      applyComposerBgChange();
    });

    cropCanvas.addEventListener('pointerdown', onComposerPointerDown);
    cropCanvas.addEventListener('pointermove', onComposerPointerMove);
    cropCanvas.addEventListener('pointerup', onComposerPointerUp);
    cropCanvas.addEventListener('pointercancel', onComposerPointerCancel);
    cropCanvas.addEventListener('pointerleave', function () {
      if (!composer.open || composer.drag || composer.pinch) return;
      cropCanvas.style.cursor = 'default';
    });
    cropCanvas.addEventListener('wheel', onComposerWheel, { passive: false });

    els.btnProjects.addEventListener('click', openProjectsDialog);
    els.btnCloseProjects.addEventListener('click', function () { els.projectsDialog.close(); });
    els.btnNewProject.addEventListener('click', newProject);

    els.projectsDialog.addEventListener('click', function (e) {
      if (e.target !== els.projectsDialog) return;
      var r = els.projectsDialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        els.projectsDialog.close();
      }
    });

    els.projectList.addEventListener('click', function (e) {
      var del = e.target.closest('.project-del');
      if (del) {
        var item = del.closest('.project-item');
        if (item) deleteProject(item.dataset.id);
        return;
      }
      var row = e.target.closest('.project-item');
      if (row) loadProjectById(row.dataset.id);
    });
    els.projectList.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.project-del')) return;
      var row = e.target.closest('.project-item');
      if (!row) return;
      e.preventDefault();
      loadProjectById(row.dataset.id);
    });

    els.projectName.addEventListener('input', function () {
      state.name = els.projectName.value.trim().slice(0, 40);
      scheduleSave();
    });
    els.projectName.addEventListener('change', function () {
      if (!state.name) {
        state.name = '未命名图纸';
        els.projectName.value = state.name;
      }
      saveNow(false, true);
    });

    els.btnSave.addEventListener('click', function () { saveNow(true, false); });
    els.btnExport.addEventListener('click', exportPNG);

    var fits = els.fitSeg.querySelectorAll('button');
    for (var f = 0; f < fits.length; f++) {
      fits[f].addEventListener('click', function () {
        if (this.disabled) return;
        setFramePreset(this.dataset.fit);
      });
    }

    var sliders = [
      { input: els.adjBrightness, out: els.outBrightness, key: 'brightness' },
      { input: els.adjContrast, out: els.outContrast, key: 'contrast' },
      { input: els.adjSaturation, out: els.outSaturation, key: 'saturation' }
    ];
    sliders.forEach(function (item) {
      item.input.addEventListener('input', function () {
        state.settings[item.key] = +item.input.value;
        item.out.textContent = item.input.value;
        setRangeFill(item.input);
        queueRegenerate();
      });
      item.input.addEventListener('change', function () {
        clearTimeout(regenTimer);
        if (state.sourceData) generate({});
      });
    });

    els.btnResetAdjust.addEventListener('click', resetAdjustments);
    els.optDither.addEventListener('change', function () {
      state.settings.dither = els.optDither.checked;
      if (state.sourceData) generate({});
    });

    [els.optGrid, els.optCoords, els.optCodes, els.optBoards].forEach(function (inp) {
      inp.addEventListener('change', function () {
        state.showGrid = els.optGrid.checked;
        state.showCoords = els.optCoords.checked;
        state.showCodes = els.optCodes.checked;
        state.showBoards = els.optBoards.checked;
        savePrefs();
        render();
      });
    });

    var tools = document.querySelectorAll('.tool[data-tool]');
    for (var t = 0; t < tools.length; t++) {
      tools[t].addEventListener('click', function () {
        setTool(this.dataset.tool);
      });
    }

    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);
    els.btnClear.addEventListener('click', clearAll);

    els.btnZoomIn.addEventListener('click', function () {
      zoomAt(1.25, state.cssW / 2, state.cssH / 2);
    });
    els.btnZoomOut.addEventListener('click', function () {
      zoomAt(0.8, state.cssW / 2, state.cssH / 2);
    });
    els.btnZoomFit.addEventListener('click', function () { fitView(true); });

    els.legendSearch.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(rebuildLegend, 70);
    });

    els.legendList.addEventListener('click', function (e) {
      var item = e.target.closest('.legend-item');
      if (!item) return;
      selectColor(+item.dataset.index, true);
    });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', function (e) {
      if (state.stroke || panning) return;
      updateHover(null);
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      if (!state.cells) return;
      e.preventDefault();
      var p = canvasPoint(e);
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 320;
      var factor = Math.exp(-delta * 0.0016);
      zoomAt(factor, p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('dblclick', function () { fitView(true); });

    window.addEventListener('keydown', function (e) {
      if (composer.open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeComposer();
        }
        return;
      }
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      var meta = e.ctrlKey || e.metaKey;

      if (meta && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveNow(true, false);
        return;
      }
      if (typing) return;

      if (meta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (meta && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      var k = (e.key || '').toLowerCase();
      if (k === 'b') { setTool('brush'); return; }
      if (k === 'e') { setTool('eraser'); return; }
      if (k === 'g') { setTool('fill'); return; }
      if (k === 'i') { setTool('dropper'); return; }
      if (k === 'h') { setTool('pan'); return; }
      if (k === '0') { e.preventDefault(); fitView(true); return; }
      if (k === '+' || k === '=') {
        e.preventDefault();
        zoomAt(1.25, state.cssW / 2, state.cssH / 2);
        return;
      }
      if (k === '-') {
        e.preventDefault();
        zoomAt(0.8, state.cssW / 2, state.cssH / 2);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        spaceDown = true;
        updateCursor();
      }
    });

    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space') {
        spaceDown = false;
        updateCursor();
      }
    });

    window.addEventListener('blur', function () {
      spaceDown = false;
      panning = null;
      endStroke();
      updateCursor();
    });

    document.addEventListener('paste', function (e) {
      if (!e.clipboardData) return;
      var items = e.clipboardData.items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) {
            e.preventDefault();
            openFile(f);
          }
          return;
        }
      }
    });

    window.addEventListener('dragenter', function (e) {
      if (!e.dataTransfer) return;
      if (Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
      dragDepth++;
      document.body.classList.add('dragging');
      e.preventDefault();
    });
    window.addEventListener('dragover', function (e) {
      if (!e.dataTransfer) return;
      if (Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    window.addEventListener('dragleave', function (e) {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove('dragging');
    });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) openFile(files[0]);
    });

    window.addEventListener('pagehide', function () {
      if (state.dirty && state.cells) saveNow(false, true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.dirty && state.cells) saveNow(false, true);
    });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { resizeCanvas(); }).observe(els.canvasShell);
      new ResizeObserver(function () {
        if (composer.open) resizeComposer();
      }).observe(els.composerStage);
    }
    window.addEventListener('resize', function () {
      resizeCanvas();
      if (composer.open) resizeComposer();
    });

    els.projectsDialog.addEventListener('close', function () {});
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    loadPrefs();
    bindUI();
    readProjectIndex();
    syncPattern();
    updateUI();
    updateHover(null);
    resizeCanvas();

    var lastId = '';
    try { lastId = localStorage.getItem(LAST_KEY) || ''; } catch (e) {}
    var last = null;
    if (lastId) {
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === lastId) { last = projects[i]; break; }
      }
    }

    if (last) {
      loadProject(last).catch(function (err) {
        console.error(err);
        resetToEmpty();
      });
    } else {
      resetToEmpty();
    }

    requestAnimationFrame(function () {
      resizeCanvas();
      if (state.cells) fitView(false);
      render();
    });
  }

  // 供调试 / 自动化测试使用，不影响正常功能。
  window.__pindou = {
    state: state,
    palette: palette,
    projects: function () { return projects; },
    generate: generate,
    loadSample: loadSample,
    exportPNG: exportPNG,
    loadProjectById: loadProjectById,
    saveNow: saveNow,
    setTool: setTool,
    openComposer: openComposer,
    closeComposer: closeComposer,
    applyComposer: applyComposer,
    composer: composer
  };

  init();
})();
