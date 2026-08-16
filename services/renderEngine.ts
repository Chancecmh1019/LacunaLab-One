import { ProjectData, ElementStyle } from '../types';
import { FONT_STACK } from '../utils/layoutPresets';
import { wrapText, drawRoundedRect, getContrastColor } from '../utils/canvasUtils';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

declare class VideoEncoder {
  constructor(init: any);
  configure(config: any): void;
  encode(frame: any, options?: any): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: 'configured' | 'unconfigured' | 'closed';
  static isConfigSupported(config: any): Promise<any>;
  readonly encodeQueueSize: number;
}

declare class AudioEncoder {
  constructor(init: any);
  configure(config: any): void;
  encode(data: any): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: 'configured' | 'unconfigured' | 'closed';
  static isConfigSupported(config: any): Promise<any>;
  readonly encodeQueueSize: number;
}

declare class VideoFrame {
  constructor(source: any, init?: any);
  close(): void;
}

declare class AudioData {
  constructor(init: any);
  close(): void;
}

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  img.onload = () => resolve(img);
  img.onerror = reject;
});

const loadVideoElement = async (file: File): Promise<HTMLVideoElement> => {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Video metadata load failed'));
  });
  return video;
};

const createNoiseCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const nctx = canvas.getContext('2d');
  if (!nctx) return null;
  const image = nctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 40;
  }
  nctx.putImageData(image, 0, 0);
  return canvas;
};

const waitForVideoSeek = async (video: HTMLVideoElement, time: number) => {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Video seek timed out at ${time.toFixed(2)}s`));
    }, 10000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.onseeked = null;
      video.onerror = null;
    };
    video.onseeked = () => { cleanup(); resolve(); };
    video.onerror = () => { cleanup(); reject(new Error('Video seek failed')); };
    video.currentTime = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));
    if (!video.seeking && video.readyState >= 2) { cleanup(); resolve(); }
  });
};

const waitForQueue = async (encoder: { encodeQueueSize: number }, high: number, low: number) => {
  if (encoder.encodeQueueSize <= high) return;
  await new Promise<void>(resolve => {
    const check = () => {
      if (encoder.encodeQueueSize <= low) resolve();
      else window.setTimeout(check, 5);
    };
    check();
  });
};

const getRenderDimensions = (project: ProjectData, sourceVideo: HTMLVideoElement | null) => {
  if (sourceVideo) {
    const w = sourceVideo.videoWidth || 1920;
    const h = sourceVideo.videoHeight || 1080;
    return { width: w - (w % 2), height: h - (h % 2) };
  }
  switch (project.theme.aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 };
    case '1:1': return { width: 1080, height: 1080 };
    case '4:5': return { width: 1080, height: 1350 };
    case '16:9':
    default: return { width: 1920, height: 1080 };
  }
};

const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  project: ProjectData,
  width: number,
  height: number,
  scale = 1
) => {
  const wm = project.theme.watermark;
  if (!wm?.text) return;
  ctx.save();
  ctx.globalAlpha = wm.opacity ?? 0.6;
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${30 * (wm.scale || 1) * scale}px ${wm.fontFamily || FONT_STACK}`;
  ctx.textAlign = wm.x > 0.5 ? 'right' : wm.x < 0.5 ? 'left' : 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(wm.text, width * wm.x, height * wm.y);
  ctx.restore();
};

