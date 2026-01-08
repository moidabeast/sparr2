import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Send, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useGetMessages, useSendMessage, useAddActivePeer, useRemoveActivePeer, useLeaveRoom, useGetActivePeers, useUpdatePresence, useSendHeartbeat, useDisconnect } from '../hooks/useQueries';
import { getSessionId } from '../lib/session';
import WebRTCManager, { WebRTCManagerRef } from '../components/WebRTCManager';
import ConnectedUsersList from '../components/ConnectedUsersList';
import UploadSpeedTest, { QualityTier } from '../components/UploadSpeedTest';
import { toast } from 'sonner';
import type { RoomRef } from '../App';

interface RoomProps {
  roomId: string;
  onLeave: () => void;
}

const HEARTBEAT_INTERVAL = 5000; // Send heartbeat every 5 seconds

const Room = forwardRef<RoomRef, RoomProps>(({ roomId, onLeave }, ref) => {
  const currentSessionId = getSessionId();

  const { data: messages = [] } = useGetMessages(roomId);
  const { data: activePeers = [] } = useGetActivePeers(roomId);
  const sendMessage = useSendMessage();
  const addActivePeer = useAddActivePeer();
  const removeActivePeer = useRemoveActivePeer();
  const leaveRoomMutation = useLeaveRoom();
  const updatePresence = useUpdatePresence();
  const sendHeartbeat = useSendHeartbeat();
  const disconnect = useDisconnect();

  const [messageInput, setMessageInput] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [uploadSpeedKbps, setUploadSpeedKbps] = useState<number>(0);
  const [currentQualityTier, setCurrentQualityTier] = useState<QualityTier>('medium');
  const [isStreamingAllowed, setIsStreamingAllowed] = useState(true);
  const [hasCompletedSpeedTest, setHasCompletedSpeedTest] = useState(false);

  const webrtcManagerRef = useRef<WebRTCManagerRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add as active peer and initialize presence when joining room
  useEffect(() => {
    if (!hasJoinedRef.current && roomId) {
      hasJoinedRef.current = true;
      console.log('[Room] Adding as active peer and initializing presence');
      addActivePeer.mutate(roomId);
      
      // Initialize presence as visible
      updatePresence.mutate({
        roomId,
        isVisible: true,
      });
    }
  }, [roomId]);

  // Heartbeat mechanism to maintain presence
  useEffect(() => {
    if (!roomId) return;

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      console.log('[Room Heartbeat] Sending heartbeat');
      sendHeartbeat.mutate({ roomId });
    }, HEARTBEAT_INTERVAL);

    console.log('[Room Heartbeat] Heartbeat interval started');

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        console.log('[Room Heartbeat] Heartbeat interval cleared');
      }
    };
  }, [roomId]);

  // Track visibility changes to update presence (but NOT disconnect)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      console.log(`[Room Visibility] Page visibility changed to: ${isVisible ? 'visible' : 'hidden'}`);
      
      // Update presence status but maintain connection
      updatePresence.mutate({
        roomId,
        isVisible,
      });

      if (isVisible) {
        console.log('[Room Visibility] Page became visible, user still connected');
      } else {
        console.log('[Room Visibility] Page hidden, maintaining connection with heartbeat');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomId]);

  // Handle upload speed test completion
  const handleSpeedTestComplete = (speedKbps: number, qualityTier: QualityTier) => {
    console.log('[Room] Upload speed test complete:', { speedKbps, qualityTier });
    setUploadSpeedKbps(speedKbps);
    setCurrentQualityTier(qualityTier);
    setHasCompletedSpeedTest(true);

    // Block streaming if speed is too low
    if (qualityTier === 'blocked') {
      setIsStreamingAllowed(false);
      setIsVideoEnabled(false);
      toast.error('Streaming blocked due to insufficient upload speed');
    } else {
      setIsStreamingAllowed(true);
    }
  };

  // Handle quality changes during streaming
  const handleQualityChange = (newTier: QualityTier, reason: string) => {
    console.log('[Room] Quality tier changed:', { newTier, reason });
    setCurrentQualityTier(newTier);

    // Block streaming if quality drops to blocked
    if (newTier === 'blocked') {
      setIsStreamingAllowed(false);
      setIsVideoEnabled(false);
      toast.error('Streaming paused due to low upload speed');
    } else if (!isStreamingAllowed) {
      // Only re-enable if currently blocked
      setIsStreamingAllowed(true);
      toast.success('Upload speed improved - streaming enabled');
    }
  };

  // Cleanup function
  const performCleanup = async () => {
    if (cleanupInProgressRef.current) {
      console.log('[Room] Cleanup already in progress, skipping');
      return;
    }

    cleanupInProgressRef.current = true;
    console.log('[Room] Starting cleanup...');

    try {
      // Stop heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // WebRTC cleanup
      if (webrtcManagerRef.current) {
        await webrtcManagerRef.current.cleanup();
      }

      // Disconnect from presence system
      try {
        await disconnect.mutateAsync(roomId);
        console.log('[Room] Disconnected from presence system');
      } catch (error) {
        console.error('[Room] Error disconnecting from presence:', error);
      }

      // Remove from active peers
      try {
        await removeActivePeer.mutateAsync(roomId);
        console.log('[Room] Removed from active peers');
      } catch (error) {
        console.error('[Room] Error removing from active peers:', error);
      }

      // Leave room
      try {
        await leaveRoomMutation.mutateAsync(roomId);
        console.log('[Room] Left room');
      } catch (error) {
        console.error('[Room] Error leaving room:', error);
      }

      console.log('[Room] Cleanup complete');
    } catch (error) {
      console.error('[Room] Error during cleanup:', error);
    } finally {
      cleanupInProgressRef.current = false;
    }
  };

  // Expose cleanup method via ref
  useImperativeHandle(ref, () => ({
    handleLeave: async () => {
      await performCleanup();
      onLeave();
    },
  }));

  // Browser event cleanup - ONLY for actual page unload/close
  useEffect(() => {
    let isUnloading = false;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[Room Browser Event] beforeunload triggered - user closing/refreshing page');
      isUnloading = true;
      
      // Use sendBeacon for reliable cleanup on page unload
      // This is a fire-and-forget API that works even as the page is unloading
      try {
        // Note: sendBeacon requires a URL endpoint. Since we're using IC canisters,
        // we'll do synchronous cleanup here instead
        disconnect.mutate(roomId);
        removeActivePeer.mutate(roomId);
        leaveRoomMutation.mutate(roomId);
      } catch (error) {
        console.error('[Room Browser Event] Error in beforeunload cleanup:', error);
      }
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      console.log('[Room Browser Event] pagehide triggered');
      
      // Only cleanup if page is being discarded (not cached for bfcache)
      if (!e.persisted) {
        console.log('[Room Browser Event] Page being discarded - performing cleanup');
        isUnloading = true;
        
        try {
          disconnect.mutate(roomId);
          removeActivePeer.mutate(roomId);
          leaveRoomMutation.mutate(roomId);
        } catch (error) {
          console.error('[Room Browser Event] Error in pagehide cleanup:', error);
        }
      } else {
        console.log('[Room Browser Event] Page cached for bfcache - maintaining connection');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    console.log('[Room Browser Event] Event listeners registered (beforeunload, pagehide)');

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      console.log('[Room Browser Event] Event listeners removed');
    };
  }, [roomId]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage.mutate({ roomId, content: messageInput });
      setMessageInput('');
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleVideo = () => {
    if (!isStreamingAllowed) {
      toast.error('Video streaming is blocked due to low upload speed');
      return;
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Room: {roomId}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload Speed Test */}
          <UploadSpeedTest
            onTestComplete={handleSpeedTestComplete}
            onQualityChange={handleQualityChange}
            isStreaming={hasCompletedSpeedTest && isVideoEnabled}
          />

          {/* WebRTC Video */}
          <Card>
            <CardHeader>
              <CardTitle>Video Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <WebRTCManager
                ref={webrtcManagerRef}
                roomId={roomId}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled && isStreamingAllowed}
              />

              {/* Controls */}
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant={isAudioEnabled ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleAudio}
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={isVideoEnabled && isStreamingAllowed ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleVideo}
                  disabled={!isStreamingAllowed}
                >
                  {isVideoEnabled && isStreamingAllowed ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Connected Users */}
          <ConnectedUsersList activePeers={activePeers} currentSessionId={currentSessionId} />

          {/* Chat */}
          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id.toString()}
                      className={`rounded-lg p-2 ${
                        msg.sender === currentSessionId
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <div className="text-xs font-mono opacity-70 mb-1">
                        {msg.sender === currentSessionId ? 'You' : msg.sender}
                      </div>
                      <div className="text-sm">{msg.content}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator />

              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage();
                    }
                  }}
                />
                <Button size="icon" onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});

Room.displayName = 'Room';

export default Room;
