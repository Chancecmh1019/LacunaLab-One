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
  const parts = timeStr.trim().replace(',', '.').split(':');
  const values = parts.map(part => Number(part));
  if (values.some(value => !Number.isFinite(value))) return 0;

  if (values.length === 3) {
    return values[0] * 3600 + values[1] * 60 + values[2];
  }
  if (values.length === 2) {
    return values[0] * 60 + values[1];
  }
  if (values.length === 1) {
    return values[0];
  }
  return 0;
};

const LRC_TIMESTAMP_REGEX = /\[(\d{1,3}):([0-5]?\d)(?:[.,](\d{1,3}))?\]/g;
const LRC_METADATA_REGEX = /^\[(ar|ti|al|by|offset|re|ve|length):.*\]$/i;

const lrcMatchToSeconds = (match: RegExpMatchArray): number => {
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const fractionRaw = match[3] || '';
  const fraction = fractionRaw
    ? Number(fractionRaw.padEnd(3, '0').slice(0, 3)) / 1000
    : 0;
  return minutes * 60 + seconds + fraction;
};

const makeLyricLine = (
  timestamp: number,
  lines: string[],
  endTime?: number
): LyricLine => {
  const cleanLines = lines.map(line => line.trim()).filter(Boolean).slice(0, 5);
  return {
    timestamp,
    endTime,
    original: cleanLines[0] || '',
    translation: cleanLines[1] || '',
    multiLine: cleanLines
  };
};

export const parseLRC = (lrcContent: string): LyricLine[] => {
  const grouped = new Map<number, { timestamp: number; lines: string[] }>();
  const normalized = lrcContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line || LRC_METADATA_REGEX.test(line)) continue;

    const matches = Array.from(line.matchAll(LRC_TIMESTAMP_REGEX));
    if (matches.length === 0) continue;

    const text = line.replace(LRC_TIMESTAMP_REGEX, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const timestamp = lrcMatchToSeconds(match);
      const key = Math.round(timestamp * 1000);
      const existing = grouped.get(key);
      if (existing) {
        if (existing.lines.length < 5 && !existing.lines.includes(text)) {
          existing.lines.push(text);
        }
      } else {
        grouped.set(key, { timestamp, lines: [text] });
      }
    }
  }

  const ordered = Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
  return ordered.map((item, index) => {
    const nextTimestamp = ordered[index + 1]?.timestamp;
    return makeLyricLine(item.timestamp, item.lines, nextTimestamp);
  });
};

export const parseSRT = (srtContent: string): LyricLine[] => {
  const data: LyricLine[] = [];
  const blocks = srtContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);

  blocks.forEach(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const timeLineIndex = lines.findIndex(line => line.includes('-->'));
    if (timeLineIndex === -1) return;

    const [startStr, endStr] = lines[timeLineIndex].split(/\s*-->\s*/);
    if (!startStr || !endStr) return;

    const contentLines = lines.slice(timeLineIndex + 1).filter(Boolean).slice(0, 5);
    if (contentLines.length === 0) return;

    data.push(makeLyricLine(parseTime(startStr), contentLines, parseTime(endStr)));
  });

  return data.sort((a, b) => a.timestamp - b.timestamp);
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

const stringValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (!value || typeof value !== 'object') return '';

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = stringValue(entry);
      if (text) return text;
    }
    return '';
  }

  const item = value as Record<string, unknown>;
  for (const key of ['text', 'value', 'name', 'description']) {
    const text = stringValue(item[key]);
    if (text) return text;
  }
  return '';
};

const collectRawLyricTexts = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === 'string') {
    const text = value.replace(/\u0000/g, '').trim();
    if (text) output.push(text);
    return output;
  }
  if (!value) return output;

  if (Array.isArray(value)) {
    value.forEach(entry => collectRawLyricTexts(entry, output));
    return output;
  }

  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;

    // music-metadata may expose embedded lyrics as ILyricsTag objects
    // ({ text, syncText }), plain MP4/Vorbis/APE strings, or nested native values.
    for (const key of [
      'text', 'lyrics', 'value',
      'unsyncedLyrics', 'unsynchronisedLyrics', 'unsynchronizedLyrics'
    ]) {
      if (item[key] !== undefined) collectRawLyricTexts(item[key], output);
    }
  }
  return output;
};

