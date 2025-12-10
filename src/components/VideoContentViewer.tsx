import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VideoContentViewerProps {
  contentUrl: string;
  userProgressId?: string;
  onContentViewed?: () => void;
  contentViewedCompletely?: boolean;
  requiresEvaluation?: boolean;
}

const VideoContentViewer = ({
  contentUrl,
  userProgressId,
  onContentViewed,
  contentViewedCompletely = false,
  requiresEvaluation = false,
}: VideoContentViewerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedPercentage, setWatchedPercentage] = useState(0);
  const [allContentViewed, setAllContentViewed] = useState(contentViewedCompletely);
  const [maxWatchedTime, setMaxWatchedTime] = useState(0);

  // Threshold percentage to consider video as "watched"
  const COMPLETION_THRESHOLD = 90;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      const total = video.duration;
      
      setCurrentTime(current);
      
      // Track the maximum time watched (prevents skipping ahead)
      if (current > maxWatchedTime) {
        setMaxWatchedTime(current);
      }
      
      // Calculate percentage based on max watched time
      if (total > 0) {
        const percentage = Math.round((maxWatchedTime / total) * 100);
        setWatchedPercentage(Math.min(percentage, 100));
        
        // Mark as complete when threshold is reached
        if (percentage >= COMPLETION_THRESHOLD && !allContentViewed) {
          markContentAsViewed();
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (!allContentViewed) {
        markContentAsViewed();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [maxWatchedTime, allContentViewed]);

  const markContentAsViewed = async () => {
    if (!userProgressId) {
      setAllContentViewed(true);
      return;
    }

    const { error } = await supabase
      .from("user_progress")
      .update({
        content_viewed_completely: true,
        progress_percentage: 100,
      })
      .eq("id", userProgressId);

    if (!error) {
      setAllContentViewed(true);
      const message = requiresEvaluation
        ? "¡Has completado la visualización del video! Ahora puedes realizar la evaluación."
        : "¡Has completado la visualización del video!";
      toast.success(message);
      if (onContentViewed) {
        onContentViewed();
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    // Only allow seeking to already watched positions
    if (newTime <= maxWatchedTime) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Progreso de visualización
          </span>
          <span className="text-sm font-bold">{watchedPercentage}%</span>
        </div>
        <Progress value={watchedPercentage} className="h-3" />
        {allContentViewed && (
          <div className="flex items-center gap-2 mt-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">¡Video completado!</span>
          </div>
        )}
      </div>

      {/* Video Player */}
      <div className="bg-card border rounded-lg overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={contentUrl}
            className="w-full aspect-video"
            onClick={togglePlay}
            playsInline
          />
          
          {/* Play overlay when paused */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={togglePlay}
            >
              <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-xl">
                <Play className="w-10 h-10 text-primary-foreground ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gradient-to-br from-card to-muted/20 space-y-3">
          {/* Seek bar */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium min-w-[45px]">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-sm font-medium min-w-[45px] text-right">{formatTime(duration)}</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
            >
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoContentViewer;
