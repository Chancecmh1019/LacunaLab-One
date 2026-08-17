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
    // CD Booklet Shorts lyrics use a true screen-centered safe band.
    // No visual card/panel is drawn; these values are layout bounds only.
    lyricSafeTop: 1168 * scaleY,
    lyricSafeBottom: 1636 * scaleY,
    lyricMaxWidth: 760 * scaleX,
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

  const { width } = ctx.canvas;
  const g = getPortraitGeometry(ctx.canvas.width, ctx.canvas.height);
  const current = project.lyrics[currentIndex];
  const next = project.lyrics[currentIndex + 1];
  const end = current.endTime ?? next?.timestamp ?? current.timestamp + 5;
  const since = effectiveTime - current.timestamp;
  const until = end - effectiveTime;

  let alpha = 1;
  if (since < 0.22) alpha = since / 0.22;
  const fadeOut = currentIndex === project.lyrics.length - 1 ? 1.5 : 0.45;
  if (until < fadeOut) alpha = Math.min(alpha, until / fadeOut);
  alpha = Math.max(0, Math.min(1, alpha));

  const original = String(current.original || '').trim();
  const translationRaw = String(current.translation || '').trim();
  const translation = translationRaw && translationRaw !== original ? translationRaw : '';
  if (!original && !translation) return;

  // Romanization stays in the lyric data, but CD Booklet Shorts never renders it.
  const style = project.theme.lyricStyle || {
    textColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 0,
    glowColor: '#000000',
    glowBlur: 0,
    fontWeight: '400',
    autoContrast: false,
  };

  const lyricCenterX = width / 2;
  const safeTop = g.lyricSafeTop;
  const safeBottom = g.lyricSafeBottom;
  const availableHeight = safeBottom - safeTop;
  const maxWidth = g.lyricMaxWidth;
  const baseScale = Math.max(
    0.78,
    Math.min(1.16, (project.theme.layout.lyrics.scale || 1) * (project.theme.fontSizeScale || 1))
  );

  const originalWeight = String(style.fontWeight || '700');
  let originalFontSize = 62 * g.unit * baseScale;
  const minOriginalFontSize = 30 * g.unit;
  let translationFontSize = Math.max(22 * g.unit, originalFontSize * 0.52);
  let originalLines: string[] = [];
  let translationLines: string[] = [];
  let originalLineHeight = 0;
  let translationLineHeight = 0;
  let translationGap = 0;
  let totalHeight = 0;

  const measure = () => {
    ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
    setLetterSpacing(ctx, '0px');
    originalLines = original ? wrapText(ctx, original, maxWidth) : [];

    translationFontSize = Math.max(22 * g.unit, originalFontSize * 0.52);
    ctx.font = `500 ${translationFontSize}px ${FONT_STACK}`;
    setLetterSpacing(ctx, '0.2px');
    translationLines = translation ? wrapText(ctx, translation, maxWidth * 0.94) : [];

    originalLineHeight = originalFontSize * 1.18;
    translationLineHeight = translationFontSize * 1.30;
    translationGap = originalLines.length > 0 && translationLines.length > 0 ? 30 * g.unit : 0;
    totalHeight =
      originalLines.length * originalLineHeight +
      translationGap +
      translationLines.length * translationLineHeight;
  };

  measure();
  while (totalHeight > availableHeight && originalFontSize > minOriginalFontSize) {
    originalFontSize = Math.max(minOriginalFontSize, originalFontSize - 2 * g.unit);
    measure();
  }

  // Hard safety fallback for unusually long lyric/translation pairs.
  if (totalHeight > availableHeight && totalHeight > 0) {
    const ratio = Math.max(0.72, availableHeight / totalHeight);
    originalFontSize *= ratio;
    translationFontSize *= ratio;
    measure();
  }

  // Center the complete lyric stack inside the lower safe band, not inside a visual card.
  let cursorY = safeTop + Math.max(0, (availableHeight - totalHeight) / 2);
  const floatOffset = (1 - alpha) * 5 * g.unit;

  let lyricColor = style.textColor || '#ffffff';
  if (style.autoContrast) lyricColor = getContrastColor(project.theme.backgroundColor);
  const isFanchant = original.startsWith('(') || current.isFanchant;
  if (isFanchant) lyricColor = project.theme.secondaryColor || lyricColor;

  ctx.save();

  // Invisible symmetric clipping only prevents overflow; it never draws a box/background.
  ctx.beginPath();
  ctx.rect(
    lyricCenterX - maxWidth / 2,
    safeTop,
    maxWidth,
    availableHeight
  );
  ctx.clip();

  // Do not rely on Canvas textAlign state for Shorts lyrics.
  // Every line is positioned from its measured pixel width so the visual block
  // is physically centered on the 1080px canvas in both preview and export.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = lyricColor;
  ctx.shadowColor = isFanchant
    ? project.theme.secondaryColor
    : style.glowBlur > 0
      ? style.glowColor
      : `rgba(0,0,0,${Math.min(0.82, 0.50 * shadowIntensity)})`;
  ctx.shadowBlur = isFanchant
    ? 16 * g.unit
    : style.glowBlur > 0
      ? style.glowBlur
      : 12 * g.unit * shadowIntensity;
  ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
  setLetterSpacing(ctx, '0px');
  if (project.theme.gameMode === 'lyric-mask') ctx.filter = `blur(${18 * g.unit}px)`;

  originalLines.forEach((line) => {
    const baselineY = cursorY + originalFontSize + floatOffset;
    const lineWidth = ctx.measureText(line).width;
    const lineX = lyricCenterX - lineWidth / 2;
    if (style.strokeWidth > 0 && !isFanchant) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(line, lineX, baselineY);
    }
    ctx.fillText(line, lineX, baselineY);
    cursorY += originalLineHeight;
  });

  ctx.filter = 'none';

  if (translationLines.length > 0) {
    cursorY += translationGap;
    ctx.globalAlpha = alpha * 0.70;
    ctx.fillStyle = style.autoContrast ? lyricColor : 'rgba(255,255,255,0.84)';
    ctx.shadowColor = `rgba(0,0,0,${Math.min(0.72, 0.40 * shadowIntensity)})`;
    ctx.shadowBlur = 7 * g.unit * shadowIntensity;
    ctx.font = `500 ${translationFontSize}px ${FONT_STACK}`;
    setLetterSpacing(ctx, '0.2px');

    translationLines.forEach((line) => {
      const baselineY = cursorY + translationFontSize + floatOffset;
      const lineWidth = ctx.measureText(line).width;
      const lineX = lyricCenterX - lineWidth / 2;
      ctx.fillText(line, lineX, baselineY);
      cursorY += translationLineHeight;
    });
  }

  ctx.restore();
};
