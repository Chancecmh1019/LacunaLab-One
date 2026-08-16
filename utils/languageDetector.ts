// 自動判斷歌詞語言的工具函數

export type LanguageType = 'KR' | 'EN' | 'JP' | 'CN';

const hasKorean = (text: string): boolean => /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
const hasJapanese = (text: string): boolean => /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
const hasEnglish = (text: string): boolean => /[a-zA-Z]/.test(text);
const hasChinese = (text: string): boolean => /[\u4E00-\u9FFF]/.test(text);

export const detectLanguageFromLyrics = (lyrics: Array<{ original: string; translation?: string }>): LanguageType => {
  const allOriginalText = lyrics
    .map(line => line.original)
    .filter(text => text && text.trim().length > 0)
    .join(' ');

  if (!allOriginalText.trim()) return 'KR';

  const hasKor = hasKorean(allOriginalText);
  const hasJap = hasJapanese(allOriginalText);
  const hasEng = hasEnglish(allOriginalText);
  const hasChi = hasChinese(allOriginalText);

  if (hasKor) return 'KR';
  if (hasJap) return 'JP';
  if (hasEng && !hasChi) return 'EN';
  if (hasChi && !hasEng) return 'CN';
  if (hasChi && hasEng) return 'CN';
  if (hasEng) return 'EN';
  return 'KR';
};

export const getLanguageLabel = (language: LanguageType): string => {
  switch (language) {
    case 'EN': return '英繁中字';
    case 'JP': return '日繁中字';
    case 'CN': return '繁中字';
    case 'KR':
    default: return '韓繁中字';
  }
};
