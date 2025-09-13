import { Button } from "@/components/ui/button";
import { Play, Pause, Rewind, FastForward, Volume2, X, GripHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface PodcastPlayerProps {
  audioUrl: string;
  onClose: () => void;
}

export default function PodcastPlayer({ audioUrl, onClose }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // dragging
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 16, y: 16 });
  const dragState = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  // Initialize default position to bottom-left once we know viewport height
  useEffect(() => {
    const margin = 16;
    const height = containerRef.current?.getBoundingClientRect().height ?? 140;
    setPos({ x: margin, y: window.innerHeight - height - margin });
  }, []);

  // audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    // ensure volume is applied to element
    audio.volume = volume;

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [volume]);

  // play/pause effect (no autoplay—only reacts to user toggling isPlaying)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay blocked or other playback error; revert button state
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // reset when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl]);

  const togglePlayPause = () => setIsPlaying((p) => !p);

  const rewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const fastForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(duration || 0, audio.currentTime + 10);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPct = parseFloat(e.target.value);
    const newTime = (newPct / 100) * (duration || 0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value) / 100;
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
  };

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
    };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // drag helpers
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const startDragMouse = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current.dragging = true;
    dragState.current.offsetX = e.clientX - rect.left;
    dragState.current.offsetY = e.clientY - rect.top;
    window.addEventListener("mousemove", onDragMouse);
    window.addEventListener("mouseup", endDragMouse);
  };

  const onDragMouse = (e: MouseEvent) => {
    if (!dragState.current.dragging) return;
    const margin = 8;
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 360;
    const h = rect?.height ?? 140;
    const x = clamp(e.clientX - dragState.current.offsetX, margin, window.innerWidth - w - margin);
    const y = clamp(e.clientY - dragState.current.offsetY, margin, window.innerHeight - h - margin);
    setPos({ x, y });
  };

  const endDragMouse = () => {
    dragState.current.dragging = false;
    window.removeEventListener("mousemove", onDragMouse);
    window.removeEventListener("mouseup", endDragMouse);
  };

  const startDragTouch = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current.dragging = true;
    dragState.current.offsetX = t.clientX - rect.left;
    dragState.current.offsetY = t.clientY - rect.top;
    window.addEventListener("touchmove", onDragTouch, { passive: false });
    window.addEventListener("touchend", endDragTouch);
  };

  const onDragTouch = (e: TouchEvent) => {
    if (!dragState.current.dragging) return;
    const t = e.touches[0];
    if (!t) return;
    e.preventDefault(); // stop page scrolling while dragging
    const margin = 8;
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 360;
    const h = rect?.height ?? 140;
    const x = clamp(t.clientX - dragState.current.offsetX, margin, window.innerWidth - w - margin);
    const y = clamp(t.clientY - dragState.current.offsetY, margin, window.innerHeight - h - margin);
    setPos({ x, y });
  };

  const endDragTouch = () => {
    dragState.current.dragging = false;
    window.removeEventListener("touchmove", onDragTouch);
    window.removeEventListener("touchend", endDragTouch);
  };

  return (
    <div
      ref={containerRef}
      className="z-[1000] fixed bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-2xl shadow-2xl p-4 min-w-[380px] border border-white/20 transform transition-transform duration-200 hover:scale-[1.02] select-none"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Podcast player"
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header with drag handle */}
      <div
        className="flex items-center justify-between mb-3 cursor-move"
        onMouseDown={startDragMouse}
        onTouchStart={startDragTouch}
        aria-label="Drag handle"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 opacity-80" aria-hidden="true" />
          <span className="text-sm font-medium">Podcast Player</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-white/20 text-white"
          aria-label="Close player"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <input
          type="range"
          min={0}
          max={100}
          value={progressPercent}
          onChange={handleProgressChange}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider hover:bg-white/30 transition-colors"
          aria-label="Seek position"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number.isFinite(progressPercent) ? Math.round(progressPercent) : 0}
          style={{
            background: `linear-gradient(to right, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
          }}
        />
        <div className="flex justify-between text-xs opacity-90 mt-1" aria-live="off">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={rewind}
          className="h-10 w-10 rounded-full hover:bg-white/20 text-white transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="Rewind 10 seconds"
          title="Rewind 10s"
        >
          <Rewind className="h-5 w-5" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlayPause}
          className="h-12 w-12 rounded-full hover:bg-white/20 text-white transition-all duration-200 hover:scale-105 active:scale-95 bg-white/10 ring-2 ring-white/20 hover:ring-white/30"
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-6 w-6" aria-hidden="true" /> : <Play className="h-6 w-6 ml-0.5" aria-hidden="true" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={fastForward}
          className="h-10 w-10 rounded-full hover:bg-white/20 text-white transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="Fast forward 10 seconds"
          title="Forward 10s"
        >
          <FastForward className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3">
        <Volume2 className="h-4 w-4 opacity-90" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider hover:bg-white/30 transition-colors"
          aria-label="Volume"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          style={{
            background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
          }}
        />
        <span className="text-xs opacity-90 w-8 text-right" aria-live="off">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Plain CSS (works in Vite/CRA/Next) */}
      <style>{`
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
