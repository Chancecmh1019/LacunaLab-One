import React from 'react';
import { useRenderQueue } from '../contexts/RenderQueueContext';
import { Trash2, Loader2, CheckCircle, AlertCircle, Clock, ListVideo, Film } from 'lucide-react';

const RenderQueueView: React.FC = () => {
  const { queue, removeFromQueue, isBatchRendering, currentProjectIndex, progress, renderStatus } = useRenderQueue();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-neutral-900 via-neutral-900 to-black text-white p-3 sm:p-4 md:p-6 lg:p-10 overflow-hidden relative">
       {/* Background */}
       <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent pointer-events-none" />
       
       <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col h-full">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
               <div>
                   <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif-tc flex items-center gap-2 sm:gap-3 text-amber-400">
                       <ListVideo className="text-amber-500" size={22} />
                       <span>渲染排程</span>
                   </h1>
                   <p className="text-neutral-400 mt-1 sm:mt-2 text-xs sm:text-sm">專案將自動依序在背景進行渲染</p>
               </div>
               {queue.length > 0 && (
                   <div className="flex items-center gap-3 text-sm">
                       <div className="px-3 py-1.5 bg-neutral-800/60 rounded-lg border border-neutral-700/50">
                           <span className="text-neutral-400">總計：</span>
                           <span className="text-white font-bold ml-1">{queue.length}</span>
                       </div>
                       {isBatchRendering && (
                           <div className="px-3 py-1.5 bg-amber-900/20 rounded-lg border border-amber-700/30 flex items-center gap-2">
                               <Loader2 size={14} className="animate-spin text-amber-500" />
                               <span className="text-amber-300 font-medium">渲染中</span>
                           </div>
                       )}
                   </div>
               )}
           </div>

           {/* Queue List */}
           <div className="flex-1 bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/70 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
               {/* Desktop Header */}
               <div className="hidden md:grid p-4 bg-neutral-900/80 border-b border-neutral-800/50 grid-cols-12 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                   <div className="col-span-1 text-center">#</div>
                   <div className="col-span-5">歌曲資訊</div>
                   <div className="col-span-2 text-center">時長</div>
                   <div className="col-span-3 text-center">狀態</div>
                   <div className="col-span-1 text-center">操作</div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 custom-scrollbar">
                   {queue.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4 p-8">
                           <div className="w-20 h-20 bg-neutral-800/50 rounded-2xl flex items-center justify-center">
                               <ListVideo size={40} className="opacity-30 text-amber-500"/>
                           </div>
                           <p className="text-base font-serif-tc">目前沒有待處理的專案</p>
                           <p className="text-sm text-neutral-500 text-center max-w-md">請在「歌詞影片編輯器」中點擊「加入排程」按鈕</p>
                       </div>
                   ) : (
                       queue.map((item, index) => {
                           const pid = (item as any).renderId || item.id;
                           const status = renderStatus.get(pid) || 'pending';
                           const isCurrent = index === currentProjectIndex && isBatchRendering;
                           const isMV = !!item.videoFile;
                           
                           return (
                               <div key={pid} className={`
                                   grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 items-center p-3 sm:p-4 rounded-xl border transition-all
                                   ${isCurrent 
                                       ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-amber-500/50 shadow-lg shadow-amber-900/20' 
                                       : 'bg-neutral-900/50 border-neutral-800/70 hover:border-neutral-700 hover:bg-neutral-900/70'
                                   }
                               `}>
                                   {/* Mobile/Tablet Layout */}
                                   <div className="md:hidden flex items-start gap-3">
                                       <div className="flex-shrink-0">
                                           <div className="w-8 h-8 bg-neutral-800/60 rounded-lg flex items-center justify-center text-neutral-400 font-mono text-sm mb-2">
                                               {index + 1}
                                           </div>
                                           {item.metadata.coverUrl ? (
                                               <img src={item.metadata.coverUrl} className="w-16 h-16 rounded-lg object-cover bg-neutral-800 shadow-lg"/>
                                           ) : (
                                               <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isMV ? 'bg-blue-900/30' : 'bg-neutral-800'}`}>
                                                   {isMV ? <Film size={24} className="text-blue-400"/> : <ListVideo size={24} className="text-neutral-600"/>}
                                               </div>
                                           )}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <div className="font-bold text-white text-sm mb-1 line-clamp-2" title={item.metadata.title}>{item.metadata.title}</div>
                                           {item.metadata.artist && <div className="text-xs text-neutral-400 mb-2">{item.metadata.artist}</div>}
                                           <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                                               <Clock size={12} />
                                               {formatTime((item.trimEnd || 0) - (item.trimStart || 0))}
                                           </div>
                                           {/* Status */}
                                           <div className="flex items-center justify-between">
                                               <div className="flex-1">
                                                   {status === 'pending' && <span className="flex items-center gap-1 text-xs text-neutral-500 bg-neutral-800/50 px-2 py-1 rounded-lg"><Clock size={12}/> 等待中</span>}
                                                   {status === 'rendering' && (
                                                       <div className="w-full">
                                                           <div className="flex justify-between text-[10px] text-amber-300 mb-1">
                                                               <span className="flex items-center gap-1"><Loader2 className="animate-spin" size={10}/> 渲染中</span>
                                                               <span className="font-bold">{progress}%</span>
                                                           </div>
                                                           <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                               <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300" style={{ width: `${progress}%` }}/>
                                                           </div>
                                                       </div>
                                                   )}
                                                   {status === 'completed' && <span className="flex items-center gap-1 text-xs text-green-400 font-bold bg-green-950/30 px-2 py-1 rounded-lg"><CheckCircle size={12}/> 完成</span>}
                                                   {status === 'error' && <span className="flex items-center gap-1 text-xs text-red-400 font-bold bg-red-950/30 px-2 py-1 rounded-lg"><AlertCircle size={12}/> 失敗</span>}
                                               </div>
                                               <button 
                                                  onClick={() => removeFromQueue(pid)}
                                                  disabled={status === 'rendering'}
                                                  className={`ml-2 p-2 rounded-lg transition ${status === 'rendering' ? 'opacity-30 cursor-not-allowed text-neutral-600' : 'hover:bg-red-900/20 text-neutral-500 hover:text-red-400 border border-neutral-700 hover:border-red-700/50'}`}
                                                  title="移除"
                                               >
                                                   <Trash2 size={16}/>
                                               </button>
                                           </div>
                                       </div>
                                   </div>

                                   {/* Desktop Layout */}
                                   <div className="hidden md:contents">
                                       <div className="col-span-1 text-center font-mono text-neutral-500">{index + 1}</div>
                                       <div className="col-span-5 flex items-center gap-4">
                                           {item.metadata.coverUrl ? (
                                               <img src={item.metadata.coverUrl} className="w-12 h-12 rounded-lg object-cover bg-neutral-800 shadow-lg"/>
                                           ) : (
                                               <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isMV ? 'bg-blue-900/30' : 'bg-neutral-800'}`}>
                                                   {isMV ? <Film size={20} className="text-blue-400"/> : <ListVideo size={20} className="text-neutral-600"/>}
                                               </div>
                                           )}
                                           <div className="min-w-0 flex-1">
                                               <div className="font-bold text-white text-sm line-clamp-1" title={item.metadata.title}>{item.metadata.title}</div>
                                               {item.metadata.artist && <div className="text-xs text-neutral-400 line-clamp-1">{item.metadata.artist}</div>}
                                           </div>
                                       </div>
                                       <div className="col-span-2 text-center font-mono text-xs text-neutral-400">
                                           {formatTime((item.trimEnd || 0) - (item.trimStart || 0))}
                                       </div>
                                       <div className="col-span-3 flex flex-col items-center justify-center px-2">
                                           {status === 'pending' && <span className="flex items-center gap-1 text-xs text-neutral-500 bg-neutral-800/50 px-2 py-1 rounded-lg"><Clock size={12}/> 等待中</span>}
                                           {status === 'rendering' && (
                                               <div className="w-full px-2">
                                                   <div className="flex justify-between text-[10px] text-amber-300 mb-1">
                                                       <span className="flex items-center gap-1"><Loader2 className="animate-spin" size={10}/> 渲染中</span>
                                                       <span className="font-bold">{progress}%</span>
                                                   </div>
                                                   <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                       <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300" style={{ width: `${progress}%` }}/>
                                                   </div>
                                               </div>
                                           )}
                                           {status === 'completed' && <span className="flex items-center gap-1 text-xs text-green-400 font-bold bg-green-950/30 px-2 py-1 rounded-lg"><CheckCircle size={14}/> 完成</span>}
                                           {status === 'error' && <span className="flex items-center gap-1 text-xs text-red-400 font-bold bg-red-950/30 px-2 py-1 rounded-lg"><AlertCircle size={14}/> 失敗</span>}
                                       </div>
                                       <div className="col-span-1 flex justify-center">
                                           <button 
                                              onClick={() => removeFromQueue(pid)}
                                              disabled={status === 'rendering'}
                                              className={`p-2 rounded-lg transition ${status === 'rendering' ? 'opacity-30 cursor-not-allowed text-neutral-600' : 'hover:bg-red-900/20 text-neutral-500 hover:text-red-400 border border-neutral-700 hover:border-red-700/50'}`}
                                              title="移除"
                                           >
                                               <Trash2 size={16}/>
                                           </button>
                                       </div>
                                   </div>
                               </div>
                           );
                       })
                   )}
               </div>
           </div>
       </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export default RenderQueueView;