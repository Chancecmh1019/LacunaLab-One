import { ProjectData } from '../types';
import { FONT_STACK } from './layoutPresets';
import { drawRoundedRect, getContrastColor, wrapText } from './canvasUtils';

type DrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type TextFit = {
  fontSize: number;
  lines: string[];
};

const setLetterSpacing = (ctx: DrawContext, value: string) => {
  (ctx as any).letterSpacing = value;
};

const fitWrappedText = (
  ctx: DrawContext,
  text: string,
  maxWidth: number,
  maxLines: number,
  maxFontSize: number,
  minFontSize: number,
  weight: string,
  fontFamily = FONT_STACK
): TextFit => {
  const value = String(text || '').trim();
  if (!value) return { fontSize: maxFontSize, lines: [] };

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, value, maxWidth);
    if (lines.length <= maxLines) return { fontSize, lines };
  }

  ctx.font = `${weight} ${minFontSize}px ${fontFamily}`;
  const wrapped = wrapText(ctx, value, maxWidth);
  if (wrapped.length <= maxLines) return { fontSize: minFontSize, lines: wrapped };

  const lines = wrapped.slice(0, maxLines);
  let last = lines[maxLines - 1] || '';
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  lines[maxLines - 1] = `${last}…`;
  return { fontSize: minFontSize, lines };
};

const getPortraitGeometry = (width: number, height: number) => {
  const scaleX = width / 1080;
  const scaleY = height / 1920;
  const unit = Math.min(scaleX, scaleY);

  return {
    unit,
    coverSize: 640 * unit,
    coverTop: 82 * scaleY,
    coverCenterX: width * 0.5,
    titleTop: 790 * scaleY,
    titleMaxWidth: 900 * scaleX,
    titleMaxHeight: 194 * scaleY,
    artistY: 1028 * scaleY,
    albumY: 1076 * scaleY,
    dividerY: 1122 * scaleY,
    lyricPanelLeft: 58 * scaleX,
    lyricPanelTop: 1160 * scaleY,
    lyricPanelRight: 952 * scaleX,
    lyricPanelBottom: 1634 * scaleY,
    lyricTextLeft: 98 * scaleX,
    lyricTextRight: 900 * scaleX,
  };
};

