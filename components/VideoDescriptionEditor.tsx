import React, { useState, useEffect } from 'react';
import { ProjectData } from '../types';
import { FileText, Copy, Hash, CheckCircle, Music, User, Disc, Languages } from 'lucide-react';
import { getLanguageLabel } from '../utils/languageDetector';

interface Props {
    project: ProjectData;
    onUpdate?: (data: Partial<ProjectData>) => void;
}

const VideoDescriptionEditor: React.FC<Props> = ({ project, onUpdate }) => {
    // 影片說明狀態
    const [description, setDescription] = useState<string>('');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    
    // 初始化預設內容
    useEffect(() => {
        const { title, artist, album, language } = project.metadata;
        
        // 生成影片說明
        const langMap: Record<string, { full: string; short: string }> = {
            'KR': { full: '韓文', short: 'Korean' },
            'EN': { full: '英文', short: 'English' },
            'JP': { full: '日文', short: 'Japanese' },
            'CN': { full: '中文', short: 'Chinese' }
        };
        const langInfo = langMap[language] || { full: '韓文', short: 'Korean' };
        const subtitleType = language === 'CN' ? '中文字幕' : '繁體中文字幕';
        
        const defaultDesc = `歌曲資訊 | Song Information
• 【歌曲名稱】${title}
• 【歌手名稱】${artist}${album ? `\n• 【專輯名稱】${album}` : ''}

⚠️ 版權聲明 | Copyright Notice
本影片僅供學習交流使用，所有音樂版權歸原作者及唱片公司所有。
如有侵權，請聯繫我們，我們將立即處理。
All rights reserved to the original artist and record label.
This video is for educational and entertainment purposes only.
If there is any copyright issue, please contact us for removal.

© ${new Date().getFullYear()} LacunaLab Studio
感謝您的收看！Thanks for watching!`;
        
        setDescription(defaultDesc);
        
        // 生成 Hashtags
        const languageLabel = getLanguageLabel(language);
        const defaultTags = [
            title.replace(/\s+/g, ''),
            artist.replace(/\s+/g, ''),
            album ? album.replace(/\s+/g, '') : null,
            language === 'CN' ? '繁中' : '繁中字',
            language === 'CN' ? '中文字幕' : '繁體中文字幕',
            languageLabel, // 自動判斷的語言標籤
            language === 'KR' ? 'KPOP' : null,
            language === 'KR' ? '韓文歌曲' : null,
            language === 'JP' ? 'JPOP' : null,
            language === 'JP' ? '日文歌曲' : null,
            language === 'EN' ? 'Pop' : null,
            language === 'EN' ? '英文歌曲' : null,
            '歌詞翻譯',
            '中文翻譯',
            '中字',
            'Chinese',
            'Lyrics',
            'LyricVideo',
            'MusicVideo',
            '音樂',
            'Music',
            '翻譯',
        ].filter(Boolean) as string[];
        
        setHashtags(defaultTags);
    }, [project.metadata]);
    
    const copyToClipboard = () => {
        const fullText = `${description}\n\n${hashtags.map(tag => `#${tag}`).join(' ')}`;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    return (
        <div className="h-full w-full overflow-auto bg-gradient-to-br from-neutral-900 via-neutral-900 to-black p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/30">
                            <FileText size={24} className="text-white"/>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold font-serif-tc text-white">影片說明 & Hashtag</h1>
                            <p className="text-sm text-neutral-400 mt-1">為您的影片生成專業的說明文字和標籤</p>
                        </div>
                    </div>
                    
                    {/* Project Info Card */}
                    <div className="bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 rounded-2xl p-5 border border-neutral-700/50 backdrop-blur-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-900/30 rounded-xl flex items-center justify-center">
                                    <Music size={18} className="text-amber-400"/>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500">歌曲名稱</div>
                                    <div className="text-sm font-medium text-white truncate">{project.metadata.title}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <User size={18} className="text-blue-400"/>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500">歌手</div>
                                    <div className="text-sm font-medium text-white truncate">{project.metadata.artist}</div>
                                </div>
                            </div>
                            {project.metadata.album && (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-900/30 rounded-xl flex items-center justify-center">
                                        <Disc size={18} className="text-purple-400"/>
                                    </div>
                                    <div>
                                        <div className="text-xs text-neutral-500">專輯</div>
                                        <div className="text-sm font-medium text-white truncate">{project.metadata.album}</div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-900/30 rounded-xl flex items-center justify-center">
                                    <Languages size={18} className="text-green-400"/>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500">語言</div>
                                    <div className="text-sm font-medium text-white">{project.metadata.language}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Description Editor */}
                    <div className="space-y-4">
                        <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800/50 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileText size={18} className="text-green-400"/>
                                    影片說明
                                </h2>
                                <span className="text-xs text-neutral-500 bg-neutral-800/50 px-3 py-1 rounded-lg">
                                    {description.length} 字元
                                </span>
                            </div>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full h-[500px] bg-neutral-950/80 border border-neutral-700/70 rounded-xl p-4 text-sm text-neutral-200 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all custom-scrollbar resize-none font-mono leading-relaxed"
                                placeholder="輸入影片說明..."
                            />
                            <p className="text-xs text-neutral-500 mt-3 italic">
                                💡 提示：詳細的說明有助於提升影片的搜尋排名和觀眾互動
                            </p>
                        </div>
                    </div>

                    {/* Right Column - Hashtags & Preview */}
                    <div className="space-y-4">
                        {/* Hashtags */}
                        <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800/50 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Hash size={18} className="text-green-400"/>
                                    Hashtags
                                </h2>
                                <span className="text-xs text-neutral-500 bg-neutral-800/50 px-3 py-1 rounded-lg">
                                    {hashtags.length} 個標籤
                                </span>
                            </div>
                            <div className="bg-neutral-950/80 border border-neutral-700/70 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                                <div className="flex flex-wrap gap-2">
                                    {hashtags.map((tag, index) => (
                                        <span 
                                            key={index}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-300 font-medium hover:bg-green-900/30 transition-colors"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 mt-3 italic">
                                💡 包含頻道名稱、歌曲資訊、語言標籤等關鍵字
                            </p>
                        </div>

                        {/* Copy Button */}
                        <button 
                            onClick={copyToClipboard}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle size={18}/>
                                    <span>已複製到剪貼簿！</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={18}/>
                                    <span>複製完整說明 & Hashtags</span>
                                </>
                            )}
                        </button>

                        {/* Preview */}
                        <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle size={16} className="text-green-400"/>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">預覽</h2>
                            </div>
                            <div className="bg-neutral-950/60 border border-neutral-800/50 rounded-xl p-4">
                                <div className="text-xs text-neutral-400 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar font-mono leading-relaxed">
                                    {description.substring(0, 300)}
                                    {description.length > 300 && '...'}
                                    {'\n\n'}
                                    <span className="text-green-400">
                                        {hashtags.slice(0, 10).map(tag => `#${tag}`).join(' ')}
                                        {hashtags.length > 10 && ' ...'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-800/50">
                                    <span className="text-xs text-neutral-600">總長度</span>
                                    <span className="text-xs text-neutral-400 font-mono">
                                        {description.length + hashtags.map(t => `#${t}`).join(' ').length + 2} 字元
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoDescriptionEditor;
