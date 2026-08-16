import React, { useState, useEffect } from 'react';
import { X, RefreshCcw, Clipboard, Download, CheckCircle, AlertTriangle } from 'lucide-react';
// @ts-ignore
import * as OpenCC from 'opencc-js';
import { buildOutputFileName } from '../utils/outputFilename';

interface LRCWidgetProps {
    onClose: () => void;
    metadata?: {
        artist?: string;
        title?: string;
    };
}

interface LogMessage {
    type: 'success' | 'warning' | 'error';
    message: string;
}

interface ParsedLine {
    timestamp: number;
    timeStr: string;
    content: string;
}

interface SRTBlock {
    index: number;
    timeStr: string;
    content: string;
}

const LRCWidget: React.FC<LRCWidgetProps> = ({ onClose, metadata }) => {
    const [inputLRC, setInputLRC] = useState("");
    const [outputLRC, setOutputLRC] = useState("");
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [converter, setConverter] = useState<any>(null);
    const [mode, setMode] = useState<'lrc' | 'srt'>('lrc');

    useEffect(() => {
        const initOpenCC = async () => {
            try {
                const factory = OpenCC.Converter || (OpenCC as any).default?.Converter;
                if (factory) {
                    const convert = factory({ from: 'cn', to: 'tw' });
                    setConverter(() => convert);
                }
            } catch (e) {
                console.error("OpenCC init failed", e);
            }
        };
        initOpenCC();
    }, []);

    // 自動偵測格式
    useEffect(() => {
        if (inputLRC.includes('-->')) {
            setMode('srt');
        } else if (inputLRC.includes('[')) {
            setMode('lrc');
        }
    }, [inputLRC]);

    const processSRT = () => {
        if (!inputLRC.trim()) return;

        setLogs([]);
        const newLogs: LogMessage[] = [];
        
        // 分割成區塊
        const blocks = inputLRC.split(/\n\s*\n/).filter(b => b.trim());
        const parsedBlocks: SRTBlock[] = [];
        
        blocks.forEach((block, idx) => {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            
            if (lines.length < 2) return;
            
            // 找時間軸行
            const timeLineIdx = lines.findIndex(l => l.includes('-->'));
            if (timeLineIdx === -1) return;
            
            const timeLine = lines[timeLineIdx];
            const contentLines = lines.slice(timeLineIdx + 1);
            
            // 修正時間軸格式
            let fixedTimeLine = timeLine
                .replace(/\s+/g, ' ')
                .replace(/\s*-->\s*/g, ' --> ')
                .trim();
            
            // 處理內容：移除尾部空格、繁簡轉換
            let content = contentLines
                .map(l => l.trimEnd()) // 移除每行尾部空格
                .join('\n');
            
            if (converter) {
                content = converter(content);
            }
            
            // 檢查是否有尾部空格
            if (contentLines.some(l => l !== l.trimEnd())) {
                newLogs.push({
                    type: 'warning',
                    message: `區塊 ${idx + 1} 有尾部空格已移除`
                });
            }
            
            parsedBlocks.push({
                index: idx + 1,
                timeStr: fixedTimeLine,
                content: content
            });
        });
        
        // 重建 SRT
        let finalOutput = parsedBlocks.map(b => 
            `${b.index}\n${b.timeStr}\n${b.content}`
        ).join('\n\n');
        
        if (newLogs.length === 0) {
            newLogs.push({ type: 'success', message: "歌詞校正完成！" });
        } else {
            newLogs.unshift({ type: 'warning', message: `完成，修正了 ${newLogs.length} 個問題` });
        }
        
        setOutputLRC(finalOutput.trim());
        setLogs(newLogs);
    };

    const processLRC = () => {
        if (!inputLRC.trim()) return;

        setLogs([]);
        const newLogs: LogMessage[] = [];
        let cleanLRC = inputLRC;

        // 1. 自動分行：修復黏在一起的時間軸
        cleanLRC = cleanLRC.replace(/([^\n])\[/g, '$1\n[');

        const lines = cleanLRC.split('\n');
        const parsedList: ParsedLine[] = [];
        const metadataLines: string[] = [];
        let hasFirstEmptyLine = false;

        // 支援各種時間軸格式：[mm:ss.xx] [mm.ss.xx] [mm,ss,xx] [mm:ss:xx]
        const timeRegex = /\[(\d{1,2})[.:,](\d{1,2})[.:,](\d{1,3})\]/g;
        
        lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();
            
            // 保留第一行的 [00:00.00] 空白行
            if (lineIdx === 0 && trimmed === '[00:00.00]') {
                hasFirstEmptyLine = true;
                return;
            }
            
            // 移除其他完全空白的時間軸行
            if (!trimmed || trimmed.match(/^\[\d{1,2}[.:,]\d{1,2}[.:,]\d{1,3}\]$/)) {
                return;
            }

            // 處理多個時間軸在同一行的情況
            const matches = Array.from(trimmed.matchAll(timeRegex));
            
            if (matches.length > 0) {
                // 提取所有時間軸後的內容
                let remainingContent = trimmed;
                const timestamps: { time: number; str: string }[] = [];
                
                matches.forEach(match => {
                    const mm = parseInt(match[1]);
                    const ss = parseInt(match[2]);
                    const rawMs = match[3];
                    
                    let csVal = 0;
                    if (rawMs.length === 3) {
                        csVal = Math.round(parseInt(rawMs) / 10);
                    } else if (rawMs.length === 2) {
                        csVal = parseInt(rawMs);
                    } else if (rawMs.length === 1) {
                        csVal = parseInt(rawMs) * 10;
                    }
                    
                    const totalSeconds = mm * 60 + ss + (csVal / 100);
                    const mmStr = mm.toString().padStart(2, '0');
                    const ssStr = ss.toString().padStart(2, '0');
                    const csStr = csVal.toString().padStart(2, '0');
                    const standardTimeStr = `[${mmStr}:${ssStr}.${csStr}]`;
                    
                    timestamps.push({ time: totalSeconds, str: standardTimeStr });
                    remainingContent = remainingContent.replace(match[0], '');
                });
                
                // 分割內容（可能是多個內容片段）
                const contentParts = remainingContent.split(/(?=\S)/).filter(p => p.trim());
                
                // 如果時間軸和內容數量匹配，配對它們
                if (timestamps.length === contentParts.length) {
                    timestamps.forEach((ts, idx) => {
                        let content = contentParts[idx].trim();
                        
                        // 繁簡轉換
                        if (converter && content) {
                            content = converter(content);
                        }
                        
                        if (content) {
                            parsedList.push({
                                timestamp: ts.time,
                                timeStr: ts.str,
                                content: content
                            });
                        }
                    });
                } else {
                    // 內容不匹配，使用第一個時間軸
                    let content = remainingContent.trim();
                    if (converter && content) {
                        content = converter(content);
                    }
                    
                    if (content) {
                        parsedList.push({
                            timestamp: timestamps[0].time,
                            timeStr: timestamps[0].str,
                            content: content
                        });
                    }
                }
            } else if (trimmed.startsWith('[')) {
                // 元數據行
                metadataLines.push(trimmed);
            }
        });

        // 2. 排序
        parsedList.sort((a, b) => a.timestamp - b.timestamp);

        // 3. 檢查缺少翻譯（雙語模式）
        const groups: Map<string, ParsedLine[]> = new Map();
        parsedList.forEach(item => {
            if (!groups.has(item.timeStr)) {
                groups.set(item.timeStr, []);
            }
            groups.get(item.timeStr)!.push(item);
        });

        let missingTranslations = 0;
        groups.forEach((groupLines, timeKey) => {
            // 檢查是否有中文
            const hasChinese = groupLines.some(l => /[\u4e00-\u9fa5]/.test(l.content));
            const hasNonChinese = groupLines.some(l => /[a-zA-Z]/.test(l.content));
            
            // 如果有英文但沒有中文，可能缺少翻譯
            if (hasNonChinese && !hasChinese && groupLines.length === 1) {
                missingTranslations++;
                newLogs.push({
                    type: 'warning',
                    message: `${timeKey} 可能缺少中文翻譯: "${groupLines[0].content}"`
                });
            }
            
            // 奇數行警告（3行以上）
            if (groupLines.length >= 3 && groupLines.length % 2 !== 0) {
                const contentSnippet = groupLines.map(l => l.content).join(" | ");
                newLogs.push({ 
                    type: 'warning', 
                    message: `${timeKey} 有 ${groupLines.length} 行 (奇數): "${contentSnippet}"`
                });
            }
        });

        // 4. 構建輸出
        let finalOutput = "";
        
        if (hasFirstEmptyLine) {
            finalOutput += "[00:00.00]\n";
        }
        
        if (metadataLines.length > 0) {
            finalOutput += metadataLines.join('\n') + "\n";
        }
        
        parsedList.forEach(l => {
            finalOutput += `${l.timeStr}${l.content}\n`;
        });

        if (newLogs.length === 0) {
            newLogs.push({ type: 'success', message: "歌詞校正完成！" });
        } else {
            newLogs.unshift({ type: 'warning', message: `完成，檢測到 ${newLogs.length} 個問題` });
        }

        setOutputLRC(finalOutput.trim());
        setLogs(newLogs);
    };

    const processFile = () => {
        if (mode === 'srt') {
            processSRT();
        } else {
            processLRC();
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(outputLRC);
        alert("已複製");
    };

    const downloadLRC = () => {
        const element = document.createElement("a");
        const file = new Blob([outputLRC], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = buildOutputFileName(metadata?.artist, metadata?.title || '歌詞', 'lrc');
        document.body.appendChild(element); 
        element.click();
        document.body.removeChild(element);
    };

    return (
        <>
            {/* 背景遮罩 */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            
            {/* 小工具面板 */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-4xl h-[90vh] bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl shadow-2xl border border-neutral-800/50 flex flex-col overflow-hidden">
                
                {/* 標題列 */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800/50 bg-neutral-950/50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-amber-500 font-serif-tc">歌詞校正工具</h2>
                        <div className="flex gap-1 bg-neutral-900/80 rounded-lg p-1">
                            <button
                                onClick={() => setMode('lrc')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                    mode === 'lrc' 
                                        ? 'bg-amber-600 text-white' 
                                        : 'text-neutral-400 hover:text-white'
                                }`}
                            >
                                LRC
                            </button>
                            <button
                                onClick={() => setMode('srt')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                    mode === 'srt' 
                                        ? 'bg-amber-600 text-white' 
                                        : 'text-neutral-400 hover:text-white'
                                }`}
                            >
                                SRT
                            </button>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800/70 rounded-lg text-neutral-400 hover:text-white transition-all"
                    >
                        <X size={20}/>
                    </button>
                </div>

                {/* 內容區 */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* 左側：輸入 */}
                    <div className="w-full md:w-1/2 flex flex-col p-4 gap-3 border-b md:border-b-0 md:border-r border-neutral-800/50">
                        <textarea 
                            value={inputLRC}
                            onChange={(e) => setInputLRC(e.target.value)}
                            placeholder={mode === 'lrc' ? "貼上原始 LRC...\n例如：[00:39.24]Hi[00:39.24]你好" : "貼上原始 SRT...\n例如：\n1\n00:00:00,000 --> 00:06:00,000\nHello"}
                            className="flex-1 bg-neutral-950/80 border border-neutral-800/70 rounded-lg p-3 font-mono text-xs focus:outline-none focus:border-amber-500 resize-none text-neutral-300 custom-scrollbar"
                        />
                        
                        <button 
                            onClick={processFile}
                            className="py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                        >
                            <RefreshCcw size={16}/> 
                            執行校正
                        </button>
                    </div>

                    {/* 右側：輸出 */}
                    <div className="w-full md:w-1/2 flex flex-col p-4 gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-green-400">校正結果</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={copyToClipboard} 
                                    className="p-2 hover:bg-neutral-800/70 rounded-lg text-neutral-400 hover:text-white transition-all" 
                                    title="複製"
                                >
                                    <Clipboard size={16}/>
                                </button>
                                <button 
                                    onClick={downloadLRC} 
                                    className="p-2 hover:bg-neutral-800/70 rounded-lg text-neutral-400 hover:text-white transition-all" 
                                    title="下載"
                                >
                                    <Download size={16}/>
                                </button>
                            </div>
                        </div>

                        <textarea 
                            value={outputLRC}
                            readOnly
                            className="flex-1 bg-neutral-950/80 border border-neutral-800/70 rounded-lg p-3 font-mono text-xs focus:outline-none text-green-100 resize-none custom-scrollbar"
                        />

                        {/* 檢測報告 */}
                        <div className="h-24 bg-neutral-950/80 border border-neutral-800/70 rounded-lg p-3 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                {logs.length === 0 && (
                                    <span className="text-xs text-neutral-600">等待執行...</span>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className={`text-xs flex items-start gap-2 ${
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'warning' ? 'text-yellow-400' : 
                                        'text-green-400'
                                    }`}>
                                        {log.type === 'error' && <AlertTriangle size={12} className="shrink-0 mt-0.5"/>}
                                        {log.type === 'warning' && <AlertTriangle size={12} className="shrink-0 mt-0.5"/>}
                                        {log.type === 'success' && <CheckCircle size={12} className="shrink-0 mt-0.5"/>}
                                        <span>{log.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LRCWidget;
