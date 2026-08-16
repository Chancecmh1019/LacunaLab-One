const sanitizePart = (value: string, fallback: string) => {
  const cleaned = (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ');
  return cleaned || fallback;
};

export const buildOutputFileName = (artist: string, title: string, extension: string) => {
  const cleanArtist = sanitizePart(artist, 'Unknown Artist');
  const cleanTitle = sanitizePart(title, '未命名');
  const cleanExtension = extension.replace(/^\./, '').trim() || 'mp4';
  return `${cleanArtist}_${cleanTitle}.${cleanExtension}`;
};
