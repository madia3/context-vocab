// 초경량 고성능 캔버스 Confetti (단일 오버레이 캔버스 재사용으로 DOM 생성/레이아웃 지연 0ms)
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

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
const particles: Particle[] = [];
let animationId: number | null = null;

const COLORS = [
  '#6366f1', '#4f46e5', '#ec4899', '#f43f5e', '#10b981',
  '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#eab308'
];

function getOrCreateCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof window === 'undefined') return null;

  if (!activeCanvas || !document.body.contains(activeCanvas)) {
    activeCanvas = document.createElement('canvas');
    activeCanvas.style.position = 'fixed';
    activeCanvas.style.top = '0';
    activeCanvas.style.left = '0';
    activeCanvas.style.width = '100vw';
    activeCanvas.style.height = '100vh';
    activeCanvas.style.pointerEvents = 'none';
    activeCanvas.style.zIndex = '999999';
    document.body.appendChild(activeCanvas);
    activeCtx = activeCanvas.getContext('2d');
  }

  if (activeCanvas && activeCtx) {
    if (activeCanvas.width !== window.innerWidth || activeCanvas.height !== window.innerHeight) {
      activeCanvas.width = window.innerWidth;
      activeCanvas.height = window.innerHeight;
    }
    return { canvas: activeCanvas, ctx: activeCtx };
  }
  return null;
}

function loop() {
  if (!activeCanvas || !activeCtx) return;
  const width = activeCanvas.width;
  const height = activeCanvas.height;

  activeCtx.clearRect(0, 0, width, height);
  const gravity = 0.45;
  const drag = 0.96;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += gravity;
    p.vx *= drag;
    p.vy *= drag;
    p.rotation += p.rotSpeed;
    p.alpha -= 0.016;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    activeCtx.save();
    activeCtx.globalAlpha = Math.max(0, p.alpha);
    activeCtx.translate(p.x, p.y);
    activeCtx.rotate((p.rotation * Math.PI) / 180);
    activeCtx.fillStyle = p.color;

    if (p.shape === 'rect') {
      activeCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
    } else {
      activeCtx.beginPath();
      activeCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      activeCtx.fill();
    }
    activeCtx.restore();
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(loop);
  } else {
    animationId = null;
    activeCtx.clearRect(0, 0, width, height);
  }
}

export function fireConfetti(options?: {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
}) {
  const setup = getOrCreateCanvas();
  if (!setup) return;

  const width = setup.canvas.width;
  const height = setup.canvas.height;
  const particleCount = options?.particleCount || 60;
  const originX = (options?.origin?.x ?? 0.5) * width;
  const originY = (options?.origin?.y ?? 0.6) * height;

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 15 + 7;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 7,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 14,
      alpha: 1,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    });
  }

  if (!animationId) {
    animationId = requestAnimationFrame(loop);
  }
}
