import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { ZoomIn, Sun, Contrast, RotateCcw, Download, Crosshair, ArrowUpDown, Layers } from 'lucide-react';
import { useMaterialRipple } from '@/lib/ripple';
import { DicomMprRendererModal } from '@/components/modals/DicomMprRendererModal';

interface PacsViewerProps {
  mrn: string;
  patientName: string;
  dob: string;
  sex: string;
  imageUrl?: string;
}

type ToolMode = 'pan' | 'zoom' | 'windowLevel' | 'scroll';

export default function PacsViewer({
  mrn,
  patientName,
  dob,
  sex,
  imageUrl = '/pacs_scan_mockup.png'
}: PacsViewerProps) {
  const { triggerRipple } = useMaterialRipple();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Viewport state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [windowCenter, setWindowCenter] = useState(128); // Brightness
  const [windowWidth, setWindowWidth] = useState(256); // Contrast
  const [inverted, setInverted] = useState(false);
  const [sliceIndex, setSliceIndex] = useState(42);
  const [showMprModal, setShowMprModal] = useState(false);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const maxSlices = 120;

  // Interaction state
  const [activeTool, setActiveTool] = useState<ToolMode>('windowLevel');
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      setImageUnavailable(false);
      resetViewport();
    };
    img.onerror = () => {
      imageRef.current = null;
      setImageUnavailable(true);
      resetViewport();
    };
  }, [imageUrl]);

  // Render loop
  useEffect(() => {
    renderCanvas();
  }, [scale, pan, windowCenter, windowWidth, inverted, sliceIndex, imageUnavailable]);

  const resetViewport = () => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const img = imageRef.current;
    
    // Fit to container
    const imageWidth = img?.width || 420;
    const imageHeight = img?.height || 420;
    const scaleX = container.clientWidth / imageWidth;
    const scaleY = container.clientHeight / imageHeight;
    const initialScale = Math.min(scaleX, scaleY) * 0.95;
    
    setScale(initialScale);
    setPan({ 
      x: (container.clientWidth - imageWidth * initialScale) / 2, 
      y: (container.clientHeight - imageHeight * initialScale) / 2 
    });
    setWindowCenter(128);
    setWindowWidth(256);
    setInverted(false);
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    const img = imageRef.current;
    const container = containerRef.current;

    if (!canvas || !ctx || !container) return;

    // Set canvas resolution to match container size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Keep the diagnostic viewport readable when an image has not loaded yet.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transforms
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Draw the loaded scan or a local visual fallback when demo assets are absent.
    if (img) {
      ctx.drawImage(img, 0, 0);
    } else {
      const fallbackSize = 420;
      const sliceOffset = (sliceIndex - 42) * 0.7;
      const brightness = 70 + (windowCenter / 255) * 60;
      const contrast = 55 + (windowWidth / 256) * 75;
      ctx.filter = `${inverted ? "invert(1) " : ""}brightness(${brightness}%) contrast(${contrast}%)`;
      const gradient = ctx.createRadialGradient(210, 210 + sliceOffset, 30, 210, 210 + sliceOffset, 210);
      gradient.addColorStop(0, "#f8fafc");
      gradient.addColorStop(0.55, "#cbd5e1");
      gradient.addColorStop(1, "#64748b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, fallbackSize, fallbackSize);
      ctx.strokeStyle = "rgba(23, 32, 51, 0.45)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(210, 210 + sliceOffset, 138, 178, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(160, 210 + sliceOffset, 52, 120, 0, 0, Math.PI * 2);
      ctx.ellipse(260, 210 + sliceOffset, 52, 120, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.filter = "none";
    }
    
    // Apply Window/Level (Brightness/Contrast) filter using pixel manipulation
    if (img && (windowCenter !== 128 || windowWidth !== 256 || inverted)) {
      // Get the bounding box of the drawn image within the canvas to avoid processing empty black space
      const drawX = Math.max(0, -pan.x / scale);
      const drawY = Math.max(0, -pan.y / scale);
      const drawW = Math.min(img.width, canvas.width / scale);
      const drawH = Math.min(img.height, canvas.height / scale);
      
      const realX = pan.x + drawX * scale;
      const realY = pan.y + drawY * scale;
      const realW = drawW * scale;
      const realH = drawH * scale;

      // Only process if visible
      if (realW > 0 && realH > 0 && realX < canvas.width && realY < canvas.height) {
        const imageData = ctx.getImageData(realX, realY, realW, realH);
        const data = imageData.data;

        // WL Math
        const minIntensity = windowCenter - 0.5 - (windowWidth - 1) / 2;
        const maxIntensity = windowCenter - 0.5 + (windowWidth - 1) / 2;
        const slope = 255 / windowWidth;

        for (let i = 0; i < data.length; i += 4) {
          // Grayscale assumption: use R channel for intensity
          let intensity = data[i];
          
          if (intensity <= minIntensity) {
            intensity = 0;
          } else if (intensity > maxIntensity) {
            intensity = 255;
          } else {
            intensity = (intensity - minIntensity) * slope;
          }

          if (inverted) {
            intensity = 255 - intensity;
          }

          data[i] = intensity;
          data[i+1] = intensity;
          data[i+2] = intensity;
        }
        ctx.putImageData(imageData, realX, realY);
      }
    }

    ctx.restore();
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    if (activeTool === 'pan') {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (activeTool === 'windowLevel') {
      setWindowWidth(prev => Math.max(1, prev + dx * 2));
      setWindowCenter(prev => Math.max(0, Math.min(255, prev - dy * 2)));
    } else if (activeTool === 'zoom') {
      setScale(prev => Math.max(0.1, prev * (1 - dy * 0.01)));
    } else if (activeTool === 'scroll') {
      setSliceIndex(prev => {
        const next = prev - Math.sign(dy);
        return Math.max(1, Math.min(maxSlices, next));
      });
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const moveImage = (horizontal: number, vertical: number) => {
    setPan((value) => ({ x: value.x + horizontal, y: value.y + vertical }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (activeTool === "pan") {
      const step = e.shiftKey ? { horizontal: e.deltaY > 0 ? -20 : 20, vertical: 0 } : { horizontal: 0, vertical: e.deltaY > 0 ? -20 : 20 };
      moveImage(step.horizontal, step.vertical);
      return;
    }
    if (activeTool === "scroll") {
      setSliceIndex((value) => Math.max(1, Math.min(maxSlices, value + Math.sign(e.deltaY))));
      return;
    }
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setScale(prev => prev * zoomFactor);
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomFactor,
        y: mouseY - (mouseY - prev.y) * zoomFactor
      }));
    }
  };

  const handleViewportKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 20;
    if (e.key === "ArrowLeft") moveImage(-step, 0);
    else if (e.key === "ArrowRight") moveImage(step, 0);
    else if (e.key === "ArrowUp") moveImage(0, -step);
    else if (e.key === "ArrowDown") moveImage(0, step);
    else return;
    e.preventDefault();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${mrn.replace(/[^a-z0-9_-]/gi, "_")}_pacs_view.png`;
    link.click();
  };

  const selectTool = (tool: ToolMode) => {
    setActiveTool(tool);
    if (tool === "windowLevel") {
      setWindowCenter((value) => value === 128 ? 160 : 128);
      setWindowWidth((value) => value === 256 ? 180 : 256);
    }
    if (tool === "pan") {
      setPan((value) => ({ x: value.x + 16, y: value.y + 10 }));
    }
    if (tool === "zoom") {
      setScale((value) => Math.min(value * 1.15, 4));
    }
    if (tool === "scroll") {
      setSliceIndex((value) => value >= maxSlices ? 1 : value + 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-lg overflow-hidden border border-[var(--border)] shadow-[var(--shadow-soft)] font-mono select-none">
      
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button 
            className={`p-2 rounded hover:bg-[var(--bg-card)] transition-colors ${activeTool === 'windowLevel' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
            onClick={(e) => { triggerRipple(e); selectTool('windowLevel'); }}
            title="Window/Level (Contrast/Brightness)"
            aria-label="Set window and level tool"
            aria-pressed={activeTool === 'windowLevel'}
          >
            <Sun size={18} />
          </button>
          <button 
            className={`p-2 rounded hover:bg-[var(--bg-card)] transition-colors ${activeTool === 'pan' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
            onClick={(e) => { triggerRipple(e); selectTool('pan'); }}
            title="Pan"
            aria-label="Set pan tool"
            aria-pressed={activeTool === 'pan'}
          >
            <Crosshair size={18} />
          </button>
          <button 
            className={`p-2 rounded hover:bg-[var(--bg-card)] transition-colors ${activeTool === 'zoom' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
            onClick={(e) => { triggerRipple(e); selectTool('zoom'); }}
            title="Zoom"
            aria-label="Set zoom tool"
            aria-pressed={activeTool === 'zoom'}
          >
            <ZoomIn size={18} />
          </button>
          <button 
            className={`p-2 rounded hover:bg-[var(--bg-card)] transition-colors ${activeTool === 'scroll' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
            onClick={(e) => { triggerRipple(e); selectTool('scroll'); }}
            title="Scroll Slices"
            aria-label="Set slice scroll tool"
            aria-pressed={activeTool === 'scroll'}
          >
            <ArrowUpDown size={18} />
          </button>
          
          <div className="w-px h-6 bg-[var(--border)] mx-2" />
          
          <button 
            className={`p-2 rounded hover:bg-[var(--bg-card)] transition-colors ${inverted ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
            onClick={(e) => { triggerRipple(e); setInverted(!inverted); }}
            title="Invert Colors"
            aria-label="Invert viewport colors"
            aria-pressed={inverted}
          >
            <Contrast size={18} />
          </button>
          <button 
            className="p-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
            onClick={(e) => { triggerRipple(e); resetViewport(); }}
            title="Reset Viewport"
            aria-label="Reset viewport"
          >
            <RotateCcw size={18} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
           <button
             className="p-2 rounded text-[var(--accent-purple)] hover:bg-[var(--bg-card)] transition-colors flex items-center gap-1 text-xs font-mono font-bold"
             onClick={(e) => { triggerRipple(e); setShowMprModal(true); }}
             title="Open 3D Multi-Planar Reconstruction"
           >
             <Layers size={18} />
             <span>3D MPR</span>
           </button>
           <button
             className="p-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
             onClick={handleDownload}
             title="Download current viewport as PNG"
             aria-label="Download current viewport as PNG"
           >
             <Download size={18} />
           </button>
        </div>
      </div>

      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[9px] text-[var(--text-secondary)]">
        <div className="flex items-center justify-between gap-2 font-semibold">
          <span>Tool: {activeTool === "windowLevel" ? "Brightness and contrast" : activeTool === "pan" ? "Pan: drag, wheel, or arrow keys" : activeTool === "zoom" ? "Zoom image" : "Scroll slices with wheel"}</span>
          <span>Slice {sliceIndex}/{maxSlices}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-[var(--border-subtle)] pt-1 font-mono leading-4">
          <span className="truncate">{patientName.toUpperCase()}</span>
          <span className="truncate text-right">HOSPITAL_SYS_AI</span>
          <span>{mrn}</span>
          <span className="truncate text-right">CT ABDOMEN W/O CONTRAST</span>
          <span className="truncate">DOB: {dob} | SEX: {sex}</span>
          <span className="text-right">Series: 2</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div 
        ref={containerRef}
        className="relative flex-1 min-h-0 bg-[var(--bg-card)] overflow-hidden cursor-crosshair"
        tabIndex={0}
        role="application"
        aria-label="PACS image viewport. Use arrow keys to move the image."
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleViewportKeyDown}
      >
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {imageUnavailable && (
          <div className="absolute inset-x-3 top-3 flex justify-center pointer-events-none">
            <span className="rounded-full border border-[var(--accent-border)] bg-[var(--bg-card)] px-2 py-1 text-[9px] font-semibold text-[var(--text-secondary)] shadow-sm">
              Demo scan preview
            </span>
          </div>
        )}
        
        {/* Slice Scrollbar Indicator */}
           <div className="absolute right-1 top-1/4 bottom-1/4 w-1 bg-[var(--border)] rounded pointer-events-none">
           <div 
             className="w-full bg-[var(--accent)] rounded" 
             style={{ 
               height: `${100 / maxSlices}%`, 
               transform: `translateY(${(sliceIndex / maxSlices) * 100 * (maxSlices-1)}%)`
             }} 
           />
        </div>
      </div>

      {showMprModal && (
        <DicomMprRendererModal
          patientName={patientName}
          mrn={mrn}
          onClose={() => setShowMprModal(false)}
        />
      )}
    </div>
  );
}
