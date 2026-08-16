export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  LYRIC_VIDEO = 'LYRIC_VIDEO',
  MV_SUBTITLE = 'MV_SUBTITLE',
  THUMBNAIL = 'THUMBNAIL',
  VIDEO_DESCRIPTION = 'VIDEO_DESCRIPTION',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  IDEAS = 'IDEAS',
  RENDER_QUEUE = 'RENDER_QUEUE'
}

export interface LyricLine {
  timestamp: number;
  endTime?: number;
  original: string;
  translation: string;
  romanization?: string;
  multiLine?: string[];
  isFanchant?: boolean;
}

export interface SongMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
  duration?: number;
  language: 'KR' | 'EN' | 'JP' | 'CN';
}

export type LayoutPreset =
  | 'cd-booklet'
  | 'magazine-left'
  | 'magazine-right'
  | 'cinema-center'
  | 'editorial-clean'
  | 'midnight-radio'
  | 'bottom-modern'
  | 'soft-dream'
  | 'swiss-grid'
  | 'fashion-cover'
  | 'left-balance'
  | 'right-balance'
  | 'corner-info'
  | 'post-modern'
  | 'retro-vhs'
  | 'minimal-centered'
  | 'modern-bauhaus'
  | 'classic-serif'
  | 'framed-minimal'
  | 'gradient-air'
  | 'pure-essence'
  | 'film-subtitle'
  | 'novel-cover'
  | 'art-exhibition'
  | 'lyric-focus'
  | 'golden-ratio'
  | 'melancholy-blue'
  | 'quiet-place'
  | 'dynamic-vinyl'
  | 'dynamic-floating'
  | 'dynamic-split'
  | 'dynamic-glitch'
  | 'dynamic-typewriter'
  | 'dynamic-neon'
  | 'dynamic-kinetic'
  | 'dynamic-3d'
  | 'dynamic-karaoke'
  | 'dynamic-wave';

export interface ElementStyle {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
  align: 'left' | 'center' | 'right';
  vertical?: boolean;
}

export interface LayoutConfig {
  title: ElementStyle;
  artist: ElementStyle;
  album: ElementStyle;
  lyrics: ElementStyle;
  cover: ElementStyle;
}

export interface VisualEffects {
  kenBurnsIntensity: number;
  filmGrainStrength: number;
  vignetteStrength: number;
  cinemaBarHeight: number;
  blurBackground: number;
}

export interface LyricStyleConfig {
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  glowColor: string;
  glowBlur: number;
  fontWeight: '300' | '400' | '500' | '700' | '900';
  autoContrast: boolean;
}

export interface VocabWord {
  word: string;
  meaning: string;
  pronunciation?: string;
}

export interface WatermarkSettings {
  text: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  fontFamily?: string;
}

export interface ThemeConfig {
  fontFamily: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  bgImageUrl?: string;
  bgVideoUrl?: string;
  bgImagePrompt?: string;
  bgMode: 'ai-image' | 'ai-video' | 'album-blur' | 'custom-image' | 'solid-vintage';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  preset: LayoutPreset;
  texture: 'clean' | 'grain' | 'paper';
  overlayOpacity: number;
  fontSizeScale: number;
  shadowIntensity: number;
  effects: VisualEffects;
  lyricStyle?: LyricStyleConfig;
  watermark: WatermarkSettings;
  particleEffect?: boolean;
  layout: LayoutConfig;
  analysisSources?: { title: string; uri: string }[];
  gameMode?: 'none' | 'intro-quiz' | 'vocab-card' | 'lyric-mask';
  creatorTag?: string;
}

export interface ProjectData {
  id: string;
  metadata: SongMetadata;
  lyrics: LyricLine[];
  lyricOffset?: number;
  trimStart?: number;
  trimEnd?: number;
  audioFile?: File;
  sourceAudioFile?: File;
  audioWasConverted?: boolean;
  videoFile?: File;
  srtFile?: File;
  theme: ThemeConfig;
  vocabList?: VocabWord[];
  status: 'draft' | 'rendering' | 'completed' | 'queued';
}