const plainLyricsToTimedLines = (text: string, duration?: number): LyricLine[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !LRC_METADATA_REGEX.test(line));

  if (lines.length === 0) return [];

  const safeDuration = Number.isFinite(duration) && (duration as number) > 0
    ? Number(duration)
    : Math.max(8, lines.length * 4);
  const start = Math.min(2, safeDuration * 0.02);
  const end = Math.max(start + 1, safeDuration - Math.min(3, safeDuration * 0.03));
  const step = Math.max(0.8, (end - start) / Math.max(1, lines.length));

  return lines.map((line, index) => {
    const timestamp = Math.min(end, start + index * step);
    const nextTimestamp = index < lines.length - 1
      ? Math.min(end, start + (index + 1) * step)
      : Math.min(safeDuration, timestamp + step);
    return makeLyricLine(timestamp, [line], nextTimestamp);
  });
};

const parseRawLyrics = (text: string, duration?: number): LyricLine[] => {
  const normalized = text.trim();
  if (!normalized) return [];

  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(normalized)) {
    const srt = parseSRT(normalized);
    if (srt.length > 0) return srt;
  }

  const lrc = parseLRC(normalized);
  if (lrc.length > 0) return lrc;

  return plainLyricsToTimedLines(normalized, duration);
};

type NativeTag = { id?: unknown; value?: unknown };

type SyncEntry = {
  timestamp: number;
  text: string;
};

const getNativeTags = (parsed: any): NativeTag[] => {
  const native = parsed?.native;
  if (!native || typeof native !== 'object') return [];

  const tags: NativeTag[] = [];
  Object.values(native as Record<string, unknown>).forEach(value => {
    if (Array.isArray(value)) {
      value.forEach(tag => {
        if (tag && typeof tag === 'object') tags.push(tag as NativeTag);
      });
    }
  });
  return tags;
};

const normalizeTagId = (id: unknown): string => String(id || '').trim().toLowerCase();

const isLyricsTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  if (!tag) return false;

  if ([
    'uslt', 'ult', 'sylt', 'slt',
    '©lyr', '\u00a9lyr',
    'lyrics', 'unsyncedlyrics', 'syncedlyrics',
    'unsynchronisedlyrics', 'unsynchronizedlyrics',
    'synchronisedlyrics', 'synchronizedlyrics',
    'wm/lyrics', 'wm/lyrics_synchronised', 'wm/lyrics_synchronized'
  ].includes(tag)) return true;

  // Catch container-specific/native variants such as LYRICS-eng,
  // ----:com.apple.iTunes:LYRICS, APE/Vorbis lyric fields, etc.
  const compact = tag.replace(/[\s_.:/-]+/g, '');
  return compact.includes('lyric') && !compact.includes('lyricist');
};

const isTitleTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  return ['tit2', 'tt2', '©nam', '\u00a9nam', 'title', 'wm/title'].includes(tag);
};

const isArtistTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  return ['tpe1', 'tp1', '©art', '\u00a9art', 'artist', 'author', 'wm/author'].includes(tag);
};

const isAlbumArtistTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  return ['tpe2', 'tp2', 'aart', 'albumartist', 'album artist', 'wm/albumartist'].includes(tag);
};

const isAlbumTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  return ['talb', 'tal', '©alb', '\u00a9alb', 'album', 'wm/albumtitle'].includes(tag);
};

const isPictureTag = (id: unknown): boolean => {
  const tag = normalizeTagId(id);
  return [
    'apic', 'pic', 'covr', 'picture', 'metadata_block_picture',
    'cover art (front)', 'wm/picture'
  ].includes(tag);
};

