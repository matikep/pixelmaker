const PM = {};

(() => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const modeTabs = document.getElementById('modeTabs');
  const imagePanel = document.getElementById('imagePanel');
  const cameraPanel = document.getElementById('cameraPanel');

  const pixelSize = document.getElementById('pixelSize');
  const colors = document.getElementById('colors');
  const brightness = document.getElementById('brightness');
  const contrast = document.getElementById('contrast');
  const saturation = document.getElementById('saturation');
  const filtersEl = document.getElementById('filters');
  const palettesEl = document.getElementById('palettes');
  const colorsField = document.getElementById('colorsField');
  const effectsEl = document.getElementById('effects');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');

  const pixelSizeVal = document.getElementById('pixelSizeVal');
  const colorsVal = document.getElementById('colorsVal');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrastVal = document.getElementById('contrastVal');
  const saturationVal = document.getElementById('saturationVal');

  let activeFilter = 'none';
  let activePalette = 'none';
  const activeEffects = new Set();

  const PALETTES = {
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    pico8: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
            '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'],
    cga: ['#000000', '#55FFFF', '#FF55FF', '#FFFFFF'],
    c64: ['#000000', '#FFFFFF', '#880000', '#AAFFEE', '#CC44CC', '#00CC55', '#0000AA', '#EEEE77',
          '#DD8855', '#664400', '#FF7777', '#333333', '#777777', '#AAFF66', '#0088FF', '#BBBBBB'],
    mono: ['#000000', '#FFFFFF'],
  };
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const PALETTE_RGB = Object.fromEntries(
    Object.entries(PALETTES).map(([k, v]) => [k, v.map(hexToRgb)])
  );

  const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function ditherOffset(x, y) {
    return BAYER4[y % 4][x % 4] / 16 - 0.5;
  }

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  const small = document.createElement('canvas');
  const smallCtx = small.getContext('2d');

  function sourceSize(el) {
    if (el instanceof HTMLVideoElement) return [el.videoWidth, el.videoHeight];
    return [el.naturalWidth, el.naturalHeight];
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => {
      dropzone.style.display = 'none';
      resetBtn.disabled = false;
      PM.setSource(img);
    };
    img.src = URL.createObjectURL(file);
  }

  function filterString() {
    const b = brightness.value, c = contrast.value, s = saturation.value;
    let base = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    if (activeFilter === 'grayscale') base += ' grayscale(1)';
    if (activeFilter === 'sepia') base += ' sepia(1)';
    if (activeFilter === 'invert') base += ' invert(1)';
    return base;
  }

  function nearestPaletteColor(r, g, b, palette) {
    let best = palette[0], bestDist = Infinity;
    for (const [pr, pg, pb] of palette) {
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
    }
    return best;
  }

  function quantize(imageData, width, levels, palette, ditherOn) {
    const d = imageData.data;
    const step = 255 / (Math.max(2, levels) - 1);
    for (let i = 0; i < d.length; i += 4) {
      const px = i / 4;
      const x = px % width;
      const y = Math.floor(px / width);
      const offset = ditherOn ? ditherOffset(x, y) : 0;

      if (palette) {
        const dv = offset * 40;
        const r = Math.min(255, Math.max(0, d[i] + dv));
        const g = Math.min(255, Math.max(0, d[i + 1] + dv));
        const b = Math.min(255, Math.max(0, d[i + 2] + dv));
        const [nr, ng, nb] = nearestPaletteColor(r, g, b, palette);
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      } else if (levels < 32) {
        const dv = offset * step;
        d[i]     = Math.min(255, Math.max(0, Math.round(Math.round((d[i]     + dv) / step) * step)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(Math.round((d[i + 1] + dv) / step) * step)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(Math.round((d[i + 2] + dv) / step) * step)));
      }
    }
  }

  function applyAberration(ctx, w, h, shift) {
    const data = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(data.data);
    const d = data.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const ri = (y * w + Math.max(0, x - shift)) * 4;
        const bi = (y * w + Math.min(w - 1, x + shift)) * 4;
        d[i] = src[ri];
        d[i + 2] = src[bi + 2];
      }
    }
    ctx.putImageData(data, 0, 0);
  }

  function drawGrid(ctx, w, h, size) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += size) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += size) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
  }

  function drawScanlines(ctx, w, h, size) {
    const gap = Math.max(2, Math.floor(size / 3));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let y = 0; y < h; y += gap) ctx.fillRect(0, y, w, 1);
  }

  function render() {
    const source = PM.source;
    if (!source) return;
    const [w, h] = sourceSize(source);
    if (!w || !h) return;

    if (offscreen.width !== w || offscreen.height !== h) {
      offscreen.width = w;
      offscreen.height = h;
    }
    offCtx.clearRect(0, 0, w, h);
    offCtx.drawImage(source, 0, 0, w, h);

    const size = Number(pixelSize.value);
    const smallW = Math.max(1, Math.round(w / size));
    const smallH = Math.max(1, Math.round(h / size));

    if (small.width !== smallW || small.height !== smallH) {
      small.width = smallW;
      small.height = smallH;
    }
    smallCtx.imageSmoothingEnabled = true;
    smallCtx.filter = filterString();
    smallCtx.clearRect(0, 0, smallW, smallH);
    smallCtx.drawImage(offscreen, 0, 0, w, h, 0, 0, smallW, smallH);

    const imageData = smallCtx.getImageData(0, 0, smallW, smallH);
    const palette = activePalette === 'none' ? null : PALETTE_RGB[activePalette];
    quantize(imageData, smallW, Number(colors.value), palette, activeEffects.has('dither'));
    smallCtx.putImageData(imageData, 0, 0);

    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, w, h);

    if (activeEffects.has('aberration')) applyAberration(ctx, w, h, Math.max(1, Math.round(size / 3)));
    if (activeEffects.has('scanlines')) drawScanlines(ctx, w, h, size);
    if (activeEffects.has('grid')) drawGrid(ctx, w, h, size);
  }

  PM.canvas = canvas;
  PM.source = null;
  PM.render = render;
  PM.clickPalette = (name) => palettesEl.querySelector(`button[data-palette="${name}"]`)?.click();
  PM.clickEffect = (name) => effectsEl.querySelector(`button[data-effect="${name}"]`)?.click();
  PM.isEffectActive = (name) => activeEffects.has(name);

  PM.setSource = (el) => {
    PM.source = el;
    canvas.style.display = 'block';
    downloadBtn.disabled = false;
    render();
  };

  PM.clearSource = () => {
    PM.source = null;
    canvas.style.display = 'none';
    downloadBtn.disabled = true;
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => loadImage(e.target.files[0]));

  ['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
  );
  dropzone.addEventListener('drop', (e) => loadImage(e.dataTransfer.files[0]));

  [pixelSize, colors, brightness, contrast, saturation].forEach(input => {
    input.addEventListener('input', () => {
      pixelSizeVal.textContent = pixelSize.value;
      colorsVal.textContent = colors.value;
      brightnessVal.textContent = brightness.value + '%';
      contrastVal.textContent = contrast.value + '%';
      saturationVal.textContent = saturation.value + '%';
      render();
    });
  });

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    [...filtersEl.children].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  palettesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-palette]');
    if (!btn) return;
    activePalette = btn.dataset.palette;
    [...palettesEl.children].forEach(b => b.classList.toggle('active', b === btn));
    colorsField.classList.toggle('disabled', activePalette !== 'none');
    render();
  });

  effectsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-effect]');
    if (!btn) return;
    const effect = btn.dataset.effect;
    if (activeEffects.has(effect)) { activeEffects.delete(effect); btn.classList.remove('active'); }
    else { activeEffects.add(effect); btn.classList.add('active'); }
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'pixelart.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  resetBtn.addEventListener('click', () => {
    PM.onResetCamera?.();
    PM.clearSource();
    fileInput.value = '';
    dropzone.style.display = 'block';
    resetBtn.disabled = true;

    activeFilter = 'none';
    activePalette = 'none';
    activeEffects.clear();
    [...filtersEl.children].forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
    [...palettesEl.children].forEach(b => b.classList.toggle('active', b.dataset.palette === 'none'));
    [...effectsEl.children].forEach(b => b.classList.remove('active'));
    colorsField.classList.remove('disabled');
  });

  function setMode(mode) {
    const btn = modeTabs.querySelector(`button[data-mode="${mode}"]`);
    if (!btn) return;
    [...modeTabs.children].forEach(b => b.classList.toggle('active', b === btn));
    imagePanel.hidden = mode !== 'image';
    cameraPanel.hidden = mode !== 'camera';
    canvas.style.display = PM.source ? 'block' : 'none';
    if (mode === 'camera') {
      PM.onEnterCamera?.();
    } else {
      PM.onExitCamera?.();
    }
  }

  modeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  const MODES = ['image', 'camera'];
  function cycleMode(delta) {
    const current = modeTabs.querySelector('button.active')?.dataset.mode ?? 'image';
    const next = MODES[(MODES.indexOf(current) + delta + MODES.length) % MODES.length];
    setMode(next);
  }
  document.getElementById('dpadLeft').addEventListener('click', () => cycleMode(-1));
  document.getElementById('dpadRight').addEventListener('click', () => cycleMode(1));

  const pixelControlsPanel = document.getElementById('pixelControls');
  const settingsFab = document.getElementById('settingsFab');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const sheetCloseBtn = document.getElementById('sheetCloseBtn');

  function openSheet() {
    pixelControlsPanel.classList.add('open');
    sheetBackdrop.hidden = false;
    settingsFab.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    pixelControlsPanel.classList.remove('open');
    sheetBackdrop.hidden = true;
    settingsFab.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  settingsFab.addEventListener('click', () => {
    pixelControlsPanel.classList.contains('open') ? closeSheet() : openSheet();
  });
  sheetBackdrop.addEventListener('click', closeSheet);
  sheetCloseBtn.addEventListener('click', closeSheet);
})();