export const drawCdBookletPortraitHeader = (
  ctx: DrawContext,
  project: ProjectData,
  coverImage: CanvasImageSource | null,
  shadowIntensity = 1
) => {
  const { width, height } = ctx.canvas;
  const g = getPortraitGeometry(width, height);
  const coverVisible = Boolean(project.theme.layout.cover.visible && coverImage);

  if (coverVisible && coverImage) {
    const coverX = g.coverCenterX - g.coverSize / 2;
    const coverY = g.coverTop;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.52)';
    ctx.shadowBlur = 34 * g.unit * shadowIntensity;
    ctx.shadowOffsetY = 14 * g.unit;
    drawRoundedRect(ctx, coverX, coverY, g.coverSize, g.coverSize, 28 * g.unit);
    ctx.clip();
    ctx.drawImage(coverImage, coverX, coverY, g.coverSize, g.coverSize);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, 1.4 * g.unit);
    drawRoundedRect(ctx, coverX, coverY, g.coverSize, g.coverSize, 28 * g.unit);
    ctx.stroke();
    ctx.restore();
  }

  const metadataTitleTop = coverVisible ? g.titleTop : height * 0.28;
  const titleFit = fitWrappedText(
    ctx,
    project.metadata.title || '',
    g.titleMaxWidth,
    2,
    92 * g.unit,
    62 * g.unit,
    '800'
  );
  const titleLineHeight = titleFit.fontSize * 1.08;
  const titleBlockHeight = titleFit.lines.length * titleLineHeight;
  const titleStartY = metadataTitleTop + Math.max(0, (g.titleMaxHeight - titleBlockHeight) / 2) + titleFit.fontSize;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.48)';
  ctx.shadowBlur = 12 * g.unit * shadowIntensity;
  ctx.font = `800 ${titleFit.fontSize}px ${FONT_STACK}`;
  setLetterSpacing(ctx, '0.4px');
  titleFit.lines.forEach((line, index) => {
    ctx.fillText(line, width * 0.5, titleStartY + index * titleLineHeight, g.titleMaxWidth);
  });

  const artistFit = fitWrappedText(
    ctx,
    project.metadata.artist || '',
    820 * (width / 1080),
    1,
    32 * g.unit,
    24 * g.unit,
    '700'
  );
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = project.theme.secondaryColor || '#ffffff';
  ctx.font = `700 ${artistFit.fontSize}px ${FONT_STACK}`;
  setLetterSpacing(ctx, '3px');
  if (artistFit.lines[0]) ctx.fillText(artistFit.lines[0], width * 0.5, g.artistY, 820 * (width / 1080));

  const albumFit = fitWrappedText(
    ctx,
    project.metadata.album || '',
    820 * (width / 1080),
    1,
    28 * g.unit,
    21 * g.unit,
    '500'
  );
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 ${albumFit.fontSize}px ${FONT_STACK}`;
  setLetterSpacing(ctx, '1.8px');
  if (albumFit.lines[0]) ctx.fillText(albumFit.lines[0], width * 0.5, g.albumY, 820 * (width / 1080));
  ctx.restore();

  ctx.save();
  const dividerWidth = 660 * (width / 1080);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = Math.max(1, g.unit);
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - dividerWidth / 2, g.dividerY);
  ctx.lineTo(width * 0.5 + dividerWidth / 2, g.dividerY);
  ctx.stroke();
  ctx.restore();
};

export const drawCdBookletPortraitLyrics = (
  ctx: DrawContext,
  project: ProjectData,
  currentIndex: number,
  effectiveTime: number,
  shadowIntensity = 1
) => {
  if (currentIndex < 0 || !project.lyrics[currentIndex]) return;

  const { width, height } = ctx.canvas;
  const g = getPortraitGeometry(width, height);
  const current = project.lyrics[currentIndex];
  const next = project.lyrics[currentIndex + 1];
  const end = current.endTime ?? next?.timestamp ?? current.timestamp + 5;
  const since = effectiveTime - current.timestamp;
  const until = end - effectiveTime;
  let alpha = 1;
  if (since < 0.25) alpha = since / 0.25;
  const fadeOut = currentIndex === project.lyrics.length - 1 ? 1.5 : 0.5;
  if (until < fadeOut) alpha = Math.min(alpha, until / fadeOut);
  alpha = Math.max(0, Math.min(1, alpha));
  const yFloatOffset = (1 - alpha) * 8 * g.unit;

  const panelWidth = g.lyricPanelRight - g.lyricPanelLeft;
  const panelHeight = g.lyricPanelBottom - g.lyricPanelTop;
  const lyricMaxWidth = g.lyricTextRight - g.lyricTextLeft;
  const baseScale = Math.max(0.72, Math.min(1.25, (project.theme.layout.lyrics.scale || 1) * (project.theme.fontSizeScale || 1)));
  const style = project.theme.lyricStyle || {
    textColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 0,
    glowColor: '#000000',
    glowBlur: 0,
    fontWeight: '400',
    autoContrast: false,
  };

  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = 'rgba(8,8,8,0.23)';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 18 * g.unit;
  drawRoundedRect(ctx, g.lyricPanelLeft, g.lyricPanelTop, panelWidth, panelHeight, 30 * g.unit);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = Math.max(1, g.unit);
  ctx.stroke();

  const accent = project.theme.secondaryColor || '#ffffff';
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = accent;
  drawRoundedRect(ctx, g.lyricPanelLeft + 18 * g.unit, g.lyricPanelTop + 32 * g.unit, 5 * g.unit, 58 * g.unit, 3 * g.unit);
  ctx.fill();
  ctx.restore();

  const original = String(current.original || '').trim();
  const translationRaw = String(current.translation || '').trim();
  const translation = translationRaw && translationRaw !== original ? translationRaw : '';

  const panelInnerTop = g.lyricPanelTop + 42 * g.unit;
  const panelInnerBottom = g.lyricPanelBottom - 42 * g.unit;
  const availableHeight = panelInnerBottom - panelInnerTop;
  const originalWeight = String(style.fontWeight || '700');

  let originalFontSize = 64 * g.unit * baseScale;
  const maxOriginalSize = 70 * g.unit;
  originalFontSize = Math.min(originalFontSize, maxOriginalSize);
  const minOriginalSize = 30 * g.unit;

  let originalLines: string[] = [];
  let translationLines: string[] = [];
  let translationFontSize = originalFontSize * 0.72;
  let totalHeight = 0;

  while (originalFontSize >= minOriginalSize) {
    translationFontSize = Math.max(24 * g.unit, originalFontSize * 0.72);
    ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
    originalLines = wrapText(ctx, original, lyricMaxWidth);
    ctx.font = `400 ${translationFontSize}px ${FONT_STACK}`;
    translationLines = translation ? wrapText(ctx, translation, lyricMaxWidth) : [];

    const originalLineHeight = originalFontSize * 1.28;
    const translationLineHeight = translationFontSize * 1.32;
    const blockGap = translationLines.length > 0 && originalLines.length > 0 ? 22 * g.unit : 0;
    totalHeight = originalLines.length * originalLineHeight + blockGap + translationLines.length * translationLineHeight;
    if (totalHeight <= availableHeight) break;
    originalFontSize -= 2 * g.unit;
  }

  if (totalHeight > availableHeight) {
    const ratio = Math.max(0.62, availableHeight / totalHeight);
    originalFontSize *= ratio;
    translationFontSize *= ratio;
    ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
    originalLines = wrapText(ctx, original, lyricMaxWidth);
    ctx.font = `400 ${translationFontSize}px ${FONT_STACK}`;
    translationLines = translation ? wrapText(ctx, translation, lyricMaxWidth) : [];
    const originalLineHeight = originalFontSize * 1.28;
    const translationLineHeight = translationFontSize * 1.32;
    const blockGap = translationLines.length > 0 && originalLines.length > 0 ? 18 * g.unit : 0;
    totalHeight = originalLines.length * originalLineHeight + blockGap + translationLines.length * translationLineHeight;
  }

  const originalLineHeight = originalFontSize * 1.28;
  const translationLineHeight = translationFontSize * 1.32;
  const blockGap = translationLines.length > 0 && originalLines.length > 0 ? 20 * g.unit : 0;
  totalHeight = originalLines.length * originalLineHeight + blockGap + translationLines.length * translationLineHeight;
  let cursorY = panelInnerTop + Math.max(0, (availableHeight - totalHeight) / 2);

  let lyricColor = style.textColor || '#ffffff';
  if (style.autoContrast) lyricColor = getContrastColor(project.theme.backgroundColor);
  const isFanchant = original.startsWith('(') || current.isFanchant;
  if (isFanchant) lyricColor = project.theme.secondaryColor || lyricColor;

  ctx.save();
  ctx.beginPath();
  ctx.rect(g.lyricPanelLeft + 8 * g.unit, g.lyricPanelTop + 8 * g.unit, panelWidth - 16 * g.unit, panelHeight - 16 * g.unit);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  setLetterSpacing(ctx, '0.2px');
  ctx.fillStyle = lyricColor;
  ctx.shadowColor = isFanchant
    ? project.theme.secondaryColor
    : style.glowBlur > 0
      ? style.glowColor
      : `rgba(0,0,0,${Math.min(0.75, 0.38 * shadowIntensity)})`;
  ctx.shadowBlur = isFanchant ? 18 * g.unit : style.glowBlur > 0 ? style.glowBlur : 10 * g.unit * shadowIntensity;
  ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
  if (project.theme.gameMode === 'lyric-mask') ctx.filter = `blur(${18 * g.unit}px)`;

  originalLines.forEach(line => {
    const baselineY = cursorY + originalFontSize + yFloatOffset;
    if (style.strokeWidth > 0 && !isFanchant) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(line, g.lyricTextLeft, baselineY, lyricMaxWidth);
    }
    ctx.fillText(line, g.lyricTextLeft, baselineY, lyricMaxWidth);
    cursorY += originalLineHeight;
  });

  ctx.filter = 'none';
  if (translationLines.length > 0) {
    cursorY += blockGap;
    ctx.globalAlpha = alpha * 0.76;
    ctx.fillStyle = style.autoContrast ? lyricColor : 'rgba(255,255,255,0.78)';
    ctx.shadowBlur = 7 * g.unit * shadowIntensity;
    ctx.font = `400 ${translationFontSize}px ${FONT_STACK}`;
    translationLines.forEach(line => {
      const baselineY = cursorY + translationFontSize + yFloatOffset;
      ctx.fillText(line, g.lyricTextLeft, baselineY, lyricMaxWidth);
      cursorY += translationLineHeight;
    });
  }
  ctx.restore();
};
