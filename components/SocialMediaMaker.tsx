
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProjectData } from '../types';
import { Share2, Type, AtSign, Download, Copy, Loader2, Wand2, Stamp, MoveHorizontal, MoveVertical, Disc, PlayCircle, AlignCenter, Info, LayoutTemplate, Palette, Sliders, Minus, Plus } from 'lucide-react';
import { generateSocialPosts } from '../services/geminiService';
import { wrapText, drawRoundedRect } from '../utils/canvasUtils';
import { FONT_STACK } from '../utils/layoutPresets';
import { buildMediaOutputFileName } from '../utils/outputFilename';

interface Props {
    project: ProjectData;
    onUpdate: (data: Partial<ProjectData>) => void;
}

type SocialTab = 'POST' | 'STORY' | 'CAPTION';
type AspectRatio = '1:1' | '4:5' | '9:16';
type TemplateType = 'JACKET' | 'PLAYER' | 'LYRIC' | 'INFO';

const TEMPLATES: { id: TemplateType; label: string; icon: React.ReactNode }[] = [
    { id: 'JACKET', label: '封面宣傳 (Jacket)', icon: <Disc size={14}/> },
    { id: 'PLAYER', label: '播放介面 (Player)', icon: <PlayCircle size={14}/> },
    { id: 'LYRIC', label: '歌詞語錄 (Lyric)', icon: <AlignCenter size={14}/> },
    { id: 'INFO', label: '資訊導流 (Info)', icon: <Info size={14}/> },
];

