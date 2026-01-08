import { forwardRef, useImperativeHandle, useEffect, useState, useRef } from 'react';
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Users, Crown, Eye, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import WebRTCManager from '../components/WebRTCManager';
import TikTokChatOverlay from '../components/TikTokChatOverlay';
import ConnectedUsersList from '../components/ConnectedUsersList';
import LiveKitViewer from '../components/LiveKitViewer';
import LiveKitBroadcaster from '../components/LiveKitBroadcaster';
import { useGetRoom, useJoinRoom, useLeaveRoom, useSaveLivePreview, useGetMessages, useSendMessage, useGetReactions, useSendReaction, useGetActivePeers } from '../hooks/useQueries';
import { getSessionId } from '../lib/session';
import { toast } from 'sonner';
import { ExternalBlob } from '../backend';
import type { RoomRole } from '../types/backend';
import type { RoomRef } from '../App';

interface RoomProps {
  roomId: string;
  userRole: RoomRole;
  onLeave: () => void;
  onBackToLobby: () => void;
}

const Room = forwardRef<RoomRef, RoomProps>(({ roomId, userRole, onLeave, onBackToLobby }, ref) => {
  const { data: room, isLoading } = useGetRoom(roomId);
  const { data: messages = [] } = useGetMessages(roomId);
  const { data: reactions = [] } = useGetReactions(roomId);
  const { data: activePeers = [] } = useGetActivePeers(roomId);
  const joinRoom = useJoinRoom();
  const leaveRoom = useLeaveRoom();
  const saveLivePreview = useSaveLivePreview();
  const sendMessage = useSendMessage();
  const sendReaction = useSendReaction();
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(userRole === 'participant');
  const [isAudioEnabled, setIsAudioEnabled] = useState(userRole === 'participant');
  const [showUsers, setShowUsers] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [broadcastStatus, setBroadcastStatus] = useState<'inactive' | 'active'>('inactive');
  const [showMobileControls, setShowMobileControls] = useState(false);
  
  const webrtcRef = useRef<any>(null);
  const previewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionId = getSessionId();

  // Join room on mount
  useEffect(() => {
    const joinRoomAsync = async () => {
      try {
        await joinRoom.mutateAsync({ roomId, role: userRole });
        setHasJoined(true);
        toast.success(`Joined as ${userRole === 'participant' ? 'Participant' : 'Spectator'}`);
      } catch (error) {
        console.error('Failed to join room:', error);
        toast.error('Failed to join room');
        onBackToLobby();
      }
    };

    joinRoomAsync();
  }, [roomId, userRole]);

  // Capture and upload preview for participants only
  useEffect(() => {
    if (userRole !== 'participant' || !hasJoined) return;

    const capturePreview = async () => {
      if (webrtcRef.current?.capturePreview) {
        try {
          const blob = await webrtcRef.current.capturePreview();
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const externalBlob = ExternalBlob.fromBytes(uint8Array);
            
            await saveLivePreview.mutateAsync({ roomId, image: externalBlob });
          }
        } catch (error) {
          console.error('Failed to capture/upload preview:', error);
        }
      }
    };

    // Capture preview every 30 seconds
    previewIntervalRef.current = setInterval(capturePreview, 30000);
    
    // Capture initial preview after 3 seconds
    setTimeout(capturePreview, 3000);

    return () => {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
      }
    };
  }, [roomId, userRole, hasJoined, saveLivePreview]);

  // Get local stream from WebRTC manager
  useEffect(() => {
    const updateLocalStream = () => {
      if (webrtcRef.current?.getDebugInfo) {
        const debugInfo = webrtcRef.current.getDebugInfo();
        
        // Get local stream for LiveKit broadcaster
        if (debugInfo.localStream) {
          setLocalStream(debugInfo.localStream);
        }
      }
    };

    // Update local stream every second
    const interval = setInterval(updateLocalStream, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLeave = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    
    try {
      // Clear preview interval
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
      }

      // Cleanup WebRTC connections
      if (webrtcRef.current?.cleanup) {
        await webrtcRef.current.cleanup();
      }

      // Leave room on backend
      await leaveRoom.mutateAsync(roomId);
      
      // Navigate back
      onLeave();
    } catch (error) {
      console.error('Error leaving room:', error);
      toast.error('Error leaving room');
      setIsLeaving(false);
    }
  };

  // Expose handleLeave to parent via ref
  useImperativeHandle(ref, () => ({
    handleLeave,
  }));

  const toggleVideo = () => {
    if (userRole === 'spectator') {
      toast.info('Spectators cannot enable video');
      return;
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleAudio = () => {
    if (userRole === 'spectator') {
      toast.info('Spectators cannot enable audio');
      return;
    }
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    sendMessage.mutate({ roomId, content: messageInput });
    setMessageInput('');
  };

  const handleSendReaction = (emoji: string) => {
    sendReaction.mutate({ roomId, emoji });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-lg font-semibold text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold text-destructive">Room not found</p>
          <Button onClick={onBackToLobby} variant="outline" className="rounded-2xl">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  const isParticipant = userRole === 'participant';
  const isSpectator = userRole === 'spectator';

  return (
    <div className="immersive-room-container">
      {/* Top Bar with Room Info and Controls - z-index: 20 */}
      <div className="immersive-top-bar">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleLeave}
            disabled={isLeaving}
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white drop-shadow-lg">{room.subject}</h1>
              {isParticipant && (
                <Badge variant="default" className="bg-primary/90 text-white gap-1 px-2 py-0.5">
                  <Crown className="h-3 w-3" />
                  <span className="text-xs font-semibold">Participant</span>
                </Badge>
              )}
              {isSpectator && (
                <Badge variant="secondary" className="bg-secondary/90 text-white gap-1 px-2 py-0.5">
                  <Eye className="h-3 w-3" />
                  <span className="text-xs font-semibold">Spectator</span>
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/80 drop-shadow">{room.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowUsers(!showUsers)}
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
          >
            <Users className="h-5 w-5" />
          </Button>
          
          {/* Desktop: Controls Button with Dropdown */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={toggleAudio}
                  disabled={isSpectator}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  <span>{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={toggleVideo}
                  disabled={isSpectator}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  <span>{isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile: Controls Button with Inline Controls */}
          <div className="md:hidden">
            <Button
              onClick={() => setShowMobileControls(!showMobileControls)}
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Session ID Tag - Positioned below header area - z-index: 14 */}
      <div className="session-id-tag">
        <span className="text-xs font-semibold text-white/90">
          Session: {currentSessionId}
        </span>
      </div>

      {/* Mobile Controls Panel - Only visible on mobile when toggled */}
      {showMobileControls && (
        <div className="mobile-controls-panel md:hidden">
          <div className="mobile-controls-content">
            <Button
              onClick={toggleAudio}
              disabled={isSpectator}
              variant="ghost"
              size="icon"
              className="mobile-control-button"
            >
              {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>
            <Button
              onClick={toggleVideo}
              disabled={isSpectator}
              variant="ghost"
              size="icon"
              className="mobile-control-button"
            >
              {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      )}

      {/* WebRTC Video Grid or LiveKit Viewer - z-index: 0 (base layer) */}
      <div className="immersive-video-grid">
        {isSpectator ? (
          <LiveKitViewer
            roomId={roomId}
            currentSessionId={currentSessionId}
          />
        ) : (
          <WebRTCManager
            ref={webrtcRef}
            roomId={roomId}
            userRole={userRole}
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
            liveKitToken={null}
          />
        )}
      </div>

      {/* LiveKit Broadcaster Component for Participants - Hidden UI, only status callback */}
      {isParticipant && localStream && (
        <LiveKitBroadcaster
          roomId={roomId}
          currentSessionId={currentSessionId}
          localStream={localStream}
          onStatusChange={setBroadcastStatus}
        />
      )}

      {/* TikTok-style Chat Overlay - z-index: 30 */}
      <TikTokChatOverlay
        roomId={roomId}
        messages={messages}
        reactions={reactions}
        currentSessionId={currentSessionId}
        messageInput={messageInput}
        onMessageInputChange={setMessageInput}
        onSendMessage={handleSendMessage}
        onSendReaction={handleSendReaction}
      />

      {/* Connected Users Modal - z-index: 40 */}
      {showUsers && (
        <div className="absolute top-20 right-4 z-40 w-72 md:w-80 bg-black/80 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <Button
              onClick={() => setShowUsers(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-white hover:bg-white/20 ml-auto"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <ConnectedUsersList activePeers={activePeers} currentSessionId={currentSessionId} />
        </div>
      )}
    </div>
  );
});

Room.displayName = 'Room';

export default Room;