const firstNativeText = (tags: NativeTag[], matcher: (id: unknown) => boolean): string => {
  for (const tag of tags) {
    if (!matcher(tag.id)) continue;
    const text = stringValue(tag.value);
    if (text) return text;
  }
  return '';
};

const timestampToSeconds = (
  rawTimestamp: unknown,
  timeStampFormat: unknown,
  format: any
): number | null => {
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp) || timestamp < 0) return null;

  const stampFormat = Number(timeStampFormat);

  // ID3 SYLT timestamp format 2 is milliseconds.
  if (stampFormat === 2) return timestamp / 1000;

  // ID3 SYLT timestamp format 1 is an absolute MPEG-frame counter.
  if (stampFormat === 1) {
    const sampleRate = Number(format?.sampleRate);
    if (Number.isFinite(sampleRate) && sampleRate > 0) {
      const codec = `${format?.codec || ''} ${format?.codecProfile || ''}`.toLowerCase();
      let samplesPerFrame = 1152;
      if (codec.includes('layer 1')) samplesPerFrame = 384;
      else if ((codec.includes('mpeg 2') || codec.includes('mpeg-2')) && codec.includes('layer 3')) samplesPerFrame = 576;
      return timestamp * samplesPerFrame / sampleRate;
    }
  }

  // For non-ID3/native synchronized structures, timestamps are often already
  // seconds. If a value is clearly too large for the track, treat it as ms.
  const duration = Number(format?.duration);
  if (Number.isFinite(duration) && duration > 0 && timestamp > duration * 4 && timestamp >= 1000) {
    return timestamp / 1000;
  }
  return timestamp;
};

const syncEntriesFromValue = (value: unknown, format: any): SyncEntry[] => {
  const result: SyncEntry[] = [];

  const visit = (candidate: unknown, inheritedStampFormat?: unknown) => {
    if (!candidate) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(entry => visit(entry, inheritedStampFormat));
      return;
    }
    if (typeof candidate !== 'object') return;

    const item = candidate as Record<string, unknown>;
    const timeStampFormat = item.timeStampFormat ?? item.timestampFormat ?? inheritedStampFormat;
    const sync = item.syncText
      ?? item.synchronisedText
      ?? item.synchronizedText
      ?? item.syncedLyrics
      ?? item.synchronisedLyrics
      ?? item.synchronizedLyrics;

    if (Array.isArray(sync)) {
      for (const rawEntry of sync) {
        if (typeof rawEntry === 'string') continue;
        if (!rawEntry || typeof rawEntry !== 'object') continue;
        const entry = rawEntry as Record<string, unknown>;
        const text = stringValue(entry.text ?? entry.value ?? entry.lyric);
        const timestamp = timestampToSeconds(
          entry.timestamp ?? entry.timeStamp ?? entry.time ?? entry.startTime ?? entry.start,
          timeStampFormat,
          format
        );
        if (text && timestamp !== null) result.push({ timestamp, text });
      }
    }

    // Some native tag wrappers put the actual lyric object in value/lyrics.
    for (const key of ['value', 'lyrics']) {
      if (item[key] && item[key] !== candidate) visit(item[key], timeStampFormat);
    }
  };

  visit(value);
  return result;
};

const syncEntriesToLyrics = (entries: SyncEntry[]): LyricLine[] => {
  if (entries.length === 0) return [];

  const grouped = new Map<number, { timestamp: number; lines: string[] }>();
  entries
    .filter(entry => Number.isFinite(entry.timestamp) && entry.timestamp >= 0 && entry.text.trim())
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(entry => {
      const key = Math.round(entry.timestamp * 1000);
      const text = entry.text.trim();
      const existing = grouped.get(key);
      if (existing) {
        if (existing.lines.length < 5 && !existing.lines.includes(text)) existing.lines.push(text);
      } else {
        grouped.set(key, { timestamp: entry.timestamp, lines: [text] });
      }
    });

  const ordered = Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
  return ordered.map((item, index) => makeLyricLine(
    item.timestamp,
    item.lines,
    ordered[index + 1]?.timestamp
  ));
};

