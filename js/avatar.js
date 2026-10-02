/*
 * Mannequin-style avatar drawn on a 600x800 logical canvas. Returns the
 * shoulder anchor the stage uses to place garments on it.
 */
(function (root) {
  'use strict';

  const SKIN_TONES = ['#F3D7C2', '#E2B48F', '#C68A5E', '#8D5A3B', '#5A3825'];

  // Half-widths in logical px.
  const SHAPES = {
    slim: { label: 'Slim', shoulder: 72, waist: 52, hip: 64 },
    average: { label: 'Average', shoulder: 80, waist: 62, hip: 76 },
    curvy: { label: 'Curvy', shoulder: 78, waist: 60, hip: 94 },
    broad: { label: 'Broad', shoulder: 94, waist: 76, hip: 80 },
  };

  const LEG_LENGTH = { petite: 240, regular: 272, tall: 300 };

  const CX = 300;
  const SHOULDER_Y = 215;
  const WAIST_Y = 375;
  const HIP_Y = 470;
  const BASE_LAYER = '#A3A7AD';

  function drawAvatar(ctx, opts) {
    const shape = SHAPES[opts.shape] || SHAPES.average;
    const skin = SKIN_TONES[opts.skin] || SKIN_TONES[2];
    const leg = LEG_LENGTH[opts.height] || LEG_LENGTH.regular;
    const { shoulder, waist, hip } = shape;

    const bg = ctx.createLinearGradient(0, 0, 0, 800);
    bg.addColorStop(0, '#F4F1EC');
    bg.addColorStop(1, '#E4DFD7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 600, 800);

    // Floor shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(CX, HIP_Y + leg + 12, hip + 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs
    ctx.strokeStyle = skin;
    ctx.lineWidth = hip * 0.78;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(CX + s * hip * 0.46, HIP_Y - 10);
      ctx.lineTo(CX + s * hip * 0.34, HIP_Y + leg);
      ctx.stroke();
    });

    // Arms hang just outside whichever is wider: shoulders or hips.
    const handX = Math.max(shoulder + 22, hip + 18);
    ctx.lineWidth = 30;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(CX + s * (shoulder - 4), SHOULDER_Y + 14);
      ctx.lineTo(CX + s * handX, HIP_Y - 10);
      ctx.stroke();
    });

    // Neck + head
    ctx.fillStyle = skin;
    ctx.fillRect(CX - 20, 150, 40, 70);
    ctx.beginPath();
    ctx.ellipse(CX, 112, 50, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,30,25,0.85)';
    ctx.beginPath();
    ctx.ellipse(CX, 86, 54, 40, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Torso
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

    // Neutral base layer (tank + shorts) so the avatar reads as a mannequin.
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

    return { cx: CX, shoulderY: SHOULDER_Y, shoulderSpan: shoulder * 2 };
  }

  root.Avatar = { SKIN_TONES, SHAPES, drawAvatar };
})(typeof self !== 'undefined' ? self : this);
