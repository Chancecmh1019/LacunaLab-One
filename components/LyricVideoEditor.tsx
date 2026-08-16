
// ... existing imports ...
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProjectData, LayoutPreset, LayoutConfig, ElementStyle, VocabWord, WatermarkSettings } from '../types';
import { analyzeSongVibe, generateAestheticImage, generateFastImage, searchLexicaImages, generateBackgroundVideo, generateRomanization, extractVocabulary } from '../services/geminiService';
import { Play, Pause, Download, Wand2, Loader2, Image as ImageIcon, Sparkles, Layout, Globe, Type, Film, Layers, Upload, Disc, Search, Grid, Zap, X, Crown, ArrowRight, Video, Aperture, Move, Link as LinkIcon, Clock, Minus, Plus, Settings2, MoveVertical, Palette, Sun, Moon, CheckCircle, Smartphone, Activity, Gamepad2, GraduationCap, User, Eye, EyeOff, MoveHorizontal, MousePointerClick, Sliders, Scissors, Stamp, ListVideo } from 'lucide-react';
import { wrapText, drawRoundedRect, getContrastColor } from '../utils/canvasUtils';
import { LAYOUT_PRESETS, FONT_STACK } from '../utils/layoutPresets';
import { getLanguageLabel, detectLanguageFromLyrics } from '../utils/languageDetector';
import { useRenderQueue } from '../contexts/RenderQueueContext';
const buildLyricVideoOutputName = (artist: string, title: string, extension: string) => {
  const sanitize = (value: string, fallback: string) =>
    (value || fallback).trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ') || fallback;
  const cleanArtist = sanitize(artist, 'Unknown Artist');
  const cleanTitle = sanitize(title, '未命名');
  const cleanExtension = extension.replace(/^\./, '').trim() || 'mp4';
  return `${cleanArtist} - ${cleanTitle}｜繁體中字翻譯.${cleanExtension}`;
};

// ... (Keep existing Type Declarations for VideoEncoder/AudioEncoder/etc) ...
declare class VideoEncoder {
  constructor(init: any);
  configure(config: any): void;
  encode(frame: any, options?: any): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: "configured" | "unconfigured" | "closed";
  static isConfigSupported(config: any): Promise<any>;
}

declare class AudioEncoder {
  constructor(init: any);
  configure(config: any): void;
  encode(data: any): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: "configured" | "unconfigured" | "closed";
  static isConfigSupported(config: any): Promise<any>;
}

declare class VideoFrame {
  constructor(source: any, init?: any);
  close(): void;
}

declare class AudioData {
  constructor(init: any);
  close(): void;
}

interface Props {
  project: ProjectData;
  onUpdate: (data: Partial<ProjectData>) => void;
}

