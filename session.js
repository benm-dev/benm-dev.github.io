(() => {
  const workspace = document.getElementById("workspace");
  const stage = document.getElementById("stage");
  const help = document.getElementById("help");
  const clockEl = document.getElementById("clock");
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d", { alpha: true });

  const windows = [
    {
      id: "about",
      title: "about · Benjamin Marshall",
      x: 56, y: 48, w: 360,
      html: `
        <h1>Benjamin Marshall</h1>
        <p>Sydney. I build remote workstations, declarative hosts, and tools that stay quiet until you need them.</p>
        <p>Most of the work is private. This page is a fake compositor session — drag it around.</p>
        <div class="chiprow">
          <span class="chip mono">Rust</span>
          <span class="chip mono">Swift</span>
          <span class="chip mono">Nix</span>
          <span class="chip mono">Wayland</span>
          <span class="chip mono">TS</span>
        </div>`
    },
    {
      id: "focus",
      title: "focus · surfaces",
      x: 460, y: 64, w: 340,
      html: `
        <h3>Remote workstation</h3>
        <p>Low-latency streaming + input for Fold-class devices. Native feel over the wire.</p>
        <h3>Declarative systems</h3>
        <p>Hosts that rebuild clean. Desktops that do not accumulate snowflake state.</p>
        <h3>Product tools</h3>
        <p>Local-first ops tools for floors that cannot wait on a spinner.</p>`
    },
    {
      id: "boot",
      title: "journalctl · session",
      x: 120, y: 320, w: 420,
      html: `<pre class="log mono" id="bootlog"></pre>`
    },
    {
      id: "curl",
      title: "hint · terminal card",
      x: 580, y: 340, w: 320,
      html: `
        <h3>Prefer terminals?</h3>
        <p>This site ships a truecolor ANSI card. No JS. No tracking. Just bytes.</p>
        <pre class="log mono">curl -sL https://benm-dev.github.io/card</pre>
        <p>Or open the profile README — same energy, less chrome.</p>`
    }
  ];

  const bootLines = [
    { t: 0, s: '<span class="hi">::</span> mounting workspace overlay' },
    { t: 280, s: '<span class="ok">ok</span>   pointer seat attached' },
    { t: 520, s: '<span class="ok">ok</span>   virtual output 2880×1600@120' },
    { t: 760, s: '<span class="hi">::</span> negotiating remote stream' },
    { t: 1100, s: '<span class="ok">ok</span>   input bridge warm' },
    { t: 1400, s: '<span class="ok">ok</span>   layout engine: tile-spiral' },
    { t: 1700, s: '<span class="hi">::</span> identity: benm-dev@sydney' },
    { t: 2000, s: '<span class="ok">ok</span>   session ready — drag a window' }
  ];

  let z = 10;
  let scale = 1;
  const nodes = new Map();

  function placeDefaults() {
    const vw = workspace.clientWidth || window.innerWidth;
    const vh = workspace.clientHeight || (window.innerHeight - 84);
    if (vw < 720) {
      windows[0].x = 16; windows[0].y = 16; windows[0].w = Math.min(360, vw - 32);
      windows[1].x = 16; windows[1].y = 250; windows[1].w = Math.min(340, vw - 32);
      windows[2].x = 16; windows[2].y = 520; windows[2].w = Math.min(400, vw - 32);
      windows[3].x = 16; windows[3].y = 720; windows[3].w = Math.min(320, vw - 32);
    } else {
      windows[0].x = Math.round(vw * 0.06);
      windows[0].y = Math.round(vh * 0.08);
      windows[1].x = Math.round(vw * 0.42);
      windows[1].y = Math.round(vh * 0.1);
      windows[2].x = Math.round(vw * 0.1);
      windows[2].y = Math.round(vh * 0.48);
      windows[3].x = Math.round(vw * 0.52);
      windows[3].y = Math.round(vh * 0.52);
    }
  }

  function focus(el) {
    document.querySelectorAll(".window").forEach(w => w.classList.remove("focused"));
    el.classList.add("focused");
    el.style.zIndex = String(++z);
  }

  function makeWindow(spec) {
    const el = document.createElement("article");
    el.className = "window";
    el.dataset.id = spec.id;
    el.style.left = spec.x + "px";
    el.style.top = spec.y + "px";
    el.style.width = spec.w + "px";
    el.innerHTML = `
      <div class="titlebar" data-drag>
        <div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="title mono">${spec.title}</div>
      </div>
      <div class="body">${spec.html}</div>`;
    workspace.appendChild(el);
    nodes.set(spec.id, el);

    const bar = el.querySelector("[data-drag]");
    let dragging = false;
    let ox = 0, oy = 0;

    const onDown = (ev) => {
      focus(el);
      dragging = true;
      const point = "touches" in ev ? ev.touches[0] : ev;
      ox = point.clientX / scale - el.offsetLeft;
      oy = point.clientY / scale - el.offsetTop;
      ev.preventDefault();
    };
    const onMove = (ev) => {
      if (!dragging) return;
      const point = "touches" in ev ? ev.touches[0] : ev;
      el.style.left = Math.round(point.clientX / scale - ox) + "px";
      el.style.top = Math.round(point.clientY / scale - oy) + "px";
    };
    const onUp = () => { dragging = false; };

    bar.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("pointerdown", () => focus(el));
    return el;
  }

  function runBoot() {
    const log = document.getElementById("bootlog");
    if (!log) return;
    log.textContent = "";
    bootLines.forEach(line => {
      setTimeout(() => {
        log.innerHTML += line.s + "\n";
      }, line.t);
    });
  }

  function tickClock() {
    const fmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    clockEl.textContent = fmt.format(new Date()) + " AEST";
  }

  const particles = Array.from({ length: 48 }, () => ({
    x: Math.random(), y: Math.random(),
    v: 0.00015 + Math.random() * 0.00045,
    s: 0.5 + Math.random() * 1.5
  }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(ts) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const y = ((ts * 0.02 + i * 110) % (h + 80)) - 40;
      const grad = ctx.createLinearGradient(0, y, w, y + 40);
      grad.addColorStop(0, "rgba(110,243,197,0)");
      grad.addColorStop(0.5, "rgba(142,182,255,0.07)");
      grad.addColorStop(1, "rgba(110,243,197,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, w, 28);
    }
    particles.forEach(p => {
      p.y += p.v * h;
      if (p.y > 1) { p.y = 0; p.x = Math.random(); }
      ctx.fillStyle = "rgba(180,200,255,0.35)";
      ctx.fillRect(p.x * w, p.y * h, p.s, p.s);
    });
    requestAnimationFrame(frame);
  }

  workspace.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    scale = Math.min(1.35, Math.max(0.75, scale + (ev.deltaY > 0 ? -0.03 : 0.03)));
    workspace.style.transform = `scale(${scale})`;
  }, { passive: false });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "?") {
      help.hidden = !help.hidden;
      help.classList.toggle("hidden", help.hidden);
    }
    if (ev.key === "Escape") {
      help.hidden = true;
      help.classList.add("hidden");
    }
    if (ev.key === "f") {
      stage.classList.add("flash");
      setTimeout(() => stage.classList.remove("flash"), 450);
    }
    const idx = "1234".indexOf(ev.key);
    if (idx >= 0) {
      const el = nodes.get(windows[idx].id);
      if (el) focus(el);
    }
  });

  placeDefaults();
  windows.forEach((w, i) => {
    const el = makeWindow(w);
    if (i === 0) focus(el);
  });
  runBoot();
  tickClock();
  setInterval(tickClock, 1000);
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);

  if (window.matchMedia("(max-width: 720px)").matches) {
    help.hidden = false;
    help.classList.remove("hidden");
    setTimeout(() => {
      help.hidden = true;
      help.classList.add("hidden");
    }, 3200);
  }
})();
