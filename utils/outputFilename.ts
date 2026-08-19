import { getLanguageLabel, type LanguageType } from './languageDetector';

const sanitizePart = (value: string, fallback: string) => {
  const cleaned = (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ');
  return cleaned || fallback;
};

const normalizeExtension = (extension: string, fallback = 'mp4') =>
  extension.replace(/^\./, '').trim() || fallback;

/**
 * Generic filename helper for non-media exports such as LRC files.
 */
export const buildOutputFileName = (artist: string, title: string, extension: string) => {
  const cleanArtist = sanitizePart(artist, 'Unknown Artist');
  const cleanTitle = sanitizePart(title, '未命名');
  const cleanExtension = normalizeExtension(extension);
  return `${cleanArtist}_${cleanTitle}.${cleanExtension}`;
};

/**
 * Filename used for exported videos and images.
 * KR: 【韓繁中字】aespa｜Lemonade.mp4
 * JP: 【日繁中字】Artist｜Title.mp4
 * EN: 【英繁中字】Artist｜Title.mp4
 * CN: 【繁中字】Artist｜Title.mp4
 * Shorts: aespa - Lemonade.mp4
 */
export const buildMediaOutputFileName = (
  artist: string,
  title: string,
  extension: string,
  isShorts = false,
  language: LanguageType = 'KR'
) => {
  const cleanArtist = sanitizePart(artist, 'Unknown Artist');
  const cleanTitle = sanitizePart(title, '未命名');
  const cleanExtension = normalizeExtension(extension);
  const languageLabel = getLanguageLabel(language);
  const baseName = isShorts
    ? `${cleanArtist} - ${cleanTitle}`
    : `【${languageLabel}】${cleanArtist}｜${cleanTitle}`;
  return `${baseName}.${cleanExtension}`;
};
