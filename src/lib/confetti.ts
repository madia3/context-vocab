// 가볍고 화려한 브라우저 네이티브 Canvas Confetti (폭죽 효과)
export function fireConfetti(options?: {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
}) {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = [
    '#6366f1', '#4f46e5', '#ec4899', '#f43f5e', '#10b981',
    '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#eab308'
  ];

  const particleCount = options?.particleCount || 70;
  const originX = (options?.origin?.x ?? 0.5) * width;
  const originY = (options?.origin?.y ?? 0.6) * height;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotSpeed: number;
    alpha: number;
    shape: 'rect' | 'circle';
  }

  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 14 + 6;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6, // 위로 솟구치게
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      alpha: 1,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    });
  }

  let animationId: number;
  const gravity = 0.4;
  const drag = 0.96;

  function update() {
    ctx!.clearRect(0, 0, width, height);
    let aliveCount = 0;

    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.015;

      if (p.alpha > 0) {
        aliveCount++;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.alpha);
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }
    }

    if (aliveCount > 0) {
      animationId = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(animationId);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    }
  }

  animationId = requestAnimationFrame(update);
}
