import React, { useState, useEffect } from 'react';
import { Upload, Music, Clapperboard, Image, Loader2, Share2, FileText, ListVideo, Home, Layers, ChevronLeft, ChevronRight, Menu, X, MessageSquare } from 'lucide-react';
import { AppMode, ProjectData, ThemeConfig } from './types';
import { extractMetadataFromAudio, isSupportedAudioFile, isSupportedVideoFile, parseFilenameMetadata } from './utils/parsers';
import { detectLanguageFromLyrics } from './utils/languageDetector';
import LyricVideoEditor from './components/LyricVideoEditor';
import ThumbnailMaker from './components/ThumbnailMaker';
import MVSubtitleMaker from './components/MVSubtitleMaker';
import SocialMediaMaker from './components/SocialMediaMaker';
import VideoDescriptionEditor from './components/VideoDescriptionEditor';
import LRCWidget from './components/LRCWidget';
import RenderQueueView from './components/RenderQueueView';
import { RenderQueueProvider } from './contexts/RenderQueueContext';
import { prepareAudioForBrowser } from './services/audioSupport';

// Default Styles
const defaultTheme: ThemeConfig = {
  fontFamily: '"Noto Serif TC", "Zen Old Mincho", "Noto Serif KR", serif', 
  primaryColor: '#ffffff', 
  secondaryColor: '#e2c799',
  backgroundColor: '#1a1a1a',
  overlayOpacity: 0.2, 
  bgMode: 'ai-image', 
  aspectRatio: '16:9',
  preset: 'cd-booklet',
  texture: 'paper',
  fontSizeScale: 1.15,
  shadowIntensity: 1.0,
  effects: {
    kenBurnsIntensity: 0,
    filmGrainStrength: 0.15,
    vignetteStrength: 0.3,
    cinemaBarHeight: 0.0,
    blurBackground: 0
  },
  lyricStyle: {
    textColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 0,
    glowColor: '#000000',
    glowBlur: 0,
    fontWeight: '400',
    autoContrast: false
  },
  watermark: {
    text: '',
    x: 0.95,
    y: 0.05,
    scale: 1.0,
    opacity: 0.6,
    fontFamily: '"Noto Serif TC", "Zen Old Mincho", "Noto Serif KR", serif'
  },
  layout: {
      artist: { x: 0.46, y: 0.22, scale: 0.85, visible: true, align: 'left' },
      album:  { x: 0.46, y: 0.27, scale: 0.75, visible: true, align: 'left' },
      title: { x: 0.46, y: 0.37, scale: 0.85, visible: true, align: 'left' },
      lyrics: { x: 0.56, y: 0.50, scale: 1.05, visible: true, align: 'left' },
      cover: { x: 0.23, y: 0.5, scale: 1.6, visible: true, align: 'center' }
  }
};

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLRCWidget, setShowLRCWidget] = useState(false);
  
  // Sidebar 狀態 - 預設展開（更符合人體工學）
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 響應式：偵測螢幕寬度
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      // 只有手機版才預設收合
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // 切換模式時關閉手機選單
  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setMobileMenuOpen(false);
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    setIsLoading(true);

    try {
        const audioFile = files.find(isSupportedAudioFile);
        const videoFile = files.find(isSupportedVideoFile);
        
        // 音訊優先判斷。這可防止 MIME type 不正確的 M4A / Opus 被當成影片。
        if (audioFile) {
            // 先從原始檔讀取標籤/封面/歌詞，再確認「預覽 + Web Audio 渲染」都能解碼。
            // 若瀏覽器不支援該 M4A / Opus codec，會在本機自動轉成 PCM WAV。
            const [{ metadata, lyrics }, preparedAudio] = await Promise.all([
                extractMetadataFromAudio(audioFile),
                prepareAudioForBrowser(audioFile),
            ]);
            
            // 自動判斷語言：如果有歌詞就根據歌詞內容判斷，否則預設為韓文
            const detectedLanguage = lyrics && lyrics.length > 0 
                ? detectLanguageFromLyrics(lyrics) 
                : 'KR';
            
            const newProject: ProjectData = {
                id: Date.now().toString(),
                metadata: { ...metadata, language: detectedLanguage },
                lyrics: lyrics || [],
                audioFile: preparedAudio.file,
                sourceAudioFile: preparedAudio.originalFile,
                audioWasConverted: preparedAudio.converted,
                theme: { ...defaultTheme },
                status: 'draft',
                lyricOffset: 0
            };
            setProject(newProject);
            // 智能判斷：如果有歌詞就直接進影片編輯，沒有就提示去歌詞校正
            if (lyrics && lyrics.length > 0) {
                handleModeChange(AppMode.LYRIC_VIDEO);
            } else {
                // 顯示提示：建議先去歌詞校正
                if (confirm('未檢測到歌詞，是否開啟歌詞校正工具？')) {
                    handleModeChange(AppMode.LYRIC_VIDEO);
                    setShowLRCWidget(true);
                } else {
                    handleModeChange(AppMode.LYRIC_VIDEO);
                }
            }
        } else if (videoFile) {
            const { title, artist } = parseFilenameMetadata(videoFile);
            const newProject: ProjectData = {
                id: Date.now().toString(),
                metadata: { title, artist, album: "", language: 'KR' },
                lyrics: [],
                videoFile: videoFile,
                theme: { 
                    ...defaultTheme,
                    layout: {
                        ...defaultTheme.layout,
                        lyrics: { ...defaultTheme.layout.lyrics, y: 0.96, x: 0.5, align: 'center' }
                    }
                },
                status: 'draft',
                lyricOffset: 0
            };
            setProject(newProject);
            handleModeChange(AppMode.MV_SUBTITLE);
        } else {
             alert("請上傳音訊檔（M4A / OPUS / MP3 / FLAC / WAV / AAC / OGG 等）或 MP4 / MOV 影片。");
        }
    } catch (error) {
        console.error("Setup failed", error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`檔案讀取失敗，請重試。\n\n詳細資訊：${message}`);
    } finally {
        setIsLoading(false);
        // 允許使用者在失敗後重新選擇同一個檔案。
        e.target.value = '';
    }
  };

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-neutral-900 via-neutral-900 to-black">
                <div className="relative">
                  <Loader2 size={56} className="animate-spin text-amber-500 mb-6" />
                  <div className="absolute inset-0 blur-xl bg-amber-500/20 animate-pulse"></div>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold font-serif-tc mb-2">正在解析檔案</h2>
                <p className="text-neutral-400 mt-2 font-light text-sm md:text-base">AI 正在讀取標籤、封面與歌詞結構...</p>
                <div className="mt-6 flex gap-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        );
    }
    
    if (mode === AppMode.RENDER_QUEUE) return <RenderQueueView />;
    if (!project && mode !== AppMode.DASHBOARD) return <div className="text-center p-10 text-white">請先上傳檔案。</div>;

    switch (mode) {
      case AppMode.DASHBOARD:
        return <DashboardView onFileUpload={handleFileUpload} onLRCClick={() => setShowLRCWidget(true)} />;
      case AppMode.LYRIC_VIDEO:
        return <LyricVideoEditor project={project!} onUpdate={(d: Partial<ProjectData>) => setProject(prev => prev ? { ...prev, ...d } : null)} />;
      case AppMode.MV_SUBTITLE:
        return <MVSubtitleMaker project={project!} onUpdate={(d: Partial<ProjectData>) => setProject(prev => prev ? { ...prev, ...d } : null)} />;
      case AppMode.THUMBNAIL:
        return <ThumbnailMaker project={project!} onUpdate={(d: Partial<ProjectData>) => setProject(prev => prev ? { ...prev, ...d } : null)} />;
      case AppMode.VIDEO_DESCRIPTION:
        return <VideoDescriptionEditor project={project!} onUpdate={(d: Partial<ProjectData>) => setProject(prev => prev ? { ...prev, ...d } : null)} />;
      case AppMode.SOCIAL_MEDIA:
        return <SocialMediaMaker project={project!} onUpdate={(d: Partial<ProjectData>) => setProject(prev => prev ? { ...prev, ...d } : null)} />;
      default:
        return <div>Error</div>;
    }
  };

  const isAudioProject = !!project?.audioFile;
  const isVideoProject = !!project?.videoFile;
  const hasProject = !!project;

  // 導航項目 - 歌詞校正移除，渲染排程移到最底部
  const navItems = [
    { id: AppMode.DASHBOARD, icon: <Home size={20}/>, label: "主控台", shortLabel: "首頁", always: true, color: "amber" },
    { id: AppMode.LYRIC_VIDEO, icon: <Music size={20}/>, label: "歌詞影片", shortLabel: "影片", show: isAudioProject, color: "indigo" },
    { id: AppMode.MV_SUBTITLE, icon: <Clapperboard size={20}/>, label: "MV 字幕", shortLabel: "字幕", show: isVideoProject, color: "blue" },
    { id: AppMode.THUMBNAIL, icon: <Image size={20}/>, label: "縮圖製作", shortLabel: "縮圖", show: isAudioProject, color: "purple" },
    { id: AppMode.VIDEO_DESCRIPTION, icon: <MessageSquare size={20}/>, label: "影片說明", shortLabel: "說明", show: hasProject, color: "green" },
    { id: AppMode.SOCIAL_MEDIA, icon: <Share2 size={20}/>, label: "社群行銷", shortLabel: "社群", show: isAudioProject, color: "pink" },
    { id: AppMode.RENDER_QUEUE, icon: <ListVideo size={20}/>, label: "渲染排程", shortLabel: "排程", always: true, color: "amber", isBottom: true },
  ];

  const visibleNavItems = navItems.filter(item => item.always || item.show);

  return (
    <RenderQueueProvider>
      <div className="flex h-screen w-screen overflow-hidden font-sans bg-[#0f0f11] text-neutral-200">
        
        {/* Mobile/Tablet Header Bar */}
        {(isMobile || isTablet) && (
          <div className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-b from-neutral-950/95 to-neutral-950/90 backdrop-blur-md border-b border-neutral-800/50 flex items-center justify-between px-4 md:px-6 z-50 shadow-lg">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl hover:bg-neutral-800/60 transition-all active:scale-95"
              aria-label="選單"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/30">
                <Music className="text-white" size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-serif-tc font-bold text-base leading-tight">歌詞工作坊</span>
                <span className="text-[9px] text-neutral-500 font-medium tracking-widest uppercase">Production</span>
              </div>
            </div>
            
            <div className="w-10" /> {/* Spacer */}
          </div>
        )}

        {/* Mobile Menu Overlay */}
        {(isMobile || isTablet) && mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav className={`
          ${(isMobile || isTablet)
            ? `fixed top-16 left-0 bottom-0 z-40 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'relative'
          }
          ${sidebarCollapsed && !isMobile && !isTablet ? 'w-20' : 'w-64'}
          bg-gradient-to-b from-neutral-950 to-neutral-900 border-r border-neutral-800/50 flex flex-col transition-all duration-300 shadow-2xl
        `}>
          
          {/* Desktop Header */}
          {!isMobile && !isTablet && (
            <div 
              className={`p-5 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} cursor-pointer hover:bg-neutral-900/50 transition-all border-b border-neutral-800/50 group`}
              onClick={() => { setProject(null); handleModeChange(AppMode.DASHBOARD); }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-900/30 group-hover:shadow-amber-900/50 transition-shadow">
                <Music className="text-white" size={20} />
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <h1 className="font-serif-tc font-bold text-lg text-white leading-tight truncate">歌詞工作坊</h1>
                  <span className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase">Production Studio</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
            {/* 主控台 */}
            {visibleNavItems.filter(i => i.always && !i.isBottom).map(item => (
              <NavItem 
                key={item.id}
                icon={item.icon}
                label={item.label}
                shortLabel={item.shortLabel}
                active={mode === item.id}
                collapsed={sidebarCollapsed && !isMobile && !isTablet}
                onClick={() => handleModeChange(item.id)}
                color={item.color || "neutral"}
              />
            ))}

            {/* 專案區 */}
            {hasProject && (
              <>
                {!sidebarCollapsed && (
                  <div className="pt-5 pb-2">
                    <p className="px-2 text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-3">當前專案</p>
                    <div className="mx-1 p-3 bg-gradient-to-br from-neutral-900/90 to-neutral-800/80 rounded-xl border border-neutral-700/50 shadow-lg">
                      <div className="font-serif-tc font-bold text-sm text-white truncate mb-1">
                        {project?.metadata.title || "Untitled"}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {project?.metadata.artist || "Unknown Artist"}
                      </div>
                      {project?.metadata.album && (
                        <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                          {project.metadata.album}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {sidebarCollapsed && !isMobile && !isTablet && <div className="h-px bg-neutral-800/50 my-3 mx-2" />}
                
                {visibleNavItems.filter(i => !i.always).map(item => (
                  <NavItem 
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    shortLabel={item.shortLabel}
                    active={mode === item.id}
                    collapsed={sidebarCollapsed && !isMobile && !isTablet}
                    onClick={() => handleModeChange(item.id)}
                    color={item.color || "neutral"}
                  />
                ))}
              </>
            )}
            
            {/* 渲染排程 - 置底 */}
            {!sidebarCollapsed && hasProject && (
              <div className="pt-4">
                <div className="h-px bg-neutral-800/50 mb-3 mx-2" />
                <p className="px-2 text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-3">最後步驟</p>
              </div>
            )}
            {sidebarCollapsed && !isMobile && !isTablet && hasProject && <div className="h-px bg-neutral-800/50 my-3 mx-2" />}
            
            {visibleNavItems.filter(i => i.isBottom).map(item => (
              <NavItem 
                key={item.id}
                icon={item.icon}
                label={item.label}
                shortLabel={item.shortLabel}
                active={mode === item.id}
                collapsed={sidebarCollapsed && !isMobile && !isTablet}
                onClick={() => handleModeChange(item.id)}
                color={item.color || "neutral"}
              />
            ))}
          </div>

          {/* Collapse Toggle (Desktop only) */}
          {!isMobile && !isTablet && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-4 border-t border-neutral-800/50 hover:bg-neutral-900/70 transition-all flex items-center justify-center text-neutral-500 hover:text-amber-400 group"
              aria-label={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
            >
              {sidebarCollapsed ? <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" /> : <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />}
            </button>
          )}
        </nav>

        {/* Main Content */}
        <main className={`flex-1 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 overflow-hidden relative ${(isMobile || isTablet) ? 'pt-16' : ''}`}>
          {renderContent()}
        </main>
        
        {/* LRC 小工具 */}
        {showLRCWidget && <LRCWidget onClose={() => setShowLRCWidget(false)} metadata={project?.metadata} />}
      </div>
    </RenderQueueProvider>
  );
}

// Dashboard View Component
const DashboardView = ({ onFileUpload, onLRCClick }: { onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onLRCClick: () => void }) => (
  <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 md:p-10 relative overflow-auto bg-gradient-to-br from-neutral-900 via-neutral-900 to-black">
    {/* 復古紙張紋理背景 */}
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat'
    }} />
    
    {/* 漸層光暈 */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent pointer-events-none" />
    
    <div className="relative z-10 text-center max-w-4xl w-full">
      {/* 標題區 */}
      <div className="mb-6 md:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black mb-3 md:mb-5 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 font-serif-tc tracking-tight leading-tight drop-shadow-2xl">
          歌詞創作工作坊
        </h1>
        <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
          <div className="h-px w-12 md:w-20 bg-gradient-to-r from-transparent to-amber-600/50"></div>
          <span className="text-[10px] md:text-xs text-amber-600/70 font-bold tracking-[0.3em] uppercase">Lyric Production Studio</span>
          <div className="h-px w-12 md:w-20 bg-gradient-to-l from-transparent to-amber-600/50"></div>
        </div>
        <p className="text-neutral-300 text-sm sm:text-base md:text-xl font-light font-serif-tc px-4 leading-relaxed">
          專為繁體中文字幕影片打造的自動化創作工具
        </p>
      </div>
      
      {/* 上傳區 */}
      <div className="group relative border-2 border-dashed border-neutral-700/70 rounded-2xl md:rounded-3xl p-6 sm:p-8 md:p-16 w-full flex flex-col items-center hover:border-amber-500/70 hover:bg-neutral-800/20 transition-all duration-300 cursor-pointer bg-neutral-900/40 backdrop-blur-sm mx-auto shadow-2xl hover:shadow-amber-900/20 mb-8">
        <input 
          type="file" 
          accept="audio/*,.m4a,.m4b,.opus,.ogg,.oga,.aac,.flac,.wav,.wave,.aif,.aiff,.alac,.weba,.webm,.wma,.ape,.amr,.ac3,.eac3,.mka,.dsf,.dff,.mpc,.mp4,.mov,.m4v,video/mp4,video/quicktime" 
          onChange={onFileUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
        />
        
        <div className="bg-gradient-to-br from-amber-600 to-yellow-600 p-4 md:p-6 rounded-2xl md:rounded-3xl mb-4 md:mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-2xl shadow-amber-900/40">
          <Upload size={28} className="text-white sm:w-8 sm:h-8 md:w-12 md:h-12" />
        </div>
        
        <h3 className="text-base sm:text-lg md:text-2xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors font-serif-tc">
          拖放檔案或點擊上傳
        </h3>
        <p className="text-neutral-400 text-xs sm:text-sm flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 items-center">
          <span className="flex items-center justify-center gap-1.5 bg-neutral-800/50 px-3 py-1.5 rounded-lg">
            <Music size={14}/> 
            <span className="font-medium">歌詞影片</span>
            <span className="text-neutral-500">(M4A / OPUS / MP3 / FLAC / WAV / AAC...)</span>
          </span>
          <span className="hidden sm:block w-px h-4 bg-neutral-700"></span>
          <span className="flex items-center justify-center gap-1.5 bg-neutral-800/50 px-3 py-1.5 rounded-lg">
            <Clapperboard size={14}/> 
            <span className="font-medium">MV 字幕</span>
            <span className="text-neutral-500">(MP4 / MOV)</span>
          </span>
        </p>
      </div>
    </div>
    
    {/* 歌詞校正浮動按鈕 - 只在首頁顯示 */}
    <button
      onClick={onLRCClick}
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30 group"
      aria-label="歌詞校正工具"
    >
      <div className="relative">
        {/* 光暈效果 */}
        <div className="absolute inset-0 bg-amber-500/30 rounded-2xl blur-xl group-hover:bg-amber-400/40 transition-all duration-300 animate-pulse" />
        
        {/* 按鈕本體 */}
        <div className="relative bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 p-4 md:p-5 rounded-2xl shadow-2xl shadow-amber-900/50 group-hover:shadow-amber-900/70 group-hover:scale-110 transition-all duration-300 flex items-center gap-3">
          <FileText size={24} className="text-white" />
          <div className="hidden md:flex flex-col items-start">
            <span className="text-white font-bold text-sm leading-tight">歌詞校正</span>
            <span className="text-amber-100 text-[10px] leading-tight">LRC / SRT</span>
          </div>
        </div>
        
        {/* 提示標籤 */}
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce">
          快速
        </div>
      </div>
    </button>
  </div>
);

// Navigation Item Component
const NavItem = ({ 
  icon, 
  label, 
  shortLabel,
  active, 
  collapsed,
  onClick, 
  color = "neutral" 
}: { 
  icon: React.ReactNode;
  label: string;
  shortLabel: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  color?: string;
}) => {
  const colorClasses: Record<string, { text: string; active: string; glow: string }> = {
    neutral: { text: "text-neutral-400", active: "text-white", glow: "bg-neutral-400" },
    indigo: { text: "text-indigo-400", active: "text-indigo-300", glow: "bg-indigo-400" },
    blue: { text: "text-blue-400", active: "text-blue-300", glow: "bg-blue-400" },
    purple: { text: "text-purple-400", active: "text-purple-300", glow: "bg-purple-400" },
    green: { text: "text-green-400", active: "text-green-300", glow: "bg-green-400" },
    pink: { text: "text-pink-400", active: "text-pink-300", glow: "bg-pink-400" },
    amber: { text: "text-amber-400", active: "text-amber-300", glow: "bg-amber-400" },
  };
  
  const colors = colorClasses[color] || colorClasses.neutral;
  
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`
        w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative
        ${collapsed ? 'justify-center p-3' : 'px-3.5 py-3'}
        ${active 
          ? 'bg-gradient-to-r from-neutral-800/90 to-neutral-800/70 text-white ring-1 ring-neutral-700/70 shadow-lg' 
          : 'hover:bg-neutral-900/60 text-neutral-400 hover:text-white'
        }
      `}
    >
      <span className={`transition-all duration-200 flex-shrink-0 ${active ? colors.active : `${colors.text} group-hover:text-neutral-300`}`}>
        {icon}
      </span>
      
      {!collapsed && (
        <span className="text-sm font-medium tracking-wide truncate">{label}</span>
      )}
      
      {active && !collapsed && (
        <div className={`absolute right-3 w-1.5 h-1.5 rounded-full ${colors.glow} shadow-[0_0_8px_currentColor] animate-pulse`} />
      )}
    </button>
  );
};
