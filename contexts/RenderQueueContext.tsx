import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ProjectData } from '../types';
import { renderProjectOffscreen } from '../services/renderEngine';
import { buildMediaOutputFileName } from '../utils/outputFilename';
const buildLyricVideoOutputName = (artist: string, title: string, extension: string, isShorts = false) =>
  buildMediaOutputFileName(artist, title, extension, isShorts);

// Extended type for internal queue handling
type QueueItem = ProjectData & { renderId?: string };

interface RenderQueueContextType {
  queue: QueueItem[];
  addToQueue: (project: ProjectData) => void;
  removeFromQueue: (renderId: string) => void;
  isBatchRendering: boolean;
  currentProjectIndex: number;
  progress: number;
  renderStatus: Map<string, 'pending' | 'rendering' | 'completed' | 'error'>;
}

const RenderQueueContext = createContext<RenderQueueContextType | undefined>(undefined);

export const RenderQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<Map<string, 'pending' | 'rendering' | 'completed' | 'error'>>(new Map());

  const addToQueue = useCallback((project: ProjectData) => {
    // Assign a unique ID for this render instance to distinguish it in the queue
    const renderId = `${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projectWithId = { ...project, renderId };
    
    setQueue(prev => [...prev, projectWithId]);
    setRenderStatus(prev => new Map(prev).set(renderId, 'pending'));
  }, []);

  const removeFromQueue = useCallback((renderId: string) => {
    setQueue(prev => prev.filter(p => (p.renderId || p.id) !== renderId));
    setRenderStatus(prev => {
        const next = new Map(prev);
        next.delete(renderId);
        return next;
    });
  }, []);

  // Automatic Queue Processor
  useEffect(() => {
    if (isBatchRendering) return;

    // Find first pending item
    const nextIndex = queue.findIndex(item => {
        const pid = item.renderId || item.id;
        return renderStatus.get(pid) === 'pending';
    });

    if (nextIndex !== -1) {
        processItem(nextIndex);
    }
  }, [queue, renderStatus, isBatchRendering]);

  const processItem = async (index: number) => {
      setIsBatchRendering(true);
      setCurrentProjectIndex(index);
      
      const item = queue[index];
      const pid = item.renderId || item.id;

      setRenderStatus(prev => new Map(prev).set(pid, 'rendering'));
      setProgress(0);

      try {
          const blob = await renderProjectOffscreen(item, (p) => setProgress(p));
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = buildLyricVideoOutputName(
            item.metadata.artist,
            item.metadata.title,
            'mp4',
            item.theme.aspectRatio === '9:16'
          );
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setRenderStatus(prev => new Map(prev).set(pid, 'completed'));
      } catch (e) {
          console.error(`Render failed for project ${pid}`, e);
          setRenderStatus(prev => new Map(prev).set(pid, 'error'));
      } finally {
          setIsBatchRendering(false);
          setCurrentProjectIndex(-1);
          setProgress(0);
      }
  };

  return (
    <RenderQueueContext.Provider value={{
        queue, 
        addToQueue, 
        removeFromQueue, 
        isBatchRendering, 
        currentProjectIndex, 
        progress, 
        renderStatus
    }}>
      {children}
    </RenderQueueContext.Provider>
  );
};

export const useRenderQueue = () => {
  const context = useContext(RenderQueueContext);
  if (context === undefined) {
    throw new Error('useRenderQueue must be used within a RenderQueueProvider');
  }
  return context;
};