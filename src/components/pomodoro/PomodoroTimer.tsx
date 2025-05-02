import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX, Timer, Activity, X } from 'lucide-react';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  sessionGoal: number;
  soundEnabled: boolean;
}

interface PomodoroStats {
  sessionsCompleted: number;
  totalWorkTime: number;
  totalBreakTime: number;
  dailyLog: Record<string, {
    date: string;
    sessionsCompleted: number;
    workTime: number;
  }>;
}

export const PomodoroTimer: React.FC = () => {
  // Default settings
  const defaultSettings: PomodoroSettings = {
    workDuration: 25,
    shortBreakDuration: 5, 
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreaks: true,
    autoStartPomodoros: true,
    sessionGoal: 8,
    soundEnabled: true,
  };

  // States
  const [settings, setSettings] = useState<PomodoroSettings>(defaultSettings);
  const [currentMode, setCurrentMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [stats, setStats] = useState<PomodoroStats>({
    sessionsCompleted: 0,
    totalWorkTime: 0,
    totalBreakTime: 0,
    dailyLog: {}
  });

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // New time tracking refs
  const timerEndRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number | null>(null);
  const completionHandlerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    // Fallback to basic beep sound as a data URL if file not found
    audioRef.current.onerror = () => {
      if (audioRef.current) {
        audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJOq0crf3uDKpIdwVkEzKSUmMEVXY3F8ipmsx9Pf4+Lf2M/Fupg...';
      }
    };
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Load settings and stats from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pomodoro-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }

    const savedStats = localStorage.getItem('pomodoro-stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error('Error loading stats:', e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
  }, [settings]);

  // Save stats to localStorage when they change
  useEffect(() => {
    localStorage.setItem('pomodoro-stats', JSON.stringify(stats));
  }, [stats]);

  // Handle timer completion
  const handleTimerCompletion = () => {
    // Play notification sound
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(e => console.error('Error playing sound:', e));
    }
    
    // Handle timer completion based on current mode
    if (currentMode === 'work') {
      // Update stats
      const today = new Date().toISOString().split('T')[0];
      setStats(prev => {
        const updatedDailyLog = { ...prev.dailyLog };
        if (!updatedDailyLog[today]) {
          updatedDailyLog[today] = {
            date: today,
            sessionsCompleted: 0,
            workTime: 0
          };
        }
        
        updatedDailyLog[today].sessionsCompleted += 1;
        updatedDailyLog[today].workTime += settings.workDuration * 60;
        
        return {
          ...prev,
          sessionsCompleted: prev.sessionsCompleted + 1,
          totalWorkTime: prev.totalWorkTime + settings.workDuration * 60,
          dailyLog: updatedDailyLog
        };
      });
      
      // Increment session count
      const newSessionsCount = sessionsCount + 1;
      setSessionsCount(newSessionsCount);
      
      // Determine if we should take a long break
      const isLongBreak = newSessionsCount % settings.longBreakInterval === 0;
      const nextMode = isLongBreak ? 'longBreak' : 'shortBreak';
      setCurrentMode(nextMode);
      
      // Set timer for appropriate break
      const nextDuration = isLongBreak 
        ? settings.longBreakDuration 
        : settings.shortBreakDuration;
      
      setTimeLeft(nextDuration * 60);
      
      // Auto-start break if enabled
      if (settings.autoStartBreaks) {
        setTimeout(() => startTimer(nextDuration * 60), 300);
      } else {
        setIsActive(false);
      }
    } else {
      // Break is complete, switch to work mode
      setCurrentMode('work');
      setTimeLeft(settings.workDuration * 60);
      
      // Update break stats
      const breakDuration = currentMode === 'shortBreak' 
        ? settings.shortBreakDuration 
        : settings.longBreakDuration;
      setStats(prev => ({
        ...prev,
        totalBreakTime: prev.totalBreakTime + breakDuration * 60
      }));
      
      // Auto-start next pomodoro if enabled
      if (settings.autoStartPomodoros) {
        setTimeout(() => startTimer(settings.workDuration * 60), 300);
      } else {
        setIsActive(false);
      }
    }
  };

  // New timer implementation using requestAnimationFrame and timestamps
  const startTimer = (duration = timeLeft) => {
    // Stop any existing timer
    stopTimer();
    
    // Set the end time based on current time + remaining seconds
    const now = Date.now();
    timerEndRef.current = now + (duration * 1000);
    lastUpdateTimeRef.current = now;
    
    // Set timer state to active
    setIsActive(true);
    
    // Start the timer update loop
    updateTimer();
    
    // Set a backup timeout to ensure timer completion (handles background tab scenarios)
    completionHandlerRef.current = setTimeout(() => {
      if (isActive && Date.now() >= timerEndRef.current!) {
        stopTimer();
        setTimeLeft(0);
        handleTimerCompletion();
      }
    }, duration * 1000 + 100); // Add 100ms buffer
  };
  
  const stopTimer = () => {
    // Cancel animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear backup timeout
    if (completionHandlerRef.current !== null) {
      clearTimeout(completionHandlerRef.current);
      completionHandlerRef.current = null;
    }
    
    // Reset timing refs
    timerEndRef.current = null;
    lastUpdateTimeRef.current = null;
  };
  
  const updateTimer = () => {
    const now = Date.now();
    
    // Only update if timer is active and end time is set
    if (isActive && timerEndRef.current !== null) {
      const remaining = Math.max(0, timerEndRef.current - now);
      const seconds = Math.ceil(remaining / 1000);
      
      // Update UI if time has changed
      if (Math.floor(seconds) !== timeLeft) {
        setTimeLeft(Math.floor(seconds));
      }
      
      // Check if timer has completed
      if (seconds <= 0) {
        stopTimer();
        setTimeLeft(0);
        handleTimerCompletion();
        return;
      }
      
      // Update last update time
      lastUpdateTimeRef.current = now;
      
      // Schedule next update using requestAnimationFrame for smooth UI updates
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    }
  };

  // Adjust pause/play functionality
  const toggleTimer = () => {
    if (!isActive) {
      startTimer();
    } else {
      stopTimer();
      setIsActive(false);
    }
  };

  // Add visibilitychange event to handle background/foreground transitions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && timerEndRef.current !== null) {
        // When page becomes visible again, recalculate remaining time
        const now = Date.now();
        const remaining = Math.max(0, timerEndRef.current - now);
        
        if (remaining <= 0) {
          // Timer should have completed while in background
          stopTimer();
          setTimeLeft(0);
          handleTimerCompletion();
        } else {
          // Timer is still running, update UI with current time
          setTimeLeft(Math.ceil(remaining / 1000));
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  // Reset timer to initial state based on current mode
  const resetTimer = () => {
    stopTimer();
    setIsActive(false);
    
    if (currentMode === 'work') {
      setTimeLeft(settings.workDuration * 60);
    } else if (currentMode === 'shortBreak') {
      setTimeLeft(settings.shortBreakDuration * 60);
    } else {
      setTimeLeft(settings.longBreakDuration * 60);
    }
  };

  // Switch between timer modes manually
  const switchMode = (mode: TimerMode) => {
    stopTimer();
    setIsActive(false);
    setCurrentMode(mode);
    
    if (mode === 'work') {
      setTimeLeft(settings.workDuration * 60);
    } else if (mode === 'shortBreak') {
      setTimeLeft(settings.shortBreakDuration * 60);
    } else {
      setTimeLeft(settings.longBreakDuration * 60);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clear all stats
  const clearStats = () => {
    if (window.confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
      setStats({
        sessionsCompleted: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        dailyLog: {}
      });
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  // Get background color based on mode
  const getBackgroundColor = () => {
    switch (currentMode) {
      case 'work':
        return 'bg-main';
      case 'shortBreak':
        return 'bg-[#4CAF50]';
      case 'longBreak':
        return 'bg-[#2196F3]';
      default:
        return 'bg-main';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Main Timer Display */}
      <div className={`flex flex-col items-center justify-center pt-8 pb-6 ${getBackgroundColor()} text-mtext`}>
        {/* Task name input (if in work mode) */}
        {currentMode === 'work' && (
          <div className="mb-2 w-3/4">
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="What are you working on?"
              className="w-full p-2 bg-white/20 text-mtext placeholder-white/70 border-2 border-border rounded text-center"
            />
          </div>
        )}
        
        {/* Timer display */}
        <div className="text-7xl font-monument mb-4">{formatTime(timeLeft)}</div>
        
        {/* Mode indicator */}
        <div className="text-lg mb-4">
          {currentMode === 'work' ? 'Focus Time' : currentMode === 'shortBreak' ? 'Short Break' : 'Long Break'}
        </div>
        
        {/* Timer controls */}
        <div className="flex space-x-4">
          <Button
            onClick={toggleTimer}
            className="h-12 w-12 rounded-full text-black border-2 border-border bg-white/90 hover:bg-white"
          >
            {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={resetTimer}
            className="h-12 w-12 rounded-full text-black border-2 border-border bg-white/90 hover:bg-white"
          >
            <RotateCcw className="h-6 w-6" />
          </Button>
        </div>
      </div>
      
      {/* Session counter and mode selector */}
      <div className="flex justify-between items-center px-4 py-3 border-b-2 border-border">
        <div className="flex items-center">
          <div className="text-sm font-medium">Sessions: {sessionsCount}/{settings.sessionGoal}</div>
          <div className="ml-2 h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBackgroundColor()}`} 
              style={{ width: `${Math.min(100, (sessionsCount / settings.sessionGoal) * 100)}%` }}
            ></div>
          </div>
        </div>
        
        <div className="flex space-x-1">
          <Button
            onClick={() => switchMode('work')}
            className={`px-2 py-1 text-xs ${currentMode === 'work' 
              ? 'bg-main text-mtext' 
              : 'bg-white border-2 border-border'}`}
            variant={currentMode === 'work' ? 'default' : 'neutral'}
          >
            Work
          </Button>
          
          <Button
            onClick={() => switchMode('shortBreak')}
            className={`px-2 py-1 text-xs ${currentMode === 'shortBreak' 
              ? 'bg-[#4CAF50] text-mtext' 
              : 'bg-white border-2 border-border'}`}
            variant={currentMode === 'shortBreak' ? 'default' : 'neutral'}
          >
            Short
          </Button>
          
          <Button
            onClick={() => switchMode('longBreak')}
            className={`px-2 py-1 text-xs ${currentMode === 'longBreak' 
              ? 'bg-[#2196F3] text-mtext' 
              : 'bg-white border-2 border-border'}`}
            variant={currentMode === 'longBreak' ? 'default' : 'neutral'}
          >
            Long
          </Button>
        </div>
      </div>
      
      {/* Main content area with stats or settings */}
      <ScrollArea className="flex-1 p-4">
        {showSettings ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-monument">Settings</h3>
              <Button 
                onClick={() => setShowSettings(false)}
                variant="neutral"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Time settings */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between">
                  <Label>Work duration: {settings.workDuration} min</Label>
                </div>
                <Slider 
                  min={1}
                  max={60}
                  step={1}
                  value={[settings.workDuration]}
                  onValueChange={(vals: number[]) => setSettings({...settings, workDuration: vals[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between">
                  <Label>Short break: {settings.shortBreakDuration} min</Label>
                </div>
                <Slider 
                  min={1}
                  max={30}
                  step={1}
                  value={[settings.shortBreakDuration]}
                  onValueChange={(vals: number[]) => setSettings({...settings, shortBreakDuration: vals[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between">
                  <Label>Long break: {settings.longBreakDuration} min</Label>
                </div>
                <Slider 
                  min={1}
                  max={60}
                  step={1}
                  value={[settings.longBreakDuration]}
                  onValueChange={(vals: number[]) => setSettings({...settings, longBreakDuration: vals[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between">
                  <Label>Long break after: {settings.longBreakInterval} sessions</Label>
                </div>
                <Slider 
                  min={1}
                  max={10}
                  step={1}
                  value={[settings.longBreakInterval]}
                  onValueChange={(vals: number[]) => setSettings({...settings, longBreakInterval: vals[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between">
                  <Label>Session goal: {settings.sessionGoal} pomodoros</Label>
                </div>
                <Slider 
                  min={1}
                  max={20}
                  step={1}
                  value={[settings.sessionGoal]}
                  onValueChange={(vals: number[]) => setSettings({...settings, sessionGoal: vals[0]})}
                  className="mt-2"
                />
              </div>
            </div>
            
            {/* Auto-start settings */}
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-start-breaks">Auto-start breaks</Label>
                <Switch 
                  id="auto-start-breaks"
                  checked={settings.autoStartBreaks}
                  onCheckedChange={(checked: boolean) => setSettings({...settings, autoStartBreaks: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-start-pomodoros">Auto-start pomodoros</Label>
                <Switch 
                  id="auto-start-pomodoros"
                  checked={settings.autoStartPomodoros}
                  onCheckedChange={(checked: boolean) => setSettings({...settings, autoStartPomodoros: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="sound-enabled">Sound notifications</Label>
                <Switch 
                  id="sound-enabled"
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked: boolean) => setSettings({...settings, soundEnabled: checked})}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-monument">Statistics</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowSettings(true)}
                  variant="neutral"
                  className="h-8 w-8 p-0 bg-white border-2 border-black"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => settings.soundEnabled && audioRef.current?.play().catch(e => console.error('Error playing sound:', e))}
                  variant="neutral"
                  className="h-8 w-8 p-0 bg-white border-2 border-black"
                >
                  {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {/* Stats summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border-2 border-border rounded-lg bg-white">
                <div className="text-xs text-gray-500 mb-1">Completed</div>
                <div className="flex items-center">
                  <Timer className="h-5 w-5 mr-2 text-[#ff6b6b]" />
                  <span className="text-xl font-monument">{stats.sessionsCompleted}</span>
                </div>
              </div>
              
              <div className="p-3 border-2 border-border rounded-lg bg-white">
                <div className="text-xs text-gray-500 mb-1">Focus Time</div>
                <div className="flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-[#ff6b6b]" />
                  <span className="text-xl font-monument">
                    {Math.floor(stats.totalWorkTime / 3600)}h {Math.floor((stats.totalWorkTime % 3600) / 60)}m
                  </span>
                </div>
              </div>
            </div>
            
            {/* Daily log */}
            {Object.keys(stats.dailyLog).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Daily Log</h4>
                <div className="space-y-2">
                  {Object.values(stats.dailyLog)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 7) // Show only the last 7 days
                    .map(day => (
                    <div key={day.date} className="flex justify-between items-center p-2 border-b border-gray-200">
                      <div>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      <div className="flex items-center">
                        <span className="mr-3">{day.sessionsCompleted} sessions</span>
                        <span>{Math.floor(day.workTime / 60)} min</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Clear stats button */}
                <Button 
                  onClick={clearStats}
                  variant="neutral"
                  className="mt-4 text-xs h-8 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50"
                >
                  Clear Statistics
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};