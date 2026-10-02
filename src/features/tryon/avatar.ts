/** Mannequin-style avatar on a 600x800 logical canvas (no faces, no real people). */
export const STAGE_W = 600;
export const STAGE_H = 800;

export const SKIN_TONES = ['#F3D7C2', '#E2B48F', '#C68A5E', '#8D5A3B', '#5A3825'];

/** Half-widths in logical px. Labeled by shape only. */
export const AVATAR_SHAPES = {
  slim: { label: 'Avatar 1', shoulder: 72, waist: 52, hip: 64 },
  average: { label: 'Avatar 2', shoulder: 80, waist: 62, hip: 76 },
  curvy: { label: 'Avatar 3', shoulder: 78, waist: 60, hip: 94 },
  broad: { label: 'Avatar 4', shoulder: 94, waist: 76, hip: 80 },
} as const;
export type AvatarShape = keyof typeof AVATAR_SHAPES;

const LEG_LENGTH = { petite: 240, regular: 272, tall: 300 } as const;

const CX = 300;
const SHOULDER_Y = 215;
const WAIST_Y = 375;
const HIP_Y = 470;
const BASE_LAYER = '#A3A7AD';

export interface Anchor {
  cx: number;
  shoulderY: number;
  shoulderSpan: number;
  waistY: number;
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  opts: { shape: AvatarShape; skin: number; height: 'petite' | 'regular' | 'tall' },
): Anchor {
  const { shoulder, waist, hip } = AVATAR_SHAPES[opts.shape] ?? AVATAR_SHAPES.average;
  const skin = SKIN_TONES[opts.skin] ?? SKIN_TONES[2];
  const leg = LEG_LENGTH[opts.height] ?? LEG_LENGTH.regular;

  const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  bg.addColorStop(0, '#F4F1EC');
  bg.addColorStop(1, '#E4DFD7');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(CX, HIP_Y + leg + 12, hip + 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = skin;
  ctx.lineWidth = hip * 0.78;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + s * hip * 0.46, HIP_Y - 10);
    ctx.lineTo(CX + s * hip * 0.34, HIP_Y + leg);
    ctx.stroke();
  }

  const handX = Math.max(shoulder + 22, hip + 18);
  ctx.lineWidth = 30;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + s * (shoulder - 4), SHOULDER_Y + 14);
    ctx.lineTo(CX + s * handX, HIP_Y - 10);
    ctx.stroke();
  }

  ctx.fillStyle = skin;
  ctx.fillRect(CX - 20, 150, 40, 70);
  ctx.beginPath();
  ctx.ellipse(CX, 112, 50, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,30,25,0.85)';
  ctx.beginPath();
  ctx.ellipse(CX, 86, 54, 40, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(CX - 24, SHOULDER_Y - 30);
  ctx.quadraticCurveTo(CX - shoulder, SHOULDER_Y - 14, CX - shoulder, SHOULDER_Y + 16);
  ctx.quadraticCurveTo(CX - waist - 6, WAIST_Y - 60, CX - waist, WAIST_Y);
  ctx.quadraticCurveTo(CX - hip, HIP_Y - 50, CX - hip, HIP_Y);
  ctx.lineTo(CX + hip, HIP_Y);
  ctx.quadraticCurveTo(CX + hip, HIP_Y - 50, CX + waist, WAIST_Y);
  ctx.quadraticCurveTo(CX + waist + 6, WAIST_Y - 60, CX + shoulder, SHOULDER_Y + 16);
  ctx.quadraticCurveTo(CX + shoulder, SHOULDER_Y - 14, CX + 24, SHOULDER_Y - 30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = BASE_LAYER;
  ctx.beginPath();
  ctx.moveTo(CX - shoulder * 0.6, SHOULDER_Y - 6);
  ctx.quadraticCurveTo(CX, SHOULDER_Y + 40, CX + shoulder * 0.6, SHOULDER_Y - 6);
  ctx.quadraticCurveTo(CX + waist + 8, WAIST_Y - 70, CX + waist, WAIST_Y);
  ctx.quadraticCurveTo(CX + hip, HIP_Y - 50, CX + hip + 2, HIP_Y + 60);
  ctx.lineTo(CX + 6, HIP_Y + 60);
  ctx.lineTo(CX, HIP_Y + 20);
  ctx.lineTo(CX - 6, HIP_Y + 60);
  ctx.lineTo(CX - hip - 2, HIP_Y + 60);
  ctx.quadraticCurveTo(CX - hip, HIP_Y - 50, CX - waist, WAIST_Y);
  ctx.quadraticCurveTo(CX - waist - 8, WAIST_Y - 70, CX - shoulder * 0.6, SHOULDER_Y - 6);
  ctx.closePath();
  ctx.fill();

  return { cx: CX, shoulderY: SHOULDER_Y, shoulderSpan: shoulder * 2, waistY: WAIST_Y };
}
