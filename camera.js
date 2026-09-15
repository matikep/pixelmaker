(() => {
  const video = document.getElementById('video');
  const activateBtn = document.getElementById('activateCameraBtn');
  const shutterBtn = document.getElementById('shutterBtn');
  const cameraControls = document.getElementById('cameraControls');
  const cameraError = document.getElementById('cameraError');
  const flash = document.getElementById('flash');
  const filmstrip = document.getElementById('filmstrip');
  const resetBtn = document.getElementById('resetBtn');
  const chromeShutterBtns = [...document.querySelectorAll('.gb-shutter-btn')];

  const MAX_SHOTS = 30;
  let stream = null;
  let rafId = null;
  let active = false;
  let appliedDefaultLook = false;
  const shots = [];

  function showError(msg) {
    cameraError.textContent = msg;
    cameraError.hidden = false;
  }

  function applyDefaultLook() {
    if (appliedDefaultLook) return;
    appliedDefaultLook = true;
    PM.clickPalette('gameboy');
    if (!PM.isEffectActive('dither')) PM.clickEffect('dither');
  }

  function loop() {
    if (!active) return;
    PM.render();
    rafId = requestAnimationFrame(loop);
  }

  async function activate() {
    cameraError.hidden = true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showError('La cámara necesita un contexto seguro: abrí esta carpeta con un servidor local (por ejemplo "python3 -m http.server" y entrá a http://localhost:8000) o publicalo por https. Abrir el archivo directamente (file://) no alcanza.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (err) {
      showError('No se pudo acceder a la cámara: ' + err.message);
      return;
    }
    video.srcObject = stream;
    await video.play();
    applyDefaultLook();
    PM.setSource(video);
    resetBtn.disabled = false;
    active = true;
    activateBtn.hidden = true;
    cameraControls.hidden = false;
    chromeShutterBtns.forEach(btn => btn.classList.add('gb-armed'));
    loop();
  }

  function stop() {
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
    activateBtn.hidden = false;
    cameraControls.hidden = true;
    chromeShutterBtns.forEach(btn => btn.classList.remove('gb-armed'));
  }

  function capture() {
    flash.classList.add('flash-active');
    setTimeout(() => flash.classList.remove('flash-active'), 150);
    const url = PM.canvas.toDataURL('image/png');
    shots.unshift(url);
    if (shots.length > MAX_SHOTS) shots.pop();
    renderFilmstrip();
  }

  function renderFilmstrip() {
    filmstrip.innerHTML = '';
    filmstrip.hidden = shots.length === 0;
    shots.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Foto ${shots.length - i}`;
      img.title = 'Descargar';
      img.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `gbcam-${shots.length - i}.png`;
        a.click();
      });
      filmstrip.appendChild(img);
    });
  }

  activateBtn.addEventListener('click', activate);
  shutterBtn.addEventListener('click', capture);
  chromeShutterBtns.forEach(btn => btn.addEventListener('click', () => { if (active) capture(); }));

  PM.onExitCamera = stop;
  PM.onResetCamera = stop;
})();
