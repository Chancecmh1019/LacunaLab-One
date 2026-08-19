
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ProjectData } from '../types';
import { Download, Layout, Type, Minus, Plus, Aperture, Stamp, MoveHorizontal, MoveVertical } from 'lucide-react';
import { drawRoundedRect, wrapText } from '../utils/canvasUtils';
import { FONT_STACK } from '../utils/layoutPresets';
import { getLanguageLabel } from '../utils/languageDetector';
import { buildMediaOutputFileName } from '../utils/outputFilename';

interface Props {
  project: ProjectData;
  onUpdate?: (data: Partial<ProjectData>) => void;
}

const ThumbnailMaker: React.FC<Props> = ({ project, onUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [styleIndex, setStyleIndex] = useState(2); // 預設為 CD Booklet
  
  // Image Resources refs to prevent reloading on every render
  const bgImgRef = useRef<HTMLImageElement>(new Image());
  const coverImgRef = useRef<HTMLImageElement>(new Image());
  const [imagesLoaded, setImagesLoaded] = useState(0); // Trigger re-render on load

  const styles = [
      { name: "01. 經典雜誌左 (Magazine L)", id: 0 },
      { name: "02. 電影海報 (Cinematic)", id: 1 },
      { name: "03. 文青專輯 (CD Booklet)", id: 2 },
      { name: "04. 純粹文字 (Typography)", id: 4 },
      { name: "05. 播放介面 (Playlist)", id: 5 },
      { name: "06. 電影雙色 (Split Tone)", id: 6 },
      { name: "07. 經典雜誌右 (Magazine R)", id: 7 },
      { name: "08. 極簡白框 (Minimal White)", id: 8 },
      { name: "09. 時尚大膽 (Fashion Bold)", id: 9 },
      { name: "10. 復古膠卷 (Vintage Film)", id: 12 },
      { name: "11. 漸層淡出 (Gradient Fade)", id: 13 },
      { name: "12. 對角線構圖 (Diagonal)", id: 14 },
      { name: "13. 玻璃擬態 (Glassmorphism)", id: 15 },
      { name: "14. 瑞士國際 (Swiss Design)", id: 16 },
      { name: "15. 日式垂直 (Japanese Vert)", id: 17 },
      { name: "16. 拍立得 (Polaroid)", id: 18 },
      { name: "17. 野獸派大字 (Brutalist)", id: 19 },
      { name: "18. 現代拼貼 (Modern Collage)", id: 21 },
      { name: "19. 霓虹邊框 (Neon Frame)", id: 22 },
      { name: "20. 垂直小說 (Vertical Novel)", id: 23 },
  ];

  const languageLabel = getLanguageLabel(project.metadata.language || 'KR');

  const watermark = project.theme.watermark || {
      text: '',
      x: 0.95,
      y: 0.05,
      scale: 1.0,
      opacity: 0.6
  };

  // Update Helper for Watermark
  const updateWatermark = (updates: Partial<typeof watermark>) => {
      if(onUpdate) {
        onUpdate({
            theme: {
                ...project.theme,
                watermark: { ...watermark, ...updates }
            }
        });
      }
  };

  // Helper to update specific layout scale
  const updateScale = (element: 'title' | 'artist' | 'album', delta: number) => {
      if (!onUpdate) return;
      const currentLayout = project.theme.layout;
      const currentScale = currentLayout[element].scale || 1.0;
      const newScale = Math.max(0.1, Math.min(4.0, currentScale + delta));
      
      onUpdate({
          theme: {
              ...project.theme,
              layout: {
                  ...currentLayout,
                  [element]: { ...currentLayout[element], scale: newScale }
              }
          }
      });
  };

  // Load images effect
  useEffect(() => {
      const bgSrc = project.theme.bgImageUrl || project.metadata.coverUrl || '';
      const coverSrc = project.metadata.coverUrl || '';
      
      bgImgRef.current.crossOrigin = "anonymous";
      bgImgRef.current.src = bgSrc;
      bgImgRef.current.onload = () => setImagesLoaded(prev => prev + 1);
      
      coverImgRef.current.crossOrigin = "anonymous";
      coverImgRef.current.src = coverSrc;
      coverImgRef.current.onload = () => setImagesLoaded(prev => prev + 1);
      
  }, [project.theme.bgImageUrl, project.metadata.coverUrl]);

  // Main Draw Function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Color
    ctx.fillStyle = project.theme.backgroundColor || '#0f0f11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { title, artist, album } = project.metadata;
    const albumName = album || "SINGLE ALBUM"; // Fallback for album name
    const color = project.theme.secondaryColor || '#f472b6';
    const langLabel = languageLabel;
    const bgImg = bgImgRef.current;
    const coverImg = coverImgRef.current;

    // SCALING FACTORS (User Customized)
    const titleScale = project.theme.layout.title.scale || 1.0;
    const artistScale = project.theme.layout.artist.scale || 1.0;
    const albumScale = project.theme.layout.album.scale || 1.0;

    // EFFECTS
    const blurAmount = project.theme.effects?.blurBackground || 0;

    // Common Helper: Draw Background Image Covered
    const drawBgCover = (overrideBlur?: number) => {
        if (bgImg.complete && bgImg.naturalWidth > 0) {
            ctx.save();
            const b = overrideBlur !== undefined ? overrideBlur : blurAmount;
            if (b > 0) ctx.filter = `blur(${b}px)`;
            const ratio = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
            const cx = (canvas.width - bgImg.width * ratio) / 2;
            const cy = (canvas.height - bgImg.height * ratio) / 2;
            ctx.drawImage(bgImg, cx, cy, bgImg.width * ratio, bgImg.height * ratio);
            ctx.restore();
        }
    };

    if (styleIndex === 0) {
        // Style 0: Magazine Style (Left)
        drawBgCover();
        const grad = ctx.createLinearGradient(0,0, canvas.width * 0.6, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)'); 
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${80 * artistScale}px ${FONT_STACK}`;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText(artist, 80, 200);

        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `500 ${40 * albumScale}px ${FONT_STACK}`;
        ctx.fillText(albumName, 80, 260);

        const maxTitleWidth = canvas.width * 0.7; // Changed from 0.42 to 0.7
        let baseFontSize = 130;
        if (title.length > 15) baseFontSize = 100;
        const fontSize = baseFontSize * titleScale;
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        const lines = wrapText(ctx, title, maxTitleWidth);
        lines.forEach((line, i) => {
            ctx.fillText(line, 80, 420 + (i * fontSize * 1.1));
        });

        const badgeY = 420 + (lines.length * fontSize * 1.1) + 20;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(80, badgeY, 240, 80);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.font = `500 40px ${FONT_STACK}`;
        ctx.fillText(langLabel, 80 + 120, badgeY + 40);
        ctx.textBaseline = 'alphabetic';

    } else if (styleIndex === 7) {
        // Style 7: Magazine Style (Right)
        drawBgCover();
        const grad = ctx.createLinearGradient(canvas.width, 0, canvas.width * 0.4, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)'); 
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${80 * artistScale}px ${FONT_STACK}`;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText(artist, canvas.width - 80, 200);

        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `500 ${40 * albumScale}px ${FONT_STACK}`;
        ctx.fillText(albumName, canvas.width - 80, 260);

        const maxTitleWidth = canvas.width * 0.7; // Changed from 0.42 to 0.7
        let fontSize = 130 * titleScale;
        if(title.length > 15) fontSize = 100 * titleScale;
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        const lines = wrapText(ctx, title, maxTitleWidth);
        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width - 80, 420 + (i * fontSize * 1.1));
        });

        const badgeY = 420 + (lines.length * fontSize * 1.1) + 20;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(canvas.width - 320, badgeY, 240, 80);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.font = `500 40px ${FONT_STACK}`;
        ctx.fillText(langLabel, canvas.width - 200, badgeY + 40);
        ctx.textBaseline = 'alphabetic';

    } else if (styleIndex === 1) {
        // Style 1: Cinematic Poster
        drawBgCover();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.textAlign = 'center';
        
        let fontSize = 120 * titleScale;
        if(title.length > 20) fontSize = 80 * titleScale;
        
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        const lines = wrapText(ctx, title, canvas.width * 0.8);
        const totalHeight = lines.length * fontSize * 1.1;
        const startY = (canvas.height - totalHeight) / 2 + 50;
        
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#fff';
        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width/2, startY + (i * fontSize * 1.1));
        });
        
        ctx.font = `400 ${50 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '10px';
        ctx.fillText(artist, canvas.width/2, startY - 80);

        ctx.font = `400 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '2px';
        ctx.fillStyle = '#ddd';
        ctx.fillText(albumName + ` | ${langLabel}`, canvas.width/2, canvas.height - 50);

    } else if (styleIndex === 8) {
        // Style 8: Minimal White Border
        drawBgCover();
        const border = 40;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.strokeRect(border, border, canvas.width - border*2, canvas.height - border*2);
        
        // Bottom Text
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * 0.4);
        grad.addColorStop(0, 'rgba(0,0,0,0.8)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, canvas.height * 0.4, canvas.width, canvas.height * 0.6);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        const fontSize = 100 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width/2, canvas.height - 180);
        
        ctx.font = `400 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText(artist, canvas.width/2, canvas.height - 120);

        ctx.font = `300 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.fillStyle = '#ccc';
        ctx.fillText(albumName + " • " + langLabel, canvas.width/2, canvas.height - 60);

    } else if (styleIndex === 9) {
        // Style 9: Fashion Bold
        drawBgCover(0); // Clear image
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; // Slight tint
        ctx.fillRect(0,0,canvas.width, canvas.height);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const fontSize = 180 * titleScale;
        ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
        ctx.globalCompositeOperation = 'overlay'; // Blend
        ctx.fillText(title, canvas.width/2, canvas.height/2 + 60);
        ctx.globalCompositeOperation = 'source-over';
        
        // Solid Text on top
        ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.strokeText(title, canvas.width/2, canvas.height/2 + 60);
        
        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `700 ${60 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, canvas.width/2, canvas.height/2 - (fontSize/2) - 20);

        ctx.fillStyle = 'white';
        ctx.font = `500 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '8px';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText(albumName, canvas.width/2, canvas.height - 50);
        ctx.shadowBlur = 0;

    } else if (styleIndex === 12) {
        // Style 12: Vintage Film
        drawBgCover();
        // Film strips on side
        const stripWidth = 80;
        ctx.fillStyle = '#111';
        ctx.fillRect(0,0, stripWidth, canvas.height);
        ctx.fillRect(canvas.width - stripWidth, 0, stripWidth, canvas.height);
        
        // Sprocket holes
        ctx.fillStyle = '#fff';
        for(let i=0; i<canvas.height; i+=60) {
            ctx.fillRect(20, i+15, 40, 30);
            ctx.fillRect(canvas.width-60, i+15, 40, 30);
        }
        
        // Grain overlay
        ctx.fillStyle = 'rgba(255, 230, 200, 0.1)'; // Sepia tint
        ctx.fillRect(stripWidth, 0, canvas.width - stripWidth*2, canvas.height);
        
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = '#ffe';
        const fontSize = 100 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width/2, canvas.height - 150);
        
        ctx.font = `400 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist + " // " + albumName, canvas.width/2, canvas.height - 80);

    } else if (styleIndex === 13) {
        // Style 13: Gradient Fade (Top/Bottom)
        drawBgCover();
        
        const grad = ctx.createLinearGradient(0,0,0,canvas.height);
        grad.addColorStop(0, 'rgba(0,0,0,0.8)');
        grad.addColorStop(0.3, 'transparent');
        grad.addColorStop(0.7, 'transparent');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,canvas.width, canvas.height);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `600 ${50 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '8px';
        ctx.fillText(artist, canvas.width/2, 100);

        ctx.fillStyle = '#ccc';
        ctx.font = `400 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText(albumName, canvas.width/2, 150);
        
        ctx.fillStyle = 'white';
        const fontSize = 90 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width/2, canvas.height - 100);
        
        // Decorative lines
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(canvas.width/2 - 100, canvas.height - 70);
        ctx.lineTo(canvas.width/2 + 100, canvas.height - 70);
        ctx.stroke();

    } else if (styleIndex === 14) {
        // Style 14: Diagonal Split
        drawBgCover();
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.6);
        ctx.lineTo(canvas.width, canvas.height * 0.3);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = '#111';
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.6 - 10);
        ctx.lineTo(canvas.width, canvas.height * 0.3 - 10);
        ctx.lineWidth = 10;
        ctx.strokeStyle = project.theme.secondaryColor;
        ctx.stroke();
        
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        const fontSize = 100 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width - 50, canvas.height - 120);
        
        ctx.textAlign = 'left';
        ctx.fillStyle = '#aaa';
        ctx.font = `400 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, 50, canvas.height - 50);

        ctx.textAlign = 'right';
        ctx.font = `300 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.fillText(albumName, canvas.width - 50, canvas.height - 60);

    } else if (styleIndex === 15) {
        // Style 15: Glassmorphism Card
        drawBgCover();
        const cardW = 900;
        const cardH = 400;
        const cardX = (canvas.width - cardW) / 2;
        const cardY = (canvas.height - cardH) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 20;
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        
        const fontSize = 90 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        const lines = wrapText(ctx, title, cardW - 100);
        const totalH = lines.length * fontSize * 1.1;
        
        const startY = cardY + (cardH - totalH)/2 + (fontSize/2) - 20;
        lines.forEach((l, i) => {
            ctx.fillText(l, canvas.width/2, startY + i*fontSize*1.1);
        });
        
        ctx.font = `500 ${30 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '5px';
        ctx.fillText(artist + " • " + albumName, canvas.width/2, cardY + cardH - 40);

    } else if (styleIndex === 16) {
        // Style 17: Swiss Design
        ctx.fillStyle = '#eaeaea';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        
        if(bgImg.complete) {
            ctx.drawImage(bgImg, canvas.width * 0.4, 0, canvas.width*0.6, canvas.height);
        }
        
        ctx.fillStyle = '#111';
        ctx.textAlign = 'left';
        ctx.font = `900 ${80 * titleScale}px ${FONT_STACK}`;
        const lines = wrapText(ctx, title, canvas.width * 0.35);
        lines.forEach((l, i) => ctx.fillText(l, 60, 150 + i*90));
        
        ctx.fillRect(60, 150 + lines.length*90 + 20, 100, 8);
        
        ctx.font = `500 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, 60, 150 + lines.length*90 + 80);
        
        ctx.font = `400 24px ${FONT_STACK}`;
        ctx.fillText("AUDIO / VISUAL", 60, canvas.height - 60);
        ctx.fillText(albumName, 60, canvas.height - 30);
    }
    // --- NEW STYLES ---
    else if (styleIndex === 17) {
        // Style 17: Japanese Vertical
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0,0,canvas.width, canvas.height);

        // Image area
        const imgW = canvas.width * 0.6;
        if (bgImg.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, imgW, canvas.height);
            ctx.clip();
            const ratio = Math.max(imgW / bgImg.width, canvas.height / bgImg.height);
            const cx = (imgW - bgImg.width * ratio) / 2;
            const cy = (canvas.height - bgImg.height * ratio) / 2;
            ctx.drawImage(bgImg, cx, cy, bgImg.width * ratio, bgImg.height * ratio);
            ctx.restore();
        }

        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        
        const rightCenter = imgW + (canvas.width - imgW) / 2;
        
        ctx.save();
        ctx.translate(rightCenter, 100);
        
        // Artist
        ctx.font = `500 ${30 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText(artist, 0, 0);

        // Title (Vertical) - Rotated for simplicity
        ctx.translate(0, 100);
        ctx.rotate(Math.PI / 2);
        ctx.font = `700 ${100 * titleScale}px ${FONT_STACK}`;
        ctx.fillText(title, 0, 0);
        ctx.restore();
        
        // Red stamp
        ctx.fillStyle = '#d00';
        ctx.fillRect(canvas.width - 80, canvas.height - 80, 50, 50);

    } else if (styleIndex === 18) {
        // Style 18: Polaroid
        ctx.fillStyle = '#eaddcf'; // Beige
        ctx.fillRect(0,0,canvas.width, canvas.height);
        
        const pWidth = 600;
        const pHeight = 750;
        const pX = (canvas.width - pWidth) / 2;
        const pY = (canvas.height - pHeight) / 2 - 20;

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 20;
        ctx.fillStyle = '#fff';
        ctx.fillRect(pX, pY, pWidth, pHeight);
        ctx.restore();

        // Image inside
        const innerM = 40;
        const innerW = pWidth - innerM*2;
        const innerH = innerW; // Square aspect
        if (bgImg.complete) {
            ctx.drawImage(bgImg, pX + innerM, pY + innerM, innerW, innerH);
        } else {
            ctx.fillStyle = '#ddd';
            ctx.fillRect(pX + innerM, pY + innerM, innerW, innerH);
        }

        // Text below image
        ctx.textAlign = 'center';
        ctx.fillStyle = '#333';
        ctx.font = `400 ${60 * titleScale}px ${FONT_STACK}`; // Handwriting style
        ctx.fillText(title, canvas.width/2, pY + innerH + innerM + 80);
        
        ctx.font = `400 ${30 * artistScale}px ${FONT_STACK}`;
        ctx.fillStyle = '#777';
        ctx.fillText(artist, canvas.width/2, pY + innerH + innerM + 130);

    } else if (styleIndex === 19) {
        // Style 19: Brutalist Big Text
        // Image background, HUGE text filling screen with blend mode
        drawBgCover();
        
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        
        const fontSize = 250 * titleScale;
        ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
        
        // Split title into 2 lines if possible, or just truncate
        const words = title.split(' ');
        if (words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            const line1 = words.slice(0, mid).join(' ');
            const line2 = words.slice(mid).join(' ');
            ctx.fillText(line1, canvas.width/2, canvas.height/2 - 20);
            ctx.fillText(line2, canvas.width/2, canvas.height/2 + fontSize - 40);
        } else {
            ctx.fillText(title, canvas.width/2, canvas.height/2 + 80);
        }
        
        ctx.globalCompositeOperation = 'source-over';
        
        // Small meta data with Album Name added
        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `700 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, canvas.width/2, canvas.height - 80); // Move Artist Up
        
        // Add Album Name
        ctx.fillStyle = '#cccccc';
        ctx.font = `500 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '2px';
        ctx.fillText(albumName, canvas.width/2, canvas.height - 35); // Album Below Artist

    } else if (styleIndex === 21) {
        // Modern Collage
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0,0,canvas.width, canvas.height);

        // 3 Images strip if possible, else repeat bg
        const w3 = canvas.width / 3;
        if(bgImg.complete) {
            // Left (Zoomed)
            ctx.save();
            ctx.beginPath(); ctx.rect(0,0,w3,canvas.height); ctx.clip();
            ctx.drawImage(bgImg, -100, 0, bgImg.width, bgImg.height);
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,w3,canvas.height);
            ctx.restore();

            // Center (Normal)
            ctx.drawImage(bgImg, w3, 50, w3, canvas.height-100);
            
            // Right (Inverted)
            ctx.save();
            ctx.beginPath(); ctx.rect(w3*2,0,w3,canvas.height); ctx.clip();
            ctx.filter = 'invert(1)';
            ctx.drawImage(bgImg, w3*2, 0, bgImg.width, bgImg.height);
            ctx.restore();
        }

        // Overlay Text Box
        ctx.fillStyle = '#fff';
        const boxW = 800;
        const boxH = 300;
        const boxX = (canvas.width - boxW)/2;
        const boxY = (canvas.height - boxH)/2;
        
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 40;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.font = `700 ${80 * titleScale}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width/2, canvas.height/2 + 20);
        
        ctx.font = `400 ${30 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '5px';
        ctx.fillText(artist, canvas.width/2, canvas.height/2 - 60);

    } else if (styleIndex === 22) {
        // Neon Frame
        ctx.fillStyle = '#050505';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        if (bgImg.complete) {
            ctx.globalAlpha = 0.4;
            drawBgCover();
            ctx.globalAlpha = 1.0;
        }

        // Neon Border
        ctx.strokeStyle = project.theme.secondaryColor;
        ctx.lineWidth = 10;
        ctx.shadowColor = project.theme.secondaryColor;
        ctx.shadowBlur = 40;
        const m = 60;
        ctx.strokeRect(m, m, canvas.width-m*2, canvas.height-m*2);
        
        // Text
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 20;
        const fontSize = 110 * titleScale;
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillText(title, canvas.width/2, canvas.height/2 + 20);
        
        ctx.shadowColor = project.theme.secondaryColor;
        ctx.fillStyle = project.theme.secondaryColor;
        ctx.font = `500 ${50 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, canvas.width/2, canvas.height/2 + 120);

    } else if (styleIndex === 23) {
        // Vertical Novel
        drawBgCover();
        
        // Side overlay gradient
        const grad = ctx.createLinearGradient(canvas.width, 0, canvas.width - 400, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.9)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(canvas.width - 400, 0, 400, canvas.height);
        
        // Vertical Text simulation
        ctx.save();
        ctx.translate(canvas.width - 150, 100);
        ctx.rotate(Math.PI/2);
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${100 * titleScale}px ${FONT_STACK}`;
        ctx.textAlign = 'left';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText(title, 0, 0);
        ctx.restore();
        
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ccc';
        ctx.font = `500 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.fillText(artist, canvas.width - 50, canvas.height - 50);

    } else if (styleIndex === 2) {
            // CD Booklet (文青專輯) - 與影片風格一致的縮圖版
            
            // 背景：專輯封面模糊
            if (coverImg.complete && coverImg.naturalWidth > 0) {
                ctx.save();
                ctx.filter = `blur(35px) brightness(0.6) saturate(0.85)`;
                const ratio = Math.max(canvas.width / coverImg.width, canvas.height / coverImg.height);
                const cx = (canvas.width - coverImg.width * ratio) / 2;
                const cy = (canvas.height - coverImg.height * ratio) / 2;
                ctx.drawImage(coverImg, cx, cy, coverImg.width * ratio, coverImg.height * ratio);
                ctx.restore();
            }
            
            // === 精準定位計算 ===
            // 畫布: 1280 x 720
            // 左側專輯封面區域: x=80, 寬度=500
            // 右側文字區域: 封面右邊開始
            
            const coverX = 80;
            const coverY = 110;
            const coverSize = 500;
            
            // === 專輯封面 ===
            if (coverImg.complete && coverImg.naturalWidth > 0) {
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetY = 10;
                
                ctx.beginPath();
                drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 12);
                ctx.clip();
                ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
                ctx.restore();
                
                // 封面下方細線（與影片一致）
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(coverX, coverY + coverSize + 20);
                ctx.lineTo(coverX + coverSize, coverY + coverSize + 20);
                ctx.stroke();
                
                // TRACK 標示
                ctx.globalAlpha = 0.4;
                ctx.font = `300 14px ${FONT_STACK}`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.fillText(`TRACK · ${project.metadata.language || 'KR'}`, coverX, coverY + coverSize + 42);
                ctx.globalAlpha = 1.0;
            }
            
            // 右側垂直分隔線（與影片一致）
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(coverX + coverSize + 30, 80);
            ctx.lineTo(coverX + coverSize + 30, canvas.height - 80);
            ctx.stroke();
            
            // === 右側文字（置中對齊，放大醒目）===
            const textAreaLeft = coverX + coverSize + 40;
            const textAreaRight = canvas.width - 40;
            const textCenterX = textAreaLeft + (textAreaRight - textAreaLeft) / 2;
            const textMaxWidth = textAreaRight - textAreaLeft - 20;
            
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 12;
            
            // Font Sizes
            const artistFontSize = 48 * artistScale;
            const albumFontSize = 32 * albumScale;
            
            let baseFontSize = 95;
            if (title.length > 18) baseFontSize = 62;
            else if (title.length > 12) baseFontSize = 75;
            else if (title.length > 8) baseFontSize = 85;
            const titleFontSize = baseFontSize * titleScale;
            
            // 1. Calculate Artist Height (wrapped)
            ctx.font = `600 ${artistFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '4px';
            const artistLines = wrapText(ctx, artist, textMaxWidth);
            const artistLineHeight = artistFontSize * 1.2;
            const artistHeight = artistLines.length * artistLineHeight;
            
            // 2. Calculate Album Height (wrapped)
            ctx.font = `400 ${albumFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '2px';
            const albumLines = wrapText(ctx, albumName, textMaxWidth);
            const albumLineHeight = albumFontSize * 1.3;
            const albumHeight = albumLines.length * albumLineHeight;

            // 3. Calculate Title Height (wrapped)
            ctx.font = `700 ${titleFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '0px';
            const titleLines = wrapText(ctx, title, textMaxWidth);
            const titleLineHeight = titleFontSize * 1.1;
            const titleHeight = titleLines.length * titleLineHeight;
            
            // Total Height
            const gap1 = 20; // Artist -> Album
            const gap2 = 35; // Album -> Title
            const totalHeight = artistHeight + gap1 + albumHeight + gap2 + titleHeight;
            
            // Start Y (Top of the text block)
            let currentY = (canvas.height - totalHeight) / 2;
            
            // Draw Artist
            ctx.fillStyle = color;
            ctx.font = `600 ${artistFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '4px';
            
            artistLines.forEach((line) => {
                ctx.fillText(line, textCenterX, currentY + artistFontSize); 
                currentY += artistLineHeight;
            });
            
            currentY += gap1;
            
            // Draw Album
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `400 ${albumFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '2px';
            
            albumLines.forEach((line) => {
                ctx.fillText(line, textCenterX, currentY + albumFontSize);
                currentY += albumLineHeight;
            });
            
            currentY += gap2;
            
            // Draw Title
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${titleFontSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '0px';
            
            titleLines.forEach((line) => {
                ctx.fillText(line, textCenterX, currentY + titleFontSize);
                currentY += titleLineHeight;
            });
            
            // 語言標籤（右下角，雜誌標籤風格）
            ctx.shadowBlur = 0;
            const labelW = 150;
            const labelH = 42;
            const labelX = canvas.width - labelW - 45;
            const labelY = canvas.height - labelH - 40;
            
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(labelX, labelY, labelW, labelH);
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `500 24px ${FONT_STACK}`;
            ctx.fillText(langLabel, labelX + labelW/2, labelY + labelH/2);
            ctx.textBaseline = 'alphabetic';

    } 
    else if (styleIndex === 4) {
        // Typography
        ctx.fillStyle = '#111';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        if (bgImg.complete && bgImg.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            drawBgCover();
            ctx.restore();
        }
        ctx.textAlign = 'center';
        
        let baseTitleFontSize = 180;
        const titleLen = title.length;
        if (titleLen > 30) baseTitleFontSize = 80;
        else if (titleLen > 20) baseTitleFontSize = 100;
        else if (titleLen > 12) baseTitleFontSize = 140;
        const titleFontSize = baseTitleFontSize * titleScale;

        ctx.font = `900 ${titleFontSize}px ${FONT_STACK}`;
        const lineHeight = titleFontSize * 1.1;
        const lines = wrapText(ctx, title, canvas.width * 0.85);
        const totalTitleHeight = lines.length * lineHeight;
        const startY = (canvas.height - (totalTitleHeight + 160)) / 2 + (lineHeight * 0.7); 
        ctx.fillStyle = '#fff';
        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width/2, startY + (i * lineHeight));
        });
        
        ctx.font = `400 ${40 * artistScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '10px';
        ctx.fillStyle = project.theme.secondaryColor;
        ctx.fillText(artist, canvas.width/2, startY + (lines.length * lineHeight) + 40);

        // Modified: Add Album
        ctx.font = `400 ${30 * albumScale}px ${FONT_STACK}`;
        ctx.letterSpacing = '5px';
        ctx.fillStyle = '#aaa';
        ctx.fillText(albumName, canvas.width/2, startY + (lines.length * lineHeight) + 90);

    } else if (styleIndex === 5) {
        // Playlist
        drawBgCover();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        const contentX = 150;
        const coverSize = 400;
        const coverY = (canvas.height - coverSize) / 2;
        if (coverImg.complete && coverImg.naturalWidth > 0) {
            ctx.drawImage(coverImg, contentX, coverY, coverSize, coverSize);
        }
        const textX = contentX + coverSize + 80;
        const textY = coverY + 80;
        ctx.textAlign = 'left';
        const maxTextW = canvas.width - textX - 60; // Padding

        // Artist (Wrap)
        const artistFontSize = 40 * artistScale;
        ctx.font = `600 ${artistFontSize}px ${FONT_STACK}`;
        ctx.fillStyle = project.theme.secondaryColor;
        
        let currentY = textY;
        const artistLines = wrapText(ctx, artist, maxTextW);
        artistLines.forEach(l => {
             ctx.fillText(l, textX, currentY);
             currentY += artistFontSize * 1.2;
        });
        
        // Title (Wrap - existed but width was hardcoded 500)
        let baseFontSize = 90;
        if (title.length > 20) baseFontSize = 60;
        const fontSize = baseFontSize * titleScale;

        currentY += 20; // gap

        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillStyle = '#fff';
        const lines = wrapText(ctx, title, maxTextW); // Use dynamic width
        lines.forEach((line, i) => {
            ctx.fillText(line, textX, currentY);
            currentY += fontSize * 1.2;
        });

        // Album (Wrap)
        currentY += 30; // gap
        const albumFontSize = 30 * albumScale;
        ctx.font = `400 ${albumFontSize}px ${FONT_STACK}`;
        ctx.fillStyle = '#ccc';
        const albumLines = wrapText(ctx, albumName, maxTextW);
        albumLines.forEach(l => {
             ctx.fillText(l, textX, currentY);
             currentY += albumFontSize * 1.2;
        });

    } else if (styleIndex === 6) {
            // Split Tone
            drawBgCover();
            ctx.fillStyle = project.theme.secondaryColor;
            ctx.globalCompositeOperation = 'color'; 
            ctx.fillRect(0,0, canvas.width/2, canvas.height);
            ctx.fillStyle = '#111';
            ctx.fillRect(canvas.width/2, 0, canvas.width/2, canvas.height);
            ctx.globalCompositeOperation = 'source-over'; 
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0,0, canvas.width, canvas.height);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width/2, 100);
            ctx.lineTo(canvas.width/2, canvas.height - 100);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            
            let baseFontSize = 80;
            if (title.length > 20) baseFontSize = 50;
            const fontSize = baseFontSize * titleScale;

            ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
            const lines = wrapText(ctx, title, canvas.width * 0.4);
            const startY = canvas.height/2 - ((lines.length - 1) * fontSize * 0.5);
            lines.forEach((line, i) => {
                ctx.fillText(line, canvas.width/2 - 40, startY + (i * fontSize * 1.1));
            });
            ctx.textAlign = 'left';
            
            ctx.font = `400 ${40 * artistScale}px ${FONT_STACK}`;
            ctx.fillStyle = '#eee';
            ctx.fillText(artist, canvas.width/2 + 40, canvas.height/2 - 20);
            
            // Modified: Add Album
            ctx.font = `400 ${30 * albumScale}px ${FONT_STACK}`;
            ctx.fillStyle = '#ccc';
            ctx.fillText(albumName, canvas.width/2 + 40, canvas.height/2 + 30);
    } 

    // --- DRAW WATERMARK ---
    if (watermark && watermark.text) {
        ctx.save();
        ctx.globalAlpha = watermark.opacity || 0.6;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        const wmSize = 30 * (watermark.scale || 1.0);
        ctx.font = `600 ${wmSize}px ${FONT_STACK}`;
        ctx.fillStyle = '#ffffff';
        
        // If x is > 0.5 assume right align, else left
        if (watermark.x > 0.5) ctx.textAlign = 'right';
        else if (watermark.x < 0.5) ctx.textAlign = 'left';
        else ctx.textAlign = 'center';
        
        ctx.fillText(watermark.text, canvas.width * watermark.x, canvas.height * watermark.y);
        ctx.restore();
    }

  }, [styleIndex, project, imagesLoaded]);

  // Execute draw on effect
  useEffect(() => {
    draw();
  }, [draw]);

  const download = () => {
    const link = document.createElement('a');
    link.download = buildMediaOutputFileName(project.metadata.artist, project.metadata.title, 'png');
    link.href = canvasRef.current!.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-neutral-900 via-neutral-900 to-black overflow-hidden">
        {/* Sidebar */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-neutral-800/50 p-3 sm:p-4 md:p-6 flex flex-col gap-3 sm:gap-4 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-y-auto z-20 shadow-2xl custom-scrollbar max-h-[45vh] lg:max-h-none">
             <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-400 font-serif-tc flex items-center gap-2">
                 <Layout size={18} className="sm:w-5 sm:h-5 md:w-[22px] md:h-[22px]"/> 
                 <span>縮圖工坊</span>
             </h2>
             
             <div className="p-2.5 sm:p-3 bg-gradient-to-br from-neutral-800/60 to-neutral-800/40 rounded-xl text-[10px] sm:text-xs text-neutral-400 border border-neutral-700/50">
                 <span className="text-neutral-500">當前語言：</span>
                 <span className="text-amber-400 font-bold ml-1">{project.metadata.language || 'KR'}</span>
             </div>

             {/* Style Selection */}
             <div className="space-y-2">
                 <h3 className="text-[10px] sm:text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-2 sm:mb-3">風格模板</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[250px] sm:max-h-[300px] lg:max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                     {styles.map((s) => (
                         <button 
                            key={s.id}
                            onClick={() => setStyleIndex(s.id)}
                            className={`p-2.5 sm:p-3 rounded-xl border text-left flex items-center gap-2 sm:gap-3 transition-all ${
                                styleIndex === s.id 
                                    ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-amber-500/50 text-white shadow-lg shadow-amber-900/20' 
                                    : 'bg-neutral-900/50 border-neutral-800/70 text-neutral-400 hover:bg-neutral-800/70 hover:border-neutral-700'
                            }`}
                        >
                            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                                styleIndex === s.id ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-500'
                            }`}>
                                {s.id + 1}
                            </span>
                            <span className="font-medium text-[10px] sm:text-xs flex-1">{s.name}</span>
                         </button>
                     ))}
                 </div>
             </div>

             {/* Customization Controls */}
             <div className="border-t border-neutral-800/50 pt-3 sm:pt-4 mt-2">
                 <h3 className="text-[10px] sm:text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
                    <Type size={12} className="sm:w-[14px] sm:h-[14px]"/> 文字大小
                 </h3>
                 
                 <div className="space-y-2.5 sm:space-y-3">
                     {[
                         { label: '標題', type: 'title' },
                         { label: '歌手', type: 'artist' },
                         { label: '專輯', type: 'album' }
                     ].map((item) => {
                         const scaleKey = item.type as 'title' | 'artist' | 'album';
                         const val = project.theme.layout[scaleKey].scale || 1.0;
                         
                         return (
                            <div key={item.type} className="bg-neutral-900/50 rounded-lg p-2.5 sm:p-3 border border-neutral-800/50">
                                <div className="flex justify-between text-[10px] sm:text-xs text-neutral-400 mb-2">
                                    <span className="font-medium">{item.label}</span>
                                    <span className="text-amber-400 font-bold">{Math.round(val * 100)}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => updateScale(scaleKey, -0.1)} 
                                        className="p-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700/50 transition-all active:scale-95"
                                    >
                                        <Minus size={14} className="text-neutral-400"/>
                                    </button>
                                    <input 
                                        type="range" min="0.1" max="4.0" step="0.1"
                                        value={val}
                                        onChange={(e) => {
                                             if(onUpdate) {
                                                const newVal = parseFloat(e.target.value);
                                                const newLayout = { ...project.theme.layout };
                                                newLayout[scaleKey] = { ...newLayout[scaleKey], scale: newVal };
                                                onUpdate({theme: {...project.theme, layout: newLayout}});
                                             }
                                        }}
                                        className="flex-1 accent-amber-500 h-2 bg-neutral-800 rounded-full cursor-pointer"
                                    />
                                    <button 
                                        onClick={() => updateScale(scaleKey, 0.1)} 
                                        className="p-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700/50 transition-all active:scale-95"
                                    >
                                        <Plus size={14} className="text-neutral-400"/>
                                    </button>
                                </div>
                            </div>
                         );
                     })}
                 </div>
             </div>
             
             {/* Watermark Section */}
             <div className="border-t border-neutral-800/50 pt-4">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
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

            {/* Background Effects */}
             <div className="border-t border-neutral-800/50 pt-4">
                 <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Aperture size={14}/> 背景特效
                 </h3>
                 
                 <div className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800/50">
                    <div className="flex justify-between text-xs text-neutral-400 mb-2">
                        <span className="font-medium">背景模糊</span>
                        <span className="text-amber-400 font-bold">{project.theme.effects?.blurBackground || 0}px</span>
                    </div>
                    <input 
                        type="range" min="0" max="60" step="1"
                        value={project.theme.effects?.blurBackground || 0}
                        onChange={(e) => {
                            if(onUpdate) {
                                const newEffects = { ...project.theme.effects, blurBackground: parseFloat(e.target.value) };
                                onUpdate({theme: {...project.theme, effects: newEffects}});
                            }
                        }}
                        className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full cursor-pointer"
                    />
                </div>
             </div>

             <button 
                onClick={download} 
                className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 p-3 sm:p-4 rounded-xl hover:from-green-500 hover:to-emerald-500 font-bold flex justify-center gap-2 items-center text-white transition-all shadow-lg shadow-green-900/30 hover:shadow-green-900/50 active:scale-[0.98] font-serif-tc"
             >
                 <Download size={20}/> 
                 <span>下載縮圖</span>
            </button>
        </div>

        {/* Canvas Preview */}
        <div className="flex-1 flex items-center justify-center bg-black p-4 sm:p-6 md:p-10 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-black pointer-events-none"/>
            <canvas 
                ref={canvasRef} 
                width={1280} 
                height={720} 
                className="max-w-full max-h-full object-contain shadow-2xl border border-neutral-800/70 relative z-10 rounded-lg"
            />
        </div>
    </div>
  );
};

export default ThumbnailMaker;
