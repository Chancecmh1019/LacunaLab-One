
import React, { useState, useRef, useEffect } from 'react';
import { ProjectData, LyricLine } from '../types';
import { Download, FileVideo, Upload, Play, Pause, Loader2, Type, CheckCircle, Trash2, Clock, Minus, Plus, Palette, MoveVertical, Stamp, MoveHorizontal, Film, ListVideo, Zap } from 'lucide-react';
import { parseSRT } from '../utils/parsers';
import { wrapText } from '../utils/canvasUtils';
import { useRenderQueue } from '../contexts/RenderQueueContext';
import { renderProjectOffscreen } from '../services/renderEngine';
import { FONT_STACK } from '../utils/layoutPresets';
import { buildMediaOutputFileName } from '../utils/outputFilename';
import { detectLanguageFromLyrics } from '../utils/languageDetector';

interface Props {
  project: ProjectData;
  onUpdate?: (data: Partial<ProjectData>) => void;
}

interface RenderLine {
  text: string;
  isTranslation: boolean;
  fontSize: number;
  lineHeight: number;
  weight: number;
}

const MVSubtitleMaker: React.FC<Props> = ({ project, onUpdate }) => {
  const { addToQueue } = useRenderQueue();
  const [videoFile, setVideoFile] = useState<File | null>(project.videoFile || null);
  const [subtitles, setSubtitles] = useState<LyricLine[]>(project.lyrics || []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [isOfflineRendering, setIsOfflineRendering] = useState(false); // For Native MP4
  const [offlineProgress, setOfflineProgress] = useState(0);
  const [cinemaMode, setCinemaMode] = useState(false); // Default: False
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  const [videoDim, setVideoDim] = useState({ width: 1920, height: 1080 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update Project Theme when Cinema Mode changes (for Offline Renderer)
  useEffect(() => {
      if (onUpdate) {
          onUpdate({
              theme: {
                  ...project.theme,
                  effects: {
                      ...project.theme.effects,
                      cinemaBarHeight: cinemaMode ? 0.12 : 0
                  }
              }
          });
      }
  }, [cinemaMode]);

  // NEW: Prevent accidental tab close during work
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isOfflineRendering) {
              e.preventDefault();
              e.returnValue = '影片正在匯出中，確定要離開嗎？';
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOfflineRendering]);

  // Preload Fonts - Updated to prioritize Noto Serif TC
  useEffect(() => {
    const loadFonts = async () => {
        if ('fonts' in document) {
            try {
                await document.fonts.ready;
                const fontVariations = [
                    '700 56px "Noto Serif TC"',
                    '500 50px "Noto Serif TC"',
                    '400 42px "Noto Serif TC"',
                    '300 42px "Noto Serif TC"',
                    '700 56px "Zen Old Mincho"', 
                    '500 50px "Zen Old Mincho"', 
                    '500 46px "Zen Old Mincho"', 
                    '400 42px "Zen Old Mincho"', 
                    '700 90px "Noto Serif KR"',
                    '600 30px "Montserrat"',
                ];
                for (const font of fontVariations) {
                    await (document as any).fonts.load(font);
                }
                let attempts = 0;
                const checkAll = () => fontVariations.every(f => document.fonts.check(f));
                while (!checkAll() && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                await new Promise(r => setTimeout(r, 800));
            } catch (e) {
                console.warn("Font loading check failed", e);
            }
        }
        setFontsLoaded(true);
    };
    loadFonts();
  }, []);

  // Load video
  useEffect(() => {
    if (videoFile && videoRef.current) {
        const url = URL.createObjectURL(videoFile);
        videoRef.current.src = url;
        const handleMetadata = () => {
             if(videoRef.current) {
                 const v = videoRef.current;
                 setVideoDim({ width: v.videoWidth, height: v.videoHeight });
                 // FIX: Sync duration so render queue knows correct length
                 if (onUpdate) {
                     onUpdate({ trimEnd: v.duration });
                 }
             }
        };
        videoRef.current.addEventListener('loadedmetadata', handleMetadata);
        videoRef.current.load();
        return () => {
            if (videoRef.current) videoRef.current.removeEventListener('loadedmetadata', handleMetadata);
            URL.revokeObjectURL(url);
        };
    }
  }, [videoFile]);

  // Handle SRT upload
  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const text = ev.target?.result as string;
          const parsed = parseSRT(text);
          setSubtitles(parsed);
          // Sync with main project data and detect source language for filenames
          if (onUpdate) {
              const detectedLanguage = detectLanguageFromLyrics(parsed);
              onUpdate({
                  lyrics: parsed,
                  metadata: { ...project.metadata, language: detectedLanguage }
              });
          }
      };
      reader.readAsText(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setVideoFile(file);
          if(onUpdate) onUpdate({ videoFile: file });
      }
  };

  const lyricStyle = project.theme.lyricStyle || {
      textColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
      glowColor: '#000000',
      glowBlur: 0,
      fontWeight: '400',
      autoContrast: false
  };

  const watermark = project.theme.watermark || { text: '', x: 0.95, y: 0.05, scale: 1.0, opacity: 0.6 };

  const updateLyricStyle = (updates: Partial<typeof lyricStyle>) => {
      if(onUpdate) onUpdate({ theme: { ...project.theme, lyricStyle: { ...lyricStyle, ...updates } } });
  };

  const updateWatermark = (updates: Partial<typeof watermark>) => {
      if(onUpdate) onUpdate({ theme: { ...project.theme, watermark: { ...watermark, ...updates } } });
  };

  // Render Loop (Preview)
  useEffect(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;

      const render = () => {
          if (video.readyState >= 2) {
            const width = canvas.width;
            const height = canvas.height;
            const scale = height / 1080;
            const shadowIntensity = project.theme.shadowIntensity ?? 1.0;

            ctx.drawImage(video, 0, 0, width, height);
            
            // Calculate Safe Area Bottom
            // Default 96% if not set (based on user request)
            const userY = project.theme.layout.lyrics.y || 0.96;
            let safeAreaBottom = height * userY; 

            if (cinemaMode) {
                const barHeight = height * 0.12; 
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, width, barHeight); 
                ctx.fillRect(0, height - barHeight, width, barHeight); 
            }

            if (watermark && watermark.text && fontsLoaded) {
                ctx.save();
                ctx.globalAlpha = watermark.opacity || 0.6;
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4 * scale;
                const wmSize = 30 * (watermark.scale || 1.0) * scale;
                ctx.font = `600 ${wmSize}px ${FONT_STACK}`;
                ctx.fillStyle = '#ffffff';
                if (watermark.x > 0.5) ctx.textAlign = 'right';
                else if (watermark.x < 0.5) ctx.textAlign = 'left';
                else ctx.textAlign = 'center';
                ctx.fillText(watermark.text, width * watermark.x, height * watermark.y);
                ctx.restore();
            }

            const realtimeTime = video.currentTime; 
            const effectiveTime = realtimeTime - (project.lyricOffset || 0);

            const currentSubIndex = subtitles.findIndex(s => {
                const start = s.timestamp;
                // 最後一句字幕給予更長的顯示時間（5秒）
                const nextSub = subtitles[subtitles.indexOf(s) + 1];
                const end = s.endTime !== undefined ? s.endTime : (nextSub?.timestamp || s.timestamp + 5);
                return effectiveTime >= start && effectiveTime <= end;
            });
            const currentSub = currentSubIndex !== -1 ? subtitles[currentSubIndex] : null;

            if (currentSub && fontsLoaded) {
                const isLastSub = currentSubIndex === subtitles.length - 1;
                const start = currentSub.timestamp;
                const nextSub = subtitles[currentSubIndex + 1];
                const end = currentSub.endTime !== undefined ? currentSub.endTime : (nextSub?.timestamp || start + 5);
                const fadeInDur = 0.25;
                // 最後一句字幕淡出時間加長到 1.5 秒
                const fadeOutDur = isLastSub ? 1.5 : 0.5;
                const timeSinceStart = effectiveTime - start;
                const timeUntilEnd = end - effectiveTime;
                
                let alpha = 1.0;
                if (timeSinceStart < fadeInDur) alpha = timeSinceStart / fadeInDur;
                if (timeUntilEnd < fadeOutDur) alpha = Math.min(alpha, timeUntilEnd / fadeOutDur);
                alpha = Math.max(0, Math.min(1, alpha));
                
                ctx.save();
                ctx.globalAlpha = alpha;
                
                const maxWidth = width * 0.8; 
                
                ctx.fillStyle = lyricStyle.textColor;
                
                if (lyricStyle.glowBlur > 0) {
                    ctx.shadowColor = lyricStyle.glowColor;
                    ctx.shadowBlur = lyricStyle.glowBlur * scale;
                } else {
                    ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
                    ctx.shadowBlur = 10 * shadowIntensity * scale;
                }
                ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

                if (lyricStyle.strokeWidth > 0) {
                    ctx.strokeStyle = lyricStyle.strokeColor;
                    ctx.lineWidth = lyricStyle.strokeWidth * scale;
                }

                let contentLines = currentSub.multiLine;
                // 支援純中文模式：如果沒有 multiLine，檢查是否有翻譯
                if (!contentLines || contentLines.length === 0) {
                    if (currentSub.translation && currentSub.translation.trim().length > 0) {
                        // 雙語模式
                        contentLines = [currentSub.original, currentSub.translation].filter(Boolean);
                    } else {
                        // 純中文模式：只顯示原文
                        contentLines = [currentSub.original].filter(Boolean);
                    }
                }

                // Font Scaling Logic
                const lyricScale = project.theme.layout.lyrics.scale || 1.0;
                const baseFontSize = 54 * scale * lyricScale;
                const lineHeightMultiplier = 1.3;
                
                // Get horizontal position (default 0.5 = center)
                const userX = project.theme.layout.lyrics.x ?? 0.5;
                const isVertical = project.theme.layout.lyrics.vertical || false;

                if (isVertical) {
                    // --- VERTICAL TEXT RENDERING (直式文字) ---
                    // Text flows top-to-bottom, columns flow right-to-left
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const charSpacing = baseFontSize * 1.1; // Spacing between characters
                    const columnSpacing = baseFontSize * 1.5; // Spacing between columns
                    
                    // Start position: use userX for horizontal, start from top area
                    let startX = width * userX;
                    const startY = height * 0.15; // Start from 15% from top
                    const maxHeight = height * 0.7; // Max vertical space
                    
                    // For multiple content lines, each becomes a column (right to left)
                    let currentColumnX = startX + ((contentLines.length - 1) * columnSpacing / 2);
                    
                    for (let j = 0; j < contentLines.length; j++) {
                        const text = contentLines[j];
                        const weight = lyricStyle.fontWeight !== '400' ? parseInt(lyricStyle.fontWeight) : (cinemaMode ? 400 : 500);
                        ctx.font = `${weight} ${baseFontSize}px ${FONT_STACK}`;
                        
                        let currentCharY = startY;
                        
                        for (let c = 0; c < text.length; c++) {
                            const char = text[c];
                            
                            // Skip spaces or handle line break
                            if (currentCharY > startY + maxHeight) {
                                // Move to next column (left)
                                currentColumnX -= columnSpacing;
                                currentCharY = startY;
                            }
                            
                            if (lyricStyle.strokeWidth > 0) {
                                ctx.lineWidth = lyricStyle.strokeWidth * scale;
                                ctx.strokeText(char, currentColumnX, currentCharY);
                            }
                            ctx.fillText(char, currentColumnX, currentCharY);
                            
                            currentCharY += charSpacing;
                        }
                        
                        // Move to next column for next content line
                        currentColumnX -= columnSpacing;
                    }
                } else {
                    // --- HORIZONTAL TEXT RENDERING (橫式文字) ---
                    // Original bottom-up rendering with horizontal position support
                    ctx.textBaseline = 'bottom';
                    
                    // Set text alignment based on X position
                    if (userX < 0.35) {
                        ctx.textAlign = 'left';
                    } else if (userX > 0.65) {
                        ctx.textAlign = 'right';
                    } else {
                        ctx.textAlign = 'center';
                    }
                    
                    const textX = width * userX;
                    let currentY = safeAreaBottom;

                    for (let j = contentLines.length - 1; j >= 0; j--) {
                        const text = contentLines[j];
                        const weight = lyricStyle.fontWeight !== '400' ? parseInt(lyricStyle.fontWeight) : (cinemaMode ? 400 : 500);
                        const fontSize = baseFontSize;
                        
                        ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`;
                        ctx.letterSpacing = '1px';
                        
                        const wrappedLines = wrapText(ctx, text, maxWidth);
                        
                        for (let k = wrappedLines.length - 1; k >= 0; k--) {
                            const line = wrappedLines[k];
                            if (lyricStyle.strokeWidth > 0) {
                                 ctx.lineWidth = lyricStyle.strokeWidth * scale;
                                 ctx.strokeText(line, textX, currentY);
                            }
                            ctx.fillText(line, textX, currentY);
                            
                            currentY -= (fontSize * lineHeightMultiplier);
                        }
                    }
                }
                ctx.restore();
            }
          }
          animationFrameId = requestAnimationFrame(render);
      };
      render();
      return () => cancelAnimationFrame(animationFrameId);
  }, [videoFile, subtitles, cinemaMode, fontsLoaded, project.lyricOffset, project.theme, videoDim]);

  const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
  };

  // Native Offline Render (Direct Export)
  const handleNativeExport = async () => {
      if (!project.videoFile) return;
      setIsOfflineRendering(true);
      setOfflineProgress(0);
      try {
          const blob = await renderProjectOffscreen(project, (p) => setOfflineProgress(p));
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = buildMediaOutputFileName(
            project.metadata.artist,
            project.metadata.title,
            'mp4',
            project.theme.aspectRatio === '9:16',
            project.metadata.language
          );
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      } catch (e) {
          console.error(e);
          alert("Native export failed.");
      } finally {
          setIsOfflineRendering(false);
      }
  };

  // Add to Queue
  const handleAddToQueue = () => {
      addToQueue(project);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-neutral-900 via-neutral-900 to-black text-white overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 bg-gradient-to-b from-neutral-950 to-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-800/50 flex flex-col z-20 shadow-2xl overflow-y-auto custom-scrollbar max-h-[45vh] lg:max-h-none">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-neutral-800/50 sticky top-0 bg-neutral-950/95 backdrop-blur-sm z-10">
             <h2 className="text-xl sm:text-2xl font-bold font-serif-tc flex items-center gap-2 text-amber-400">
                 <Film className="text-amber-500" size={22}/> 
                 <span>MV 字幕合成</span>
             </h2>
          </div>
          
          <div className="p-4 sm:p-6 space-y-6">
              {/* GROUP 1: VIDEO SETTINGS */}
              <div className="space-y-3 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider flex items-center gap-2">
                    <FileVideo size={14}/> 影片設定
                 </h3>

                 {!videoFile && (
                    <div className="bg-neutral-900/50 rounded-xl border-2 border-dashed border-neutral-800/70 hover:border-amber-500/70 transition-all group">
                        <input type="file" accept="video/mp4" onChange={handleVideoUpload} className="hidden" id="vid-upload"/>
                        <label htmlFor="vid-upload" className="cursor-pointer flex flex-col items-center gap-2 p-6">
                            <Upload size={24} className="text-neutral-600 group-hover:text-amber-400 transition-colors"/>
                            <span className="text-xs text-neutral-500 group-hover:text-neutral-300 font-bold">上傳 MV (MP4)</span>
                        </label>
                    </div>
                 )}

                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                      <button 
                        onClick={() => setCinemaMode(!cinemaMode)}
                        className={`w-full p-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-between ${
                            cinemaMode 
                                ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-amber-500/50 text-white' 
                                : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                        }`}
                      >
                          <span>影院黑邊</span>
                          {cinemaMode && <CheckCircle size={14} className="text-amber-400"/>}
                      </button>
                 </div>
              </div>

              <div className="space-y-3 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider flex items-center gap-2">
                    <Type size={14}/> 字幕檔案
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                    {subtitles.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-sm bg-neutral-800/60 p-2.5 rounded-lg">
                                <span className="text-green-400 flex items-center gap-2 font-medium"><CheckCircle size={14}/> 已載入字幕</span>
                                <span className="text-neutral-500 text-xs font-mono">{subtitles.length} 行</span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => document.getElementById('srt-reupload')?.click()} 
                                className="flex-1 py-2 border border-neutral-700/50 rounded-lg hover:bg-neutral-800/70 text-xs text-neutral-300 transition-all"
                              >
                                更換檔案
                              </button>
                              <button 
                                onClick={() => setSubtitles([])} 
                                className="p-2 border border-neutral-700/50 rounded-lg hover:bg-red-900/30 hover:text-red-400 text-neutral-500 transition-all" 
                                title="清除字幕"
                              >
                                <Trash2 size={14}/>
                              </button>
                            </div>
                            <input type="file" accept=".srt" onChange={handleSrtUpload} className="hidden" id="srt-reupload"/>
                        </div>
                    ) : (
                        <div className="border border-dashed border-neutral-700/50 rounded-lg p-4 text-center hover:border-neutral-500 transition-all group">
                            <input type="file" accept=".srt" onChange={handleSrtUpload} className="hidden" id="srt-upload"/>
                            <label htmlFor="srt-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <Upload size={20} className="text-neutral-600 group-hover:text-amber-400 transition-colors"/>
                                <span className="text-xs text-neutral-500 group-hover:text-neutral-300 font-bold">點擊上傳 SRT</span>
                            </label>
                        </div>
                    )}
                 </div>
                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                     <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase flex items-center gap-1">
                        <Clock size={10}/> 時間軸同步
                     </div>
                     <div className="flex items-center justify-between bg-neutral-800/60 rounded-lg p-1">
                          <button 
                            onClick={() => { const next = Math.round(((project.lyricOffset || 0) - 0.1) * 10) / 10; onUpdate?.({ lyricOffset: next }); }} 
                            className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-300 transition-all active:scale-95"
                          >
                            <Minus size={14}/>
                          </button>
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-mono font-bold text-white">{(project.lyricOffset || 0) > 0 ? "+" : ""}{(project.lyricOffset || 0).toFixed(1)}s</span>
                            <span className="text-[9px] text-neutral-500">{ (project.lyricOffset || 0) > 0 ? "延後顯示" : ((project.lyricOffset || 0) < 0 ? "提早顯示" : "標準同步") }</span>
                          </div>
                          <button 
                            onClick={() => { const next = Math.round(((project.lyricOffset || 0) + 0.1) * 10) / 10; onUpdate?.({ lyricOffset: next }); }} 
                            className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-300 transition-all active:scale-95"
                          >
                            <Plus size={14}/>
                          </button>
                     </div>
                 </div>
              </div>

              <div className="space-y-3 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider flex items-center gap-2">
                    <Palette size={14}/> 字幕外觀
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50 space-y-3">
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-2">
                            <span>垂直位置</span>
                            <span className="text-amber-400 font-bold">{Math.round((project.theme.layout.lyrics.y || 0.96) * 100)}%</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <MoveVertical size={12} className="text-neutral-500"/>
                            <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={project.theme.layout.lyrics.y || 0.96} 
                                onChange={(e) => { if(onUpdate) { onUpdate({ theme: { ...project.theme, layout: { ...project.theme.layout, lyrics: { ...project.theme.layout.lyrics, y: parseFloat(e.target.value) } } } }); } }} 
                                className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full"
                            />
                         </div>
                     </div>
                     
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-2">
                            <span>水平位置</span>
                            <span className="text-amber-400 font-bold">{Math.round((project.theme.layout.lyrics.x || 0.5) * 100)}%</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <MoveHorizontal size={12} className="text-neutral-500"/>
                            <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={project.theme.layout.lyrics.x || 0.5} 
                                onChange={(e) => { if(onUpdate) { onUpdate({ theme: { ...project.theme, layout: { ...project.theme.layout, lyrics: { ...project.theme.layout.lyrics, x: parseFloat(e.target.value) } } } }); } }} 
                                className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full"
                            />
                         </div>
                     </div>
                     
                     <div>
                         <div className="flex justify-between text-[10px] text-neutral-500 mb-2">
                            <span>字體大小</span>
                            <span className="text-amber-400 font-bold">{Math.round((project.theme.layout.lyrics.scale || 1.0) * 100)}%</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <Type size={12} className="text-neutral-500"/>
                            <input 
                                type="range" min="0.5" max="2.0" step="0.1" 
                                value={project.theme.layout.lyrics.scale || 1.0} 
                                onChange={(e) => { if(onUpdate) { onUpdate({ theme: { ...project.theme, layout: { ...project.theme.layout, lyrics: { ...project.theme.layout.lyrics, scale: parseFloat(e.target.value) } } } }); } }} 
                                className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full"
                            />
                         </div>
                     </div>
                     
                     <div>
                         <div className="text-[10px] text-neutral-500 mb-2">文字方向</div>
                         <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => { if(onUpdate) { onUpdate({ theme: { ...project.theme, layout: { ...project.theme.layout, lyrics: { ...project.theme.layout.lyrics, vertical: false } } } }); } }}
                               className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                    !project.theme.layout.lyrics.vertical 
                                        ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-amber-500/50 text-white' 
                                        : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                               }`}
                             >
                                 <Type size={12}/> 橫式
                             </button>
                             <button 
                               onClick={() => { if(onUpdate) { onUpdate({ theme: { ...project.theme, layout: { ...project.theme.layout, lyrics: { ...project.theme.layout.lyrics, vertical: true } } } }); } }}
                               className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                    project.theme.layout.lyrics.vertical 
                                        ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-amber-500/50 text-white' 
                                        : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                               }`}
                             >
                                 <Type size={12} className="rotate-90"/> 直式
                             </button>
                         </div>
                     </div>

                     <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/50">
                         <div className="bg-neutral-950/80 p-2 rounded-lg border border-neutral-800/50 flex justify-between items-center">
                            <span className="text-[10px] text-neutral-400">顏色</span>
                            <input 
                                type="color" 
                                value={lyricStyle.textColor} 
                                onChange={(e) => updateLyricStyle({ textColor: e.target.value })} 
                                className="bg-transparent border-none w-5 h-5 p-0 cursor-pointer rounded"
                            />
                         </div>
                         <div className="bg-neutral-950/80 p-2 rounded-lg border border-neutral-800/50">
                             <select 
                                value={lyricStyle.fontWeight} 
                                onChange={(e) => updateLyricStyle({ fontWeight: e.target.value as any })} 
                                className="w-full bg-transparent text-[10px] text-white border-none focus:ring-0 p-0"
                             >
                                 <option value="300">細體</option>
                                 <option value="400">標準</option>
                                 <option value="500">中黑</option>
                                 <option value="700">粗體</option>
                                 <option value="900">特粗</option>
                             </select>
                         </div>
                     </div>
                     <div className="space-y-2 pt-2 border-t border-neutral-800/50">
                         <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-neutral-500">描邊</span>
                                <input 
                                    type="color" 
                                    value={lyricStyle.strokeColor} 
                                    onChange={(e) => updateLyricStyle({ strokeColor: e.target.value })} 
                                    className="w-4 h-4 p-0 border-none bg-transparent rounded"
                                />
                            </div>
                            <input 
                                type="range" min="0" max="8" step="0.5" 
                                value={lyricStyle.strokeWidth} 
                                onChange={(e) => updateLyricStyle({ strokeWidth: parseFloat(e.target.value) })} 
                                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                            />
                         </div>
                         <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-neutral-500">發光</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => updateLyricStyle({ glowColor: '#000000' })} 
                                        className={`w-3 h-3 bg-black rounded-full border ${lyricStyle.glowColor === '#000000' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-neutral-600'}`}
                                    />
                                    <button 
                                        onClick={() => updateLyricStyle({ glowColor: '#ffffff' })} 
                                        className={`w-3 h-3 bg-white rounded-full border ${lyricStyle.glowColor === '#ffffff' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-neutral-600'}`}
                                    />
                                </div>
                            </div>
                            <input 
                                type="range" min="0" max="20" step="1" 
                                value={lyricStyle.glowBlur} 
                                onChange={(e) => updateLyricStyle({ glowBlur: parseFloat(e.target.value) })} 
                                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                            />
                         </div>
                     </div>
                 </div>
              </div>

              <div className="space-y-3 border-b border-neutral-800/50 pb-6">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider flex items-center gap-2">
                    <Stamp size={14}/> 浮水印
                 </h3>
                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                    <input 
                        type="text" 
                        value={watermark.text} 
                        onChange={(e) => updateWatermark({ text: e.target.value })} 
                        placeholder="@YourChannelName" 
                        className="w-full bg-neutral-950/80 border border-neutral-700/70 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none mb-3 transition-all"
                    />
                    {watermark.text && (
                        <div className="space-y-2 pt-2 border-t border-neutral-800/50">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-neutral-500 flex items-center gap-1">
                                        <MoveHorizontal size={10}/> 水平
                                    </label>
                                    <input 
                                        type="range" min="0" max="1" step="0.01" 
                                        value={watermark.x} 
                                        onChange={(e) => updateWatermark({ x: parseFloat(e.target.value) })} 
                                        className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-neutral-500 flex items-center gap-1">
                                        <MoveVertical size={10}/> 垂直
                                    </label>
                                    <input 
                                        type="range" min="0" max="1" step="0.01" 
                                        value={watermark.y} 
                                        onChange={(e) => updateWatermark({ y: parseFloat(e.target.value) })} 
                                        className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-neutral-500">大小 {Math.round(watermark.scale * 100)}%</label>
                                    <input 
                                        type="range" min="0.5" max="2" step="0.1" 
                                        value={watermark.scale} 
                                        onChange={(e) => updateWatermark({ scale: parseFloat(e.target.value) })} 
                                        className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-neutral-500">透明度 {Math.round(watermark.opacity * 100)}%</label>
                                    <input 
                                        type="range" min="0.1" max="1" step="0.1" 
                                        value={watermark.opacity} 
                                        onChange={(e) => updateWatermark({ opacity: parseFloat(e.target.value) })} 
                                        className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="space-y-2">
                  <button 
                    onClick={handleAddToQueue}
                    disabled={!videoFile || isRendering || isOfflineRendering}
                    className="w-full py-3 border rounded-xl font-bold flex items-center justify-center gap-2 transition-all font-serif-tc bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-amber-600/50 text-amber-200 hover:from-amber-800/50 hover:to-amber-700/40 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ListVideo size={18}/> 
                      <span>加入排程</span>
                  </button>

                  <button 
                    onClick={handleNativeExport}
                    disabled={!videoFile || isRendering || isOfflineRendering}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/30 hover:shadow-green-900/50 active:scale-[0.98] font-serif-tc disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isOfflineRendering ? <Loader2 className="animate-spin"/> : <Zap size={18}/>}
                      <span>{isOfflineRendering ? `渲染中 ${offlineProgress}%` : "立即匯出"}</span>
                  </button>
              </div>
          </div>
      </div>

      {/* Main Preview */}
      <div className="flex-1 bg-black p-4 sm:p-6 md:p-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-black pointer-events-none"/>
          {videoFile ? (
              <div className="relative max-w-full max-h-full flex items-center justify-center bg-black shadow-2xl ring-1 ring-neutral-800/70 rounded-lg overflow-hidden">
                  <canvas ref={canvasRef} width={videoDim.width} height={videoDim.height} className="max-w-full max-h-[85vh] object-contain"/>
                  <video ref={videoRef} className="hidden" onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}/>
                  <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl p-3 sm:p-4 bg-black/80 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 border border-white/10 opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={togglePlay} 
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-95"
                      >
                        {isPlaying ? <Pause fill="white" size={16}/> : <Play fill="white" size={16} className="ml-1"/>}
                      </button>
                      <span className="text-xs font-mono text-white/80 w-12 text-right">{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                      <input 
                        type="range" min="0" max={videoRef.current?.duration || 100} 
                        value={currentTime} 
                        onChange={(e) => { if(videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value); }} 
                        className="flex-1 accent-amber-500 h-1.5 bg-white/20 rounded-full"
                      />
                      <span className="text-xs font-mono text-white/80 w-12">{new Date((videoRef.current?.duration || 0) * 1000).toISOString().substr(14, 5)}</span>
                  </div>
              </div>
          ) : (
              <div className="text-neutral-500 flex flex-col items-center gap-4">
                  <div className="p-6 bg-neutral-900/50 rounded-2xl border border-neutral-800/50">
                    <FileVideo size={48} className="opacity-30 text-amber-500"/>
                  </div>
                  <span className="text-sm font-serif-tc">請先在左側上傳影片</span>
              </div>
          )}
      </div>
    </div>
  );
};

export default MVSubtitleMaker;
