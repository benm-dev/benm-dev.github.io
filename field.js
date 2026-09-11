(() => {
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const signal = document.getElementById('signal');
  const sctx = signal.getContext('2d');
  const seedline = document.getElementById('seedline');
  const clockEl = document.getElementById('clock');
  const fpsEl = document.getElementById('fps');
  const typesEl = document.getElementById('types');

  let w = 0, h = 0, dpr = 1;
  let mx = 0.72, my = 0.18, tmx = mx, tmy = my;
  let activity = null;
  let last = performance.now(), frames = 0, fps = 0;

  // lightweight value-noise from hash
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0), b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 5; i++) {
      v += a * noise(x * f, y * f);
      a *= 0.5; f *= 2.05;
    }
    return v;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sw = signal.parentElement.clientWidth - 8;
    signal.width = Math.floor(sw * dpr);
    signal.height = Math.floor(120 * dpr);
    signal.style.width = sw + 'px';
    signal.style.height = '120px';
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSignal(time) {
    if (!activity) return;
    const sw = signal.clientWidth, sh = 120;
    sctx.clearRect(0, 0, sw, sh);
    const series = activity.series;
    const mxv = activity.max || 1;
    const n = series.length;
    // density bars
    for (let i = 0; i < n; i++) {
      const t = series[i] / mxv;
      const x = (i + 0.5) / n * sw;
      const bh = 10 + t * (sh - 28);
      const y = sh - 8 - bh;
      sctx.fillStyle = `rgba(142,182,255,${0.08 + t * 0.55})`;
      sctx.fillRect(x - (2 + t * 4), y, 4 + t * 8, bh);
    }
    // waveform
    sctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = series[i] / mxv;
      const x = (i + 0.5) / n * sw;
      const y = sh - 8 - (10 + t * (sh - 28));
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.strokeStyle = `rgba(110,243,197,${0.65 + 0.35 * Math.sin(time / 400)})`;
    sctx.lineWidth = 2;
    sctx.stroke();
    // playhead
    const ph = ((time / 40) % sw);
    sctx.fillStyle = 'rgba(255,255,255,0.12)';
    sctx.fillRect(ph, 0, 2, sh);
  }

  function frame(now) {
    frames++;
    if (now - last > 500) {
      fps = Math.round(frames * 1000 / (now - last));
      fpsEl.textContent = String(fps);
      frames = 0; last = now;
    }
    mx += (tmx - mx) * 0.04;
    my += (tmy - my) * 0.04;

    const t = now * 0.00008;
    // low-res field then scale for perf
    const step = Math.max(3, Math.floor(Math.min(w, h) / 220));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const nx = x / w, ny = y / h;
        let v = fbm(nx * 3.2 + t, ny * 2.4 - t * 0.6);
        const dx = nx - mx, dy = ny - my;
        const light = Math.exp(-(dx * dx * 6 + dy * dy * 9));
        v = v * 0.75 + light * 0.55;
        const r = 6 + v * 50 + light * 40;
        const g = 10 + v * 80 + light * 35;
        const b = 18 + v * 150 + light * 60;
        ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
        ctx.fillRect(x, y, step, step);
      }
    }
    // scan
    const sy = ((now * 0.04) % (h + 60)) - 30;
    const grd = ctx.createLinearGradient(0, sy, 0, sy + 50);
    grd.addColorStop(0, 'rgba(142,182,255,0)');
    grd.addColorStop(0.5, 'rgba(142,182,255,0.07)');
    grd.addColorStop(1, 'rgba(110,243,197,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, sy, w, 50);

    drawSignal(now);
    requestAnimationFrame(frame);
  }

  function tickClock() {
    clockEl.textContent = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());
  }

  window.addEventListener('pointermove', (e) => {
    tmx = e.clientX / innerWidth;
    tmy = e.clientY / innerHeight;
  });
  window.addEventListener('resize', resize);

  fetch('activity.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      activity = data;
      seedline.textContent = 'seed ' + data.seed.slice(0, 24) + '…';
      typesEl.innerHTML = (data.top_types || []).map(([k, v]) =>
        `<span>${k.replace('Event','')} ${v}</span>`).join('');
    })
    .catch(() => { seedline.textContent = 'seed unavailable'; });

  resize();
  tickClock();
  setInterval(tickClock, 1000);
  requestAnimationFrame(frame);
})();