const drawMVSubtitles = (
  ctx: CanvasRenderingContext2D,
  project: ProjectData,
  width: number,
  height: number,
  absoluteTime: number
) => {
  const scale = height / 1080;
  const barH = (project.theme.effects.cinemaBarHeight || 0) * height;
  if (barH > 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);
  }
  drawWatermark(ctx, project, width, height, scale);

  const effectiveTime = absoluteTime - (project.lyricOffset || 0);
  const currentIndex = project.lyrics.findIndex((line, idx) => {
    const end = line.endTime ?? project.lyrics[idx + 1]?.timestamp ?? line.timestamp + 5;
    return effectiveTime >= line.timestamp && effectiveTime <= end;
  });
  if (currentIndex < 0) return;

  const current = project.lyrics[currentIndex];
  const end = current.endTime ?? project.lyrics[currentIndex + 1]?.timestamp ?? current.timestamp + 5;
  let alpha = 1;
  const since = effectiveTime - current.timestamp;
  const until = end - effectiveTime;
  if (since < 0.25) alpha = since / 0.25;
  const fadeOut = currentIndex === project.lyrics.length - 1 ? 1.5 : 0.5;
  if (until < fadeOut) alpha = Math.min(alpha, until / fadeOut);
  alpha = Math.max(0, Math.min(1, alpha));

  const style = project.theme.lyricStyle || {
    textColor: '#fff', strokeColor: '#000', strokeWidth: 0,
    glowColor: '#000', glowBlur: 0, fontWeight: '400', autoContrast: false
  };
  const shadowIntensity = project.theme.shadowIntensity ?? 1;
  const lyricScale = project.theme.layout.lyrics.scale || 1;
  const baseFontSize = 54 * scale * lyricScale;
  const contentLines = current.multiLine?.length
    ? current.multiLine
    : [current.original, current.translation].filter(Boolean);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style.textColor;
  if (style.glowBlur > 0) {
    ctx.shadowColor = style.glowColor || '#000';
    ctx.shadowBlur = style.glowBlur * scale;
  } else {
    ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
    ctx.shadowBlur = 10 * shadowIntensity * scale;
  }
  if (style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor || '#000';
    ctx.lineWidth = style.strokeWidth * scale;
  }

  const userX = project.theme.layout.lyrics.x ?? 0.5;
  if (project.theme.layout.lyrics.vertical) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const charSpacing = baseFontSize * 1.1;
    const columnSpacing = baseFontSize * 1.5;
    const startY = height * 0.15;
    const maxHeight = height * 0.7;
    let columnX = width * userX + ((contentLines.length - 1) * columnSpacing / 2);
    for (const text of contentLines) {
      ctx.font = `${style.fontWeight || 500} ${baseFontSize}px ${FONT_STACK}`;
      let y = startY;
      for (const char of Array.from(text)) {
        if (y > startY + maxHeight) { columnX -= columnSpacing; y = startY; }
        if (style.strokeWidth > 0) ctx.strokeText(char, columnX, y);
        ctx.fillText(char, columnX, y);
        y += charSpacing;
      }
      columnX -= columnSpacing;
    }
  } else {
    ctx.textBaseline = 'bottom';
    ctx.textAlign = userX < 0.35 ? 'left' : userX > 0.65 ? 'right' : 'center';
    const textX = width * userX;
    let y = height * (project.theme.layout.lyrics.y || 0.96);
    for (let j = contentLines.length - 1; j >= 0; j--) {
      ctx.font = `${style.fontWeight || 500} ${baseFontSize}px ${FONT_STACK}`;
      const lines = wrapText(ctx, contentLines[j], width * 0.8);
      for (let k = lines.length - 1; k >= 0; k--) {
        if (style.strokeWidth > 0) ctx.strokeText(lines[k], textX, y);
        ctx.fillText(lines[k], textX, y, width * 0.8);
        y -= baseFontSize * 1.3;
      }
    }
  }
  ctx.restore();
};

