import { parseBlob } from 'music-metadata';
import { LyricLine, SongMetadata } from '../types';

export const getMediaFileExtension = (file: File): string =>
  file.name.split('.').pop()?.toLowerCase() || '';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'm4b', 'aac', 'adts', 'opus', 'ogg', 'oga',
  'wav', 'wave', 'flac', 'aif', 'aiff', 'aifc', 'alac',
  'webm', 'weba', 'wma', 'ape', 'amr', 'ac3', 'eac3', 'mka',
  'dsf', 'dff', 'mpc'
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v']);

export const isSupportedAudioFile = (file: File): boolean => {
  const ext = getMediaFileExtension(file);
  if (AUDIO_EXTENSIONS.has(ext)) return true;
  if (VIDEO_EXTENSIONS.has(ext)) return false;
  return file.type.startsWith('audio/') || file.type === 'application/ogg';
};

export const isSupportedVideoFile = (file: File): boolean => {
  const ext = getMediaFileExtension(file);
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  if (AUDIO_EXTENSIONS.has(ext)) return false;
  return file.type.startsWith('video/');
};

const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  let seconds = 0;
  if (parts.length === 3) {
    seconds += parseInt(parts[0]) * 3600;
    seconds += parseInt(parts[1]) * 60;
    seconds += parseFloat(parts[2].replace(',', '.'));
  } else if (parts.length === 2) {
    seconds += parseInt(parts[0]) * 60;
    seconds += parseFloat(parts[1].replace(',', '.'));
  }
  return seconds;
};

export const parseLRC = (lrcContent: string): LyricLine[] => {
  const lines = lrcContent.split('\n');
  const lyrics: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})[.,](\d{2,3})\]/;
  let tempLine: { timestamp: number; text: string } | null = null;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (!match) continue;
    const timestamp = parseTime(`${match[1]}:${match[2]}.${match[3]}`);
    const text = line.replace(timeRegex, '').trim();
    if (!text) continue;

    if (tempLine && Math.abs(tempLine.timestamp - timestamp) < 0.2) {
      lyrics.push({
        timestamp: tempLine.timestamp,
        original: tempLine.text,
        translation: text,
        multiLine: [tempLine.text, text]
      });
      tempLine = null;
    } else {
      if (tempLine) {
        lyrics.push({
          timestamp: tempLine.timestamp,
          original: tempLine.text,
          translation: '',
          multiLine: [tempLine.text]
        });
      }
      tempLine = { timestamp, text };
    }
  }

  if (tempLine) {
    lyrics.push({
      timestamp: tempLine.timestamp,
      original: tempLine.text,
      translation: '',
      multiLine: [tempLine.text]
    });
  }
  return lyrics;
};

export const parseSRT = (srtContent: string): LyricLine[] => {
  const data: LyricLine[] = [];
  const blocks = srtContent.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return;
    const timeLineIndex = lines.findIndex(l => l.includes('-->'));
    if (timeLineIndex === -1) return;
    const timeLine = lines[timeLineIndex];
    const [startStr, endStr] = timeLine.split(' --> ');
    const timestamp = parseTime(startStr);
    const endTime = parseTime(endStr);
    const contentLines = lines.slice(timeLineIndex + 1);
    if (contentLines.length > 0) {
      data.push({
        timestamp,
        endTime,
        original: contentLines[0] || '',
        translation: contentLines[1] || '',
        multiLine: contentLines
      });
    }
  });
  return data;
};

export const parseFilenameMetadata = (file: File) => {
  let title = file.name.replace(/\.[^/.]+$/, '');
  let artist = 'Unknown Artist';
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }
  return { title, artist };
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Cover art read failed'));
    reader.readAsDataURL(blob);
  });

const lyricValueToText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map(lyricValueToText).filter(Boolean).join('\n').trim();
  }

  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    for (const key of ['text', 'lyrics', 'value', 'description']) {
      const text = lyricValueToText(item[key]);
      if (text) return text;
    }
    const sync = item.synchronisedText ?? item.synchronizedText ?? item.syncText;
    if (Array.isArray(sync)) {
      return sync
        .map((entry: any) => typeof entry === 'string' ? entry : entry?.text || entry?.value || '')
        .filter(Boolean)
        .join('\n')
        .trim();
    }
  }
  return '';
};

export const extractMetadataFromAudio = async (
  file: File
): Promise<{ metadata: SongMetadata; lyrics: LyricLine[] | null }> => {
  const fallback = parseFilenameMetadata(file);
  try {
    const parsed: any = await parseBlob(file, { duration: true });
    const common = parsed?.common || {};
    const format = parsed?.format || {};
    let coverUrl: string | undefined;
    const picture = Array.isArray(common.picture) ? common.picture[0] : undefined;
    if (picture?.data) {
      const raw = picture.data instanceof Uint8Array
        ? picture.data
        : new Uint8Array(picture.data);
      const copied = new Uint8Array(raw.byteLength);
      copied.set(raw);
      const blob = new Blob([copied.buffer], { type: picture.format || 'image/jpeg' });
      coverUrl = await blobToDataUrl(blob);
    }
    const rawLyrics = lyricValueToText(common.lyrics);
    const lyrics = rawLyrics ? parseLRC(rawLyrics) : null;
    return {
      metadata: {
        title: common.title || fallback.title,
        artist: common.artist || common.albumartist || fallback.artist,
        album: common.album || '',
        coverUrl,
        duration: Number.isFinite(format.duration) ? format.duration : undefined,
        language: 'KR'
      },
      lyrics: lyrics && lyrics.length > 0 ? lyrics : null
    };
  } catch (error) {
    console.warn('Audio metadata read failed; using filename fallback.', error);
    return {
      metadata: {
        title: fallback.title,
        artist: fallback.artist,
        album: '',
        language: 'KR'
      },
      lyrics: null
    };
  }
};
