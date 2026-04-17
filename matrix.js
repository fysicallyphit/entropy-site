(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'matrix-bg';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '0',
  });
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const FONT_SIZE = 13;
  const CHARS = '01∑∆π√≠±×10110010101001011010001101001';
  const MOUSE_RADIUS = 200;

  let cols, drops, speeds, mouse = { x: -9999, y: -9999 };

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / FONT_SIZE);
    drops = Array.from({ length: cols }, () => Math.random() * -(canvas.height / FONT_SIZE));
    speeds = Array.from({ length: cols }, () => 0.2 + Math.random() * 0.5);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  resize();

  function draw() {
    // Fade trail
    ctx.fillStyle = 'rgba(26,26,23,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;

    for (let i = 0; i < cols; i++) {
      const x = i * FONT_SIZE + FONT_SIZE / 2;
      const y = drops[i] * FONT_SIZE;

      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximity = Math.max(0, 1 - dist / MOUSE_RADIUS);

      // Skip drawing if far from mouse and randomly sparse
      if (proximity < 0.05 && Math.random() > 0.35) {
        drops[i] += speeds[i];
        if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.97) {
          drops[i] = -Math.floor(Math.random() * 20);
        }
        continue;
      }

      const char = CHARS[Math.floor(Math.random() * CHARS.length)];

      // Head glow at full proximity
      if (proximity > 0.75) {
        ctx.fillStyle = `rgba(226,226,218,${0.6 + proximity * 0.4})`;
      } else if (proximity > 0.35) {
        ctx.fillStyle = `rgba(166,162,153,${0.3 + proximity * 0.5})`;
      } else if (proximity > 0.05) {
        ctx.fillStyle = `rgba(118,115,111,${0.15 + proximity * 0.4})`;
      } else {
        ctx.fillStyle = 'rgba(69,67,66,0.25)';
      }

      ctx.fillText(char, x, y);

      // Bright leading character
      if (Math.random() > 0.95) {
        ctx.fillStyle = `rgba(226,226,218,${proximity > 0.3 ? 0.9 : 0.12})`;
        ctx.fillText(char, x, y);
      }

      drops[i] += speeds[i] * (1 + proximity * 3);

      if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.97) {
        drops[i] = -Math.floor(Math.random() * 20);
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