const drawLyricFrame = (
  ctx: CanvasRenderingContext2D,
  project: ProjectData,
  width: number,
  height: number,
  absoluteTime: number,
  startTime: number,
  bgImage: HTMLImageElement | null,
  coverImage: HTMLImageElement | null,
  noiseCanvas: HTMLCanvasElement | null
) => {
  const {
    layout, preset, overlayOpacity, secondaryColor, backgroundColor,
    effects, fontSizeScale = 1, shadowIntensity = 1, lyricStyle, aspectRatio, gameMode
  } = project.theme;
  const isVertical = aspectRatio === '9:16';
  const effectiveLayout = isVertical ? {
    artist: { ...layout.artist, x: 0.5, y: 0.45, align: 'center' as const },
    title: { ...layout.title, x: 0.5, y: 0.5, align: 'center' as const, scale: layout.title.scale * 0.8 },
    album: { ...layout.album, visible: false },
    lyrics: { ...layout.lyrics, x: 0.5, y: 0.7, align: 'center' as const, scale: layout.lyrics.scale * 1.2 },
    cover: { ...layout.cover, x: 0.5, y: 0.3, align: 'center' as const, scale: 0.8 }
  } : layout;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const zoomIntensity = effects.kenBurnsIntensity ?? 0;
  const progress = (absoluteTime % 60) / 60;
  const currentScale = 1 + Math.sin(progress * Math.PI) * zoomIntensity;
  const drawWithEffect = (
    img: CanvasImageSource, imgW: number, imgH: number, blur = 0,
    clipX = 0, clipY = 0, clipW = width, clipH = height
  ) => {
    const ratio = Math.max(clipW / imgW, clipH / imgH);
    const drawW = imgW * ratio * currentScale;
    const drawH = imgH * ratio * currentScale;
    const x = clipX + (clipW - drawW) / 2;
    const y = clipY + (clipH - drawH) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();
    if (blur > 0) ctx.filter = `blur(${blur}px) contrast(1.1)`;
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();
  };

  const isQuizPhase = gameMode === 'intro-quiz' && absoluteTime < startTime + 5;
  const quizBlur = isQuizPhase ? 40 : effects.blurBackground;

  if (project.theme.bgMode === 'solid-vintage') {
    const vintageColors = [
      ['#8B7355', '#6B5D52'], ['#7A6F5D', '#5C5449'], ['#6B8E7F', '#4A6B5E'],
      ['#8B7B8B', '#6B5B6B'], ['#7B6B5A', '#5B4B3A'], ['#6B7B8B', '#4B5B6B']
    ];
    const colorIndex = (project.metadata.title.length + project.metadata.artist.length) % vintageColors.length;
    const [color1, color2] = vintageColors[colorIndex];
    const grad = ctx.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.7, height * 0.7, width * 0.8);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (noiseCanvas) {
      const pattern = ctx.createPattern(noiseCanvas, 'repeat');
      if (pattern) {
        const driftX = (absoluteTime * 2.2) % noiseCanvas.width;
        const driftY = (absoluteTime * 1.1) % noiseCanvas.height;
        ctx.save();
        ctx.globalAlpha = 0.055;
        ctx.translate(driftX, driftY);
        ctx.fillStyle = pattern;
        ctx.fillRect(-driftX, -driftY, width + noiseCanvas.width, height + noiseCanvas.height);
        ctx.restore();
      }
    }
  } else if (bgImage && project.theme.bgMode !== 'album-blur' && project.theme.bgMode !== 'ai-video') {
    drawWithEffect(bgImage, bgImage.width, bgImage.height, quizBlur);
  } else if (project.theme.bgMode === 'album-blur' && coverImage) {
    drawWithEffect(coverImage, coverImage.width, coverImage.height, 60);
  }

  // CD-Booklet: restrained motion rather than distracting MV effects.
  if (preset === 'cd-booklet' && !isVertical) {
    const driftX = Math.sin(absoluteTime * 0.18) * width * 0.018;
    const driftY = Math.cos(absoluteTime * 0.14) * height * 0.012;
    ctx.save();
    if (coverImage) {
      const ghostSize = Math.max(width, height) * 0.82;
      ctx.globalAlpha = 0.055;
      ctx.filter = 'blur(90px) saturate(0.75)';
      ctx.drawImage(
        coverImage,
        width * 0.54 - ghostSize * 0.5 + driftX,
        height * 0.5 - ghostSize * 0.5 + driftY,
        ghostSize, ghostSize
      );
      ctx.filter = 'none';
    }
    const glowX = width * 0.72 + driftX * 0.8;
    const glowY = height * 0.46 + driftY * 0.8;
    const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, width * 0.42);
    glow.addColorStop(0, secondaryColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.045 + Math.sin(absoluteTime * 0.22) * 0.008;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    const guideX = width * 0.515 + Math.sin(absoluteTime * 0.12) * 3;
    ctx.beginPath();
    ctx.moveTo(guideX, height * 0.1);
    ctx.lineTo(guideX, height * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  if (preset === 'framed-minimal') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);
  }
  if (overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (isVertical) {
    const grad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);
  }
  if (effects.vignetteStrength > 0) {
    const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.4, width / 2, height / 2, width * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${effects.vignetteStrength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Cover and the CD-Booklet centered information group.
  if (effectiveLayout.cover.visible && coverImage) {
    const cv = effectiveLayout.cover;
    const size = 400 * cv.scale;
    let cx = cv.x * width;
    let cy = cv.y * height;
    if (preset === 'cd-booklet' && !isVertical) {
      const metadataStackHeight = 208;
      const groupTop = (height - (size + metadataStackHeight)) / 2;
      cx += Math.cos(absoluteTime * 0.32) * 2.5;
      cy = groupTop + size / 2 + Math.sin(absoluteTime * 0.42) * 3.5;
    }
    if (cv.align === 'left') cx += size / 2;
    else if (cv.align === 'right') cx -= size / 2;
    const drawX = cx - size / 2;
    const drawY = cy - size / 2;

    if (preset === 'dynamic-vinyl') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(absoluteTime * 1.5);
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      for (let r = size * 0.2; r < size * 0.475; r += 4) {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.175, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(coverImage, -size * 0.175, -size * 0.175, size * 0.35, size * 0.35);
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 30 * shadowIntensity;
      ctx.shadowOffsetY = 10;
      ctx.beginPath();
      drawRoundedRect(ctx, drawX, drawY, size, size, 20);
      ctx.clip();
      ctx.drawImage(coverImage, drawX, drawY, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (preset === 'cd-booklet' && !isVertical) {
      const metaCenterX = drawX + size / 2;
      const coverBottom = drawY + size;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drawX, coverBottom + 18);
      ctx.lineTo(drawX + size, coverBottom + 18);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      // CD booklet 左下資訊固定順序：歌手 → 專輯 → 歌曲。
      ctx.globalAlpha = 0.64;
      ctx.font = `600 22px ${FONT_STACK}`;
      ctx.letterSpacing = '1.4px';
      ctx.fillText(project.metadata.artist || '', metaCenterX, coverBottom + 58, size * 0.94);
      ctx.globalAlpha = 0.72;
      ctx.font = `600 24px ${FONT_STACK}`;
      ctx.letterSpacing = '1.6px';
      ctx.fillText(project.metadata.album || '', metaCenterX, coverBottom + 107, size * 0.94);
      ctx.globalAlpha = 0.98;
      ctx.font = `800 44px ${FONT_STACK}`;
      ctx.letterSpacing = '0.8px';
      ctx.fillText(project.metadata.title || '', metaCenterX, coverBottom + 165, size * 0.94);
      ctx.restore();
    }
  }

  drawWatermark(ctx, project, width, height);
  if (isQuizPhase) {
    const rel = absoluteTime - startTime;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `700 120px ${FONT_STACK}`;
    ctx.fillText(String(Math.max(1, Math.ceil(5 - rel))), width / 2, height / 2);
    ctx.font = `500 40px ${FONT_STACK}`;
    ctx.fillText('GUESS THE SONG', width / 2, height / 2 - 100);
    return;
  }

  const calculateMaxWidth = (xPercent: number, align: string) => {
    const x = xPercent * width;
    const padding = 60;
    if (align === 'left') return Math.max(80, width - x - padding);
    if (align === 'right') return Math.max(80, x - padding);
    return Math.max(80, Math.min(x, width - x) * 2 - padding);
  };

  const drawTextElement = (
    text: string,
    style: ElementStyle,
    fontSize: number,
    fontWeight: string,
    color: string,
    spacing = '0px',
    font = FONT_STACK
  ) => {
    if (!style.visible || !text) return;
    const x = style.x * width;
    const y = style.y * height;
    const finalSize = fontSize * style.scale;
    ctx.textAlign = style.align;
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${finalSize}px ${font}`;
    (ctx as any).letterSpacing = spacing;
    const maxWidth = calculateMaxWidth(style.x, style.align);
    wrapText(ctx, text, maxWidth).forEach((line, i) => ctx.fillText(line, x, y + i * finalSize * 1.2, maxWidth));
  };

  const primaryTextColor = '#fff';
  const tertiaryTextColor = 'rgba(255,255,255,0.7)';
  ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
  ctx.shadowBlur = 10 * shadowIntensity;

  if (preset !== 'cd-booklet' || isVertical) {
    drawTextElement(project.metadata.artist, effectiveLayout.artist, 42, '700', secondaryColor, '6px');
    drawTextElement(project.metadata.album || '', effectiveLayout.album, 34, '600', tertiaryTextColor, '4px');
    let titleScaleFactor = 1;
    if (project.metadata.title.length > 12) titleScaleFactor = 0.85;
    if (project.metadata.title.length > 20) titleScaleFactor = 0.7;
    drawTextElement(project.metadata.title, effectiveLayout.title, 90 * titleScaleFactor, '800', primaryTextColor, '2px');
  }

  const effectiveTime = absoluteTime - (project.lyricOffset || 0);
  const getLineEndTime = (idx: number) => {
    const line = project.lyrics[idx];
    return line.endTime ?? project.lyrics[idx + 1]?.timestamp ?? line.timestamp + 5;
  };
  const currentIndex = project.lyrics.findIndex((line, idx) => effectiveTime >= line.timestamp && effectiveTime < getLineEndTime(idx));
  if (currentIndex < 0) return;

  const lyricX = effectiveLayout.lyrics.x * width;
  const lyricY = effectiveLayout.lyrics.y * height;
  const baseScale = (effectiveLayout.lyrics.scale || 1) * fontSizeScale;
  const style = lyricStyle || {
    textColor: '#fff', strokeColor: '#000', strokeWidth: 0,
    glowColor: '#000', glowBlur: 0, fontWeight: '400', autoContrast: false
  };

  // CD Booklet: keep the original lyric behavior with three lyric groups.
  // All three groups use one fixed font size. Long text wraps instead of shrinking the song's subtitles.
  // Original is above translation; only the current lyric uses the original mainAlpha fade.
  // Content near/outside the top and bottom of the lyric field fades and blurs at the edges.
  if (preset === 'cd-booklet' && !isVertical) {
    // Shift only the rendered lyric column slightly right; leave the saved layout untouched.
    const panelLeft = effectiveLayout.lyrics.x * width + width * 0.016;
    const panelRight = width * 0.965;
    const lyricMaxWidth = Math.max(320, panelRight - panelLeft);
    const lyricAreaTop = height * 0.105;
    const lyricAreaBottom = height * 0.895;

    const originalFontSize = 40 * baseScale;
    const translationFontSize = Math.max(12 * baseScale, originalFontSize - 7 * baseScale);
    const originalLineHeight = originalFontSize * 1.30;
    const translationLineHeight = translationFontSize * 1.30;
    const translationGap = Math.max(16, 20 * baseScale);
    const sectionGap = Math.max(34, 44 * baseScale);
    const originalWeight = '600';
    const translationWeight = '400';

    const requestedCenterY = effectiveLayout.lyrics.y * height;
    const centerY = Math.max(
      lyricAreaTop + originalFontSize * 1.6,
      Math.min(lyricAreaBottom - originalFontSize * 1.6, requestedCenterY)
    );

    const getOriginal = (lyric: any): string => {
      if (!lyric) return '';
      const original = String(lyric.original || '').trim();
      if (original) return original;
      if (Array.isArray(lyric.multiLine)) {
        const first = lyric.multiLine.find((part: unknown) => String(part || '').trim());
        if (first) return String(first).trim();
      }
      return '';
    };

    const getTranslation = (lyric: any, original: string): string => {
      if (!lyric) return '';
      const translation = String(lyric.translation || '').trim();
      if (!translation || translation === original) return '';
      return translation;
    };

    type BookletRow = {
      offset: number;
      originalLines: string[];
      translationLines: string[];
      height: number;
    };

    const slotOffsets = [-1, 0, 1];
    const rows: BookletRow[] = slotOffsets.map(offset => {
      const lyric = project.lyrics[currentIndex + offset];
      const original = getOriginal(lyric);
      const translation = getTranslation(lyric, original);

      ctx.font = `${originalWeight} ${originalFontSize}px ${FONT_STACK}`;
      const originalLines = original ? wrapText(ctx, original, lyricMaxWidth) : [];

      ctx.font = `${translationWeight} ${translationFontSize}px ${FONT_STACK}`;
      const translationLines = translation ? wrapText(ctx, translation, lyricMaxWidth) : [];

      const height =
        originalLines.length * originalLineHeight +
        (translationLines.length > 0 && originalLines.length > 0 ? translationGap : 0) +
        translationLines.length * translationLineHeight;

      return { offset, originalLines, translationLines, height };
    });

    // Keep the current lyric centered. Context lyrics stack above/below without any movement animation.
    const rowTop = new Map<number, number>();
    const currentRow = rows[1];
    const currentTop = centerY - currentRow.height / 2;
    rowTop.set(0, currentTop);

    let upperCursor = currentTop;
    for (let i = 1; i <= 1; i++) {
      const row = rows[1 - i];
      if (!row || row.height <= 0) continue;
      upperCursor -= sectionGap + row.height;
      rowTop.set(row.offset, upperCursor);
    }

    let lowerCursor = currentTop + currentRow.height;
    for (let i = 1; i <= 1; i++) {
      const row = rows[1 + i];
      if (!row || row.height <= 0) continue;
      lowerCursor += sectionGap;
      rowTop.set(row.offset, lowerCursor);
      lowerCursor += row.height;
    }

    // Original rule: only the current lyric fades at its own start/end.
    const currentLine = project.lyrics[currentIndex];
    const end = getLineEndTime(currentIndex);
    const since = effectiveTime - currentLine.timestamp;
    const until = end - effectiveTime;
    let mainAlpha = 1;
    if (since < 0.3) mainAlpha = since / 0.3;
    const isLast = currentIndex === project.lyrics.length - 1;
    const fadeOut = isLast ? 1.5 : 0.4;
    if (until < fadeOut) mainAlpha = Math.min(mainAlpha, until / fadeOut);
    mainAlpha = Math.max(0, Math.min(1, mainAlpha));

    const getEdgeEffect = (baselineY: number, fontSize: number) => {
      const visualCenterY = baselineY - fontSize * 0.35;
      const distanceToEdge = Math.min(
        visualCenterY - lyricAreaTop,
        lyricAreaBottom - visualCenterY
      );
      const fadeZone = Math.max(56, fontSize * 1.75);
      const t = Math.max(0, Math.min(1, distanceToEdge / fadeZone));
      const fade = t * t * (3 - 2 * t);
      const blur = (1 - fade) * Math.max(7, 8 * baseScale);
      return { fade, blur };
    };

    const drawTextLine = (
      value: string,
      baselineY: number,
      baseAlpha: number,
      weight: string,
      isCurrent: boolean,
      isTranslation: boolean,
      fontSize: number
    ) => {
      const { fade, blur } = getEdgeEffect(baselineY, fontSize);
      if (fade <= 0.002) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(panelLeft - 20, lyricAreaTop, lyricMaxWidth + 40, lyricAreaBottom - lyricAreaTop);
      ctx.clip();
      ctx.globalAlpha = baseAlpha * fade * (isTranslation ? 0.76 : 1);
      ctx.filter = blur > 0.35 ? `blur(${blur.toFixed(2)}px)` : 'none';
      ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`;
      ctx.fillStyle = isCurrent && !isTranslation ? style.textColor : '#fff';
      ctx.shadowColor = `rgba(0,0,0,${isCurrent ? shadowIntensity : shadowIntensity * 0.62})`;
      ctx.shadowBlur = isCurrent ? 12 * shadowIntensity : 7 * shadowIntensity;

      if (style.strokeWidth > 0 && isCurrent && !isTranslation) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth;
        ctx.strokeText(value, panelLeft, baselineY, lyricMaxWidth);
      }
      ctx.fillText(value, panelLeft, baselineY, lyricMaxWidth);
      ctx.restore();
    };

    ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';

    rows.forEach(row => {
      if (row.height <= 0) return;
      const top = rowTop.get(row.offset);
      if (top === undefined) return;

      const isCurrent = row.offset === 0;
      const alpha = isCurrent ? mainAlpha : 0.24;
      let cursorY = top;

      row.originalLines.forEach(textLine => {
        const baselineY = cursorY + originalFontSize;
        drawTextLine(textLine, baselineY, alpha, originalWeight, isCurrent, false, originalFontSize);
        cursorY += originalLineHeight;
      });

      if (row.translationLines.length > 0) {
        if (row.originalLines.length > 0) cursorY += translationGap;
        row.translationLines.forEach(textLine => {
          const baselineY = cursorY + translationFontSize;
          drawTextLine(textLine, baselineY, alpha, translationWeight, isCurrent, true, translationFontSize);
          cursorY += translationLineHeight;
        });
      }
    });
    return;
  }

  // Other layouts keep the existing single-current-line behavior.
  const current = project.lyrics[currentIndex];
  const next = project.lyrics[currentIndex + 1];
  const end = getLineEndTime(currentIndex);
  let alpha = 1;
  const since = effectiveTime - current.timestamp;
  const until = end - effectiveTime;
  if (since < 0.25) alpha = since / 0.25;
  const fadeOut = currentIndex === project.lyrics.length - 1 ? 1.5 : 0.5;
  if (until < fadeOut) alpha = Math.min(alpha, until / fadeOut);
  alpha = Math.max(0, Math.min(1, alpha));
  const yFloatOffset = (1 - alpha) * 10;
  const lyricMaxWidth = calculateMaxWidth(effectiveLayout.lyrics.x, effectiveLayout.lyrics.align);

  ctx.save();
  ctx.globalAlpha = alpha;
  let lyricColor = style.textColor;
  if (style.autoContrast) lyricColor = getContrastColor(backgroundColor);
  const isFanchant = current.original.startsWith('(') || current.isFanchant;
  if (isFanchant) {
    lyricColor = secondaryColor;
    ctx.shadowColor = secondaryColor;
    ctx.shadowBlur = 20;
  } else if (style.glowBlur > 0) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowBlur;
  } else {
    ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
    ctx.shadowBlur = 10 * shadowIntensity;
  }
  if (style.strokeWidth > 0 && !isFanchant) {
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
  }
  ctx.fillStyle = lyricColor;
  ctx.textAlign = effectiveLayout.lyrics.align;
  const isModern = ['editorial-clean', 'bottom-modern', 'swiss-grid'].includes(preset);
  const fontFace = isModern ? 'Montserrat, sans-serif' : FONT_STACK;
  const baseFontSize = 55 * baseScale;
  ctx.font = `${style.fontWeight || 400} ${baseFontSize}px ${fontFace}`;
  if (gameMode === 'lyric-mask') ctx.filter = 'blur(20px)';
  const orgLines = wrapText(ctx, current.original, lyricMaxWidth);
  const lineHeight = baseFontSize * 1.25;
  orgLines.forEach((text, idx) => {
    const y = lyricY + idx * lineHeight + yFloatOffset;
    if (style.strokeWidth > 0 && !isFanchant) ctx.strokeText(text, lyricX, y);
    ctx.fillText(text, lyricX, y, lyricMaxWidth);
  });
  ctx.filter = 'none';

  let nextY = lyricY + orgLines.length * lineHeight + 10 * baseScale;
  if (current.romanization) {
    const romSize = 36 * baseScale;
    const romHeight = romSize * 1.25;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `300 ${romSize}px ${FONT_STACK}`;
    const romLines = wrapText(ctx, current.romanization, lyricMaxWidth);
    romLines.forEach((text, idx) => ctx.fillText(text, lyricX, nextY + idx * romHeight + yFloatOffset, lyricMaxWidth));
    nextY += romLines.length * romHeight + 5 * baseScale;
  }
  if (current.translation) {
    const transSize = 48 * baseScale;
    const transHeight = transSize * 1.25;
    ctx.fillStyle = style.autoContrast ? lyricColor : tertiaryTextColor;
    ctx.font = `300 ${transSize}px ${FONT_STACK}`;
    const transLines = wrapText(ctx, current.translation, lyricMaxWidth);
    transLines.forEach((text, idx) => ctx.fillText(text, lyricX, nextY + idx * transHeight + yFloatOffset, lyricMaxWidth));
  }
  ctx.restore();
};

