export const drawRoundedRect = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

export const getContrastColor = (hexColor: string) => {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#ffffff';
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

export const wrapText = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const value = (text || '').trim();
  if (!value) return [];

  const lines: string[] = [];
  const pushLineToCheck = (line: string) => {
    if (!line) return;
    if (ctx.measureText(line).width <= maxWidth) {
      lines.push(line);
      return;
    }

    let current = '';
    for (const char of Array.from(line)) {
      const test = current + char;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  };

  const words = value.split(/\s+/);
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; i += 1) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      pushLineToCheck(currentLine);
      currentLine = words[i];
    }
  }
  pushLineToCheck(currentLine);

  return lines;
};