const extractEmbeddedLyrics = (parsed: any, duration?: number): LyricLine[] => {
  const commonLyrics = parsed?.common?.lyrics;
  const nativeTags = getNativeTags(parsed);
  const nativeLyricValues = nativeTags.filter(tag => isLyricsTag(tag.id)).map(tag => tag.value);
  const format = parsed?.format || {};

  // 1. Prefer genuinely synchronized lyrics (ID3 SYLT / parsed LRC / equivalent).
  const syncEntries = [commonLyrics, ...nativeLyricValues]
    .flatMap(value => syncEntriesFromValue(value, format));
  const synchronized = syncEntriesToLyrics(syncEntries);
  if (synchronized.length > 0) return synchronized;

  // 2. Then inspect raw text. This is essential for MP4/M4A ©lyr and ID3 USLT.
  //    music-metadata can normalize some raw lyric strings into an empty syncText array,
  //    while parsed.native still contains the original tag value.
  const rawTexts = [
    ...collectRawLyricTexts(commonLyrics),
    ...nativeLyricValues.flatMap(value => collectRawLyricTexts(value))
  ].filter((text, index, array) => text && array.indexOf(text) === index);

  let best: LyricLine[] = [];
  for (const text of rawTexts) {
    const parsedLyrics = parseRawLyrics(text, duration);
    if (parsedLyrics.length > best.length) best = parsedLyrics;
  }
  return best;
};

const pictureFromUnknown = (value: unknown): { data: Uint8Array; format?: string } | null => {
  if (!value) return null;
  if (value instanceof Uint8Array) return { data: value };
  if (value instanceof ArrayBuffer) return { data: new Uint8Array(value) };
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picture = pictureFromUnknown(entry);
      if (picture) return picture;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const item = value as Record<string, unknown>;
  const data = item.data;
  if (data instanceof Uint8Array) {
    return { data, format: typeof item.format === 'string' ? item.format : undefined };
  }
  if (data instanceof ArrayBuffer) {
    return { data: new Uint8Array(data), format: typeof item.format === 'string' ? item.format : undefined };
  }
  return null;
};

const extractCover = async (common: any, nativeTags: NativeTag[]): Promise<string | undefined> => {
  let picture = pictureFromUnknown(common?.picture);
  if (!picture) {
    for (const tag of nativeTags) {
      if (!isPictureTag(tag.id)) continue;
      picture = pictureFromUnknown(tag.value);
      if (picture) break;
    }
  }
  if (!picture) return undefined;

  const copied = new Uint8Array(picture.data.byteLength);
  copied.set(picture.data);
  const blob = new Blob([copied.buffer], { type: picture.format || 'image/jpeg' });
  return blobToDataUrl(blob);
};

export const extractMetadataFromAudio = async (
  file: File
): Promise<{ metadata: SongMetadata; lyrics: LyricLine[] | null }> => {
  const fallback = parseFilenameMetadata(file);

  try {
    const parsed: any = await parseBlob(file, {
      duration: true,
      skipCovers: false,
      skipPostHeaders: false
    });
    const common = parsed?.common || {};
    const format = parsed?.format || {};
    const nativeTags = getNativeTags(parsed);
    const duration = Number.isFinite(format.duration) ? Number(format.duration) : undefined;

    const title = stringValue(common.title) || firstNativeText(nativeTags, isTitleTag) || fallback.title;
    const artist = stringValue(common.artist)
      || stringValue(common.albumartist)
      || firstNativeText(nativeTags, isArtistTag)
      || firstNativeText(nativeTags, isAlbumArtistTag)
      || fallback.artist;
    const album = stringValue(common.album) || firstNativeText(nativeTags, isAlbumTag) || '';
    const coverUrl = await extractCover(common, nativeTags);
    const lyrics = extractEmbeddedLyrics(parsed, duration);

    return {
      metadata: {
        title,
        artist,
        album,
        coverUrl,
        duration,
        language: 'KR'
      },
      lyrics: lyrics.length > 0 ? lyrics : null
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
