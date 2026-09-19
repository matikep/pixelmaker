(() => {
  const video = document.getElementById('video');
  const cameraHint = document.getElementById('cameraHint');
  const cameraError = document.getElementById('cameraError');
  const flash = document.getElementById('flash');
  const filmstrip = document.getElementById('filmstrip');
  const resetBtn = document.getElementById('resetBtn');
  const selectBtn = document.getElementById('gbSelect');
  const chromeShutterBtns = [...document.querySelectorAll('.gb-shutter-btn')];

  const MAX_SHOTS = 30;
  let stream = null;
  let rafId = null;
  let active = false;
  let starting = false;
  let inCameraMode = false;
  let facingMode = 'environment';
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
    if (starting) return;
    cameraError.hidden = true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showError('La cámara necesita un contexto seguro: abrí esta carpeta con un servidor local (por ejemplo "python3 -m http.server" y entrá a http://localhost:8000) o publicalo por https. Abrir el archivo directamente (file://) no alcanza.');
      return;
    }
    starting = true;
    try {
      // "ideal" so laptops without a rear camera fall back to whatever they have
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      showError('No se pudo acceder a la cámara: ' + err.message);
      return;
    } finally {
      starting = false;
    }
    applyDefaultLook();
    PM.setSource(video);
    resetBtn.disabled = false;
    active = true;
    cameraHint.hidden = true;
    loop();
  }

  function stop() {
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
    cameraHint.hidden = false;
  }

  function setArmed(armed) {
    chromeShutterBtns.forEach(btn => btn.classList.toggle('gb-armed', armed));
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
      img.addEventListener('click', () => PM.saveImage(url, `gbcam-${shots.length - i}.png`));
      filmstrip.appendChild(img);
    });
  }

  function onShutter() {
    if (!inCameraMode) return;
    if (active) capture();
    else activate();
  }

  function flipCamera() {
    if (!inCameraMode) return;
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    if (active) { stop(); activate(); }
  }

  chromeShutterBtns.forEach(btn => btn.addEventListener('click', onShutter));
  selectBtn.addEventListener('click', flipCamera);

  PM.onEnterCamera = () => { inCameraMode = true; setArmed(true); };
  PM.onExitCamera = () => { inCameraMode = false; setArmed(false); stop(); };
  PM.onResetCamera = stop;
})();