/**
 * Render one project to MP4 with WebCodecs + mp4-muxer.
 * CD-Booklet rendering intentionally shares the same adaptive layout rules as the editor preview.
 */
export const renderProjectOffscreen = async (
  project: ProjectData,
  onProgress: (percent: number) => void
): Promise<Blob> => {
  const isMV = !!project.videoFile;
  let bgImage: HTMLImageElement | null = null;
  let coverImage: HTMLImageElement | null = null;
  let sourceVideo: HTMLVideoElement | null = null;

  if (isMV && project.videoFile) {
    sourceVideo = await loadVideoElement(project.videoFile);
  } else {
    if (project.theme.bgImageUrl && project.theme.bgMode !== 'ai-video') {
      try { bgImage = await loadImage(project.theme.bgImageUrl); } catch { console.warn('Failed to load background image'); }
    }
    if (project.metadata.coverUrl) {
      try { coverImage = await loadImage(project.metadata.coverUrl); } catch { console.warn('Failed to load cover image'); }
    }
  }

  const audioSourceFile = isMV ? project.videoFile : project.audioFile;
  if (!audioSourceFile) throw new Error('No audio source found');
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(await audioSourceFile.arrayBuffer());
  } catch (error) {
    const ext = audioSourceFile.name.split('.').pop()?.toLowerCase() || '';
    if (['opus', 'ogg'].includes(ext) || ['audio/opus', 'audio/ogg', 'application/ogg'].includes(audioSourceFile.type)) {
      throw new Error('無法解碼這個 Opus 音訊。請使用最新版 Chrome / Edge；若仍失敗，請先轉成 M4A 或 MP3。');
    }
    throw new Error(`無法解碼音訊檔案：${error instanceof Error ? error.message : String(error)}`);
  }

  const { width, height } = getRenderDimensions(project, sourceVideo);
  const fps = 30;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
    fastStart: false
  });

  let encodingError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => { encodingError = e instanceof Error ? e : new Error(String(e)); }
  });
  const pixelCount = width * height;
  const isHighRes = pixelCount > 2_228_224;
  videoEncoder.configure({
    codec: isHighRes ? 'avc1.4d0033' : 'avc1.4d002a',
    width, height,
    bitrate: isHighRes ? 12_000_000 : 6_000_000,
    framerate: fps,
    latencyMode: 'quality'
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => { encodingError = e instanceof Error ? e : new Error(String(e)); }
  });
  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    bitrate: 128_000
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  const noiseCanvas = createNoiseCanvas();

  const startTime = Math.max(0, project.trimStart || 0);
  const requestedEnd = project.trimEnd || audioBuffer.duration;
  const endTime = Math.min(audioBuffer.duration, Math.max(startTime, requestedEnd));
  const duration = Math.max(0, endTime - startTime);
  if (duration <= 0) throw new Error('Invalid render duration');
  const totalFrames = Math.ceil(duration * fps);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encodingError) throw encodingError;
      await waitForQueue(videoEncoder, 3, 1);
      const relativeTime = i / fps;
      const absoluteTime = startTime + relativeTime;

      if (isMV && sourceVideo) {
        await waitForVideoSeek(sourceVideo, absoluteTime);
        ctx.drawImage(sourceVideo, 0, 0, width, height);
        drawMVSubtitles(ctx, project, width, height, absoluteTime);
      } else {
        drawLyricFrame(ctx, project, width, height, absoluteTime, startTime, bgImage, coverImage, noiseCanvas);
      }

      const frame = new VideoFrame(canvas, { timestamp: Math.round(relativeTime * 1_000_000) });
      try {
        videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      } finally {
        frame.close();
      }

      if (i % 30 === 0) {
        onProgress(Math.round((i / totalFrames) * 90));
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
    }

    await videoEncoder.flush();
    if (encodingError) throw encodingError;

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(audioBuffer.length, Math.floor(endTime * sampleRate));
    const totalSamples = endSample - startSample;
    const samplesPerChunk = 4096;
    const channelData = Array.from({ length: channels }, (_, c) => audioBuffer.getChannelData(c).slice(startSample, endSample));

    for (let i = 0; i < totalSamples; i += samplesPerChunk) {
      if (encodingError) throw encodingError;
      await waitForQueue(audioEncoder, 5, 1);
      const count = Math.min(samplesPerChunk, totalSamples - i);
      const interleaved = new Float32Array(count * channels);
      for (let j = 0; j < count; j++) {
        for (let c = 0; c < channels; c++) interleaved[j * channels + c] = channelData[c][i + j];
      }
      const audioData = new AudioData({
        format: 'f32', sampleRate, numberOfFrames: count, numberOfChannels: channels,
        timestamp: Math.round(i * 1_000_000 / sampleRate), data: interleaved
      });
      audioEncoder.encode(audioData);
      audioData.close();
      if (i % (samplesPerChunk * 50) === 0) {
        onProgress(Math.min(99, 90 + Math.round((i / totalSamples) * 9)));
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
    }

    await audioEncoder.flush();
    if (encodingError) throw encodingError;
    muxer.finalize();
    onProgress(100);
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    if (videoEncoder.state !== 'closed') videoEncoder.close();
    if (audioEncoder.state !== 'closed') audioEncoder.close();
    await audioCtx.close().catch(() => undefined);
    if (sourceVideo) {
      const url = sourceVideo.src;
      sourceVideo.removeAttribute('src');
      sourceVideo.load();
      URL.revokeObjectURL(url);
      sourceVideo.remove();
    }
  }
};
