import { LayoutPreset, LayoutConfig } from '../types';

// Prioritize Traditional Chinese, then Japanese/Korean serif fallbacks.
export const FONT_STACK = '"Noto Serif TC", "Zen Old Mincho", "Noto Serif KR", serif';

export const LAYOUT_PRESETS: Record<LayoutPreset, LayoutConfig> = {
  'cd-booklet': {
    artist: { x: 0.46, y: 0.22, scale: 0.85, visible: true, align: 'left' },
    album: { x: 0.46, y: 0.27, scale: 0.75, visible: true, align: 'left' },
    title: { x: 0.46, y: 0.37, scale: 0.85, visible: true, align: 'left' },
    lyrics: { x: 0.56, y: 0.50, scale: 1.05, visible: true, align: 'left' },
    cover: { x: 0.23, y: 0.5, scale: 1.6, visible: true, align: 'center' }
  },
  'magazine-left': {
    artist: { x: 0.1, y: 0.18, scale: 1.0, visible: true, align: 'left' },
    album: { x: 0.1, y: 0.225, scale: 0.9, visible: true, align: 'left' },
    title: { x: 0.1, y: 0.35, scale: 1.2, visible: true, align: 'left' },
    lyrics: { x: 0.1, y: 0.72, scale: 1.0, visible: true, align: 'left' },
    cover: { x: 0.5, y: 0.5, scale: 0.0, visible: false, align: 'center' }
  },
  'magazine-right': {
    artist: { x: 0.9, y: 0.18, scale: 1.0, visible: true, align: 'right' },
    album: { x: 0.9, y: 0.225, scale: 0.9, visible: true, align: 'right' },
    title: { x: 0.9, y: 0.35, scale: 1.2, visible: true, align: 'right' },
    lyrics: { x: 0.9, y: 0.72, scale: 1.0, visible: true, align: 'right' },
    cover: { x: 0.5, y: 0.5, scale: 0.0, visible: false, align: 'center' }
  },
  'cinema-center': {
    artist: { x: 0.5, y: 0.15, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.195, scale: 0.8, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.32, scale: 1.0, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.75, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 0.0, visible: false, align: 'center' }
  },
  'editorial-clean': {
    artist: { x: 0.5, y: 0.12, scale: 0.6, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.88, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 0.9, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.6, scale: 0.9, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'midnight-radio': {
    artist: { x: 0.08, y: 0.12, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.92, y: 0.12, scale: 0.8, visible: true, align: 'right' },
    title: { x: 0.5, y: 0.85, scale: 1.5, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'bottom-modern': {
    artist: { x: 0.08, y: 0.72, scale: 0.9, visible: true, align: 'left' },
    album: { x: 0.08, y: 0.68, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.08, y: 0.85, scale: 1.4, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.4, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'soft-dream': {
    artist: { x: 0.5, y: 0.45, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.9, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 1.3, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.6, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'swiss-grid': {
    artist: { x: 0.06, y: 0.08, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.94, y: 0.08, scale: 0.8, visible: true, align: 'right' },
    title: { x: 0.06, y: 0.25, scale: 1.8, visible: true, align: 'left' },
    lyrics: { x: 0.06, y: 0.65, scale: 1.0, visible: true, align: 'left' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'fashion-cover': {
    artist: { x: 0.5, y: 0.1, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.15, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.88, scale: 2.2, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'left-balance': {
    artist: { x: 0.08, y: 0.12, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.08, y: 0.17, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.08, y: 0.3, scale: 1.4, visible: true, align: 'left' },
    lyrics: { x: 0.65, y: 0.5, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'right-balance': {
    artist: { x: 0.92, y: 0.12, scale: 0.8, visible: true, align: 'right' },
    album: { x: 0.92, y: 0.17, scale: 0.7, visible: true, align: 'right' },
    title: { x: 0.92, y: 0.3, scale: 1.4, visible: true, align: 'right' },
    lyrics: { x: 0.35, y: 0.5, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'corner-info': {
    artist: { x: 0.06, y: 0.08, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.94, y: 0.08, scale: 0.8, visible: true, align: 'right' },
    title: { x: 0.06, y: 0.92, scale: 1.1, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'post-modern': {
    artist: { x: 0.5, y: 0.1, scale: 0.9, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.95, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.5, scale: 3.5, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.7, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'retro-vhs': {
    artist: { x: 0.1, y: 0.1, scale: 0.9, visible: true, align: 'left' },
    album: { x: 0.1, y: 0.15, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.1, y: 0.85, scale: 1.2, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'minimal-centered': {
    artist: { x: 0.5, y: 0.25, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.29, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.15, scale: 1.2, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.7, scale: 0.9, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'modern-bauhaus': {
    artist: { x: 0.05, y: 0.08, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.05, y: 0.92, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.95, y: 0.92, scale: 1.5, visible: true, align: 'right' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'classic-serif': {
    artist: { x: 0.5, y: 0.2, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.24, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 1.4, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.75, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'framed-minimal': {
    artist: { x: 0.5, y: 0.18, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.88, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.12, scale: 0.9, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.5, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'gradient-air': {
    artist: { x: 0.92, y: 0.85, scale: 0.8, visible: true, align: 'right' },
    album: { x: 0.92, y: 0.9, scale: 0.7, visible: true, align: 'right' },
    title: { x: 0.08, y: 0.85, scale: 1.4, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.4, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'pure-essence': {
    artist: { x: 0.5, y: 0.12, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.16, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.25, scale: 1.4, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.75, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'film-subtitle': {
    artist: { x: 0.5, y: 0.45, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.5, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 1.2, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.88, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'novel-cover': {
    artist: { x: 0.88, y: 0.15, scale: 0.8, visible: true, align: 'right' },
    album: { x: 0.88, y: 0.2, scale: 0.7, visible: true, align: 'right' },
    title: { x: 0.88, y: 0.35, scale: 1.5, visible: true, align: 'right' },
    lyrics: { x: 0.15, y: 0.6, scale: 1.0, visible: true, align: 'left' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'art-exhibition': {
    artist: { x: 0.08, y: 0.88, scale: 0.7, visible: true, align: 'left' },
    album: { x: 0.08, y: 0.92, scale: 0.6, visible: true, align: 'left' },
    title: { x: 0.08, y: 0.1, scale: 1.0, visible: true, align: 'left' },
    lyrics: { x: 0.6, y: 0.5, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'lyric-focus': {
    artist: { x: 0.5, y: 0.9, scale: 0.6, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.94, scale: 0.5, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.85, scale: 0.8, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.45, scale: 1.3, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'golden-ratio': {
    artist: { x: 0.15, y: 0.2, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.15, y: 0.25, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.15, y: 0.35, scale: 1.4, visible: true, align: 'left' },
    lyrics: { x: 0.7, y: 0.7, scale: 1.0, visible: true, align: 'right' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'melancholy-blue': {
    artist: { x: 0.08, y: 0.82, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.08, y: 0.87, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.08, y: 0.75, scale: 1.2, visible: true, align: 'left' },
    lyrics: { x: 0.92, y: 0.2, scale: 1.0, visible: true, align: 'right' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'quiet-place': {
    artist: { x: 0.5, y: 0.12, scale: 0.7, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.16, scale: 0.6, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.22, scale: 1.0, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.85, scale: 1.0, visible: true, align: 'center' },
    cover: { x: 0, y: 0, scale: 0, visible: false, align: 'center' }
  },
  'dynamic-vinyl': {
    artist: { x: 0.1, y: 0.85, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.1, y: 0.9, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.1, y: 0.75, scale: 1.5, visible: true, align: 'left' },
    lyrics: { x: 0.9, y: 0.5, scale: 1.0, visible: true, align: 'right' },
    cover: { x: 0.3, y: 0.4, scale: 1.2, visible: true, align: 'center' }
  },
  'dynamic-floating': {
    artist: { x: 0.5, y: 0.1, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.15, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.85, scale: 1.5, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.5, scale: 1.2, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 1.5, visible: true, align: 'center' }
  },
  'dynamic-split': {
    artist: { x: 0.75, y: 0.2, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.75, y: 0.25, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.75, y: 0.35, scale: 1.5, visible: true, align: 'center' },
    lyrics: { x: 0.75, y: 0.65, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0.25, y: 0.5, scale: 1.8, visible: true, align: 'center' }
  },
  'dynamic-glitch': {
    artist: { x: 0.5, y: 0.15, scale: 0.9, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.2, scale: 0.8, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 2.0, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.7, scale: 1.2, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 1.0, visible: true, align: 'center' }
  },
  'dynamic-typewriter': {
    artist: { x: 0.1, y: 0.1, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.1, y: 0.15, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.1, y: 0.25, scale: 1.5, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.6, scale: 1.2, visible: true, align: 'center' },
    cover: { x: 0.8, y: 0.2, scale: 0.8, visible: true, align: 'center' }
  },
  'dynamic-neon': {
    artist: { x: 0.5, y: 0.85, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.9, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.15, scale: 1.8, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.5, scale: 1.3, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 0, visible: false, align: 'center' }
  },
  'dynamic-kinetic': {
    artist: { x: 0.5, y: 0.1, scale: 1.0, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.15, scale: 0.8, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.3, scale: 2.5, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.65, scale: 1.5, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 0, visible: false, align: 'center' }
  },
  'dynamic-3d': {
    artist: { x: 0.5, y: 0.15, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.2, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.35, scale: 2.0, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.75, scale: 1.2, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.5, scale: 0, visible: false, align: 'center' }
  },
  'dynamic-karaoke': {
    artist: { x: 0.1, y: 0.85, scale: 0.8, visible: true, align: 'left' },
    album: { x: 0.1, y: 0.9, scale: 0.7, visible: true, align: 'left' },
    title: { x: 0.1, y: 0.75, scale: 1.5, visible: true, align: 'left' },
    lyrics: { x: 0.5, y: 0.4, scale: 1.4, visible: true, align: 'center' },
    cover: { x: 0.85, y: 0.85, scale: 0.8, visible: true, align: 'center' }
  },
  'dynamic-wave': {
    artist: { x: 0.5, y: 0.2, scale: 0.8, visible: true, align: 'center' },
    album: { x: 0.5, y: 0.25, scale: 0.7, visible: true, align: 'center' },
    title: { x: 0.5, y: 0.1, scale: 1.5, visible: true, align: 'center' },
    lyrics: { x: 0.5, y: 0.7, scale: 1.1, visible: true, align: 'center' },
    cover: { x: 0.5, y: 0.45, scale: 1.0, visible: true, align: 'center' }
  }
};