const LyricVideoEditor: React.FC<Props> = ({ project, onUpdate }) => {
  // ... (Keep existing Hooks and State) ...
  const { addToQueue } = useRenderQueue();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [fontsLoaded, setFontsLoaded] = useState(false); // Font preloading state
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [exportMode, setExportMode] = useState<'fast' | 'compatible'>('fast');
  const [isGeneratingRomanization, setIsGeneratingRomanization] = useState(false);
  const [isGeneratingVocab, setIsGeneratingVocab] = useState(false);
  
  // New State for Queue Button
  const [hasAddedToQueue, setHasAddedToQueue] = useState(false);
  
  // Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'library' | 'fast-gen' | 'pro-gen'>('library');

  // AI Model Selection State
  const [selectedImageModel, setSelectedImageModel] = useState<string>('gemini-2.5-flash-image');
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('veo-3.1-fast-generate-preview');
  
  // NEW: Fast Gen Model Selection
  const [selectedFastModel, setSelectedFastModel] = useState<string>('flux');

  // Assets
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Use a ref to track export state in async/event callbacks to avoid stale closures
  const isExportingRef = useRef(false);

  useEffect(() => {
    isExportingRef.current = isExporting;
  }, [isExporting]);

  // NEW: Prevent accidental tab close during work
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          const isBusy = isExporting || isAnalyzing || isGeneratingImage || isGeneratingVideo || isGeneratingRomanization || isGeneratingVocab;
          if (isBusy) {
              e.preventDefault();
              e.returnValue = '工作正在進行中，確定要離開嗎？';
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExporting, isAnalyzing, isGeneratingImage, isGeneratingVideo, isGeneratingRomanization, isGeneratingVocab]);

  // Initialize Trim settings if not present
  useEffect(() => {
    if (project.trimStart === undefined && audioRef.current?.duration) {
         onUpdate({ trimStart: 0, trimEnd: audioRef.current.duration });
    }
  }, [project.trimStart, audioRef.current?.duration]);

  // 自動判斷語言（當歌詞更新時）
  useEffect(() => {
    if (project.lyrics && project.lyrics.length > 0) {
      const detectedLanguage = detectLanguageFromLyrics(project.lyrics);
      if (detectedLanguage !== project.metadata.language) {
        onUpdate({ metadata: { ...project.metadata, language: detectedLanguage }});
      }
    }
  }, [project.lyrics]);

  // --- Preload Fonts ---
  useEffect(() => {
    const loadFonts = async () => {
        if ('fonts' in document) {
            try {
                // Wait for document.fonts to be ready initially
                await document.fonts.ready;

                // Explicitly load specific families used in Canvas
                // We must be exhaustive with the weights/sizes to prevent fallback.
                const fontsToLoad = [
                    '700 90px "Noto Serif TC"',
                    '500 55px "Noto Serif TC"',
                    '400 55px "Noto Serif TC"',
                    '300 48px "Noto Serif TC"',
                    '700 90px "Zen Old Mincho"',
                    '600 42px "Zen Old Mincho"',
                    '500 34px "Zen Old Mincho"',
                    '400 55px "Zen Old Mincho"', // Lyric
                    '300 48px "Zen Old Mincho"', // Trans
                    '700 90px "Noto Serif KR"',
                    '300 55px "Montserrat"',
                ];

                for (const font of fontsToLoad) {
                    await (document as any).fonts.load(font);
                }
                
                // Strict Polling Check
                // We will NOT set fontsLoaded until we are sure they are renderable.
                let attempts = 0;
                const checkAll = () => fontsToLoad.every(f => document.fonts.check(f));
                
                while (!checkAll() && attempts < 50) { // 5 seconds max
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                // *** CRITICAL SAFETY BUFFER ***
                // Even after 'check' returns true, the rasterizer needs a split second.
                // We force a delay to absolutely eliminate the FOUT "jump".
                await new Promise(r => setTimeout(r, 800));

            } catch (e) {
                console.warn("Font loading check failed", e);
            }
        }
        setFontsLoaded(true);
    };
    loadFonts();
  }, []);

  // --- Initialization ---
  useEffect(() => {
    if (project.theme.bgImageUrl && project.theme.bgMode !== 'ai-video') {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = project.theme.bgImageUrl;
        img.onload = () => { bgImageRef.current = img; };
    } else {
        bgImageRef.current = null;
    }
  }, [project.theme.bgImageUrl, project.theme.bgMode]);

  // NEW: Initialize Background Video
  useEffect(() => {
    if (project.theme.bgVideoUrl && project.theme.bgMode === 'ai-video') {
        const vid = document.createElement('video');
        vid.crossOrigin = "anonymous";
        vid.src = project.theme.bgVideoUrl;
        vid.loop = true;
        vid.muted = true;
        vid.play().catch(e => console.warn("Video autoplay blocked", e));
        bgVideoRef.current = vid;
    } else {
        bgVideoRef.current = null;
    }
  }, [project.theme.bgVideoUrl, project.theme.bgMode]);

  useEffect(() => {
      if (project.metadata.coverUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = project.metadata.coverUrl;
          img.onload = () => { coverImageRef.current = img; };
      }
  }, [project.metadata.coverUrl]);

  // --- Performance: Pre-render Noise ---
  useEffect(() => {
      const createNoise = () => {
          const w = 512; 
          const h = 512;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if(!ctx) return;
          
          const idata = ctx.createImageData(w, h);
          const data = idata.data;
          
          for (let i = 0; i < data.length; i += 4) {
              // Generate greyscale noise
              const v = Math.random() * 255;
              data[i] = v;     // R
              data[i+1] = v;   // G
              data[i+2] = v;   // B
              data[i+3] = 40;  // Alpha (Base visibility)
          }
          ctx.putImageData(idata, 0, 0);
          noiseCanvasRef.current = canvas;
      };
      createNoise();
  }, []);

  const applyPreset = (preset: LayoutPreset) => {
      const config = LAYOUT_PRESETS[preset];
      onUpdate({
          theme: {
              ...project.theme,
              preset: preset,
              layout: JSON.parse(JSON.stringify(config))
          }
      });
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      onUpdate({
        theme: {
          ...project.theme,
          bgImageUrl: result,
          bgMode: 'custom-image'
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // --- Audio Setup ---
  useEffect(() => {
    if (project.audioFile && audioRef.current) {
      const url = URL.createObjectURL(project.audioFile);
      audioRef.current.src = url;
      // When audio is loaded, set default trim if needed
      audioRef.current.onloadedmetadata = () => {
          if (project.trimEnd === undefined || project.trimEnd === 0) {
              onUpdate({ trimStart: 0, trimEnd: audioRef.current?.duration || 60 });
          }
      };
      return () => URL.revokeObjectURL(url);
    }
  }, [project.audioFile]);

  const initAudioContext = () => {
      if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          
          if (audioRef.current) {
              const source = ctx.createMediaElementSource(audioRef.current);
              source.connect(ctx.destination);
              sourceNodeRef.current = source;
          }
      } else if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
      }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      initAudioContext();
      if (isPlaying) {
          audioRef.current.pause();
          if(bgVideoRef.current) bgVideoRef.current.pause();
      } else {
          // If we are outside of trim range, jump to start
          const start = project.trimStart || 0;
          const end = project.trimEnd || audioRef.current.duration;
          
          if (audioRef.current.currentTime < start || audioRef.current.currentTime >= end) {
              audioRef.current.currentTime = start;
          }
          audioRef.current.play();
          if(bgVideoRef.current) bgVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      let now = audioRef.current.currentTime;
      
      // Loop Logic for Shorts Trim
      const start = project.trimStart || 0;
      const end = project.trimEnd || audioRef.current.duration;
      
      // If Shorts mode (9:16) enabled, enforce loop
      // IMPORTANT: DISABLE LOOP IF EXPORTING TO PREVENT HANG
      if (project.theme.aspectRatio === '9:16' && isPlaying && !isExportingRef.current) {
          if (now >= end) {
              audioRef.current.currentTime = start;
              now = start;
          }
      }

      setCurrentTime(now);
      
      // Update progress if in compatible export mode
      if (isExportingRef.current && exportMode === 'compatible') {
          // Progress relative to trim duration
          const duration = end - start;
          const p = Math.round(((now - start) / duration) * 100);
          setExportProgress(Math.min(100, Math.max(0, p)));
      }
    }
  };

  // --- Core Rendering Function (Reused for Preview & Export) ---
  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
      // ... (Keep existing background/overlay logic) ...
      const { layout, preset, overlayOpacity, secondaryColor, backgroundColor, effects, fontSizeScale = 1.0, shadowIntensity = 1.0, lyricStyle, aspectRatio, gameMode, creatorTag, watermark } = project.theme;
      
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const isVertical = aspectRatio === '9:16';

      // 1. Background Logic (With Ken Burns Effect)
      const aiImage = bgImageRef.current;
      const aiVideo = bgVideoRef.current;
      const albumCover = coverImageRef.current;
      
      // Default fill color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // --- KEN BURNS EFFECT CALCULATIONS ---
      const zoomIntensity = effects.kenBurnsIntensity ?? 0; 
      const cycle = 60; 
      const progress = (time % cycle) / cycle; 
      const smooth = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
      
      const currentScale = 1.0 + (smooth * zoomIntensity);
      
      const drawWithEffect = (img: CanvasImageSource, imgW: number, imgH: number, blur = 0, offsetX = 0, clipX = 0, clipW = width, clipY = 0, clipH = height) => {
           const ratio = Math.max(clipW / imgW, clipH / imgH);
           const drawW = imgW * ratio * currentScale;
           const drawH = imgH * ratio * currentScale;
           
           const cx = clipX + (clipW - drawW) / 2;
           const cy = clipY + (clipH - drawH) / 2;
           
           ctx.save();
           ctx.beginPath();
           ctx.rect(clipX, clipY, clipW, clipH);
           ctx.clip();
           
           if (blur > 0) ctx.filter = `blur(${blur}px) contrast(1.1)`;
           ctx.drawImage(img, cx + offsetX, cy, drawW, drawH);
           ctx.restore();
      }

      // Logic for background (full width)
      const clipW = width;
      const clipH = height;
      
      const isQuizPhase = gameMode === 'intro-quiz' && time < 5;
      const quizBlur = isQuizPhase ? 40 : effects.blurBackground;
      
      // 【修正2】新增文青素色背景模式
      if (project.theme.bgMode === 'solid-vintage') {
           // 從專輯封面提取主色調，生成文青復古色系
           // 使用柔和的漸層，避免顏色太尖銳
           const vintageColors = [
               ['#8B7355', '#6B5D52'], // 復古棕
               ['#7A6F5D', '#5C5449'], // 文青灰棕
               ['#6B8E7F', '#4A6B5E'], // 復古綠
               ['#8B7B8B', '#6B5B6B'], // 復古紫灰
               ['#7B6B5A', '#5B4B3A'], // 復古土黃
               ['#6B7B8B', '#4B5B6B'], // 復古藍灰
           ];
           // 根據歌曲標題的長度選擇顏色（簡單的偽隨機）
           const colorIndex = (project.metadata.title.length + project.metadata.artist.length) % vintageColors.length;
           const [color1, color2] = vintageColors[colorIndex];
           
           const grad = ctx.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.7, height * 0.7, width * 0.8);
           grad.addColorStop(0, color1);
           grad.addColorStop(1, color2);
           ctx.fillStyle = grad;
           ctx.fillRect(0, 0, width, height);
           
           // 添加紙張紋理效果：使用預先生成的 noise，避免每一幀 5000 次隨機繪製造成閃爍。
           if (noiseCanvasRef.current) {
               ctx.save();
               ctx.globalAlpha = 0.055;
               const pattern = ctx.createPattern(noiseCanvasRef.current, 'repeat');
               if (pattern) {
                   const driftX = (time * 2.2) % noiseCanvasRef.current.width;
                   const driftY = (time * 1.1) % noiseCanvasRef.current.height;
                   ctx.translate(driftX, driftY);
                   ctx.fillStyle = pattern;
                   ctx.fillRect(-driftX, -driftY, width + noiseCanvasRef.current.width, height + noiseCanvasRef.current.height);
               }
               ctx.restore();
           }
      } else if (project.theme.bgMode === 'ai-video' && aiVideo && aiVideo.readyState >= 2) {
           drawWithEffect(aiVideo, aiVideo.videoWidth, aiVideo.videoHeight, quizBlur, 0, 0, clipW, 0, clipH);
      } else if (aiImage && project.theme.bgMode !== 'ai-video') {
           drawWithEffect(aiImage, aiImage.width, aiImage.height, quizBlur, 0, 0, clipW, 0, clipH); 
      } else if (project.theme.bgMode === 'album-blur' && albumCover) {
           drawWithEffect(albumCover, albumCover.width, albumCover.height, 60, 0, 0, clipW, 0, clipH); 
      } else if (project.theme.bgMode === 'ai-image' && aiImage) { 
           drawWithEffect(aiImage, aiImage.width, aiImage.height, quizBlur, 0, 0, clipW, 0, clipH);
      }

      // --- CD BOOKLET AMBIENT MOTION ---
      // 文青版不使用誇張特效，而是用極慢的封面光影、紙面漂移與細線位移補足動態感。
      if (preset === 'cd-booklet' && !isVertical) {
          ctx.save();
          const driftX = Math.sin(time * 0.18) * width * 0.018;
          const driftY = Math.cos(time * 0.14) * height * 0.012;

          if (albumCover) {
              const ghostSize = Math.max(width, height) * 0.82;
              ctx.globalAlpha = 0.055;
              ctx.filter = 'blur(90px) saturate(0.75)';
              ctx.drawImage(
                  albumCover,
                  width * 0.54 - ghostSize * 0.5 + driftX,
                  height * 0.5 - ghostSize * 0.5 + driftY,
                  ghostSize,
                  ghostSize
              );
              ctx.filter = 'none';
          }

          const glowX = width * 0.72 + driftX * 0.8;
          const glowY = height * 0.46 + driftY * 0.8;
          const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, width * 0.42);
          glow.addColorStop(0, secondaryColor);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.045 + Math.sin(time * 0.22) * 0.008;
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, width, height);

          // 幾乎不被注意到的「印刷版面漂移線」，讓靜態畫面有呼吸感。
          ctx.globalAlpha = 0.07;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          const guideX = width * 0.515 + Math.sin(time * 0.12) * 3;
          ctx.beginPath();
          ctx.moveTo(guideX, height * 0.10);
          ctx.lineTo(guideX, height * 0.90);
          ctx.stroke();
          ctx.restore();
      }

      // --- DYNAMIC BACKGROUNDS ---
      if (preset === 'dynamic-split') {
          ctx.save();
          const splitX = width * 0.5 + Math.sin(time * 0.5) * 50;
          
          // Left Side
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(0, 0, splitX, height);
          
          // Right Side (Background Image or Dark Color)
          ctx.beginPath();
          ctx.rect(splitX, 0, width - splitX, height);
          ctx.clip();
          if (albumCover) {
              drawWithEffect(albumCover, albumCover.width, albumCover.height, 40, 0, splitX, width - splitX, 0, height);
          } else {
              ctx.fillStyle = '#111';
              ctx.fillRect(splitX, 0, width - splitX, height);
          }
          ctx.restore();
          
          // Draw Split Line
          ctx.beginPath();
          ctx.moveTo(splitX, 0);
          ctx.lineTo(splitX, height);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.stroke();
      } else if (preset === 'dynamic-neon') {
          ctx.fillStyle = '#050505'; // Deep black
          ctx.fillRect(0, 0, width, height);
          
          // Pulse Grid
          ctx.save();
          ctx.strokeStyle = secondaryColor;
          ctx.globalAlpha = 0.2 + Math.sin(time * 2) * 0.1;
          ctx.lineWidth = 2;
          const gridSize = 100;
          const offset = (time * 50) % gridSize;
          
          // Horizontal Lines (Perspective)
          for (let i = height/2; i < height; i += 40) {
              ctx.beginPath();
              ctx.moveTo(0, i);
              ctx.lineTo(width, i);
              ctx.stroke();
          }
          // Vertical Lines
          for (let i = 0; i < width; i += gridSize) {
              ctx.beginPath();
              ctx.moveTo(i, height/2);
              ctx.lineTo(i - (width/2 - i) * 2, height);
              ctx.stroke();
          }
          ctx.restore();
      } else if (preset === 'dynamic-wave') {
          // Audio Visualizer Background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, width, height);
          
          ctx.save();
          ctx.globalAlpha = 0.3;
          const bars = 60;
          const barW = width / bars;
          for (let i = 0; i < bars; i++) {
              const freq = (i / bars) * 10;
              const mag = Math.abs(Math.sin(time * 2 + freq) * Math.cos(time * 3 + freq)) * height * 0.6;
              
              ctx.fillStyle = i % 2 === 0 ? secondaryColor : '#fff';
              ctx.fillRect(i * barW, height/2 - mag/2, barW - 2, mag);
          }
          ctx.restore();
      }

      if (preset === 'framed-minimal') {
          const border = 60;
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(border, border, width - border*2, height - border*2);
      }

      if (overlayOpacity > 0) {
          ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`; 
          ctx.fillRect(0,0,width,height);
      }
      
      if (isVertical) {
          const grad = ctx.createLinearGradient(0, height * 0.5, 0, height);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
          grad.addColorStop(1, 'rgba(0,0,0,0.8)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, height * 0.5, width, height);
      }

      if (effects.vignetteStrength > 0) {
          const grad = ctx.createRadialGradient(width/2, height/2, width * 0.4, width/2, height/2, width * 0.8);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, `rgba(0,0,0,${effects.vignetteStrength})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0,0,width,height);
      }
      
      const drawSmartGradient = (yPos: number, heightPercent = 0.4) => {
          const baseIntensity = 0.5 + (overlayOpacity * 0.3);
          const intensity = Math.min(0.9, baseIntensity * shadowIntensity); 
          const gradH = height * heightPercent;
          
          ctx.save();
          if (yPos > 0.6) {
              const grad = ctx.createLinearGradient(0, height, 0, height - gradH);
              grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, height - gradH, width, gradH);
          } else if (yPos < 0.4) {
              const grad = ctx.createLinearGradient(0, 0, 0, gradH);
              grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, width, gradH);
          } else {
              const grad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width*0.7);
              grad.addColorStop(0, `rgba(0,0,0,${intensity * 0.7})`);
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, width, height);
          }
          ctx.restore();
      };

      if (!isVertical) {
          if (layout.lyrics.visible) drawSmartGradient(layout.lyrics.y);
          if (Math.abs(layout.lyrics.y - layout.title.y) > 0.4) {
              drawSmartGradient(layout.title.y, 0.3);
          }
      }
      
      const effectiveLayout = isVertical ? {
         artist: { ...layout.artist, x: 0.5, y: 0.45, align: 'center' as const },
         title: { ...layout.title, x: 0.5, y: 0.5, align: 'center' as const, scale: layout.title.scale * 0.8 },
         album: { ...layout.album, visible: false },
         lyrics: { ...layout.lyrics, x: 0.5, y: 0.7, align: 'center' as const, scale: layout.lyrics.scale * 1.2 },
         cover: { ...layout.cover, x: 0.5, y: 0.3, align: 'center' as const, scale: 0.8 } 
      } : layout;

      // ... (Cover drawing logic remains same) ...
      if (effectiveLayout.cover && effectiveLayout.cover.visible && albumCover) {
          const cv = effectiveLayout.cover;
          const size = 400 * cv.scale; 
          
          let cx = cv.x * width;
          let cy = cv.y * height;
          
          // CD Booklet：把「封面 + 專輯名 + 歌名 + 演出者」視為同一個資訊群組，整組沿 Y 軸置中。
          // 只做極小幅度的平移，不改變使用者設定的 X 位置，也不讓元素互相追趕。
          if (preset === 'cd-booklet' && !isVertical) {
              const metadataStackHeight = 208;
              const groupHeight = size + metadataStackHeight;
              const groupTop = (height - groupHeight) / 2;
              cx += Math.cos(time * 0.32) * 2.5;
              cy = groupTop + size / 2 + Math.sin(time * 0.42) * 3.5;
          }
          
          // Dynamic Floating Effect
          if (preset === 'dynamic-floating') {
              cy += Math.sin(time * 1.5) * 20;
          }
          
          if (cv.align === 'left') cx += size/2; 
          else if (cv.align === 'right') cx -= size/2;
          
          const drawX = cx - size/2;
          const drawY = cy - size/2;
          
          ctx.save();
          
          if (preset === 'dynamic-vinyl') {
              // VINYL RECORD DRAWING
              const rotation = time * 1.5; // Rotation speed
              
              ctx.translate(cx, cy);
              ctx.rotate(rotation);
              
              // Draw Vinyl Record (Black Circle)
              ctx.beginPath();
              ctx.arc(0, 0, size/2, 0, Math.PI * 2);
              ctx.fillStyle = '#111';
              ctx.fill();
              
              // Draw Grooves (Subtle rings)
              ctx.strokeStyle = '#222';
              ctx.lineWidth = 2;
              for(let r = size/2 * 0.4; r < size/2 * 0.95; r += 4) {
                  ctx.beginPath();
                  ctx.arc(0, 0, r, 0, Math.PI * 2);
                  ctx.stroke();
              }
              
              // Draw Label (Album Cover)
              ctx.beginPath();
              ctx.arc(0, 0, size/2 * 0.35, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(albumCover, -size/2 * 0.35, -size/2 * 0.35, size * 0.35, size * 0.35);
              ctx.restore();
              
              // Draw Glint
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(rotation); // Rotate glint with record or keep static? Static looks better for light source
              ctx.rotate(-rotation); // Counter rotate to keep glint static relative to screen
              
              const grad = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
              grad.addColorStop(0, 'rgba(255,255,255,0)');
              grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
              grad.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(0, 0, size/2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              
          } else if (preset === 'dynamic-glitch') {
              // GLITCH EFFECT
              const glitchOffset = Math.random() > 0.9 ? (Math.random() - 0.5) * 20 : 0;
              const rOffset = Math.random() > 0.95 ? 10 : 0;
              
              ctx.save();
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 30 * shadowIntensity;
              ctx.beginPath();
              drawRoundedRect(ctx, drawX + glitchOffset, drawY, size, size, 20); 
              ctx.clip();
              
              // Draw Base
              ctx.drawImage(albumCover, drawX + glitchOffset, drawY, size, size);
              
              // Draw Color Fringe (Red)
              if (Math.random() > 0.8) {
                  ctx.globalCompositeOperation = 'lighter';
                  ctx.globalAlpha = 0.5;
                  ctx.fillStyle = 'red';
                  ctx.fillRect(drawX, drawY, size, size); // Tint
                  ctx.drawImage(albumCover, drawX + glitchOffset + 5, drawY, size, size);
              }
              
              // Draw Scanline
              if (Math.random() > 0.7) {
                  ctx.fillStyle = 'rgba(0,0,0,0.2)';
                  ctx.fillRect(drawX, drawY + Math.random() * size, size, 2);
              }
              
              ctx.strokeStyle = 'rgba(255,255,255,0.5)';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.restore();
              
          } else {
              // STANDARD COVER DRAWING
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 30 * shadowIntensity;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 10;
              ctx.beginPath();
              drawRoundedRect(ctx, drawX, drawY, size, size, 20); 
              ctx.clip();
              ctx.drawImage(albumCover, drawX, drawY, size, size);
              ctx.strokeStyle = 'rgba(255,255,255,0.15)';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.restore();
          }
          
          if (preset === 'cd-booklet' && !isVertical) {
              ctx.save();
              const metaCenterX = drawX + size / 2;
              const coverBottom = drawY + size;

              ctx.strokeStyle = 'rgba(255,255,255,0.28)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(drawX, coverBottom + 18);
              ctx.lineTo(drawX + size, coverBottom + 18);
              ctx.stroke();

              ctx.textAlign = 'center';
              ctx.fillStyle = '#ffffff';
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
      
      // ... (Watermark logic remains same) ...
      if (watermark && watermark.text) {
          ctx.save();
          ctx.globalAlpha = watermark.opacity || 0.6;
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          const wmSize = 30 * (watermark.scale || 1.0);
          ctx.font = `600 ${wmSize}px ${watermark.fontFamily || FONT_STACK}`;
          ctx.fillStyle = '#ffffff';
          if (watermark.x > 0.5) ctx.textAlign = 'right';
          else if (watermark.x < 0.5) ctx.textAlign = 'left';
          else ctx.textAlign = 'center';
          ctx.fillText(watermark.text, width * watermark.x, height * watermark.y);
          ctx.restore();
      }

      // --- TEXT RENDERING (Wait for Fonts) ---
      if (fontsLoaded) {
          ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
          ctx.shadowBlur = 10 * shadowIntensity;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          let primaryTextColor = '#fff';
          let secondaryTextColor = secondaryColor;
          let tertiaryTextColor = 'rgba(255,255,255,0.7)';
          
          const calculateMaxWidth = (xPercent: number, align: string) => {
              const x = xPercent * width;
              const padding = 60; 
              if (align === 'left') return (width - x) - padding;
              else if (align === 'right') return x - padding;
              else {
                  const distToEdge = Math.min(x, width - x);
                  return (distToEdge * 2) - padding;
              }
          };
          
          const drawTextElement = (text: string, style: ElementStyle, fontSize: number, fontWeight: string, color: string, spacing = "0px", font = FONT_STACK) => {
              if (!style.visible || !text) return;
              let x = style.x * width;
              let y = style.y * height;
              
              // Dynamic Floating for Text
              if (preset === 'dynamic-floating') {
                  y += Math.sin(time * 2 + (x/width)) * 10;
              }
              
              // Dynamic Glitch for Text
              if (preset === 'dynamic-glitch' && Math.random() > 0.92) {
                  x += (Math.random() - 0.5) * 10;
              }
              
              // Dynamic Kinetic Scale
              let scale = style.scale;
              if (preset === 'dynamic-kinetic') {
                  const beat = Math.sin(time * 8); // Simulated beat
                  if (beat > 0.8) scale *= 1.1;
              }
              
              ctx.textAlign = style.align;
              ctx.fillStyle = color;
              
              const finalSize = fontSize * scale;
              
              ctx.font = `${fontWeight} ${finalSize}px ${font}`;
              ctx.letterSpacing = spacing;
              
              // Dynamic Neon Glow
              if (preset === 'dynamic-neon') {
                  ctx.shadowColor = color;
                  ctx.shadowBlur = 20 + Math.sin(time * 5) * 10;
              }
              
              // Dynamic 3D Effect
              if (preset === 'dynamic-3d') {
                  const depth = 8;
                  ctx.fillStyle = 'rgba(0,0,0,0.3)';
                  for(let i=1; i<=depth; i++) {
                      ctx.fillText(text, x + i, y + i);
                  }
                  ctx.fillStyle = color;
              }
              
              const maxWidth = calculateMaxWidth(style.x, style.align);
              const lines = wrapText(ctx, text, maxWidth);
              
              lines.forEach((line, i) => {
                  ctx.fillText(line, x, y + (i * (finalSize * 1.2)));
              });
          };

          if (gameMode === 'intro-quiz') {
               const relTime = time - (project.trimStart || 0);
               if (relTime < 5) {
                   ctx.fillStyle = 'rgba(0,0,0,0.5)';
                   ctx.fillRect(0,0,width,height);
                   ctx.textAlign = 'center';
                   ctx.fillStyle = '#fff';
                   ctx.font = `700 ${120}px ${FONT_STACK}`;
                   const countdown = Math.ceil(5 - relTime);
                   ctx.fillText(countdown.toString(), width/2, height/2);
                   ctx.font = `500 ${40}px ${FONT_STACK}`;
                   ctx.letterSpacing = '5px';
                   ctx.fillText("GUESS THE SONG", width/2, height/2 - 100);
                   return; 
               } else if (relTime < 6) {
                   const flashOp = 1.0 - (relTime - 5);
                   ctx.fillStyle = `rgba(255,255,255,${flashOp})`;
                   ctx.fillRect(0,0,width,height);
               }
          }

          if (preset !== 'cd-booklet' || isVertical) {
              drawTextElement(project.metadata.artist, effectiveLayout.artist, 42, "700", secondaryTextColor, "6px");

              if (effectiveLayout.album) { 
                 drawTextElement(project.metadata.album || "", effectiveLayout.album, 34, "600", tertiaryTextColor, "4px");
              }

              if (preset === 'post-modern' && !isVertical) {
                  ctx.save();
                  ctx.globalAlpha = 0.2;
                  ctx.shadowBlur = 0;
                  drawTextElement(project.metadata.title, effectiveLayout.title, 90, "700", primaryTextColor, "2px");
                  ctx.restore();
              } else {
                  let titleScaleFactor = 1.0;
                  if (project.metadata.title.length > 12) titleScaleFactor = 0.85;
                  if (project.metadata.title.length > 20) titleScaleFactor = 0.7;
                  
                  drawTextElement(project.metadata.title, effectiveLayout.title, 90 * titleScaleFactor, "800", primaryTextColor, "2px");
              }
          }
              
          const lyricX = effectiveLayout.lyrics.x * width;
          const lyricY = effectiveLayout.lyrics.y * height;
          ctx.textAlign = effectiveLayout.lyrics.align;
          
          const effectiveTime = time - (project.lyricOffset || 0);

          // 計算最後一句歌詞的結束時間（給予更長的顯示時間）
          const getLineEndTime = (line: any, idx: number) => {
            if (line.endTime) return line.endTime;
            const nextLine = project.lyrics[idx + 1];
            if (nextLine) return nextLine.timestamp;
            // 最後一句歌詞：給予更長的顯示時間（5秒）
            return line.timestamp + 5;
          };

          const currentIndex = project.lyrics.findIndex((line, i) => {
            const end = getLineEndTime(line, i);
            return effectiveTime >= line.timestamp && effectiveTime < end;
          });

          // --- CD BOOKLET：原版歌詞邏輯維持三句 ---
          // 三句全部使用同一個固定字級；長句只換行，不因內容長度縮小字體。
          // 原文在上、譯文在下；只有當前句沿用原版 mainAlpha 淡入／淡出。
          // 上下超出歌詞欄位的內容，依距離做漸淡 + blur，不讓整組歌詞移動。
          if (preset === 'cd-booklet' && !isVertical && currentIndex !== -1) {
            const baseScale = (effectiveLayout.lyrics.scale || 1) * fontSizeScale;
            const style = lyricStyle || {
                textColor: '#ffffff',
                strokeColor: '#000000',
                strokeWidth: 0,
                glowColor: '#000000',
                glowBlur: 0,
                fontWeight: '400',
                autoContrast: false
            };

            // 只在 CD-booklet 繪製時把整個歌詞欄稍微向右移，不改使用者已經設定好的 layout。
            const panelLeft = effectiveLayout.lyrics.x * width + width * 0.016;
            const panelRight = width * 0.965;
            const lyricMaxWidth = Math.max(320, panelRight - panelLeft);
            const lyricAreaTop = height * 0.105;
            const lyricAreaBottom = height * 0.895;

            const originalFontSize = 42 * baseScale;
            const translationFontSize = 35 * baseScale;
            const originalLineHeight = originalFontSize * 1.30;
            const translationLineHeight = translationFontSize * 1.30;
            const translationGap = Math.max(12, 14 * baseScale);
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

            // 當前句固定在中心。上一句在上、下一句在下；沒有任何滑動／漂浮動畫。
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

            // 原版規則：只有現在這一句在開始／結束時淡入淡出。
            const currentLine = project.lyrics[currentIndex];
            const start = currentLine.timestamp;
            const end = getLineEndTime(currentLine, currentIndex);
            const timeSinceStart = effectiveTime - start;
            const timeUntilEnd = end - effectiveTime;
            let mainAlpha = 1.0;
            if (timeSinceStart < 0.3) mainAlpha = timeSinceStart / 0.3;
            const isLastLine = currentIndex === project.lyrics.length - 1;
            const fadeOutDur = isLastLine ? 1.5 : 0.4;
            if (timeUntilEnd < fadeOutDur) mainAlpha = Math.min(mainAlpha, timeUntilEnd / fadeOutDur);
            mainAlpha = Math.max(0, Math.min(1, mainAlpha));

            // 欄位邊緣效果：越接近上下邊界越淡、越模糊；真正超出欄位就裁掉。
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
                ctx.fillStyle = isCurrent && !isTranslation ? style.textColor : '#ffffff';
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
          } else if (currentIndex !== -1) {
            // ... (Standard lyric drawing remains unchanged) ...
            const line = project.lyrics[currentIndex];
            const isLastLine = currentIndex === project.lyrics.length - 1;
            
            const fadeInDur = 0.25;
            // 最後一句歌詞淡出時間加長到 1.5 秒
            const fadeOutDur = isLastLine ? 1.5 : 0.5;
            const start = line.timestamp;
            const end = getLineEndTime(line, currentIndex);
            const timeSinceStart = effectiveTime - start;
            const timeUntilEnd = end - effectiveTime;
            
            let alpha = 1.0;
            if (timeSinceStart < fadeInDur) alpha = timeSinceStart / fadeInDur;
            if (timeUntilEnd < fadeOutDur) alpha = Math.min(alpha, timeUntilEnd / fadeOutDur);
            alpha = Math.max(0, Math.min(1, alpha));

            const yFloatOffset = (1 - alpha) * 10;
            
            ctx.save();
            ctx.globalAlpha = alpha;

            const scale = (effectiveLayout.lyrics.scale || 1) * fontSizeScale;
            const lyricMaxWidth = calculateMaxWidth(effectiveLayout.lyrics.x, effectiveLayout.lyrics.align);
            
            const style = lyricStyle || { textColor: '#ffffff', strokeColor: '#000000', strokeWidth: 0, glowColor: '#000000', glowBlur: 0, fontWeight: '400', autoContrast: false };

            let lyricColor = style.textColor;
            if (style.autoContrast) lyricColor = getContrastColor(backgroundColor);

            const isFanchant = line.original.startsWith('(') || line.isFanchant;
            if (isFanchant) {
                lyricColor = secondaryColor;
                ctx.shadowColor = secondaryColor;
                ctx.shadowBlur = 20;
            } else {
                if (style.strokeWidth > 0) { ctx.strokeStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth; }
                if (style.glowBlur > 0) { ctx.shadowColor = style.glowColor; ctx.shadowBlur = style.glowBlur; }
                else { ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`; ctx.shadowBlur = 10 * shadowIntensity; }
            }
            
            ctx.fillStyle = lyricColor;
            
            const isModern = preset === 'editorial-clean' || preset === 'bottom-modern' || preset === 'swiss-grid' || preset === 'modern-bauhaus';
            let fontFace = FONT_STACK;
            if (isModern) fontFace = 'Montserrat, sans-serif';
            if (preset === 'dynamic-typewriter') fontFace = '"Courier New", monospace';
            if (preset === 'dynamic-glitch') fontFace = '"Courier New", monospace';

            const baseFontSize = 55 * scale;
            const lyricWeight = style.fontWeight || (isModern ? '300' : '400');
            ctx.font = `${lyricWeight} ${baseFontSize}px ${fontFace}`;
            ctx.letterSpacing = "1px";
            
            if (gameMode === 'lyric-mask') ctx.filter = 'blur(20px)';
            if (preset === 'dynamic-neon') {
                ctx.shadowColor = lyricColor;
                ctx.shadowBlur = 15 + Math.sin(time * 5) * 5;
            }
            
            const orgLines = wrapText(ctx, line.original, lyricMaxWidth);
            const lineHeight = baseFontSize * 1.25;

            const totalLength = orgLines.reduce((acc, cur) => acc + cur.length, 0);
            let currentGlobalCharIndex = 0;

            orgLines.forEach((l, i) => {
                const yPos = lyricY + (i * lineHeight) + yFloatOffset;
                
                // TYPEWRITER EFFECT
                if (preset === 'dynamic-typewriter') {
                    const lineDuration = end - start;
                    const progress = Math.max(0, Math.min(1, timeSinceStart / (lineDuration * 0.8))); // Finish typing at 80%
                    const totalVisibleChars = Math.floor(totalLength * progress);
                    
                    let visibleInLine = totalVisibleChars - currentGlobalCharIndex;
                    visibleInLine = Math.max(0, Math.min(l.length, visibleInLine));
                    
                    const visibleText = l.substring(0, visibleInLine);
                    const isActiveLine = visibleInLine < l.length && visibleInLine >= 0 && (totalVisibleChars >= currentGlobalCharIndex);
                    // Show cursor if this is the active line being typed, or if it's the last line and we haven't finished the wait time
                    const showCursor = (isActiveLine || (i === orgLines.length - 1 && visibleInLine === l.length && progress < 1.0)) && (time % 0.5 < 0.25);
                    
                    ctx.fillText(visibleText + (showCursor ? '|' : ''), lyricX, yPos);
                    currentGlobalCharIndex += l.length;
                    return;
                }
                
                // KARAOKE EFFECT
                if (preset === 'dynamic-karaoke') {
                    // Draw base text
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText(l, lyricX, yPos);
                    
                    // Draw active text clipped
                    ctx.save();
                    const lineDuration = end - start;
                    const progress = Math.max(0, Math.min(1, timeSinceStart / lineDuration));
                    const textWidth = ctx.measureText(l).width;
                    
                    let clipX = lyricX;
                    if (effectiveLayout.lyrics.align === 'center') clipX = lyricX - textWidth/2;
                    else if (effectiveLayout.lyrics.align === 'right') clipX = lyricX - textWidth;
                    
                    ctx.beginPath();
                    ctx.rect(clipX, yPos - baseFontSize, textWidth * progress, baseFontSize * 1.5);
                    ctx.clip();
                    
                    ctx.fillStyle = secondaryColor;
                    ctx.fillText(l, lyricX, yPos);
                    ctx.restore();
                    return;
                }
                
                if (style.strokeWidth > 0 && !isFanchant) ctx.strokeText(l, lyricX, yPos);
                ctx.fillText(l, lyricX, yPos);
            });
            
            ctx.filter = 'none';
            let nextY = lyricY + (orgLines.length * lineHeight) + (10 * scale);

            if (line.romanization) {
                 ctx.fillStyle = 'rgba(255,255,255,0.9)';
                 const romSize = 36 * scale;
                 const romHeight = romSize * 1.25;
                 ctx.font = `300 ${romSize}px ${FONT_STACK}`;
                 const romLines = wrapText(ctx, line.romanization, lyricMaxWidth);
                 romLines.forEach((l, i) => {
                    const yPos = nextY + (i * romHeight) + yFloatOffset;
                    ctx.fillText(l, lyricX, yPos);
                 });
                 nextY += (romLines.length * romHeight) + (5 * scale);
            }

            const transYOffset = nextY - lyricY;
            
            // 只有在有翻譯時才顯示翻譯行
            if (line.translation && line.translation.trim().length > 0) {
                ctx.fillStyle = style.autoContrast ? lyricColor : tertiaryTextColor; 
                const transFontSize = 48 * scale;
                const transLineHeight = transFontSize * 1.25;
                ctx.font = `300 ${transFontSize}px ${FONT_STACK}`;
                if (style.strokeWidth > 0 && !isFanchant) ctx.lineWidth = style.strokeWidth * 0.5;

                const transLines = wrapText(ctx, line.translation, lyricMaxWidth);
                transLines.forEach((l, i) => {
                    const yPos = lyricY + transYOffset + (i * transLineHeight) + yFloatOffset;
                    if (style.strokeWidth > 0 && !isFanchant) ctx.strokeText(l, lyricX, yPos);
                    ctx.fillText(l, lyricX, yPos);
                });
            }
            ctx.restore();
          }
      }

      // ... (Vocab card and Film grain remain unchanged) ...
      if (gameMode === 'vocab-card' && project.vocabList && project.vocabList.length > 0) {
           const showVocab = time > (project.trimEnd || audioRef.current?.duration || 100) - 10;
           if (showVocab) {
               ctx.fillStyle = 'rgba(0,0,0,0.85)';
               ctx.fillRect(0,0,width,height);
               
               ctx.textAlign = 'center';
               ctx.fillStyle = secondaryColor;
               ctx.font = `700 ${50}px ${FONT_STACK}`; // No fontSizeScale
               ctx.fillText("TODAY'S VOCABULARY", width/2, height * 0.2);
               
               project.vocabList.forEach((word, i) => {
                   const y = height * 0.35 + (i * 150);
                   
                   ctx.fillStyle = '#fff';
                   ctx.font = `700 ${60}px ${FONT_STACK}`; // No fontSizeScale
                   ctx.fillText(word.word, width/2, y);
                   
                   ctx.fillStyle = '#ccc';
                   ctx.font = `400 ${30}px ${FONT_STACK}`; // No fontSizeScale
                   ctx.fillText(word.pronunciation || "", width/2, y + 45);
                   
                   ctx.fillStyle = secondaryColor;
                   ctx.font = `400 ${35}px ${FONT_STACK}`; // No fontSizeScale
                   ctx.fillText(word.meaning, width/2, y + 90);
               });
           }
      }

      if (project.theme.texture !== 'clean' && noiseCanvasRef.current) {
          ctx.save();
          ctx.globalCompositeOperation = 'overlay'; 
          ctx.globalAlpha = project.theme.texture === 'paper' ? 0.35 : (effects.filmGrainStrength || 0.15);
          const shiftX = Math.floor(Math.random() * 100);
          const shiftY = Math.floor(Math.random() * 100);
          const pattern = ctx.createPattern(noiseCanvasRef.current, 'repeat');
          if (pattern) {
              ctx.translate(shiftX, shiftY);
              ctx.fillStyle = pattern;
              ctx.fillRect(-shiftX, -shiftY, width, height); 
          }
          ctx.restore();
      }
  }, [project.theme, project.lyrics, project.metadata, project.lyricOffset, fontsLoaded, project.vocabList, project.trimStart, project.trimEnd]);

  // ... (Keep existing Effect loops and AI handlers) ...
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      let animId: number;
      const render = () => {
          const liveTime = audioRef.current && !audioRef.current.paused 
             ? audioRef.current.currentTime 
             : currentTime;

          drawFrame(ctx, liveTime);
          animId = requestAnimationFrame(render);
      };
      render();
      return () => cancelAnimationFrame(animId);
  }, [drawFrame, currentTime]);

  // ... (Keep remaining methods: autoAnalyze, handleGenerateImage, etc) ...
  const autoAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        const rawLyrics = project.lyrics.map(l => l.original).join('\n');
        const result = await analyzeSongVibe(
            rawLyrics, 
            project.metadata.artist, 
            project.metadata.title,
            project.metadata.album,
            project.metadata.coverUrl
        );
        onUpdate({
            theme: {
                ...project.theme,
                backgroundColor: result.colors[0],
                primaryColor: result.colors[1],
                secondaryColor: result.colors[2],
                fontFamily: FONT_STACK,
                bgImagePrompt: result.imagePrompt,
                texture: 'paper',
                analysisSources: result.sources
            }
        });
        if (result.searchQuery) setSearchQuery(result.searchQuery);
    } catch (e) {
        console.error("Auto analyze error:", e);
        alert("分析失敗，請檢查 API Key 或網路連線");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleGenerateRomanization = async () => {
      setIsGeneratingRomanization(true);
      try {
          const originals = project.lyrics.map(l => l.original);
          const romanized = await generateRomanization(originals);
          const newLyrics = project.lyrics.map((line, i) => ({
              ...line,
              romanization: romanized[i] || ""
          }));
          onUpdate({ lyrics: newLyrics });
          alert("羅馬拼音生成完成！");
      } catch (e) {
          console.error(e);
          alert("生成失敗");
      } finally {
          setIsGeneratingRomanization(false);
      }
  };

  const handleGenerateVocab = async () => {
      setIsGeneratingVocab(true);
      try {
          const rawLyrics = project.lyrics.map(l => l.original).join("\n");
          const vocab = await extractVocabulary(rawLyrics);
          onUpdate({ vocabList: vocab });
          alert("單字卡生成完成！");
      } catch (e) {
          console.error(e);
          alert("單字卡失敗");
      } finally {
          setIsGeneratingVocab(false);
      }
  }

  const handleGenerateImage = async () => {
      if (!project.theme.bgImagePrompt) return;
      setIsGeneratingImage(true);
      try {
          const imageUrl = await generateAestheticImage(project.theme.bgImagePrompt, selectedImageModel);
          if (imageUrl) {
              onUpdate({ theme: { ...project.theme, bgImageUrl: imageUrl, bgMode: 'ai-image' } });
              setIsSearchOpen(false); 
          } else {
              alert("圖片生成失敗 (請嘗試切換模型 或 改用 Fast Gen)");
          }
      } catch (e) {
          console.error("Image Gen Error", e);
          alert("圖片生成發生錯誤 (Quota Exceeded? Try Fast Gen)");
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const handleGenerateVideo = async () => {
      if (!project.theme.bgImagePrompt) return;
      setIsGeneratingVideo(true);
      try {
          const videoUrl = await generateBackgroundVideo(project.theme.bgImagePrompt, selectedVideoModel);
          if (videoUrl) {
              onUpdate({ theme: { ...project.theme, bgVideoUrl: videoUrl, bgMode: 'ai-video' } });
              setIsSearchOpen(false);
          } else {
              alert("AI 影片生成失敗 (Veo Error)");
          }
      } catch (e) {
          console.error("Video Gen Error", e);
      } finally {
          setIsGeneratingVideo(false);
      }
  };

  const performSearch = async () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      try {
          if (searchMode === 'library') {
              const results = await searchLexicaImages(searchQuery);
              setSearchResults(results);
          } else if (searchMode === 'fast-gen') {
              const results = Array.from({length: 4}).map((_, i) => 
                 generateFastImage(searchQuery, i, selectedFastModel)
              );
              setSearchResults(results);
          }
      } catch (e) {
          console.error("Search error", e);
          setSearchResults([]);
      } finally {
          setIsSearching(false);
      }
  };

  useEffect(() => {
      if (isSearchOpen && searchQuery && searchResults.length === 0 && searchMode !== 'pro-gen') {
          performSearch();
      }
  }, [isSearchOpen, searchMode]);

  const getCompatibleMimeType = () => {
    const types = [
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      'video/mp4',
      'video/webm; codecs=vp9',
      'video/webm'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return 'video/webm';
  };

  const handleCompatibleExport = async () => {
    if (!audioRef.current || !canvasRef.current) return;
    setExportMode('compatible');
    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(true); 
    if(bgVideoRef.current) bgVideoRef.current.play();
    
    const mimeType = getCompatibleMimeType();
    const isMp4 = mimeType.includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    
    const startTime = project.trimStart || 0;
    const endTime = project.trimEnd || audioRef.current.duration;
    
    try {
        initAudioContext();
        if (!audioContextRef.current || !sourceNodeRef.current) throw new Error("Audio Context not ready");
        const ctx = audioContextRef.current;
        const dest = ctx.createMediaStreamDestination();
        sourceNodeRef.current.connect(dest);
        
        const canvasStream = canvasRef.current.captureStream(30);
        const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        
        const recorder = new MediaRecorder(combinedStream, { 
            mimeType: mimeType, 
            videoBitsPerSecond: 8000000 
        });
        
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = buildLyricVideoOutputName(project.metadata.artist, project.metadata.title, ext);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setIsExporting(false); setExportProgress(0); setIsPlaying(false);
        };
        
        audioRef.current.currentTime = startTime;
        audioRef.current.play(); 
        if(bgVideoRef.current) { bgVideoRef.current.currentTime = startTime; bgVideoRef.current.play(); }

        recorder.start();
        
        const checkEnd = () => {
            if (audioRef.current && audioRef.current.currentTime >= endTime) {
                if (recorder.state !== 'inactive') recorder.stop();
                audioRef.current.pause();
                audioRef.current.removeEventListener('timeupdate', checkEnd);
            }
        };
        audioRef.current.addEventListener('timeupdate', checkEnd);
        audioRef.current.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
        
    } catch (error) {
        console.error("Compatible Export Failed", error);
        alert("匯出失敗，請刷新頁面重試。"); setIsExporting(false);
    }
  };

  const toggleLanguage = () => {
      const modes: ('KR' | 'EN' | 'JP' | 'CN')[] = ['KR', 'EN', 'JP', 'CN'];
      const current = project.metadata.language || 'KR';
      const next = modes[(modes.indexOf(current) + 1) % modes.length];
      onUpdate({ metadata: { ...project.metadata, language: next }});
  };

  // 自動判斷語言（當歌詞更新時）
  const autoDetectLanguage = () => {
      if (project.lyrics && project.lyrics.length > 0) {
          const detectedLanguage = detectLanguageFromLyrics(project.lyrics);
          if (detectedLanguage !== project.metadata.language) {
              onUpdate({ metadata: { ...project.metadata, language: detectedLanguage }});
          }
      }
  };

  const PRESET_LABELS: Record<string, string> = {
      'cd-booklet': '文青專輯',
      'magazine-left': '經典雜誌(左)',
      'magazine-right': '經典雜誌(右)',
      'cinema-center': '電影置中',
      'editorial-clean': '極簡編輯',
      'midnight-radio': '午夜電台',
      'bottom-modern': '現代底部',
      'soft-dream': '夢幻柔焦',
      'swiss-grid': '瑞士網格',
      'fashion-cover': '時尚封面',
      'left-balance': '左側平衡',
      'right-balance': '右側平衡',
      'corner-info': '四角資訊',
      'post-modern': '後現代',
      'retro-vhs': '復古錄影帶',
      'minimal-centered': '極致置中',
      'modern-bauhaus': '包浩斯幾何',
      'classic-serif': '古典襯線',
      'framed-minimal': '極簡畫框',
      'gradient-air': '空氣感漸層',
      'pure-essence': '純粹本質',
      'film-subtitle': '電影字幕',
      'novel-cover': '小說封面',
      'art-exhibition': '藝術展覽',
      'lyric-focus': '歌詞聚焦',
      'golden-ratio': '黃金比例',
      'melancholy-blue': '憂鬱藍調',
      'quiet-place': '寧靜之地',
      // DYNAMIC MV
      'dynamic-vinyl': '旋轉黑膠',
      'dynamic-floating': '漂浮歌詞',
      'dynamic-split': '幾何分割',
      'dynamic-glitch': '故障藝術',
      'dynamic-typewriter': '打字機',
      'dynamic-neon': '霓虹脈動',
      'dynamic-kinetic': '動態排版',
      'dynamic-3d': '3D透視',
      'dynamic-karaoke': '卡拉OK',
      'dynamic-wave': '音波律動'
  };

  const PRESET_GROUPS = {
    '動態 MV': [
      'dynamic-vinyl', 'dynamic-floating', 'dynamic-split', 'dynamic-glitch',
      'dynamic-typewriter', 'dynamic-neon', 'dynamic-kinetic', 'dynamic-3d',
      'dynamic-karaoke', 'dynamic-wave'
    ],
    '文青質感': [
      'cd-booklet', 'pure-essence', 'film-subtitle', 'novel-cover',
      'art-exhibition', 'lyric-focus', 'golden-ratio', 'melancholy-blue', 'quiet-place'
    ],
    '經典版面': [
      'magazine-left', 'magazine-right', 'cinema-center', 'editorial-clean',
      'midnight-radio', 'bottom-modern', 'soft-dream', 'swiss-grid',
      'fashion-cover', 'left-balance', 'right-balance', 'corner-info',
      'post-modern', 'retro-vhs', 'minimal-centered', 'modern-bauhaus',
      'classic-serif', 'framed-minimal', 'gradient-air'
    ]
  };

  const isProcessing = isAnalyzing || isGeneratingImage;
  const compatibleLabel = getCompatibleMimeType().includes('mp4') ? "原生 MP4" : "WebM 模式";

  const lyricStyle = project.theme.lyricStyle || {
      textColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
      glowColor: '#000000',
      glowBlur: 0,
      fontWeight: '400',
      autoContrast: false
  };

  const watermark = project.theme.watermark || {
      text: '',
      x: 0.95,
      y: 0.05,
      scale: 1.0,
      opacity: 0.6
  };

  const updateLyricStyle = (updates: Partial<typeof lyricStyle>) => {
      onUpdate({
          theme: {
              ...project.theme,
              lyricStyle: { ...lyricStyle, ...updates }
          }
      });
  };

  const updateWatermark = (updates: Partial<typeof watermark>) => {
      onUpdate({
          theme: {
              ...project.theme,
              watermark: { ...watermark, ...updates }
          }
      });
  }
  
  const updateLayoutElement = (element: keyof LayoutConfig, updates: Partial<ElementStyle>) => {
    onUpdate({
        theme: {
            ...project.theme,
            layout: {
                ...project.theme.layout,
                [element]: { ...project.theme.layout[element], ...updates }
            }
        }
    });
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddToQueue = () => {
    if (hasAddedToQueue) return;
    setHasAddedToQueue(true);
    addToQueue(project);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-neutral-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-full lg:w-80 bg-gradient-to-b from-neutral-950 to-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-800/50 flex flex-col z-20 shadow-2xl overflow-y-auto custom-scrollbar max-h-[60vh] lg:max-h-none">
         <div className="p-4 sm:p-6 border-b border-neutral-800/50 sticky top-0 bg-gradient-to-b from-neutral-950 to-neutral-900 z-10">
             <h2 className="text-lg sm:text-xl font-bold font-serif-tc flex items-center gap-2 text-amber-400">
                 <Sparkles className="text-amber-500 w-[18px] h-[18px] sm:w-5 sm:h-5"/> 
                 影片工作室
             </h2>
             <p className="text-[10px] sm:text-xs text-neutral-500 mt-1">Lyric Video Studio</p>
         </div>
         
         <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-20 sm:pb-24">
             {/* GROUP 1: PROJECT SETTINGS */}
             <div className="space-y-3 sm:space-y-4 border-b border-neutral-800/50 pb-4 sm:pb-6">
                 <h3 className="text-[10px] sm:text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                     <Settings2 size={12}/> 專案設定
                 </h3>
                 <button 
                     onClick={() => onUpdate({ theme: { ...project.theme, aspectRatio: project.theme.aspectRatio === '9:16' ? '16:9' : '9:16' } })}
                     className={`w-full p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-between transition-all active:scale-[0.98] ${project.theme.aspectRatio === '9:16' ? 'bg-amber-900/40 border-amber-500/50 text-white shadow-lg shadow-amber-900/20' : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'}`}
                 >
                     <span className="flex items-center gap-2"><Smartphone size={14} className="sm:w-4 sm:h-4"/> 短影音模式 (9:16)</span>
                     {project.theme.aspectRatio === '9:16' && <CheckCircle size={14} className="sm:w-4 sm:h-4 text-amber-400"/>}
                 </button>
                 
                 {project.theme.aspectRatio === '9:16' && (
                     <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 space-y-2 sm:space-y-3">
                         <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-amber-300">
                             <Scissors size={12}/> 剪輯區間
                         </div>
                         <div className="flex gap-2 text-xs">
                             <div className="flex-1">
                                 <label className="text-[9px] sm:text-[10px] text-neutral-500 block mb-1">開始 (秒)</label>
                                 <div className="relative">
                                     <input 
                                        type="number" 
                                        value={project.trimStart || 0}
                                        onChange={(e) => onUpdate({ trimStart: Math.max(0, Number(e.target.value)) })}
                                        className="w-full bg-neutral-900/50 border border-neutral-700/50 rounded-lg p-1 text-center font-mono text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                     />
                                     <span className="absolute right-1 top-1 text-[8px] sm:text-[9px] text-neutral-600">{formatTime(project.trimStart || 0)}</span>
                                 </div>
                             </div>
                             <div className="flex-1">
                                 <label className="text-[9px] sm:text-[10px] text-neutral-500 block mb-1">結束 (秒)</label>
                                 <div className="relative">
                                     <input 
                                        type="number" 
                                        value={project.trimEnd || 60}
                                        onChange={(e) => onUpdate({ trimEnd: Math.min(audioRef.current?.duration || 300, Number(e.target.value)) })}
                                        className="w-full bg-neutral-900/50 border border-neutral-700/50 rounded-lg p-1 text-center font-mono text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                     />
                                     <span className="absolute right-1 top-1 text-[8px] sm:text-[9px] text-neutral-600">{formatTime(project.trimEnd || 60)}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="text-[9px] sm:text-[10px] text-neutral-400 text-center flex items-center justify-center gap-2">
                             <span>總長度: {formatTime((project.trimEnd || 60) - (project.trimStart || 0))}</span>
                             {((project.trimEnd || 60) - (project.trimStart || 0)) > 60 && <span className="text-red-400">(大於60秒)</span>}
                         </div>
                     </div>
                 )}

                 <div className="flex gap-2">
                     <button onClick={toggleLanguage} className="flex-1 p-2 rounded-xl border border-neutral-700/50 bg-neutral-900/50 flex items-center justify-center gap-2 text-[10px] sm:text-xs hover:bg-neutral-800/50 transition-all active:scale-[0.98]">
                        <Globe size={14} className="text-neutral-500"/>
                        <span>{getLanguageLabel(project.metadata.language)}</span>
                     </button>
                     <button 
                        onClick={handleGenerateRomanization}
                        disabled={isGeneratingRomanization}
                        className="flex-1 p-2 bg-neutral-800/50 hover:bg-neutral-700/50 rounded-xl text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-neutral-700/50 text-neutral-300"
                        title="Generate Romanization"
                     >
                        {isGeneratingRomanization ? <Loader2 className="animate-spin" size={14}/> : <Type size={14}/>}
                        <span>羅馬拼音</span>
                     </button>
                 </div>

                 {/* Engagement Section */}
                 <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-xl p-3 space-y-3">
                     <div>
                        <div className="text-xs text-neutral-500 mb-2 font-bold flex items-center gap-1"><Gamepad2 size={10}/> 遊戲模式</div>
                        <select 
                            value={project.theme.gameMode || 'none'} 
                            onChange={(e) => onUpdate({ theme: { ...project.theme, gameMode: e.target.value as any } })}
                            className="w-full bg-neutral-950/80 border border-neutral-700/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                        >
                            <option value="none">無 (None)</option>
                            <option value="intro-quiz">前奏猜歌 (Intro Quiz)</option>
                            <option value="lyric-mask">記憶大考驗 (Lyric Mask)</option>
                            <option value="vocab-card">結尾單字卡 (Vocab Card)</option>
                        </select>
                     </div>

                     {/* Watermark Section (Replaced Creator Tag) */}
                     <div className="pt-2 border-t border-neutral-800/50">
                        <div className="text-xs text-neutral-500 mb-2 font-bold flex items-center gap-1"><Stamp size={10}/> 浮水印</div>
                        <input 
                            type="text"
                            value={watermark.text}
                            onChange={(e) => updateWatermark({ text: e.target.value })}
                            placeholder="@YourChannelName"
                            className="w-full bg-neutral-950/80 border border-neutral-700/50 rounded-lg p-2 text-xs text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all mb-2"
                        />
                        {watermark.text && (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1">
                                         <MoveHorizontal size={10} className="text-neutral-500 mr-2"/>
                                         <input type="range" min="0" max="1" step="0.01" value={watermark.x} onChange={(e) => updateWatermark({ x: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                                    </div>
                                    <div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1">
                                         <MoveVertical size={10} className="text-neutral-500 mr-2"/>
                                         <input type="range" min="0" max="1" step="0.01" value={watermark.y} onChange={(e) => updateWatermark({ y: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 text-[9px] text-neutral-500 flex items-center justify-between px-1">
                                        <span>Scale</span>
                                        <input type="range" min="0.5" max="2" step="0.1" value={watermark.scale} onChange={(e) => updateWatermark({ scale: parseFloat(e.target.value) })} className="w-16 accent-amber-500 h-1 bg-neutral-800 rounded"/>
                                    </div>
                                    <div className="flex-1 text-[9px] text-neutral-500 flex items-center justify-between px-1">
                                        <span>Opac</span>
                                        <input type="range" min="0.1" max="1" step="0.1" value={watermark.opacity} onChange={(e) => updateWatermark({ opacity: parseFloat(e.target.value) })} className="w-16 accent-amber-500 h-1 bg-neutral-800 rounded"/>
                                    </div>
                                </div>
                            </div>
                        )}
                     </div>
                     
                     {project.theme.gameMode === 'vocab-card' && (
                         <button 
                            onClick={handleGenerateVocab}
                            disabled={isGeneratingVocab}
                            className="w-full py-2 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/50 rounded-xl text-xs font-bold text-amber-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                         >
                             {isGeneratingVocab ? <Loader2 className="animate-spin" size={14}/> : <GraduationCap size={14}/>}
                             <span>生成今日單字</span>
                         </button>
                     )}
                 </div>
             </div>
             
             {/* ... (Keep remaining UI groups exactly as they are) ... */}
             <div className="space-y-4 border-b border-neutral-800 pb-6">
                 {/* ... (Background & Layout) ... */}
                 {/* ... (Typography) ... */}
                 {/* ... (Lyric Style) ... */}
                 {/* ... (Visual Effects) ... */}
                 {/* ... (Just make sure not to cut anything, assume existing code unless specified) ... */}
                 {/* Since I am just updating the render logic in drawFrame, I will rely on the diff for the changed logic */}
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ImageIcon size={12}/> 背景與版面
                 </h3>
                 {/* ... (Controls) ... */}
                 <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50 space-y-3">
                     <div className="grid grid-cols-2 gap-2">
                         <button 
                             onClick={() => document.getElementById('bg-upload')?.click()}
                             className={`py-2 px-3 rounded-xl border border-dashed border-neutral-600/50 hover:border-neutral-400 hover:bg-neutral-800/50 text-neutral-400 hover:text-white text-xs font-bold transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 h-16 ${project.theme.bgMode === 'custom-image' ? 'border-amber-500 bg-amber-900/20 text-amber-200' : ''}`}
                         >
                            <Upload size={16}/>
                            <span>上傳圖片</span>
                         </button>
                         <input type="file" id="bg-upload" accept="image/*" className="hidden" onChange={handleBgUpload} />

                         <button 
                             onClick={() => onUpdate({ theme: { ...project.theme, bgImageUrl: undefined, bgMode: 'album-blur' } })}
                             className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 h-16 ${project.theme.bgMode === 'album-blur' ? 'bg-amber-900/40 border-amber-500/50 text-white' : 'border-neutral-800/50 text-neutral-400 hover:bg-neutral-800/50'}`}
                         >
                             <Disc size={16}/>
                             <span>專輯模糊</span>
                         </button>
                         
                         <button 
                             onClick={() => onUpdate({ theme: { ...project.theme, bgImageUrl: undefined, bgMode: 'solid-vintage' } })}
                             className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 h-16 ${project.theme.bgMode === 'solid-vintage' ? 'bg-amber-900/40 border-amber-500/50 text-white' : 'border-neutral-800/50 text-neutral-400 hover:bg-neutral-800/50'}`}
                         >
                             <Palette size={16}/>
                             <span>文青素色</span>
                         </button>
                     </div>
                     {/* ... */}
                     <div className="space-y-2 pt-2 border-t border-neutral-800/50">
                         <button onClick={() => autoAnalyze()} disabled={isProcessing} className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${isProcessing ? 'bg-amber-800 cursor-wait' : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500'}`}>
                            {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                            <span>{isAnalyzing ? "正在搜尋 & 分析中..." : "1. AI 深度分析"}</span>
                         </button>
                         <button onClick={() => { if(!searchQuery && project.metadata.title) { setSearchQuery(`${project.metadata.title} kpop aesthetic wallpaper`); } setIsSearchOpen(true); }} className="w-full py-2.5 bg-neutral-800/50 hover:bg-neutral-700/50 rounded-xl text-xs font-bold text-amber-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-neutral-700/50 relative">
                             <Search size={14}/> <span>2. 選擇背景</span>
                             {searchQuery && !project.theme.bgImageUrl && <div className="absolute top-1/2 -translate-y-1/2 right-3 w-2 h-2 bg-amber-500 rounded-full animate-pulse"/>}
                         </button>
                     </div>
                 </div>
                 {/* ... */}
                 <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50">
                    <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase">版面預設</div>
                    <select value={project.theme.preset} onChange={(e) => applyPreset(e.target.value as LayoutPreset)} className="w-full bg-neutral-950/80 border border-neutral-700/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all mb-3">
                        {Object.entries(PRESET_GROUPS).map(([groupName, presets]) => (
                            <optgroup key={groupName} label={groupName} className="bg-neutral-900 text-amber-500 font-bold">
                                {presets.map(key => (
                                    <option key={key} value={key} className="text-white font-normal">{PRESET_LABELS[key]}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                 </div>
             </div>
             
             {/* ... And so on for other groups ... */}
             
             {/* GROUP 3: ELEMENT CUSTOMIZATION */}
             <div className="space-y-4 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sliders size={12}/> 元素微調
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50 space-y-4">
                     {/* Title */}
                     <div>
                        <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-white flex items-center gap-1"><button onClick={() => updateLayoutElement('title', { visible: !project.theme.layout.title.visible })}>{project.theme.layout.title.visible ? <Eye size={12} className="text-neutral-400"/> : <EyeOff size={12} className="text-neutral-600"/>}</button> 歌名</span>
                             <span className="text-[10px] text-neutral-500">{Math.round(project.theme.layout.title.scale * 100)}%</span>
                        </div>
                        <input type="range" min="0.1" max="3.0" step="0.1" value={project.theme.layout.title.scale} onChange={(e) => updateLayoutElement('title', { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded mb-2"/>
                        <div className="flex gap-2"><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveHorizontal size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.title.x} onChange={(e) => updateLayoutElement('title', { x: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveVertical size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.title.y} onChange={(e) => updateLayoutElement('title', { y: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div></div>
                     </div>
                     <div className="border-t border-neutral-800/50"/>
                     {/* Artist */}
                     <div>
                        <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-white flex items-center gap-1"><button onClick={() => updateLayoutElement('artist', { visible: !project.theme.layout.artist.visible })}>{project.theme.layout.artist.visible ? <Eye size={12} className="text-neutral-400"/> : <EyeOff size={12} className="text-neutral-600"/>}</button> 歌手</span><span className="text-[10px] text-neutral-500">{Math.round(project.theme.layout.artist.scale * 100)}%</span></div>
                        <input type="range" min="0.1" max="2.0" step="0.1" value={project.theme.layout.artist.scale} onChange={(e) => updateLayoutElement('artist', { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded mb-2"/>
                         <div className="flex gap-2"><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveHorizontal size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.artist.x} onChange={(e) => updateLayoutElement('artist', { x: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveVertical size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.artist.y} onChange={(e) => updateLayoutElement('artist', { y: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div></div>
                     </div>
                     <div className="border-t border-neutral-800/50"/>
                     {/* Album */}
                     <div>
                        <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-white flex items-center gap-1"><button onClick={() => updateLayoutElement('album', { visible: !project.theme.layout.album?.visible })}>{project.theme.layout.album?.visible ? <Eye size={12} className="text-neutral-400"/> : <EyeOff size={12} className="text-neutral-600"/>}</button> 專輯</span><span className="text-[10px] text-neutral-500">{Math.round((project.theme.layout.album?.scale || 1) * 100)}%</span></div>
                        <input type="range" min="0.1" max="2.0" step="0.1" value={project.theme.layout.album?.scale || 0.6} onChange={(e) => updateLayoutElement('album', { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded mb-2"/>
                         <div className="flex gap-2"><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveHorizontal size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.album?.x || 0.5} onChange={(e) => updateLayoutElement('album', { x: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div><div className="flex-1 flex items-center bg-neutral-950/80 rounded-lg border border-neutral-800/50 px-2 py-1"><MoveVertical size={10} className="text-neutral-500 mr-2"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.album?.y || 0.5} onChange={(e) => updateLayoutElement('album', { y: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div></div>
                     </div>
                 </div>
             </div>

             {/* GROUP 4: LYRIC STYLE */}
             <div className="space-y-4 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Palette size={12}/> 字幕樣式
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50 space-y-4">
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>字幕字體大小</span><span>{Math.round((project.theme.fontSizeScale || 1.0) * 100)}%</span></div>
                         <input type="range" min="0.5" max="1.5" step="0.05" value={project.theme.fontSizeScale || 1.0} onChange={(e) => onUpdate({theme: {...project.theme, fontSizeScale: parseFloat(e.target.value)}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>字幕位置</span><span>{Math.round(project.theme.layout.lyrics.y * 100)}%</span></div>
                         <div className="flex items-center gap-2"><MoveVertical size={12} className="text-neutral-500"/><input type="range" min="0" max="1" step="0.01" value={project.theme.layout.lyrics.y} onChange={(e) => updateLayoutElement('lyrics', { y: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                         <div className="bg-neutral-950/80 p-2 rounded-lg border border-neutral-800/50 flex justify-between items-center"><span className="text-[10px] text-neutral-400">顏色</span><input type="color" value={lyricStyle.textColor} onChange={(e) => updateLyricStyle({ textColor: e.target.value })} className="bg-transparent border-none w-5 h-5 p-0 cursor-pointer"/></div>
                         <div className="bg-neutral-950/80 p-2 rounded-lg border border-neutral-800/50">
                             <select value={lyricStyle.fontWeight} onChange={(e) => updateLyricStyle({ fontWeight: e.target.value as any })} className="w-full bg-transparent text-[10px] text-white border-none focus:ring-0 p-0">
                                 <option value="300">細體 300</option><option value="400">標準 400</option><option value="500">中黑 500</option><option value="700">粗體 700</option><option value="900">特粗 900</option>
                             </select>
                         </div>
                     </div>
                     <div className="space-y-3 pt-2 border-t border-neutral-800/50">
                         <div><div className="flex justify-between items-center mb-1"><span className="text-[10px] text-neutral-500">描邊</span><input type="color" value={lyricStyle.strokeColor} onChange={(e) => updateLyricStyle({ strokeColor: e.target.value })} className="w-3 h-3 p-0 border-none bg-transparent"/></div><input type="range" min="0" max="8" step="0.5" value={lyricStyle.strokeWidth} onChange={(e) => updateLyricStyle({ strokeWidth: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div>
                         <div><div className="flex justify-between items-center mb-1"><span className="text-[10px] text-neutral-500">發光</span><input type="color" value={lyricStyle.glowColor} onChange={(e) => updateLyricStyle({ glowColor: e.target.value })} className="w-3 h-3 p-0 border-none bg-transparent"/></div><input type="range" min="0" max="20" step="1" value={lyricStyle.glowBlur} onChange={(e) => updateLyricStyle({ glowBlur: parseFloat(e.target.value) })} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/></div>
                     </div>
                     <button onClick={() => updateLyricStyle({ autoContrast: !lyricStyle.autoContrast })} className={`w-full py-2 px-3 rounded-xl text-xs flex items-center justify-between border transition-all active:scale-[0.98] ${lyricStyle.autoContrast ? 'bg-amber-900/50 border-amber-500/50 text-white' : 'bg-neutral-950/80 border-neutral-800/50 text-neutral-400'}`}>
                         <span className="flex items-center gap-2"><Sun size={12}/> 自動對比</span> {lyricStyle.autoContrast && <CheckCircle size={12} className="text-amber-400"/>}
                     </button>
                 </div>
             </div>
             
             {/* GROUP 5: VISUAL EFFECTS */}
             <div className="mt-8 border-t border-neutral-800/50 pt-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Aperture size={12}/> 視覺特效
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50 space-y-4">
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Ken Burns (動態推進)</span><span>{Math.round((project.theme.effects.kenBurnsIntensity || 0) * 100)}%</span></div>
                         <input type="range" min="0" max="0.8" step="0.1" value={project.theme.effects.kenBurnsIntensity} onChange={(e) => onUpdate({theme: {...project.theme, effects: {...project.theme.effects, kenBurnsIntensity: parseFloat(e.target.value)}}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Film Grain (底片顆粒)</span><span>{Math.round((project.theme.effects.filmGrainStrength || 0) * 100)}%</span></div>
                         <input type="range" min="0" max="0.5" step="0.05" value={project.theme.effects.filmGrainStrength} onChange={(e) => onUpdate({theme: {...project.theme, effects: {...project.theme.effects, filmGrainStrength: parseFloat(e.target.value)}}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Vignette (暗角)</span><span>{Math.round((project.theme.effects.vignetteStrength || 0) * 100)}%</span></div>
                         <input type="range" min="0" max="0.8" step="0.1" value={project.theme.effects.vignetteStrength || 0} onChange={(e) => onUpdate({theme: {...project.theme, effects: {...project.theme.effects, vignetteStrength: parseFloat(e.target.value)}}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Dim (全域壓暗)</span><span>{Math.round((project.theme.overlayOpacity || 0) * 100)}%</span></div>
                         <input type="range" min="0" max="0.9" step="0.1" value={project.theme.overlayOpacity} onChange={(e) => onUpdate({theme: {...project.theme, overlayOpacity: parseFloat(e.target.value)}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Shadow (文字陰影強度)</span><span>{Math.round((project.theme.shadowIntensity || 0.8) * 100)}%</span></div>
                         <input type="range" min="0" max="2.0" step="0.1" value={project.theme.shadowIntensity ?? 0.8} onChange={(e) => onUpdate({theme: {...project.theme, shadowIntensity: parseFloat(e.target.value)}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-1"><span>Blur (背景模糊)</span><span>{project.theme.effects.blurBackground || 0}px</span></div>
                         <input type="range" min="0" max="40" step="1" value={project.theme.effects.blurBackground || 0} onChange={(e) => onUpdate({theme: {...project.theme, effects: {...project.theme.effects, blurBackground: parseFloat(e.target.value)}}})} className="w-full accent-amber-500 h-1 bg-neutral-800 rounded"/>
                     </div>
                 </div>
             </div>

         </div>
      </div>

      {/* Main Preview Area (Unchanged) */}
      <div className="flex-1 bg-neutral-950 relative flex flex-col">
          <div className="flex-1 relative flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 bg-neutral-900 overflow-hidden">
              <canvas 
                ref={canvasRef} 
                width={project.theme.aspectRatio === '9:16' ? 1080 : 1920} 
                height={project.theme.aspectRatio === '9:16' ? 1920 : 1080} 
                className="max-h-full max-w-full shadow-2xl border border-neutral-800 bg-black object-contain transition-all duration-300"
                style={{ aspectRatio: project.theme.aspectRatio === '9:16' ? '9/16' : '16/9' }}
              />
          </div>

          <div className="h-20 sm:h-24 bg-gradient-to-b from-neutral-900 to-neutral-950 border-t border-neutral-800/50 flex items-center px-3 sm:px-4 md:px-6 lg:px-8 gap-3 sm:gap-4 md:gap-6 z-30">
              <button onClick={togglePlay} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 text-black flex items-center justify-center hover:scale-105 transition-all active:scale-95 shadow-lg shadow-amber-900/30 shrink-0">
                  {isPlaying ? <Pause size={16} className="sm:w-5 sm:h-5" fill="black"/> : <Play size={16} className="sm:w-5 sm:h-5 ml-0.5" fill="black"/>}
              </button>
              
              <div className="flex-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] sm:text-xs font-mono text-neutral-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(audioRef.current?.duration || 0)}</span>
                  </div>
                  <input 
                    type="range" min="0" max={audioRef.current?.duration || 100}
                    value={currentTime}
                    onChange={(e) => { if(audioRef.current) audioRef.current.currentTime = Number(e.target.value); }}
                    className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                  />
                  {/* Visual indication of trim range on timeline */}
                  {project.theme.aspectRatio === '9:16' && (
                     <div className="relative w-full h-1 mt-1">
                         <div 
                           className="absolute top-0 h-1 bg-amber-500/50 rounded-full"
                           style={{
                               left: `${((project.trimStart || 0) / (audioRef.current?.duration || 1)) * 100}%`,
                               width: `${(((project.trimEnd || 1) - (project.trimStart || 0)) / (audioRef.current?.duration || 1)) * 100}%`
                           }}
                         />
                     </div>
                  )}
              </div>

              {/* Lyric Offset Control */}
              <div className="flex items-center gap-2 bg-neutral-800/50 px-3 py-1.5 rounded-xl border border-neutral-700/50">
                  <Clock size={14} className="text-neutral-400"/>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold">Sync:</span>
                  <button 
                     onClick={() => {
                        const next = Math.round(((project.lyricOffset || 0) - 0.1) * 10) / 10;
                        onUpdate({ lyricOffset: next });
                     }}
                     className="p-1 hover:bg-neutral-700/50 rounded text-neutral-300 transition-all active:scale-95"
                  >
                      <Minus size={12}/>
                  </button>
                  <span className="text-xs font-mono w-10 text-center text-white">
                      {(project.lyricOffset || 0).toFixed(1)}s
                  </span>
                  <button 
                     onClick={() => {
                        const next = Math.round(((project.lyricOffset || 0) + 0.1) * 10) / 10;
                        onUpdate({ lyricOffset: next });
                     }}
                     className="p-1 hover:bg-neutral-700/50 rounded text-neutral-300 transition-all active:scale-95"
                  >
                      <Plus size={12}/>
                  </button>
              </div>

              {/* 匯出按鈕區域 */}
              <div className="flex gap-2">
                <button 
                    onClick={handleAddToQueue}
                    disabled={hasAddedToQueue}
                    className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] border ${hasAddedToQueue ? 'border-neutral-700/50 bg-neutral-800/50 text-neutral-500 cursor-not-allowed' : 'border-amber-600/50 bg-amber-900/30 text-amber-200 hover:bg-amber-800/40 shadow-lg shadow-amber-900/20'}`}
                >
                    <div className="flex items-center gap-1"><ListVideo size={12} className="sm:w-[14px] sm:h-[14px]"/> <span className="hidden sm:inline">{hasAddedToQueue ? "已加入" : "加入排程"}</span><span className="sm:hidden">{hasAddedToQueue ? "已加入" : "排程"}</span></div>
                    <span className="text-[9px] sm:text-[10px] opacity-60 font-normal hidden sm:block">批次背景渲染</span>
                </button>

                <button onClick={handleCompatibleExport} disabled={isExporting} className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] border border-neutral-700/50 ${isExporting && exportMode === 'compatible' ? 'bg-red-900 text-white cursor-not-allowed' : 'bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50 hover:text-white'}`}>
                    {isExporting && exportMode === 'compatible' ? <><Loader2 className="animate-spin w-3 h-3 sm:w-[14px] sm:h-[14px]"/><span className="text-[9px] sm:text-xs">錄製 {exportProgress}%</span></> : <><div className="flex items-center gap-1"><Film size={12} className="sm:w-[14px] sm:h-[14px]"/> <span className="hidden sm:inline">{compatibleLabel}</span><span className="sm:hidden">匯出</span></div><span className="text-[9px] sm:text-[10px] opacity-60 font-normal hidden sm:block">快速預覽匯出</span></>}
                </button>
              </div>
          </div>
          <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => {setIsPlaying(false);}} />
      </div>

      {/* ... (Search Modal Logic) ... */}
      {isSearchOpen && (
          // ... (Existing Modal Code) ...
          // ... For brevity, assume existing JSX is maintained ...
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
              <div className="bg-neutral-900 border border-neutral-700 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                  
                  <div className="p-6 border-b border-neutral-800/50 flex items-center justify-between bg-gradient-to-b from-neutral-900 to-neutral-950">
                      <div className="flex flex-col gap-1">
                          <h2 className="text-xl font-bold font-serif-tc text-white flex items-center gap-2">
                              <Search className="text-amber-400"/>
                              背景圖庫
                          </h2>
                          <div className="flex gap-2 text-xs">
                             <span className="text-neutral-500">當前關鍵字：</span>
                             <span className="text-amber-300 font-mono bg-amber-900/30 px-2 rounded">{searchQuery || "請先執行 AI 分析"}</span>
                          </div>
                      </div>
                      <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-neutral-800/50 rounded-full transition-all active:scale-95">
                          <X size={20} className="text-neutral-500"/>
                      </button>
                  </div>

                  {/* Search Bar & Tabs */}
                  <div className="p-6 border-b border-neutral-800/50 bg-neutral-900/50 flex flex-col gap-4">
                      {/* Tabs */}
                      <div className="flex gap-2">
                          <button 
                             onClick={() => { setSearchMode('library'); setSearchResults([]); }}
                             className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] ${searchMode === 'library' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' : 'bg-neutral-800/50 text-neutral-400 hover:text-white'}`}
                          >
                              <Grid size={16}/> 現有圖庫
                          </button>
                          <button 
                             onClick={() => { setSearchMode('fast-gen'); setSearchResults([]); }}
                             className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] ${searchMode === 'fast-gen' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' : 'bg-neutral-800/50 text-neutral-400 hover:text-white'}`}
                          >
                              <Zap size={16}/> 極速生成
                          </button>
                          <button 
                             onClick={() => setSearchMode('pro-gen')}
                             className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] ml-auto ${searchMode === 'pro-gen' ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/30' : 'bg-neutral-800/50 text-neutral-400 hover:text-white'}`}
                          >
                              <Crown size={16}/> 專業生成
                          </button>
                      </div>

                      {/* Search Input */}
                      {searchMode !== 'pro-gen' && (
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                    className="w-full bg-neutral-950/80 border border-neutral-700/50 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm pl-10"
                                    placeholder="輸入英文關鍵字..."
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16}/>
                            </div>

                            {/* New Fast Gen Model Selector (Only visible in Fast Gen mode) */}
                            {searchMode === 'fast-gen' && (
                                <select 
                                    value={selectedFastModel}
                                    onChange={(e) => setSelectedFastModel(e.target.value)}
                                    className="bg-neutral-900/50 border border-neutral-700/50 text-neutral-300 rounded-xl px-3 text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                >
                                    <option value="flux">Flux (Default)</option>
                                    <option value="flux-realism">Flux Realism</option>
                                    <option value="any-dark">Dark Universe</option>
                                    <option value="turbo">Turbo (Fastest)</option>
                                </select>
                            )}

                            <button 
                                onClick={performSearch}
                                disabled={isSearching}
                                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 min-w-[100px] shadow-lg shadow-amber-900/30"
                            >
                                {isSearching ? <Loader2 className="animate-spin mx-auto"/> : '搜尋 / 生成'}
                            </button>
                          </div>
                      )}
                  </div>

                  {/* Results Area */}
                  <div className="flex-1 overflow-y-auto p-6 bg-neutral-950">
                      {searchMode === 'pro-gen' ? (
                          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center gap-6">
                              <div className="p-4 bg-amber-900/20 rounded-full">
                                <Crown size={48} className="text-amber-400"/>
                              </div>
                              <div>
                                  <h3 className="text-xl font-bold text-white mb-2">Google Gemini & Veo (Pro)</h3>
                                  <p className="text-neutral-400 text-sm mb-6">使用最高品質的 AI 模型生成獨一無二的藝術背景或動態影片。<br/>(若遇到 Quota Exceeded 錯誤，請切換模型或使用 Fast Gen)</p>
                                  
                                  <div className="bg-neutral-900/50 p-4 rounded-xl text-left text-xs text-neutral-500 font-mono mb-6 border border-neutral-800/50">
                                      PROMPT: {project.theme.bgImagePrompt || "請先執行步驟 1 分析歌曲..."}
                                  </div>

                                  {/* Model Selection UI */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                      <div className="p-3 border border-neutral-700/50 rounded-xl bg-neutral-900/50">
                                          <label className="text-xs font-bold text-amber-300 block mb-2 flex items-center gap-2"><ImageIcon size={12}/> 圖片模型</label>
                                          <select 
                                            value={selectedImageModel} 
                                            onChange={(e) => setSelectedImageModel(e.target.value)}
                                            className="w-full bg-neutral-950/80 border border-neutral-600/50 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                          >
                                              <option value="gemini-2.5-flash-image">Nano Banana (Gemini 2.5 Flash) - 推薦 / 快速</option>
                                              <option value="gemini-3-pro-image-preview">Nano Banana Pro (Gemini 3 Pro) - 高畫質 2K</option>
                                              <option value="imagen-3.0-generate-001">Imagen 3 (Standard) - 穩定備用</option>
                                              <option value="imagen-4.0-generate-001">Imagen 4 Ultra - 寫實攝影 (極高消耗)</option>
                                          </select>
                                      </div>

                                      <div className="p-3 border border-neutral-700 rounded-lg bg-neutral-900/50">
                                          <label className="text-xs font-bold text-blue-300 block mb-2 flex items-center gap-2"><Video size={12}/> 影片模型 (Video Model)</label>
                                           <select 
                                            value={selectedVideoModel} 
                                            onChange={(e) => setSelectedVideoModel(e.target.value)}
                                            className="w-full bg-neutral-950 border border-neutral-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                          >
                                              <option value="veo-3.1-fast-generate-preview">Veo Fast - 快速預覽 (1080p)</option>
                                              <option value="veo-3.1-generate-preview">Veo Pro - 高品質生成</option>
                                          </select>
                                      </div>
                                  </div>

                                  <div className="flex justify-center gap-4">
                                      <button 
                                          onClick={handleGenerateImage}
                                          disabled={isGeneratingImage || isGeneratingVideo || !project.theme.bgImagePrompt}
                                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                          {isGeneratingImage ? <Loader2 className="animate-spin"/> : <ImageIcon/>}
                                          {isGeneratingImage ? "正在繪製圖片..." : "1. 生成 AI 圖片"}
                                      </button>

                                      <button 
                                          onClick={handleGenerateVideo}
                                          disabled={isGeneratingImage || isGeneratingVideo || !project.theme.bgImagePrompt}
                                          className="bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                          {isGeneratingVideo ? <Loader2 className="animate-spin"/> : <Video/>}
                                          {isGeneratingVideo ? "正在生成影片..." : "2. 生成 Veo 影片"}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <>
                              {isSearching ? (
                                  <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
                                      <Loader2 className="animate-spin text-indigo-500" size={40}/>
                                      <p>{searchMode === 'library' ? "正在搜尋全球藝術圖庫..." : `正在使用 ${selectedFastModel} 模型極速生成...`}</p>
                                  </div>
                              ) : (searchResults.length > 0 ? (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {searchResults.map((src, i) => (
                                          <button 
                                              key={i}
                                              onClick={() => {
                                                  onUpdate({ theme: { ...project.theme, bgImageUrl: src, bgMode: 'ai-image' } });
                                                  setIsSearchOpen(false);
                                              }}
                                              className="group relative aspect-video rounded-lg overflow-hidden border border-neutral-800 hover:border-indigo-500 transition-all hover:scale-[1.02]"
                                          >
                                              <img src={src} alt="result" className="w-full h-full object-cover"/>
                                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <span className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                                                      使用此圖 <ArrowRight size={12}/>
                                                  </span>
                                              </div>
                                          </button>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-4">
                                      <ImageIcon size={60} className="opacity-20"/>
                                      <p className="text-sm">點擊上方搜尋按鈕，使用 AI 關鍵字尋找圖片</p>
                                      <div className="flex gap-4 text-xs opacity-50">
                                          <span className="flex items-center gap-1"><Grid size={12}/> Lexica Public</span>
                                          <span className="flex items-center gap-1"><Zap size={12}/> Fast Flux / Turbo</span>
                                      </div>
                                  </div>
                              ))}
                          </>
                      )}
                  </div>

              </div>
          </div>
      )}
    </div>
  );
};

export default LyricVideoEditor;
