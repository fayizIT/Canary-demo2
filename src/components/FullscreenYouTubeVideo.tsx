import React, { useState, useRef, useEffect } from "react";

const FullscreenYouTubeVideo: React.FC = () => {
  const [unmuted, setUnmuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cursorTimeoutRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const enableSound = () => {
    setUnmuted(true);
  };

  const seekVideo = (seconds: number) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      setCurrentTime(newTime);
      
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [newTime, true],
        }),
        "*"
      );
    }
  };

  const seekToTime = (time: number) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const newTime = Math.max(0, Math.min(duration, time));
      setCurrentTime(newTime);
      
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [newTime, true],
        }),
        "*"
      );
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clickX = clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;
      seekToTime(newTime);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (isDragging && progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;
      seekToTime(newTime);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    // Keyboard controls (desktop only)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobile) return;
      
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          seekVideo(10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekVideo(-10);
          break;
        case "ArrowUp":
          e.preventDefault();
          seekVideo(30);
          break;
        case "ArrowDown":
          e.preventDefault();
          seekVideo(-30);
          break;
        case " ":
          e.preventDefault();
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                event: "command",
                func: "playVideo",
              }),
              "*"
            );
          }
          break;
      }
    };

    // Mouse wheel controls (desktop only)
    const handleWheel = (e: WheelEvent) => {
      if (isMobile) return;
      e.preventDefault();
      const skipAmount = e.deltaY > 0 ? 10 : -10;
      seekVideo(skipAmount);
    };

    // Mouse movement - show/hide cursor (desktop only)
    const handleMouseMoveForCursor = (e: MouseEvent) => {
      if (isMobile) return;
      setShowCursor(true);
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      
      cursorTimeoutRef.current = window.setTimeout(() => {
        if (!isDragging) {
          setShowCursor(false);
        }
      }, 3000);

      handleMouseMove(e);
    };

    // Touch move for mobile
    const handleTouchMove = (e: TouchEvent) => {
      handleMouseMove(e);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (!isMobile) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("mousemove", handleMouseMoveForCursor);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      setShowCursor(true);
    }

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    // Listen for updates from YouTube
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "infoDelivery" && data.info) {
          if (data.info.currentTime !== undefined && !isDragging) {
            setCurrentTime(data.info.currentTime);
          }
          if (data.info.duration !== undefined) {
            setDuration(data.info.duration);
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };

    window.addEventListener("message", handleMessage);

    // Request periodic updates
    const interval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "listening",
            id: 1,
            channel: "widget",
          }),
          "*"
        );
      }
    }, 1000);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMoveForCursor);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [currentTime, duration, isDragging, isMobile]);

  const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`fixed top-0 left-0 w-screen h-screen overflow-hidden bg-black ${
        showCursor || isMobile ? "cursor-default" : "cursor-none"
      }`}
      style={{ zIndex: 1 }}
      onClick={enableSound}
    >
      {/* YouTube iframe */}
      <iframe
        ref={iframeRef}
        className="absolute top-1/2 left-1/2 w-[120vw] h-[120vh] -translate-x-1/2 -translate-y-1/2 pointer-events-none border-none"
        src={`https://www.youtube.com/embed/4pX3qyE7iF0?autoplay=1&mute=${
          unmuted ? 0 : 1
        }&controls=0&playsinline=1&loop=1&playlist=4pX3qyE7iF0&modestbranding=1&enablejsapi=1`}
        title="YouTube video"
        allow="autoplay"
        allowFullScreen
        style={{ zIndex: 1 }}
      />

      {/* Tap to enable sound */}
      {!unmuted && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 text-white bg-black/70 rounded-md text-center ${
            isMobile 
              ? "bottom-32 text-sm px-3 py-1.5" 
              : "bottom-[100px] text-lg px-4 py-2"
          }`}
          style={{ zIndex: 1000 }}
        >
          🔊 Tap to enable sound
        </div>
      )}

      {/* Progress Bar Container - ALWAYS VISIBLE ON MOBILE */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 pointer-events-auto transition-opacity duration-300 ${
          isMobile ? "opacity-100" : (showCursor ? "opacity-100" : "opacity-0")
        } ${
          isMobile 
            ? "bottom-16 w-[88%]" 
            : "bottom-[70px] w-[80%] max-w-[600px]"
        }`}
        style={{ zIndex: 1000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Time Display - Mobile (Above slider) */}
        {isMobile && duration > 0 && (
          <div className="flex justify-between text-white text-xs mb-2 px-1 font-medium">
            <span className="bg-black/50 px-2 py-0.5 rounded">{formatTime(currentTime)}</span>
            <span className="bg-black/50 px-2 py-0.5 rounded">{formatTime(duration)}</span>
          </div>
        )}

        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className={`relative w-full rounded-full overflow-visible touch-none cursor-pointer ${
            isMobile 
              ? "h-3 bg-white/50 shadow-lg border border-white/20" 
              : "h-1.5 bg-white/30"
          }`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleProgressBarClick}
        >
          {/* Progress Fill */}
          <div
            className={`h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-100 ease-linear rounded-full ${
              isMobile ? "shadow-md" : ""
            }`}
            style={{ width: `${percentage}%` }}
          />
          
          {/* Draggable Circle/Thumb */}
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-all duration-100 ease-linear touch-none ${
              isMobile 
                ? "w-6 h-6 bg-red-600 shadow-xl cursor-grab active:cursor-grabbing active:scale-125 active:shadow-2xl" 
                : "w-3.5 h-3.5 bg-red-600 cursor-grab"
            }`}
            style={{ left: `${percentage}%`, zIndex: 1001 }}
          />
        </div>

        {/* Time Display - Desktop (Below slider) */}
        {!isMobile && duration > 0 && (
          <div className="flex justify-between text-white text-xs mt-1 px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Keyboard hints - Desktop only */}
      {!isMobile && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-[30px] text-white text-sm bg-black/70 px-4 py-2 rounded-md whitespace-nowrap text-center max-w-[90%] overflow-hidden text-ellipsis transition-opacity duration-300 ${
            showCursor ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 1000 }}
        >
          ⌨️ ← → (±10s) | ↑ ↓ (±30s) | 🖱️ Scroll (±10s) | Drag progress bar
        </div>
      )}
    </div>
  );
};

export default FullscreenYouTubeVideo;