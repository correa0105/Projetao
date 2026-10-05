export function drawTurnEffect(c: CanvasRenderingContext2D, radius: number, next: boolean) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
    angle = reduced ? 0 : Date.now() / 6500;
  c.save();
  c.rotate(next ? -angle * 0.6 : angle);
  c.globalAlpha *= next ? 0.38 : 0.88;
  c.strokeStyle = next ? '#e5c35c' : '#9ce5f3';
  c.shadowColor = c.strokeStyle;
  c.shadowBlur = radius * 0.13;
  c.lineWidth = Math.max(1, radius * 0.016);
  for (const factor of [1, 1.12, 1.19]) {
    c.beginPath();
    c.arc(0, 0, radius * factor, 0, Math.PI * 2);
    c.stroke();
  }
  for (let triangle = 0; triangle < 2; triangle++) {
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 + triangle * Math.PI;
      const x = Math.cos(a) * radius,
        y = Math.sin(a) * radius;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    c.save();
    c.rotate((i * Math.PI) / 6);
    c.translate(radius * 1.055, 0);
    c.beginPath();
    c.moveTo(-radius * 0.028, -radius * 0.035);
    c.lineTo(radius * 0.028, radius * 0.035);
    c.moveTo(-radius * 0.02, radius * 0.025);
    c.lineTo(radius * 0.018, -radius * 0.025);
    c.stroke();
    c.restore();
  }
  c.restore();
}