const SocialMediaMaker: React.FC<Props> = ({ project, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<SocialTab>('POST');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [activeTemplate, setActiveTemplate] = useState<TemplateType>('JACKET');
    const [selectedLyricIndex, setSelectedLyricIndex] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Caption State
    const [threadsContent, setThreadsContent] = useState("");
    const [threadsTags, setThreadsTags] = useState<string[]>([]);
    
    // Customization State (Local Overrides)
    const [customBlur, setCustomBlur] = useState<number>(project.theme.effects?.blurBackground || 0);
    const [customColor, setCustomColor] = useState<string>(project.theme.secondaryColor);
    const [handleText, setHandleText] = useState<string>("@ChangeEnt.official");

    // Individual Font Scales
    const [titleScale, setTitleScale] = useState<number>(1.0);
    const [artistScale, setArtistScale] = useState<number>(1.0);
    const [albumScale, setAlbumScale] = useState<number>(1.0);
    const [contentScale, setContentScale] = useState<number>(1.0); // Master scale for graphics

    // Initialize local state when project changes
    useEffect(() => {
        setCustomColor(project.theme.secondaryColor);
    }, [project.theme.secondaryColor]);

    // Canvas Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const [coverImage, setCoverImage] = useState<HTMLImageElement | null>(null);

    // Load background image
    useEffect(() => {
        if (project.theme.bgImageUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = project.theme.bgImageUrl;
            img.onload = () => setBgImage(img);
        }
    }, [project.theme.bgImageUrl]);

    // Load cover image
    useEffect(() => {
        if (project.metadata.coverUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = project.metadata.coverUrl;
            img.onload = () => setCoverImage(img);
        }
    }, [project.metadata.coverUrl]);

    // Helper: Update Watermark
    const watermark = project.theme.watermark || {
        text: '',
        x: 0.95,
        y: 0.05,
        scale: 1.0,
        opacity: 0.6,
        fontFamily: FONT_STACK
    };
  
    const updateWatermark = (updates: Partial<typeof watermark>) => {
        onUpdate({
            theme: {
                ...project.theme,
                watermark: { ...watermark, ...updates }
            }
        });
    };

    // --- DRAWING HELPERS ---

    const drawNoise = (ctx: CanvasRenderingContext2D, width: number, height: number, opacity: number = 0.05) => {
        const w = width;
        const h = height;
        const idata = ctx.createImageData(w, h);
        const buffer32 = new Uint32Array(idata.data.buffer);
        const len = buffer32.length;
        
        for (let i = 0; i < len; i++) {
            if (Math.random() < 0.5) {
                buffer32[i] = 0xffffffff; // White
            }
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.putImageData(idata, 0, 0);
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = 'overlay';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        }
    };

    const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0,0,width,height);

        if (bgImage) {
            const ratio = Math.max(width / bgImage.width, height / bgImage.height);
            const drawW = bgImage.width * ratio;
            const drawH = bgImage.height * ratio;
            const drawX = (width - drawW) / 2;
            const drawY = (height - drawH) / 2;
            
            const blurAmount = activeTemplate === 'PLAYER' ? Math.max(60, customBlur + 20) : customBlur;
            
            ctx.save();
            if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px) brightness(0.7) saturate(1.2)`;
            ctx.drawImage(bgImage, drawX, drawY, drawW, drawH);
            ctx.restore();
        } else {
             const grad = ctx.createRadialGradient(width*0.2, height*0.2, 0, width*0.8, height*0.8, width);
             grad.addColorStop(0, '#2d1b4e');
             grad.addColorStop(1, '#000000');
             ctx.fillStyle = grad;
             ctx.fillRect(0,0,width,height);
        }
        
        const overlay = activeTemplate === 'PLAYER' ? 0.5 : (project.theme.overlayOpacity || 0.3);
        ctx.fillStyle = `rgba(0,0,0,${overlay})`;
        ctx.fillRect(0,0,width,height);

        drawNoise(ctx, width, height, 0.08);
    };

    const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        if (watermark && watermark.text) {
            ctx.save();
            ctx.globalAlpha = watermark.opacity || 0.6;
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            const wmSize = 30 * (watermark.scale || 1.0);
            ctx.font = `600 ${wmSize}px ${FONT_STACK}`;
            ctx.fillStyle = '#ffffff';
            
            if (watermark.x > 0.5) ctx.textAlign = 'right';
            else if (watermark.x < 0.5) ctx.textAlign = 'left';
            else ctx.textAlign = 'center';
            
            ctx.fillText(watermark.text, width * watermark.x, height * watermark.y);
            ctx.restore();
        }
    };

    // --- TEMPLATE DRAWING FUNCTIONS ---

    const drawJacket = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        // CENTER ALIGNMENT LOGIC
        const cx = width / 2;
        // Moved higher to allow more space for text below
        const artCenterY = height * 0.35; 

        // 1. CD / Jewel Case Logic
        const minDim = Math.min(width, height);
        const coverSize = minDim * 0.5 * contentScale; 
        const discRadius = (coverSize * 0.98) / 2;
        const shiftAmount = coverSize * 0.45;
        
        const groupCenterX = cx;
        const coverCenterX = groupCenterX - (shiftAmount / 2);
        const discCenterX = groupCenterX + (shiftAmount / 2);
        
        const coverX = coverCenterX - (coverSize/2);
        const coverY = artCenterY - (coverSize/2);

        // Draw CD (Back layer)
        ctx.save();
        ctx.translate(discCenterX, artCenterY);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 10;

        const cdGrad = ctx.createConicGradient(Math.PI / 4, 0, 0);
        cdGrad.addColorStop(0, '#111');
        cdGrad.addColorStop(0.2, '#333');
        cdGrad.addColorStop(0.4, '#111');
        cdGrad.addColorStop(0.5, '#666'); 
        cdGrad.addColorStop(0.6, '#111');
        cdGrad.addColorStop(0.8, '#222');
        cdGrad.addColorStop(1, '#111');
        
        ctx.fillStyle = cdGrad;
        ctx.beginPath();
        ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for(let r = discRadius*0.4; r < discRadius*0.95; r+=4) {
             ctx.beginPath();
             ctx.arc(0, 0, r, 0, Math.PI * 2);
             ctx.stroke();
        }
        
        ctx.fillStyle = '#0f0f11';
        ctx.beginPath();
        ctx.arc(0, 0, discRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        
        if (coverImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0,0, discRadius*0.35, 0, Math.PI*2);
            ctx.clip();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(coverImage, -discRadius*0.35, -discRadius*0.35, discRadius*0.7, discRadius*0.7);
            ctx.restore();
        }

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, discRadius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw Cover (Front Layer)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 50;
        ctx.shadowOffsetX = -10;
        
        if (coverImage) {
            drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 4);
            ctx.clip();
            ctx.drawImage(coverImage, coverX, coverY, coverSize, coverSize);
            
            const shine = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
            shine.addColorStop(0, 'rgba(255,255,255,0.2)');
            shine.addColorStop(0.4, 'rgba(255,255,255,0.0)');
            shine.addColorStop(0.6, 'rgba(255,255,255,0.0)');
            shine.addColorStop(1, 'rgba(255,255,255,0.1)');
            ctx.fillStyle = shine;
            ctx.fillRect(coverX, coverY, coverSize, coverSize);
            
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(coverX, coverY, coverSize, coverSize);
        } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(coverX, coverY, coverSize, coverSize);
        }
        ctx.restore();

        // 3. Typographic Layout (CENTERED)
        // Start below the artwork
        let cursorY = coverY + coverSize + (height * 0.08);
        
        ctx.textAlign = 'center'; // FORCE CENTER
        const textX = width / 2;  
        
        // Badge (New Release)
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `600 24px ${FONT_STACK}`; 
        ctx.letterSpacing = '1px';
        ctx.fillText("OUT NOW", textX, cursorY);
        
        // ** SPACE INCREASED HERE (140 -> 180) **
        cursorY += 180 * contentScale;

        // Title
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 0;
        
        const title = project.metadata.title;
        let fontSize = 90 * contentScale * titleScale; // Apply Title Scale
        
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        const maxWidth = width * 0.8;

        const titleLines = wrapText(ctx, title, maxWidth);
        titleLines.forEach(line => {
             ctx.fillText(line, textX, cursorY);
             cursorY += fontSize * 1.1;
        });
        
        cursorY += 20;

        // Artist
        ctx.fillStyle = customColor;
        const artistSize = 40 * contentScale * artistScale; // Apply Artist Scale
        ctx.font = `500 ${artistSize}px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText(project.metadata.artist, textX, cursorY);
        
        cursorY += 45;

        // Album Name (Jacket: YES)
        if (project.metadata.album) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            const alSize = 28 * contentScale * albumScale; // Apply Album Scale
            ctx.font = `400 ${alSize}px ${FONT_STACK}`;
            ctx.letterSpacing = '1px';
            ctx.fillText(project.metadata.album, textX, cursorY);
        }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const cx = width / 2;
        const cy = height / 2;
        
        const cardW = width * 0.9;
        const cardH = height * 0.85;
        const cardX = (width - cardW) / 2;
        const cardY = (height - cardH) / 2;
        
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 60;
        ctx.shadowOffsetY = 30;
        
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 40);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // 1. Cover Art
        const coverSize = cardW * 0.8 * contentScale;
        const maxCoverH = cardH * 0.55;
        const finalCoverSize = Math.min(coverSize, maxCoverH);
        
        const coverX = (width - finalCoverSize) / 2;
        const coverY = cardY + (cardW * 0.1);

        ctx.save();
        ctx.shadowColor = customColor;
        ctx.shadowBlur = 60 * contentScale;
        ctx.shadowOffsetY = 20;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000';
        drawRoundedRect(ctx, coverX + 20, coverY + 20, finalCoverSize - 40, finalCoverSize - 40, 20);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        
        ctx.shadowBlur = 0;
        if (coverImage) {
            drawRoundedRect(ctx, coverX, coverY, finalCoverSize, finalCoverSize, 20);
            ctx.clip();
            ctx.drawImage(coverImage, coverX, coverY, finalCoverSize, finalCoverSize);
        } else {
            ctx.fillStyle = '#222';
            drawRoundedRect(ctx, coverX, coverY, finalCoverSize, finalCoverSize, 20);
            ctx.fill();
        }
        ctx.restore();

        // 2. Info Stack (CENTERED)
        let cursorY = coverY + finalCoverSize + 60;
        const textMaxW = cardW * 0.8;
        const textCenterX = cardX + (cardW / 2); // Center of card
        
        ctx.textAlign = 'center'; // FORCE CENTER
        
        // Title
        ctx.fillStyle = '#ffffff';
        const titleSize = 64 * contentScale * titleScale; // Apply Title Scale
        ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
        const titleText = project.metadata.title;
        const titleLines = wrapText(ctx, titleText, textMaxW);
        titleLines.forEach(l => {
             ctx.fillText(l, textCenterX, cursorY);
             cursorY += titleSize * 1.2;
        });
        
        cursorY += 10;

        // Artist
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        const artistSize = 32 * contentScale * artistScale; // Apply Artist Scale
        ctx.font = `500 ${artistSize}px ${FONT_STACK}`;
        ctx.fillText(project.metadata.artist, textCenterX, cursorY);
        
        // Album (Player: YES)
        if (project.metadata.album) {
            cursorY += 35;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            const alSize = 24 * contentScale * albumScale; // Apply Album Scale
            ctx.font = `400 ${alSize}px ${FONT_STACK}`;
            ctx.fillText(project.metadata.album, textCenterX, cursorY);
            cursorY += 25; 
        } else {
            cursorY += 60;
        }

        // 3. Progress Bar
        const barW = textMaxW;
        const barX = textCenterX - (barW / 2); // Start left relative to center
        
        // Track Line
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        drawRoundedRect(ctx, barX, cursorY, barW, 6, 3);
        ctx.fill();
        
        // Active Line
        const progress = 0.35;
        const activeW = barW * progress;
        
        const barGrad = ctx.createLinearGradient(barX, 0, barX + activeW, 0);
        barGrad.addColorStop(0, customColor);
        barGrad.addColorStop(1, '#fff');
        
        ctx.fillStyle = barGrad;
        drawRoundedRect(ctx, barX, cursorY, activeW, 6, 3);
        ctx.fill();
        
        // Thumb
        ctx.shadowColor = customColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(barX + activeW, cursorY + 3, 10 * contentScale, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Times
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `500 24px ${FONT_STACK}`;
        ctx.textAlign = 'left';
        ctx.fillText("1:14", barX, cursorY + 40);
        ctx.textAlign = 'right';
        ctx.fillText("3:42", barX + barW, cursorY + 40);
        
        cursorY += 70;

        // 4. Playback Controls
        const ctrlCenterY = cursorY + 40;
        const ctrlCenterX = cx;
        
        const btnRadius = 50 * contentScale;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ctrlCenterX, ctrlCenterY, btnRadius, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        const triSize = btnRadius * 0.4;
        ctx.beginPath();
        ctx.moveTo(ctrlCenterX - (triSize/1.5) + 4, ctrlCenterY - triSize);
        ctx.lineTo(ctrlCenterX + triSize + 4, ctrlCenterY);
        ctx.lineTo(ctrlCenterX - (triSize/1.5) + 4, ctrlCenterY + triSize);
        ctx.fill();
        
        const iconOffset = 120 * contentScale;
        ctx.fillStyle = '#fff';
        
        const drawSkip = (x: number, scale: number) => {
             ctx.save();
             ctx.translate(x, ctrlCenterY);
             ctx.scale(scale, scale);
             
             ctx.beginPath();
             ctx.moveTo(0, -20);
             ctx.lineTo(25, 0);
             ctx.lineTo(0, 20);
             ctx.fill();
             ctx.fillRect(25, -20, 6, 40);
             ctx.restore();
        }
        
        drawSkip(ctrlCenterX + iconOffset, 1); // Next
        drawSkip(ctrlCenterX - iconOffset, -1); // Prev
    };

    const drawLyric = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const cx = width / 2;
        // Pushed down to avoid overlap with edge
        const headerY = height * 0.15; 
        
        ctx.textAlign = 'center'; // FORCE CENTER
        
        // Artist Pill
        ctx.font = `600 ${28 * artistScale}px ${FONT_STACK}`; // Artist Scale
        const artistText = project.metadata.artist;
        const pillW = ctx.measureText(artistText).width + 40;
        
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        drawRoundedRect(ctx, cx - pillW/2, headerY - 30, pillW, 44, 22);
        ctx.fill();
        
        ctx.fillStyle = customColor;
        ctx.fillText(artistText, cx, headerY + 2);
        
        const titleY = headerY + 80 * contentScale;
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${48 * titleScale}px ${FONT_STACK}`; // Title Scale
        ctx.fillText(project.metadata.title, cx, titleY);
        
        // Album Name (Lyric: YES)
        if (project.metadata.album) {
            const albumY = titleY + 40;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `400 ${24 * albumScale}px ${FONT_STACK}`; // Album Scale
            ctx.letterSpacing = '2px';
            ctx.fillText(project.metadata.album, cx, albumY);
        }
        
        const footerY = height * 0.85;
        const availableH = footerY - titleY;
        
        // Push lyric block down significantly
        const centerY = titleY + (availableH / 2) + (height * 0.05); 
        
        if (project.lyrics && project.lyrics.length > 0) {
            const line = project.lyrics[selectedLyricIndex];
            if (line) {
                const maxW = width * 0.8;
                const scale = contentScale;
                
                ctx.font = `500 ${80 * scale}px ${FONT_STACK}`;
                const orgLines = wrapText(ctx, line.original, maxW);
                
                ctx.font = `300 ${46 * scale}px ${FONT_STACK}`;
                const transLines = wrapText(ctx, line.translation, maxW);
                
                const gap = 50 * scale;
                const totalH = (orgLines.length * 90 * scale) + gap + (transLines.length * 60 * scale);
                
                let cursorY = centerY - (totalH / 2);
                
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.font = `700 ${200 * scale}px serif`;
                ctx.fillText("“", cx, cursorY - 20);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = `500 ${80 * scale}px ${FONT_STACK}`;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 30;
                
                orgLines.forEach(l => {
                    ctx.fillText(l, cx, cursorY + 30);
                    cursorY += 90 * scale;
                });
                
                cursorY += gap;
                
                ctx.fillStyle = customColor;
                ctx.font = `300 ${46 * scale}px ${FONT_STACK}`;
                ctx.shadowBlur = 0;
                
                transLines.forEach(l => {
                    ctx.fillText(l, cx, cursorY);
                    cursorY += 60 * scale;
                });
            }
        }
        
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 24px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText("LINK IN BIO", cx, height - 60);
    };

    const drawInfo = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const cx = width / 2;
        const cy = height / 2;
        const scale = contentScale; 

        ctx.textAlign = 'center'; // FORCE CENTER
        
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${100 * scale * titleScale}px ${FONT_STACK}`; // Use Title Scale for main text
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 40;
        
        const line1 = "新片發布";
        
        ctx.fillText(line1, cx, cy - (80 * scale));
        
        ctx.fillStyle = '#ccc';
        ctx.font = `400 ${40 * scale}px ${FONT_STACK}`;
        ctx.letterSpacing = '4px';
        ctx.fillText("NOW AVAILABLE", cx, cy + (20 * scale));
        
        // --- REMOVED ALBUM NAME AS REQUESTED (INFO Mode specific) ---

        // Button Size Logic (Dynamic)
        const btnText = "Watch Video";
        ctx.font = `700 ${36 * scale}px "Noto Sans TC", sans-serif`;
        const textMetrics = ctx.measureText(btnText);
        const textWidth = textMetrics.width;
        const iconWidth = 30 * scale; 
        const gap = 20 * scale;
        const totalContentWidth = iconWidth + gap + textWidth;
        const btnPadding = 80 * scale;

        const btnW = Math.max(420 * scale, totalContentWidth + btnPadding);
        const btnH = 110 * scale;
        const btnX = cx - btnW/2;
        const btnY = cy + (110 * scale); 
        
        ctx.save();
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 80;
        ctx.fillStyle = '#FF0000';
        drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 55 * scale);
        ctx.fill();
        ctx.restore();
        
        // Draw Button Content
        const startX = cx - (totalContentWidth / 2);
        const iconCenterY = btnY + btnH/2;
        
        // Draw Icon
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        // Play triangle
        ctx.moveTo(startX, iconCenterY - 15 * scale);
        ctx.lineTo(startX + iconWidth, iconCenterY);
        ctx.lineTo(startX, iconCenterY + 15 * scale);
        ctx.fill();
        
        // Draw Text
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent'; // Remove shadow for clean text inside button
        ctx.fillText(btnText, startX + iconWidth + gap, iconCenterY + 2 * scale);
        ctx.textBaseline = 'alphabetic'; // Reset
        
        // --- FOOTER ---
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(cx - 100, height - 120);
        ctx.lineTo(cx + 100, height - 120);
        ctx.stroke();
        
        ctx.fillStyle = customColor;
        ctx.font = `600 ${32 * scale}px ${FONT_STACK}`;
        ctx.letterSpacing = '2px';
        ctx.fillText(handleText || "@ChangeEnt.official", cx, height - 70);
    };

    // --- MAIN DRAW ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        drawBackground(ctx, width, height);
        
        switch (activeTemplate) {
            case 'JACKET':
                drawJacket(ctx, width, height);
                break;
            case 'PLAYER':
                drawPlayer(ctx, width, height);
                break;
            case 'LYRIC':
                drawLyric(ctx, width, height);
                break;
            case 'INFO':
                drawInfo(ctx, width, height);
                break;
        }
        
        if (activeTemplate !== 'INFO') {
            drawWatermark(ctx, width, height);
        }

    }, [bgImage, coverImage, activeTemplate, project.theme, project.metadata, project.lyrics, selectedLyricIndex, watermark, aspectRatio, customBlur, contentScale, customColor, handleText, titleScale, artistScale, albumScale]);

    useEffect(() => {
        if (activeTab === 'POST' || activeTab === 'STORY') {
            const t = setTimeout(() => draw(), 100);
            return () => clearTimeout(t);
        }
    }, [draw, activeTab]);

    const handleGenerateCaption = async () => {
        setIsGenerating(true);
        try {
            const snippet = project.lyrics.slice(0, 5).map(l => l.original + " " + l.translation).join("\n");
            const result = await generateSocialPosts(project.metadata.title, project.metadata.artist, snippet);
            setThreadsContent(result.content);
            setThreadsTags(result.tags);
        } catch(e) {
            console.error(e);
            alert("生成失敗");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadImage = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = buildMediaOutputFileName(project.metadata.artist, project.metadata.title, 'png');
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    const copyCaption = () => {
        const fullText = `${threadsContent}\n\n${threadsTags.join(' ')}`;
        navigator.clipboard.writeText(fullText);
        alert("已複製到剪貼簿");
    };

    // Helper for rendering Font Size Slider
    const FontScaleControl = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
        <div className="mb-2">
            <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                <span>{label}</span>
                <span>{Math.round(value * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => onChange(value - 0.1)} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700">
                    <Minus size={12} className="text-neutral-400"/>
                </button>
                <input 
                    type="range" min="0.5" max="2.0" step="0.1" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className="flex-1 accent-pink-500 h-1 bg-neutral-800 rounded cursor-pointer"
                />
                <button onClick={() => onChange(value + 0.1)} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700">
                    <Plus size={12} className="text-neutral-400"/>
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-neutral-900 via-neutral-900 to-black text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-full lg:w-80 bg-gradient-to-b from-neutral-950 to-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-800/50 flex flex-col z-20 shadow-2xl p-4 sm:p-6 overflow-y-auto custom-scrollbar max-h-[45vh] lg:max-h-none">
                 <h2 className="text-xl sm:text-2xl font-bold font-serif-tc mb-6 flex items-center gap-2 text-amber-400">
                     <Share2 className="text-amber-500" size={22}/> 
                     <span>社群行銷</span>
                 </h2>
                 
                 {/* Tabs */}
                 <div className="flex bg-neutral-900/50 p-1 rounded-xl mb-6 border border-neutral-800/50">
                     {(['POST', 'STORY', 'CAPTION'] as SocialTab[]).map(t => (
                         <button 
                            key={t}
                            onClick={() => {
                                setActiveTab(t);
                                if (t === 'POST') setAspectRatio('1:1');
                                if (t === 'STORY') setAspectRatio('9:16');
                            }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                                activeTab === t 
                                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/30' 
                                    : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'
                            }`}
                         >
                             {t === 'POST' ? '貼文' : t === 'STORY' ? '限動' : '文案'}
                         </button>
                     ))}
                 </div>

                 {/* Controls based on Tab */}
                 {activeTab === 'CAPTION' ? (
                     <div className="space-y-4">
                         <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-xl p-4">
                             <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AtSign size={14}/> AI 文案生成
                             </h3>
                             <p className="text-xs text-neutral-400 mb-4 leading-relaxed">AI 將根據歌詞意境與網路搜尋的歌曲背景，生成一篇感性的推廣文案</p>
                             
                             <button 
                                onClick={handleGenerateCaption}
                                disabled={isGenerating}
                                className="w-full py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-4 transition-all shadow-lg shadow-amber-900/30 active:scale-[0.98] disabled:opacity-50 font-serif-tc"
                             >
                                 {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                                 <span>生成文案</span>
                             </button>
                             
                             {threadsContent && (
                                 <div className="space-y-2">
                                     <textarea 
                                        className="w-full h-64 bg-neutral-950/80 border border-neutral-700/70 rounded-xl p-3 text-sm text-neutral-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all custom-scrollbar"
                                        value={threadsContent + "\n\n" + threadsTags.join(" ")}
                                        onChange={(e) => setThreadsContent(e.target.value)}
                                     />
                                     <button 
                                        onClick={copyCaption} 
                                        className="w-full py-2.5 border border-neutral-700/50 rounded-xl hover:bg-neutral-800/70 text-xs text-neutral-300 flex items-center justify-center gap-2 transition-all active:scale-95"
                                     >
                                         <Copy size={14}/> 複製內容
                                     </button>
                                 </div>
                             )}
                         </div>
                     </div>
                 ) : (
                     <div className="space-y-6">
                         {/* Template Selection */}
                         <div>
                             <div className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                                 <LayoutTemplate size={14}/> 視覺模板
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                                 {TEMPLATES.map(t => (
                                     <button 
                                        key={t.id}
                                        onClick={() => setActiveTemplate(t.id)}
                                        className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                                            activeTemplate === t.id 
                                                ? 'bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-900/20' 
                                                : 'bg-neutral-900/50 border-neutral-800/50 text-neutral-400 hover:bg-neutral-800/50 hover:border-neutral-700'
                                        }`}
                                     >
                                         {t.icon}
                                         <span className="text-[10px] font-bold">{t.label.split('(')[1].replace(')', '')}</span>
                                     </button>
                                 ))}
                             </div>
                         </div>

                         {/* Aspect Ratio */}
                         <div>
                             <div className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3">畫布比例</div>
                             <div className="grid grid-cols-3 gap-2">
                                 <button 
                                    onClick={() => setAspectRatio('1:1')} 
                                    className={`py-2.5 border rounded-xl text-xs font-bold transition-all ${
                                        aspectRatio === '1:1' 
                                            ? 'border-amber-500/50 bg-gradient-to-br from-amber-900/40 to-amber-800/30 text-white' 
                                            : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                                    }`}
                                 >
                                    1:1
                                 </button>
                                 <button 
                                    onClick={() => setAspectRatio('4:5')} 
                                    className={`py-2.5 border rounded-xl text-xs font-bold transition-all ${
                                        aspectRatio === '4:5' 
                                            ? 'border-amber-500/50 bg-gradient-to-br from-amber-900/40 to-amber-800/30 text-white' 
                                            : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                                    }`}
                                 >
                                    4:5
                                 </button>
                                 <button 
                                    onClick={() => setAspectRatio('9:16')} 
                                    className={`py-2.5 border rounded-xl text-xs font-bold transition-all ${
                                        aspectRatio === '9:16' 
                                            ? 'border-amber-500/50 bg-gradient-to-br from-amber-900/40 to-amber-800/30 text-white' 
                                            : 'border-neutral-700/50 text-neutral-400 hover:bg-neutral-800/50'
                                    }`}
                                 >
                                    9:16
                                 </button>
                             </div>
                         </div>

                         {/* Customization Controls */}
                         <div className="border-t border-neutral-800/50 pt-4 space-y-4">
                             <div className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Sliders size={14}/> 客製化
                             </div>
                             
                             {/* Individual Font Scaling */}
                             <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50 space-y-3">
                                <div className="text-[10px] font-bold text-neutral-400 mb-2 uppercase">字體大小</div>
                                <FontScaleControl label="標題" value={titleScale} onChange={setTitleScale} />
                                <FontScaleControl label="歌手" value={artistScale} onChange={setArtistScale} />
                                <FontScaleControl label="專輯" value={albumScale} onChange={setAlbumScale} />
                             </div>

                             {/* Scale Graphics */}
                             <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                                 <div className="flex justify-between text-[10px] text-neutral-500 mb-2">
                                     <span>版面縮放</span>
                                     <span className="text-amber-400 font-bold">{Math.round(contentScale * 100)}%</span>
                                 </div>
                                 <input 
                                    type="range" min="0.5" max="1.5" step="0.05" 
                                    value={contentScale} 
                                    onChange={(e) => setContentScale(Number(e.target.value))} 
                                    className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full"
                                 />
                             </div>

                             {/* Background Blur */}
                             <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                                 <div className="flex justify-between text-[10px] text-neutral-500 mb-2">
                                     <span>背景模糊</span>
                                     <span className="text-amber-400 font-bold">{customBlur}px</span>
                                 </div>
                                 <input 
                                    type="range" min="0" max="60" 
                                    value={customBlur} 
                                    onChange={(e) => setCustomBlur(Number(e.target.value))} 
                                    className="w-full accent-amber-500 h-2 bg-neutral-800 rounded-full"
                                 />
                             </div>
                             
                             {/* Accent Color */}
                             <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/50">
                                 <span className="text-xs text-neutral-400 flex items-center gap-2 font-medium">
                                    <Palette size={14}/> 主題色
                                 </span>
                                 <input 
                                    type="color" 
                                    value={customColor} 
                                    onChange={(e) => setCustomColor(e.target.value)} 
                                    className="bg-transparent border-none w-6 h-6 p-0 cursor-pointer rounded"
                                 />
                             </div>
                             
                             {/* Handle for INFO Mode */}
                             {activeTemplate === 'INFO' && (
                                 <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800/50">
                                     <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase">品牌帳號</div>
                                     <input 
                                        type="text" 
                                        value={handleText} 
                                        onChange={(e) => setHandleText(e.target.value)}
                                        className="w-full bg-neutral-950/80 border border-neutral-700/70 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                     />
                                 </div>
                             )}
                         </div>

                         {/* Contextual Controls based on Template */}
                         {activeTemplate === 'LYRIC' && (
                             <div>
                                 <div className="text-xs font-bold text-neutral-500 mb-2">選擇歌詞片段</div>
                                 <select 
                                    value={selectedLyricIndex}
                                    onChange={(e) => setSelectedLyricIndex(Number(e.target.value))}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs text-white focus:outline-none"
                                 >
                                     {project.lyrics.map((l, i) => (
                                         <option key={i} value={i}>
                                             {i + 1}. {l.original.substring(0, 30)}...
                                         </option>
                                     ))}
                                 </select>
                             </div>
                         )}

                         <button 
                            onClick={handleDownloadImage}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 mt-4 shadow-lg shadow-green-900/50"
                         >
                             <Download size={14}/> 下載圖片
                         </button>
                     </div>
                 )}
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-black p-10 flex items-center justify-center relative">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800/30 to-black pointer-events-none"/>
                 
                 <div 
                    className="relative shadow-2xl transition-all duration-300 ring-1 ring-neutral-800"
                    style={{
                        width: aspectRatio === '1:1' ? '600px' : aspectRatio === '4:5' ? '480px' : '337.5px',
                        height: '600px'
                    }}
                 >
                     <canvas 
                        ref={canvasRef}
                        width={aspectRatio === '1:1' ? 1080 : aspectRatio === '4:5' ? 1080 : 1080}
                        height={aspectRatio === '1:1' ? 1080 : aspectRatio === '4:5' ? 1350 : 1920}
                        className="w-full h-full object-contain bg-neutral-900"
                     />
                 </div>
            </div>
        </div>
    );
};

export default SocialMediaMaker;
