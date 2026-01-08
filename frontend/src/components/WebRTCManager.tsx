import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useGetSignalingMessages, useSendSignalingMessage, useClearSignalingMessages, useGetActivePeers, useLeaveRoom, useLogSessionEvent, useAddEventBadge } from '../hooks/useQueries';
import { getSessionId } from '../lib/session';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import WebRTCDebugPanel, { PeerDebugInfo, ReconnectionInfo } from './WebRTCDebugPanel';
import { ExternalBlob } from '../backend';
import type { RoomRole } from '../types/backend';

// LiveKit SDK types
type LiveKitRoom = any;
type RemoteParticipant = any;
type RemoteTrack = any;
type LiveKitRoomEvent = any;
type LiveKitTrack = any;

interface WebRTCManagerProps {
  roomId: string;
  userRole: RoomRole;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  liveKitToken?: string | null;
  onPreviewCapture?: (imageBlob: ExternalBlob) => void;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  stream?: MediaStream;
  localCandidatesCount: number;
  remoteCandidatesCount: number;
  usingRelay: boolean;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
  trackStatus: 'active' | 'recovering' | 'stalled';
  isReconnecting: boolean;
  isPolite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  remoteDescriptionSet: boolean;
  iceRestartAttempts: number;
  lastIceRestart: number;
  iceRestartInProgress: boolean;
  pendingIceCandidates: RTCIceCandidateInit[];
}

interface GridDimensions {
  cols: number;
  rows: number;
}

interface LiveKitDiagnosticLog {
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  category: 'connection' | 'token' | 'stream' | 'room' | 'reconnection' | 'publish' | 'participant' | 'track' | 'sdk';
  message: string;
  details?: any;
}

interface LiveKitReconnectionState {
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastReconnectAttempt: number;
  reconnectTimer?: NodeJS.Timeout;
}

interface LiveKitSDK {
  Room: any;
  RoomEvent: any;
  Track: any;
}

export interface WebRTCManagerRef {
  cleanup: () => Promise<void>;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const HEALTH_CHECK_INTERVAL = 3000;
const BASE_RECONNECT_DELAY = 1000;
const PREVIEW_CAPTURE_INTERVAL = 30000;
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const PREVIEW_QUALITY = 0.85;

// Phase 4b: Connection Optimization Constants
const MIN_JOIN_DELAY = 100;
const MAX_JOIN_DELAY = 500;
const MAX_ICE_RESTART_ATTEMPTS = 3;
const ICE_RESTART_COOLDOWN = 10000;
const LIVEKIT_RECONNECT_BASE_DELAY = 1000;
const MAX_LIVEKIT_RECONNECT_ATTEMPTS = 5;

// LiveKit Configuration
const LIVEKIT_URL = 'wss://sparr-4z7yxmt4.livekit.cloud';
const TOKEN_SERVER_URL = 'https://livekit-token-server2.vercel.app/api/generate-livekit-token';

// TURN server configuration
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * Check if LiveKit SDK is available via window.LivekitClient global object
 */
const checkLiveKitSDKAvailability = (): LiveKitSDK | null => {
  if (typeof window === 'undefined') {
    console.log('[LiveKit SDK Check] Window is undefined (SSR context)');
    return null;
  }

  const globalLiveKit = (window as any).LivekitClient;
  
  if (globalLiveKit) {
    console.log('%c✅ window.LivekitClient Detected', 'color: #10b981; font-weight: bold; font-size: 14px;');
    console.log('[LiveKit SDK Check] SDK available via global window object');
    console.log('[LiveKit SDK Check] SDK object keys:', Object.keys(globalLiveKit));
    console.log('[LiveKit SDK Check] Has Room:', !!globalLiveKit.Room);
    console.log('[LiveKit SDK Check] Has RoomEvent:', !!globalLiveKit.RoomEvent);
    console.log('[LiveKit SDK Check] Has Track:', !!globalLiveKit.Track);
    
    return {
      Room: globalLiveKit.Room,
      RoomEvent: globalLiveKit.RoomEvent,
      Track: globalLiveKit.Track,
    };
  }
  
  console.warn('[LiveKit SDK Check] window.LivekitClient not found');
  console.warn('[LiveKit SDK Check] typeof window.LivekitClient:', typeof globalLiveKit);
  return null;
};

const isMobileViewport = (): boolean => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait = height > width;
  const isSmallScreen = width < 768;
  return isPortrait || isSmallScreen;
};

const calculateGridDimensions = (participantCount: number): GridDimensions => {
  if (participantCount === 0 || participantCount === 1) {
    return { cols: 1, rows: 1 };
  }
  
  if (participantCount === 2) {
    if (isMobileViewport()) {
      return { cols: 1, rows: 2 };
    } else {
      return { cols: 2, rows: 1 };
    }
  }
  
  if (participantCount === 3 || participantCount === 4) {
    return { cols: 2, rows: 2 };
  }
  
  if (participantCount === 5 || participantCount === 6) {
    return { cols: 3, rows: 2 };
  }
  
  if (participantCount === 7 || participantCount === 8 || participantCount === 9) {
    return { cols: 3, rows: 3 };
  }
  
  const cols = Math.ceil(Math.sqrt(participantCount));
  const rows = Math.ceil(participantCount / cols);
  
  return { cols, rows };
};

// Phase 4b: Generate randomized join delay to prevent offer collisions
const getRandomJoinDelay = (): number => {
  return Math.floor(Math.random() * (MAX_JOIN_DELAY - MIN_JOIN_DELAY + 1)) + MIN_JOIN_DELAY;
};

const WebRTCManager = forwardRef<WebRTCManagerRef, WebRTCManagerProps>(
  ({ roomId, userRole, isAudioEnabled, isVideoEnabled, liveKitToken, onPreviewCapture }, ref) => {
    const { data: signalingMessages } = useGetSignalingMessages();
    const { data: activePeers } = useGetActivePeers(roomId);
    const sendSignalingMessage = useSendSignalingMessage();
    const clearSignalingMessages = useClearSignalingMessages();
    const leaveRoomMutation = useLeaveRoom();
    const logSessionEvent = useLogSessionEvent();
    const addEventBadge = useAddEventBadge();
    
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [debugInfo, setDebugInfo] = useState<PeerDebugInfo[]>([]);
    const [localStreamStatus, setLocalStreamStatus] = useState<'active' | 'recovering' | 'stalled'>('active');
    const [viewportKey, setViewportKey] = useState(0);
    const [liveKitConnectionState, setLiveKitConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'publishing' | 'error'>('disconnected');
    const [liveKitError, setLiveKitError] = useState<string | null>(null);
    const [liveKitDiagnostics, setLiveKitDiagnostics] = useState<LiveKitDiagnosticLog[]>([]);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [liveKitParticipants, setLiveKitParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
    const [liveKitSDKAvailable, setLiveKitSDKAvailable] = useState<boolean | null>(null);
    
    const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const hasInitializedRef = useRef(false);
    const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const previewCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const previousActivePeersRef = useRef<Set<string>>(new Set());
    const cleanupInProgressRef = useRef(false);
    const liveKitPublishedRef = useRef(false);
    const liveKitReconnectionStateRef = useRef<LiveKitReconnectionState>({
      isReconnecting: false,
      reconnectAttempts: 0,
      lastReconnectAttempt: 0,
      reconnectTimer: undefined,
    });
    const liveKitTokenRef = useRef<string | null>(null);
    const joinDelayAppliedRef = useRef(false);
    const localStreamReadyRef = useRef(false);
    const liveKitRoomRef = useRef<LiveKitRoom | null>(null);
    const liveKitSDKRef = useRef<LiveKitSDK | null>(null);

    const currentSessionId = getSessionId();
    const isSpectator = userRole === 'spectator';
    const isParticipant = userRole === 'participant';

    const gridDimensions = useMemo(() => {
      const totalParticipants = (isSpectator ? 0 : 1) + remoteStreams.size + liveKitParticipants.size;
      return calculateGridDimensions(totalParticipants);
    }, [remoteStreams.size, liveKitParticipants.size, viewportKey, isSpectator]);

    useEffect(() => {
      const handleResize = () => {
        const totalParticipants = (isSpectator ? 0 : 1) + remoteStreams.size + liveKitParticipants.size;
        if (totalParticipants === 2) {
          setViewportKey(prev => prev + 1);
        }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      };
    }, [remoteStreams.size, liveKitParticipants.size, isSpectator]);

    // Check LiveKit SDK availability on mount - explicitly check window.LivekitClient
    useEffect(() => {
      const checkSDK = () => {
        addDiagnosticLog('info', 'sdk', 'Checking for window.LivekitClient global object...');
        console.log('[WebRTC Manager] Explicitly checking window.LivekitClient availability');
        console.log('[WebRTC Manager] typeof window.LivekitClient:', typeof (window as any).LivekitClient);
        
        const sdk = checkLiveKitSDKAvailability();
        const available = !!sdk;
        setLiveKitSDKAvailable(available);
        liveKitSDKRef.current = sdk;
        
        if (available) {
          addDiagnosticLog('success', 'sdk', 'window.LivekitClient detected and loaded successfully', {
            source: 'Global window object',
            hasRoom: !!sdk.Room,
            hasRoomEvent: !!sdk.RoomEvent,
            hasTrack: !!sdk.Track,
            loadedFrom: '/livekit-client.umd.js or CDN fallback',
          });
        } else {
          addDiagnosticLog('error', 'sdk', 'window.LivekitClient not available', {
            reason: 'Global object not found',
            checkedObject: 'window.LivekitClient',
            solution: 'Ensure /livekit-client.umd.js is loaded in index.html',
            fallback: 'P2P mesh networking will be used for participants',
          });
        }
      };
      
      // Check immediately
      checkSDK();
      
      // Also check after a short delay in case script is still loading
      const delayedCheck = setTimeout(() => {
        if (liveKitSDKAvailable === null || liveKitSDKAvailable === false) {
          console.log('[WebRTC Manager] Performing delayed SDK check...');
          checkSDK();
        }
      }, 500);
      
      return () => clearTimeout(delayedCheck);
    }, []);

    // Helper function to add diagnostic log
    const addDiagnosticLog = (
      level: 'info' | 'success' | 'warning' | 'error',
      category: 'connection' | 'token' | 'stream' | 'room' | 'reconnection' | 'publish' | 'participant' | 'track' | 'sdk',
      message: string,
      details?: any
    ) => {
      const log: LiveKitDiagnosticLog = {
        timestamp: Date.now(),
        level,
        category,
        message,
        details,
      };
      
      setLiveKitDiagnostics(prev => [...prev, log]);
      
      const prefix = isSpectator ? `[LiveKit Spectator]` : `[LiveKit Broadcaster]`;
      const timestamp = new Date().toISOString();
      
      switch (level) {
        case 'success':
          console.log(`%c✓ ${prefix} ${message}`, 'color: #10b981; font-weight: bold', { timestamp, details });
          break;
        case 'error':
          console.error(`%c✗ ${prefix} ${message}`, 'color: #ef4444; font-weight: bold', { timestamp, details });
          break;
        case 'warning':
          console.warn(`%c⚠ ${prefix} ${message}`, 'color: #f59e0b; font-weight: bold', { timestamp, details });
          break;
        default:
          console.log(`%cℹ ${prefix} ${message}`, 'color: #3b82f6; font-weight: bold', { timestamp, details });
      }
    };

    // LiveKit initialization for spectators using window.LivekitClient
    useEffect(() => {
      if (!isSpectator || !liveKitToken || liveKitSDKAvailable === null) return;

      // If SDK is not available, show error immediately
      if (liveKitSDKAvailable === false) {
        addDiagnosticLog('error', 'sdk', 'Cannot connect as spectator: window.LivekitClient not found', {
          checkedObject: 'window.LivekitClient',
          currentValue: typeof (window as any).LivekitClient,
          requiredFor: 'Spectator mode',
          solution: 'Ensure /livekit-client.umd.js is loaded in index.html',
        });
        setLiveKitError('LiveKit SDK not available. window.LivekitClient not found.');
        setLiveKitConnectionState('error');
        toast.error('LiveKit SDK not available. Check console for details.');
        return;
      }

      liveKitTokenRef.current = liveKitToken;

      const connectToLiveKit = async () => {
        try {
          addDiagnosticLog('info', 'connection', 'Initializing LiveKit spectator connection', {
            roomId,
            sessionId: currentSessionId,
            liveKitUrl: LIVEKIT_URL,
            tokenReceived: !!liveKitToken,
            sdkAvailable: liveKitSDKAvailable,
            sdkSource: 'window.LivekitClient',
          });
          
          setLiveKitConnectionState('connecting');
          
          addDiagnosticLog('info', 'token', 'Validating LiveKit viewer token', {
            tokenPrefix: liveKitToken.substring(0, 20) + '...',
            tokenFormat: liveKitToken.includes('.') ? 'JWT format detected' : 'Unknown format',
          });
          
          logEvent('livekit-spectator-token-received', `LiveKit viewer token received for room ${roomId}`, 'info');

          const sdk = liveKitSDKRef.current;
          if (!sdk) {
            throw new Error('LiveKit SDK not loaded from window.LivekitClient');
          }

          addDiagnosticLog('info', 'sdk', 'Using window.LivekitClient for connection', {
            hasRoom: !!sdk.Room,
            hasRoomEvent: !!sdk.RoomEvent,
            hasTrack: !!sdk.Track,
          });

          // Create LiveKit Room instance
          const room = new sdk.Room();
          liveKitRoomRef.current = room;

          // Set up event listeners before connecting
          room.on(sdk.RoomEvent.Connected, () => {
            addDiagnosticLog('success', 'connection', 'Successfully connected to LiveKit SFU', {
              serverUrl: LIVEKIT_URL,
              roomId,
              role: 'spectator',
              connectionState: room.state,
            });
            
            setLiveKitConnectionState('connected');
            logEvent('livekit-spectator-connected', 'LiveKit spectator connection established', 'info');
            toast.success('Connected to live stream');
          });

          room.on(sdk.RoomEvent.Disconnected, (reason: any) => {
            addDiagnosticLog('warning', 'connection', 'Disconnected from LiveKit', {
              reason,
              roomId,
            });
            
            setLiveKitConnectionState('disconnected');
            logEvent('livekit-spectator-disconnected', `Disconnected: ${reason}`, 'warning');
          });

          room.on(sdk.RoomEvent.Reconnecting, () => {
            addDiagnosticLog('info', 'reconnection', 'Reconnecting to LiveKit', {
              roomId,
            });
            
            setLiveKitConnectionState('reconnecting');
            liveKitReconnectionStateRef.current.isReconnecting = true;
            liveKitReconnectionStateRef.current.reconnectAttempts++;
          });

          room.on(sdk.RoomEvent.Reconnected, () => {
            addDiagnosticLog('success', 'reconnection', 'Reconnected to LiveKit', {
              roomId,
              attempts: liveKitReconnectionStateRef.current.reconnectAttempts,
            });
            
            setLiveKitConnectionState('connected');
            liveKitReconnectionStateRef.current.isReconnecting = false;
            toast.success('Reconnected to live stream');
          });

          room.on(sdk.RoomEvent.ParticipantConnected, (participant: any) => {
            addDiagnosticLog('success', 'participant', 'Remote participant connected', {
              participantId: participant.identity,
              participantSid: participant.sid,
              metadata: participant.metadata,
            });
            
            setLiveKitParticipants(prev => {
              const newMap = new Map(prev);
              newMap.set(participant.sid, participant);
              return newMap;
            });
            
            logEvent('livekit-participant-connected', `Participant ${participant.identity} connected`, 'info');
          });

          room.on(sdk.RoomEvent.ParticipantDisconnected, (participant: any) => {
            addDiagnosticLog('info', 'participant', 'Remote participant disconnected', {
              participantId: participant.identity,
              participantSid: participant.sid,
            });
            
            setLiveKitParticipants(prev => {
              const newMap = new Map(prev);
              newMap.delete(participant.sid);
              return newMap;
            });
            
            setRemoteStreams(prev => {
              const newMap = new Map(prev);
              newMap.delete(participant.sid);
              return newMap;
            });
            
            logEvent('livekit-participant-disconnected', `Participant ${participant.identity} disconnected`, 'info');
          });

          room.on(sdk.RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
            addDiagnosticLog('success', 'track', 'Track subscribed', {
              trackKind: track.kind,
              trackSid: track.sid,
              participantId: participant.identity,
              participantSid: participant.sid,
              source: publication.source,
            });
            
            // Attach track to MediaStream
            if (track.kind === sdk.Track.Kind.Video || track.kind === sdk.Track.Kind.Audio) {
              const mediaStreamTrack = track.mediaStreamTrack;
              
              setRemoteStreams(prev => {
                const newMap = new Map(prev);
                let stream = newMap.get(participant.sid);
                
                if (!stream) {
                  stream = new MediaStream();
                  newMap.set(participant.sid, stream);
                }
                
                stream.addTrack(mediaStreamTrack);
                
                addDiagnosticLog('success', 'stream', `${track.kind} track added to stream`, {
                  participantId: participant.identity,
                  streamId: stream.id,
                  trackCount: stream.getTracks().length,
                });
                
                return newMap;
              });
            }
            
            logEvent('livekit-track-subscribed', `${track.kind} track subscribed from ${participant.identity}`, 'info');
          });

          room.on(sdk.RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
            addDiagnosticLog('info', 'track', 'Track unsubscribed', {
              trackKind: track.kind,
              trackSid: track.sid,
              participantId: participant.identity,
              participantSid: participant.sid,
            });
            
            // Remove track from MediaStream
            setRemoteStreams(prev => {
              const newMap = new Map(prev);
              const stream = newMap.get(participant.sid);
              
              if (stream) {
                const mediaStreamTrack = track.mediaStreamTrack;
                stream.removeTrack(mediaStreamTrack);
                
                if (stream.getTracks().length === 0) {
                  newMap.delete(participant.sid);
                }
              }
              
              return newMap;
            });
            
            logEvent('livekit-track-unsubscribed', `${track.kind} track unsubscribed from ${participant.identity}`, 'info');
          });

          // Connect to LiveKit room
          addDiagnosticLog('info', 'connection', 'Connecting to LiveKit room', {
            url: LIVEKIT_URL,
            roomId,
          });
          
          await room.connect(LIVEKIT_URL, liveKitToken);
          
          addDiagnosticLog('success', 'room', 'Room join confirmation', {
            roomId,
            sessionId: currentSessionId,
            role: 'spectator',
            canPublish: false,
            canSubscribe: true,
            numParticipants: room.remoteParticipants.size,
          });

        } catch (error: any) {
          addDiagnosticLog('error', 'connection', 'Failed to connect to LiveKit', {
            error: error.message,
            stack: error.stack,
            roomId,
            sdkAvailable: liveKitSDKAvailable,
          });
          
          setLiveKitError(error.message || 'Failed to connect to LiveKit');
          setLiveKitConnectionState('error');
          logEvent('livekit-spectator-error', `LiveKit connection error: ${error.message}`, 'error');
          toast.error('Failed to connect to live stream');
        }
      };

      connectToLiveKit();

      return () => {
        if (liveKitRoomRef.current) {
          addDiagnosticLog('info', 'connection', 'Disconnecting from LiveKit', {
            reason: 'Component cleanup',
            roomId,
          });
          
          liveKitRoomRef.current.disconnect();
          liveKitRoomRef.current = null;
        }
        
        setLiveKitConnectionState('disconnected');
        setLiveKitParticipants(new Map());
        liveKitReconnectionStateRef.current.isReconnecting = false;
        liveKitReconnectionStateRef.current.reconnectAttempts = 0;
      };
    }, [isSpectator, roomId, currentSessionId, liveKitToken, liveKitSDKAvailable]);

    // LiveKit broadcaster publishing for participants - fetch token at runtime
    useEffect(() => {
      if (!isParticipant || !localStream || liveKitPublishedRef.current) return;

      const publishToLiveKit = async () => {
        try {
          addDiagnosticLog('info', 'connection', 'Starting LiveKit broadcaster initialization', {
            roomId,
            sessionId: currentSessionId,
            liveKitUrl: LIVEKIT_URL,
            localStreamTracks: {
              audio: localStream.getAudioTracks().length,
              video: localStream.getVideoTracks().length,
            },
            sdkAvailable: liveKitSDKAvailable,
            sdkSource: 'window.LivekitClient',
          });
          
          setLiveKitConnectionState('connecting');
          logEvent('livekit-broadcaster-init', `Initializing LiveKit broadcaster for room ${roomId}`, 'info');

          addDiagnosticLog('info', 'token', 'Fetching broadcaster token from Vercel token server', {
            tokenServer: TOKEN_SERVER_URL,
            roomId,
            broadcasterId: currentSessionId,
            role: 'broadcaster',
          });
          
          // Fetch token from Vercel token server at runtime
          const response = await fetch(TOKEN_SERVER_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomId: roomId,
              userId: currentSessionId,
              role: 'broadcaster',
            }),
          });

          if (!response.ok) {
            throw new Error(`Token server returned ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (!data.token) {
            throw new Error('Token server returned empty token');
          }

          const token = data.token;
          liveKitTokenRef.current = token;

          addDiagnosticLog('success', 'token', 'Broadcaster token received successfully from Vercel server', {
            tokenPrefix: token.substring(0, 20) + '...',
            tokenLength: token.length,
            tokenFormat: token.includes('.') ? 'JWT format detected' : 'Unknown format',
            tokenSource: 'Vercel runtime token server',
          });
          
          logEvent('livekit-broadcaster-token-received', `Broadcaster token received for room ${roomId}`, 'info');

          liveKitPublishedRef.current = true;
          setLiveKitConnectionState('publishing');

          // Check if SDK is available for actual publishing
          if (liveKitSDKAvailable === false || !liveKitSDKRef.current) {
            addDiagnosticLog('warning', 'sdk', 'window.LivekitClient not available for broadcaster publishing', {
              fallback: 'P2P mesh networking active',
              note: 'Ensure /livekit-client.umd.js is loaded for spectator support',
              checkedObject: 'window.LivekitClient',
            });
            
            setTimeout(() => {
              setLiveKitConnectionState('connected');
              toast.info('Broadcasting via P2P only (LiveKit SDK not available)');
            }, 500);
            
            return;
          }

          addDiagnosticLog('info', 'connection', 'Connecting to LiveKit as broadcaster', {
            url: LIVEKIT_URL,
            roomId,
            role: 'broadcaster',
            sdkSource: 'window.LivekitClient',
          });

          const sdk = liveKitSDKRef.current;

          // Create LiveKit Room instance for broadcaster
          const room = new sdk.Room();
          liveKitRoomRef.current = room;

          // Set up event listeners
          room.on(sdk.RoomEvent.Connected, async () => {
            addDiagnosticLog('success', 'connection', 'Successfully connected to LiveKit as broadcaster', {
              serverUrl: LIVEKIT_URL,
              roomId,
              role: 'broadcaster',
            });

            // Publish local tracks
            try {
              const audioTracks = localStream.getAudioTracks();
              const videoTracks = localStream.getVideoTracks();

              addDiagnosticLog('info', 'publish', 'Publishing local tracks to LiveKit', {
                audioTracks: audioTracks.length,
                videoTracks: videoTracks.length,
              });

              // Publish audio track
              if (audioTracks.length > 0) {
                await room.localParticipant.publishTrack(audioTracks[0], {
                  name: 'microphone',
                  source: sdk.Track.Source.Microphone,
                });
                addDiagnosticLog('success', 'publish', 'Audio track published', {
                  trackId: audioTracks[0].id,
                });
              }

              // Publish video track
              if (videoTracks.length > 0) {
                await room.localParticipant.publishTrack(videoTracks[0], {
                  name: 'camera',
                  source: sdk.Track.Source.Camera,
                });
                addDiagnosticLog('success', 'publish', 'Video track published', {
                  trackId: videoTracks[0].id,
                });
              }

              setLiveKitConnectionState('connected');
              addDiagnosticLog('success', 'publish', 'All tracks published successfully to LiveKit', {
                publishedTracks: ['audio', 'video'],
                streamingToSpectators: true,
                p2pActive: true,
              });

              logEvent('livekit-broadcaster-publishing', 'LiveKit broadcaster publishing active', 'info');
              toast.success('Broadcasting to LiveKit and P2P');
            } catch (publishError: any) {
              addDiagnosticLog('error', 'publish', 'Failed to publish tracks', {
                error: publishError.message,
              });
              throw publishError;
            }
          });

          room.on(sdk.RoomEvent.Disconnected, (reason: any) => {
            addDiagnosticLog('warning', 'connection', 'Disconnected from LiveKit', {
              reason,
              roomId,
            });
            setLiveKitConnectionState('disconnected');
          });

          // Connect to LiveKit room
          await room.connect(LIVEKIT_URL, token);

        } catch (error: any) {
          addDiagnosticLog('error', 'connection', 'Failed to publish to LiveKit', {
            error: error.message,
            stack: error.stack,
            roomId,
          });
          
          setLiveKitError(error.message || 'Failed to publish to LiveKit');
          setLiveKitConnectionState('error');
          logEvent('livekit-broadcaster-error', `LiveKit publishing error: ${error.message}`, 'error');
          
          addDiagnosticLog('warning', 'connection', 'Falling back to P2P streaming only', {
            reason: 'LiveKit publishing failed',
            p2pActive: true,
          });
          
          toast.info('Broadcasting via P2P only');
          liveKitPublishedRef.current = false;
        }
      };

      publishToLiveKit();

      return () => {
        if (liveKitPublishedRef.current && liveKitRoomRef.current) {
          addDiagnosticLog('info', 'publish', 'Unpublishing tracks from LiveKit', {
            roomId,
            reason: 'Component cleanup',
          });
          
          liveKitRoomRef.current.disconnect();
          liveKitRoomRef.current = null;
          logEvent('livekit-broadcaster-cleanup', 'LiveKit broadcaster cleanup', 'info');
          liveKitPublishedRef.current = false;
          setLiveKitConnectionState('disconnected');
        }
        
        if (liveKitReconnectionStateRef.current.reconnectTimer) {
          clearTimeout(liveKitReconnectionStateRef.current.reconnectTimer);
        }
        
        liveKitReconnectionStateRef.current.isReconnecting = false;
        liveKitReconnectionStateRef.current.reconnectAttempts = 0;
      };
    }, [isParticipant, localStream, roomId, currentSessionId, liveKitSDKAvailable]);

    // Update track enabled state for local stream
    useEffect(() => {
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = isAudioEnabled;
        });
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = isVideoEnabled;
        });

        // Log track state changes for LiveKit
        if (liveKitPublishedRef.current) {
          addDiagnosticLog('info', 'stream', `Audio track ${isAudioEnabled ? 'enabled' : 'disabled'}`, {
            note: 'Track state updated in LiveKit',
          });
          addDiagnosticLog('info', 'stream', `Video track ${isVideoEnabled ? 'enabled' : 'disabled'}`, {
            note: 'Track state updated in LiveKit',
          });
        }
      }
    }, [isAudioEnabled, isVideoEnabled, localStream]);

    // Periodic live preview capture (participants only)
    useEffect(() => {
      if (!localVideoRef.current || !localStream || !isVideoEnabled || !onPreviewCapture || isSpectator) {
        return;
      }

      const capturePreview = async () => {
        if (!localVideoRef.current || !localStream || !isVideoEnabled) {
          return;
        }

        try {
          const video = localVideoRef.current;
          
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.log('[WebRTC Preview] Video not ready for capture yet');
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = PREVIEW_WIDTH;
          canvas.height = PREVIEW_HEIGHT;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error('[WebRTC Preview] Failed to get canvas context');
            return;
          }

          ctx.drawImage(video, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          
          canvas.toBlob(async (blob) => {
            if (!blob) {
              console.error('[WebRTC Preview] Failed to create blob from canvas');
              return;
            }

            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            const externalBlob = ExternalBlob.fromBytes(uint8Array);
            onPreviewCapture(externalBlob);
            
            console.log('[WebRTC Preview] Captured and sent high-quality live preview snapshot');
          }, 'image/jpeg', PREVIEW_QUALITY);
          
        } catch (error) {
          console.error('[WebRTC Preview] Error capturing preview:', error);
        }
      };

      const initialTimeout = setTimeout(() => {
        capturePreview();
      }, 2000);

      previewCaptureIntervalRef.current = setInterval(() => {
        capturePreview();
      }, PREVIEW_CAPTURE_INTERVAL);

      console.log('[WebRTC Preview] High-quality live preview capture started (every 30 seconds)');

      return () => {
        if (initialTimeout) {
          clearTimeout(initialTimeout);
        }
        if (previewCaptureIntervalRef.current) {
          clearInterval(previewCaptureIntervalRef.current);
          previewCaptureIntervalRef.current = null;
        }
        console.log('[WebRTC Preview] Live preview capture stopped');
      };
    }, [localStream, isVideoEnabled, onPreviewCapture, isSpectator]);

    const logEvent = (eventType: string, details: string, severity?: string, peerId?: string) => {
      logSessionEvent.mutate({
        eventType,
        timestamp: BigInt(Date.now()),
        details,
        severity: severity ?? null,
        peerId: peerId ?? null,
      });
    };

    const addBadge = (eventType: string, mediaType?: string, outcome?: string) => {
      addEventBadge.mutate({
        eventType,
        timestamp: BigInt(Date.now()),
        mediaType: mediaType ?? null,
        outcome: outcome ?? null,
      });
    };

    // Phase 4b: Apply randomized join delay for participants
    useEffect(() => {
      if (isSpectator || joinDelayAppliedRef.current) return;

      const delay = getRandomJoinDelay();
      
      console.log(`%c[WebRTC Phase 4b] Applying randomized join delay: ${delay}ms to prevent offer collisions`, 'color: #3b82f6; font-weight: bold');

      const delayTimer = setTimeout(() => {
        joinDelayAppliedRef.current = true;
        console.log('%c[WebRTC Phase 4b] Join delay complete, proceeding with connection setup', 'color: #10b981; font-weight: bold');
      }, delay);

      return () => {
        clearTimeout(delayTimer);
      };
    }, [isSpectator]);

    // Initialize local media stream for participants
    useEffect(() => {
      if (isSpectator || !joinDelayAppliedRef.current || hasInitializedRef.current) return;

      const initLocalStream = async () => {
        hasInitializedRef.current = true;

        console.log('%c[WebRTC Media] Starting getUserMedia() call...', 'color: #3b82f6; font-weight: bold', {
          timestamp: new Date().toISOString(),
          constraints: {
            audio: true,
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            },
          },
        });

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            },
          });

          console.log('%c✓ [WebRTC Media] getUserMedia() successful - Local stream created', 'color: #10b981; font-weight: bold', {
            timestamp: new Date().toISOString(),
            streamId: stream.id,
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
            trackDetails: {
              audio: stream.getAudioTracks().map(t => ({
                id: t.id,
                kind: t.kind,
                label: t.label,
                enabled: t.enabled,
                readyState: t.readyState,
              })),
              video: stream.getVideoTracks().map(t => ({
                id: t.id,
                kind: t.kind,
                label: t.label,
                enabled: t.enabled,
                readyState: t.readyState,
                settings: t.getSettings(),
              })),
            },
          });

          setLocalStream(stream);
          localStreamReadyRef.current = true;
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            console.log('%c[WebRTC Media] Local stream attached to video element', 'color: #10b981; font-weight: bold');
          }

          toast.success('Camera and microphone access granted');
          setLocalStreamStatus('active');
          
          logEvent('local-media-initialized', 'Local media stream successfully initialized', 'info');
          addBadge('media-acquisition', 'audio-video', 'success');

        } catch (error: any) {
          console.error('%c✗ [WebRTC Media] getUserMedia() failed', 'color: #ef4444; font-weight: bold', {
            timestamp: new Date().toISOString(),
            error: error.name,
            message: error.message,
            stack: error.stack,
          });

          toast.error('Failed to access camera/microphone. Please grant permissions.');
          setLocalStreamStatus('stalled');
          
          logEvent('local-media-error', `Media acquisition failed: ${error.message}`, 'error');
          addBadge('media-acquisition', 'audio-video', 'failed');
        }
      };

      initLocalStream();
    }, [isSpectator, joinDelayAppliedRef.current]);

    useEffect(() => {
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }, [localStream]);

    // Create peer connection helper
    const createPeerConnection = (peerId: string): PeerConnection => {
      console.log(`%c[WebRTC Peer] Creating peer connection for ${peerId}`, 'color: #3b82f6; font-weight: bold');
      
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      const peerConn: PeerConnection = {
        pc,
        localCandidatesCount: 0,
        remoteCandidatesCount: 0,
        usingRelay: false,
        reconnectAttempts: 0,
        trackStatus: 'active',
        isReconnecting: false,
        isPolite: currentSessionId < peerId,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        remoteDescriptionSet: false,
        iceRestartAttempts: 0,
        lastIceRestart: 0,
        iceRestartInProgress: false,
        pendingIceCandidates: [],
      };

      // Add local stream tracks BEFORE any negotiation
      if (localStream && localStreamReadyRef.current) {
        const audioTracks = localStream.getAudioTracks();
        const videoTracks = localStream.getVideoTracks();

        console.log(`%c[WebRTC Peer] Adding local tracks to peer connection for ${peerId}`, 'color: #10b981; font-weight: bold', {
          audioTracks: audioTracks.length,
          videoTracks: videoTracks.length,
          totalTracks: localStream.getTracks().length,
        });

        localStream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, localStream);
          console.log(`%c✓ [WebRTC Peer] Added ${track.kind} track to peer connection for ${peerId}`, 'color: #10b981; font-weight: bold', {
            trackId: track.id,
            trackLabel: track.label,
            trackEnabled: track.enabled,
            trackReadyState: track.readyState,
            senderId: sender.track?.id,
          });
        });

        console.log(`%c✓ [WebRTC Peer] All tracks successfully added to peer connection for ${peerId}`, 'color: #10b981; font-weight: bold', {
          peerId,
          tracksAdded: localStream.getTracks().length,
          readyForNegotiation: true,
        });
      } else {
        console.warn(`%c⚠ [WebRTC Peer] Local stream not ready when creating peer connection for ${peerId}`, 'color: #f59e0b; font-weight: bold', {
          localStreamExists: !!localStream,
          localStreamReady: localStreamReadyRef.current,
        });
      }

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log(`%c✓ [WebRTC Track] Received ${event.track.kind} track from ${peerId}`, 'color: #10b981; font-weight: bold', {
          trackId: event.track.id,
          trackLabel: event.track.label,
          trackReadyState: event.track.readyState,
          streamId: event.streams[0]?.id,
          streamTrackCount: event.streams[0]?.getTracks().length,
        });
        const [remoteStream] = event.streams;
        if (remoteStream) {
          peerConn.stream = remoteStream;
          setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            newMap.set(peerId, remoteStream);
            return newMap;
          });
          peerConn.trackStatus = 'active';
          
          logEvent('remote-track-received', `Received ${event.track.kind} track from ${peerId}`, 'info', peerId);
        }
      };

      // Phase 2: Handle ICE candidates - send immediately when gathered
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          peerConn.localCandidatesCount++;
          
          console.log(`%c[WebRTC ICE Phase 2] Local ICE candidate gathered for ${peerId}`, 'color: #8b5cf6; font-weight: bold', {
            candidateNumber: peerConn.localCandidatesCount,
            candidateType: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority,
            foundation: event.candidate.foundation,
          });
          
          // Send candidate immediately to backend
          console.log(`%c[WebRTC ICE Phase 2] Sending ICE candidate to backend for ${peerId}`, 'color: #8b5cf6; font-weight: bold', {
            receiver: peerId,
            candidateType: event.candidate.type,
          });
          
          sendSignalingMessage.mutate({
            receiver: peerId,
            messageType: 'ice-candidate',
            payload: JSON.stringify(event.candidate),
          });
          
          logEvent('ice-candidate-sent', `Sent ${event.candidate.type} candidate to ${peerId}`, 'info', peerId);
        } else {
          // ICE gathering complete
          console.log(`%c✓ [WebRTC ICE Phase 2] ICE gathering complete for ${peerId}`, 'color: #10b981; font-weight: bold', {
            totalLocalCandidates: peerConn.localCandidatesCount,
          });
          
          logEvent('ice-gathering-complete', `ICE gathering complete for ${peerId} (${peerConn.localCandidatesCount} candidates)`, 'info', peerId);
        }
      };

      // Phase 2: Handle ICE gathering state changes
      pc.onicegatheringstatechange = () => {
        console.log(`%c[WebRTC ICE Phase 2] ICE gathering state changed for ${peerId}: ${pc.iceGatheringState}`, 'color: #8b5cf6; font-weight: bold', {
          iceGatheringState: pc.iceGatheringState,
          localCandidatesCount: peerConn.localCandidatesCount,
        });
        
        logEvent('ice-gathering-state-change', `ICE gathering state: ${pc.iceGatheringState} for ${peerId}`, 'info', peerId);
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`%c[WebRTC State] Connection state with ${peerId}: ${pc.connectionState}`, 'color: #3b82f6; font-weight: bold', {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState,
        });
        
        logEvent('connection-state-change', `Connection state: ${pc.connectionState} for ${peerId}`, 'info', peerId);
        
        if (pc.connectionState === 'connected') {
          console.log(`%c✓ [WebRTC State] Successfully connected to ${peerId}`, 'color: #10b981; font-weight: bold', {
            localCandidates: peerConn.localCandidatesCount,
            remoteCandidates: peerConn.remoteCandidatesCount,
          });
          peerConn.reconnectAttempts = 0;
          peerConn.isReconnecting = false;
          toast.success(`Connected to peer ${peerId.substring(0, 8)}`);
          
          logEvent('peer-connected', `Successfully connected to ${peerId}`, 'info', peerId);
        } else if (pc.connectionState === 'failed') {
          console.error(`%c✗ [WebRTC State] Connection failed with ${peerId}`, 'color: #ef4444; font-weight: bold');
          logEvent('connection-failed', `Connection failed with ${peerId}`, 'error', peerId);
          handleConnectionFailure(peerId, peerConn);
        } else if (pc.connectionState === 'disconnected') {
          console.warn(`%c⚠ [WebRTC State] Disconnected from ${peerId}`, 'color: #f59e0b; font-weight: bold');
          peerConn.trackStatus = 'recovering';
          logEvent('peer-disconnected', `Disconnected from ${peerId}`, 'warning', peerId);
        }
      };

      // Phase 2: Handle ICE connection state changes with detailed logging
      pc.oniceconnectionstatechange = () => {
        console.log(`%c[WebRTC ICE Phase 2] ICE connection state changed for ${peerId}: ${pc.iceConnectionState}`, 'color: #8b5cf6; font-weight: bold', {
          iceConnectionState: pc.iceConnectionState,
          connectionState: pc.connectionState,
          localCandidates: peerConn.localCandidatesCount,
          remoteCandidates: peerConn.remoteCandidatesCount,
        });
        
        logEvent('ice-connection-state-change', `ICE connection state: ${pc.iceConnectionState} for ${peerId}`, 'info', peerId);
        
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log(`%c✓ [WebRTC ICE Phase 2] ICE connection established with ${peerId}`, 'color: #10b981; font-weight: bold', {
            state: pc.iceConnectionState,
            localCandidates: peerConn.localCandidatesCount,
            remoteCandidates: peerConn.remoteCandidatesCount,
          });
        } else if (pc.iceConnectionState === 'failed') {
          console.error(`%c✗ [WebRTC ICE Phase 2] ICE connection failed with ${peerId}`, 'color: #ef4444; font-weight: bold', {
            localCandidates: peerConn.localCandidatesCount,
            remoteCandidates: peerConn.remoteCandidatesCount,
          });
        }
      };

      // Handle negotiation needed
      pc.onnegotiationneeded = async () => {
        try {
          if (peerConn.makingOffer) {
            console.log(`%c[WebRTC Negotiation] Already making offer to ${peerId}, skipping`, 'color: #f59e0b; font-weight: bold');
            return;
          }

          console.log(`%c[WebRTC Negotiation] Negotiation needed with ${peerId}, creating offer`, 'color: #3b82f6; font-weight: bold', {
            localTracksCount: pc.getSenders().length,
            hasLocalDescription: !!pc.localDescription,
            signalingState: pc.signalingState,
          });

          peerConn.makingOffer = true;
          
          await pc.setLocalDescription();
          
          console.log(`%c✓ [WebRTC Negotiation] Offer created and set as local description for ${peerId}`, 'color: #10b981; font-weight: bold', {
            offerType: pc.localDescription?.type,
            sdpLength: pc.localDescription?.sdp.length,
          });

          console.log(`%c[WebRTC Signaling] Sending offer to ${peerId}`, 'color: #3b82f6; font-weight: bold');
          sendSignalingMessage.mutate({
            receiver: peerId,
            messageType: 'offer',
            payload: JSON.stringify(pc.localDescription),
          });
          
          logEvent('offer-sent', `Sent offer to ${peerId}`, 'info', peerId);
        } catch (error: any) {
          console.error(`%c✗ [WebRTC Negotiation] Error during negotiation with ${peerId}`, 'color: #ef4444; font-weight: bold', {
            error: error.message,
            stack: error.stack,
          });
          logEvent('negotiation-error', `Negotiation error with ${peerId}: ${error.message}`, 'error', peerId);
        } finally {
          peerConn.makingOffer = false;
        }
      };

      return peerConn;
    };

    // Handle connection failure
    const handleConnectionFailure = (peerId: string, peerConn: PeerConnection) => {
      if (peerConn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`%c✗ [WebRTC Reconnect] Max reconnection attempts reached for ${peerId}`, 'color: #ef4444; font-weight: bold', {
          attempts: peerConn.reconnectAttempts,
          maxAttempts: MAX_RECONNECT_ATTEMPTS,
        });
        toast.error(`Failed to connect to peer ${peerId.substring(0, 8)}`);
        peerConn.trackStatus = 'stalled';
        logEvent('reconnect-failed', `Max reconnection attempts reached for ${peerId}`, 'error', peerId);
        return;
      }

      peerConn.reconnectAttempts++;
      peerConn.isReconnecting = true;
      peerConn.trackStatus = 'recovering';

      const delay = BASE_RECONNECT_DELAY * Math.pow(2, peerConn.reconnectAttempts - 1);
      console.log(`%c[WebRTC Reconnect] Scheduling reconnection attempt ${peerConn.reconnectAttempts} for ${peerId} in ${delay}ms`, 'color: #f59e0b; font-weight: bold');
      
      logEvent('reconnect-scheduled', `Reconnection attempt ${peerConn.reconnectAttempts} scheduled for ${peerId}`, 'warning', peerId);

      peerConn.reconnectTimer = setTimeout(() => {
        console.log(`%c[WebRTC Reconnect] Attempting to reconnect to ${peerId}`, 'color: #3b82f6; font-weight: bold');
        
        // Trigger ICE restart
        peerConn.pc.restartIce();
        peerConn.iceRestartAttempts++;
        peerConn.lastIceRestart = Date.now();
        peerConn.iceRestartInProgress = true;
        
        logEvent('ice-restart', `ICE restart initiated for ${peerId} (attempt ${peerConn.iceRestartAttempts})`, 'info', peerId);
      }, delay);
    };

    // Phase 2: Process signaling messages with improved ICE candidate handling
    useEffect(() => {
      if (!signalingMessages || !localStream || !localStreamReadyRef.current || isSpectator) return;

      const processMessages = async () => {
        for (const message of signalingMessages) {
          const messageKey = `${message.sender}-${message.messageType}-${message.payload.substring(0, 50)}`;
          
          if (processedMessagesRef.current.has(messageKey)) {
            continue;
          }

          processedMessagesRef.current.add(messageKey);
          const peerId = message.sender;

          console.log(`%c[WebRTC Signaling Phase 2] Processing ${message.messageType} from ${peerId}`, 'color: #3b82f6; font-weight: bold');

          // Get or create peer connection
          let peerConn = peerConnectionsRef.current.get(peerId);
          if (!peerConn) {
            peerConn = createPeerConnection(peerId);
            peerConnectionsRef.current.set(peerId, peerConn);
          }

          const pc = peerConn.pc;

          try {
            if (message.messageType === 'peer_joined') {
              console.log(`%c[WebRTC Peer] Peer ${peerId} joined, initiating connection`, 'color: #10b981; font-weight: bold');
              logEvent('peer-joined', `Peer ${peerId} joined the room`, 'info', peerId);
              // Connection will be established via negotiationneeded event
              
            } else if (message.messageType === 'peer_left') {
              console.log(`%c[WebRTC Peer] Peer ${peerId} left, closing connection`, 'color: #f59e0b; font-weight: bold');
              logEvent('peer-left', `Peer ${peerId} left the room`, 'info', peerId);
              pc.close();
              peerConnectionsRef.current.delete(peerId);
              setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                newMap.delete(peerId);
                return newMap;
              });
              
            } else if (message.messageType === 'offer') {
              const offer = JSON.parse(message.payload);
              console.log(`%c[WebRTC Signaling Phase 2] Received offer from ${peerId}`, 'color: #3b82f6; font-weight: bold', {
                offerType: offer.type,
                sdpLength: offer.sdp?.length,
                signalingState: pc.signalingState,
              });
              
              logEvent('offer-received', `Received offer from ${peerId}`, 'info', peerId);

              const offerCollision = peerConn.makingOffer || pc.signalingState !== 'stable';
              peerConn.ignoreOffer = !peerConn.isPolite && offerCollision;

              if (peerConn.ignoreOffer) {
                console.log(`%c[WebRTC Negotiation] Ignoring offer from ${peerId} due to collision`, 'color: #f59e0b; font-weight: bold', {
                  makingOffer: peerConn.makingOffer,
                  signalingState: pc.signalingState,
                  isPolite: peerConn.isPolite,
                });
                logEvent('offer-ignored', `Ignored offer from ${peerId} due to collision`, 'warning', peerId);
                return;
              }

              await pc.setRemoteDescription(offer);
              peerConn.remoteDescriptionSet = true;
              console.log(`%c✓ [WebRTC Signaling Phase 2] Remote description set for ${peerId}`, 'color: #10b981; font-weight: bold');
              logEvent('remote-description-set', `Remote offer description set for ${peerId}`, 'info', peerId);
              
              // Phase 2: Apply any pending ICE candidates now that remote description is set
              if (peerConn.pendingIceCandidates.length > 0) {
                console.log(`%c[WebRTC ICE Phase 2] Applying ${peerConn.pendingIceCandidates.length} pending ICE candidates for ${peerId}`, 'color: #8b5cf6; font-weight: bold');
                
                for (const candidate of peerConn.pendingIceCandidates) {
                  try {
                    await pc.addIceCandidate(candidate);
                    peerConn.remoteCandidatesCount++;
                    console.log(`%c✓ [WebRTC ICE Phase 2] Applied pending ICE candidate for ${peerId}`, 'color: #10b981; font-weight: bold', {
                      candidateType: candidate.candidate?.split(' ')[7],
                    });
                  } catch (error: any) {
                    console.error(`%c✗ [WebRTC ICE Phase 2] Failed to apply pending candidate for ${peerId}`, 'color: #ef4444; font-weight: bold', {
                      error: error.message,
                    });
                  }
                }
                
                peerConn.pendingIceCandidates = [];
                logEvent('pending-candidates-applied', `Applied pending ICE candidates for ${peerId}`, 'info', peerId);
              }
              
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log(`%c✓ [WebRTC Signaling Phase 2] Answer created and set as local description for ${peerId}`, 'color: #10b981; font-weight: bold');
              logEvent('answer-created', `Created answer for ${peerId}`, 'info', peerId);

              console.log(`%c[WebRTC Signaling] Sending answer to ${peerId}`, 'color: #3b82f6; font-weight: bold');
              sendSignalingMessage.mutate({
                receiver: peerId,
                messageType: 'answer',
                payload: JSON.stringify(pc.localDescription),
              });
              logEvent('answer-sent', `Sent answer to ${peerId}`, 'info', peerId);
              
            } else if (message.messageType === 'answer') {
              const answer = JSON.parse(message.payload);
              console.log(`%c[WebRTC Signaling Phase 2] Received answer from ${peerId}`, 'color: #3b82f6; font-weight: bold', {
                answerType: answer.type,
                sdpLength: answer.sdp?.length,
                signalingState: pc.signalingState,
              });
              
              logEvent('answer-received', `Received answer from ${peerId}`, 'info', peerId);

              if (!peerConn.isSettingRemoteAnswerPending) {
                peerConn.isSettingRemoteAnswerPending = true;
                await pc.setRemoteDescription(answer);
                peerConn.remoteDescriptionSet = true;
                peerConn.isSettingRemoteAnswerPending = false;
                console.log(`%c✓ [WebRTC Signaling Phase 2] Remote answer set for ${peerId}`, 'color: #10b981; font-weight: bold');
                logEvent('remote-description-set', `Remote answer description set for ${peerId}`, 'info', peerId);
                
                // Phase 2: Apply any pending ICE candidates now that remote description is set
                if (peerConn.pendingIceCandidates.length > 0) {
                  console.log(`%c[WebRTC ICE Phase 2] Applying ${peerConn.pendingIceCandidates.length} pending ICE candidates for ${peerId}`, 'color: #8b5cf6; font-weight: bold');
                  
                  for (const candidate of peerConn.pendingIceCandidates) {
                    try {
                      await pc.addIceCandidate(candidate);
                      peerConn.remoteCandidatesCount++;
                      console.log(`%c✓ [WebRTC ICE Phase 2] Applied pending ICE candidate for ${peerId}`, 'color: #10b981; font-weight: bold', {
                        candidateType: candidate.candidate?.split(' ')[7],
                      });
                    } catch (error: any) {
                      console.error(`%c✗ [WebRTC ICE Phase 2] Failed to apply pending candidate for ${peerId}`, 'color: #ef4444; font-weight: bold', {
                        error: error.message,
                      });
                    }
                  }
                  
                  peerConn.pendingIceCandidates = [];
                  logEvent('pending-candidates-applied', `Applied pending ICE candidates for ${peerId}`, 'info', peerId);
                }
              }
              
            } else if (message.messageType === 'ice-candidate') {
              const candidate = JSON.parse(message.payload);
              peerConn.remoteCandidatesCount++;
              
              console.log(`%c[WebRTC ICE Phase 2] Received ICE candidate from ${peerId}`, 'color: #8b5cf6; font-weight: bold', {
                candidateNumber: peerConn.remoteCandidatesCount,
                candidateType: candidate.candidate?.split(' ')[7],
                protocol: candidate.candidate?.split(' ')[2],
                hasRemoteDescription: peerConn.remoteDescriptionSet,
              });
              
              logEvent('ice-candidate-received', `Received ICE candidate from ${peerId}`, 'info', peerId);
              
              // Phase 2: Apply ICE candidate immediately if remote description is set, otherwise queue it
              if (peerConn.remoteDescriptionSet) {
                try {
                  await pc.addIceCandidate(candidate);
                  console.log(`%c✓ [WebRTC ICE Phase 2] ICE candidate added immediately for ${peerId}`, 'color: #10b981; font-weight: bold', {
                    candidateType: candidate.candidate?.split(' ')[7],
                    totalRemoteCandidates: peerConn.remoteCandidatesCount,
                  });
                  logEvent('ice-candidate-added', `Added ICE candidate from ${peerId}`, 'info', peerId);
                } catch (error: any) {
                  console.error(`%c✗ [WebRTC ICE Phase 2] Failed to add ICE candidate for ${peerId}`, 'color: #ef4444; font-weight: bold', {
                    error: error.message,
                    candidate: candidate.candidate,
                  });
                  logEvent('ice-candidate-error', `Failed to add ICE candidate from ${peerId}: ${error.message}`, 'error', peerId);
                }
              } else {
                // Queue candidate for later application
                peerConn.pendingIceCandidates.push(candidate);
                console.log(`%c[WebRTC ICE Phase 2] Queued ICE candidate for ${peerId} (remote description not yet set)`, 'color: #f59e0b; font-weight: bold', {
                  queuedCandidates: peerConn.pendingIceCandidates.length,
                });
                logEvent('ice-candidate-queued', `Queued ICE candidate from ${peerId}`, 'info', peerId);
              }
            }
          } catch (error: any) {
            console.error(`%c✗ [WebRTC Signaling Phase 2] Error processing ${message.messageType} from ${peerId}`, 'color: #ef4444; font-weight: bold', {
              error: error.message,
              stack: error.stack,
            });
            logEvent('signaling-error', `Error processing ${message.messageType} from ${peerId}: ${error.message}`, 'error', peerId);
          }
        }
      };

      processMessages();

      // Clear processed messages after processing
      if (signalingMessages.length > 0) {
        clearSignalingMessages.mutate();
      }
    }, [signalingMessages, localStream, isSpectator, currentSessionId]);

    // Monitor active peers and clean up disconnected ones
    useEffect(() => {
      if (!activePeers || isSpectator) return;

      const currentPeers = new Set(activePeers.filter(p => p !== currentSessionId));
      const previousPeers = previousActivePeersRef.current;

      // Find peers that left
      const leftPeers = Array.from(previousPeers).filter(p => !currentPeers.has(p));
      leftPeers.forEach((peerId) => {
        console.log(`%c[WebRTC Peer] Peer ${peerId} is no longer active, cleaning up`, 'color: #f59e0b; font-weight: bold');
        const peerConn = peerConnectionsRef.current.get(peerId);
        if (peerConn) {
          peerConn.pc.close();
          peerConnectionsRef.current.delete(peerId);
        }
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
        logEvent('peer-cleanup', `Cleaned up connection to ${peerId}`, 'info', peerId);
      });

      previousActivePeersRef.current = currentPeers;
    }, [activePeers, isSpectator, currentSessionId]);

    // Health check interval
    useEffect(() => {
      if (isSpectator) return;

      healthCheckIntervalRef.current = setInterval(() => {
        peerConnectionsRef.current.forEach((peerConn, peerId) => {
          const state = peerConn.pc.connectionState;
          if (state === 'failed' || state === 'closed') {
            console.log(`%c[WebRTC Health] Peer ${peerId} is ${state}`, 'color: #f59e0b; font-weight: bold');
          }
        });
      }, HEALTH_CHECK_INTERVAL);

      return () => {
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
      };
    }, [isSpectator]);

    useImperativeHandle(ref, () => ({
      cleanup: async () => {
        if (cleanupInProgressRef.current) {
          console.log('[WebRTC Cleanup] Cleanup already in progress, skipping');
          return;
        }

        cleanupInProgressRef.current = true;
        console.log('[WebRTC Cleanup] Starting cleanup...');
        
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }

        if (previewCaptureIntervalRef.current) {
          clearInterval(previewCaptureIntervalRef.current);
          previewCaptureIntervalRef.current = null;
        }

        // Cleanup LiveKit room for spectators
        if (liveKitRoomRef.current) {
          console.log('[WebRTC Cleanup] Disconnecting from LiveKit room');
          liveKitRoomRef.current.disconnect();
          liveKitRoomRef.current = null;
        }

        peerConnectionsRef.current.forEach((peerConn, peerId) => {
          console.log(`[WebRTC Cleanup] Closing connection to ${peerId}`);
          if (peerConn.reconnectTimer) {
            clearTimeout(peerConn.reconnectTimer);
          }
          peerConn.pc.close();
        });
        peerConnectionsRef.current.clear();

        if (localStream) {
          console.log('[WebRTC Cleanup] Stopping local media tracks');
          localStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`[WebRTC Cleanup] Stopped ${track.kind} track`);
          });
          setLocalStream(null);
          localStreamReadyRef.current = false;
        }

        try {
          await clearSignalingMessages.mutateAsync();
          console.log('[WebRTC Cleanup] Cleared signaling messages');
        } catch (error) {
          console.error('[WebRTC Cleanup] Error clearing signaling messages:', error);
        }

        processedMessagesRef.current.clear();
        previousActivePeersRef.current.clear();
        setDebugInfo([]);
        setLiveKitParticipants(new Map());

        console.log('[WebRTC Cleanup] Cleanup complete');
        cleanupInProgressRef.current = false;
      },
    }));

    const allStreams = useMemo(() => {
      const streams: Array<{ id: string; stream: MediaStream; isLocal: boolean }> = [];
      
      // Add local stream for participants
      if (!isSpectator && localStream) {
        streams.push({ id: currentSessionId, stream: localStream, isLocal: true });
      }
      
      // Add P2P remote streams
      remoteStreams.forEach((stream, peerId) => {
        streams.push({ id: peerId, stream, isLocal: false });
      });
      
      // Add LiveKit remote streams for spectators
      liveKitParticipants.forEach((participant, sid) => {
        const stream = remoteStreams.get(sid);
        if (stream) {
          streams.push({ id: participant.identity, stream, isLocal: false });
        }
      });
      
      return streams;
    }, [localStream, remoteStreams, liveKitParticipants, currentSessionId, isSpectator]);

    // Generate debug info with reconnection data
    useEffect(() => {
      const updateDebugInfo = () => {
        const info: PeerDebugInfo[] = [];
        
        peerConnectionsRef.current.forEach((peerConn, peerId) => {
          const reconnectionInfo: ReconnectionInfo = {
            liveKitReconnectAttempts: liveKitReconnectionStateRef.current.reconnectAttempts,
            liveKitIsReconnecting: liveKitReconnectionStateRef.current.isReconnecting,
            iceRestartAttempts: peerConn.iceRestartAttempts || 0,
            iceRestartInProgress: peerConn.iceRestartInProgress || false,
            lastReconnectTimestamp: liveKitReconnectionStateRef.current.lastReconnectAttempt,
          };

          info.push({
            sessionId: peerId,
            connectionState: peerConn.pc.connectionState,
            iceConnectionState: peerConn.pc.iceConnectionState,
            signalingState: peerConn.pc.signalingState,
            remoteTrackCount: peerConn.stream?.getTracks().length || 0,
            hasRemoteDescription: !!peerConn.pc.remoteDescription,
            hasLocalDescription: !!peerConn.pc.localDescription,
            localCandidatesCount: peerConn.localCandidatesCount,
            remoteCandidatesCount: peerConn.remoteCandidatesCount,
            usingRelay: peerConn.usingRelay,
            reconnectAttempts: peerConn.reconnectAttempts,
            trackStatus: peerConn.trackStatus,
            isReconnecting: peerConn.isReconnecting,
            reconnectionInfo,
          });
        });
        
        setDebugInfo(info);
      };

      const interval = setInterval(updateDebugInfo, 1000);
      return () => clearInterval(interval);
    }, []);

    return (
      <>
        {isSpectator && liveKitConnectionState === 'connecting' && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950 p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-semibold">Connecting to Live Stream</span>
            </div>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              {liveKitSDKAvailable === null ? 'Checking window.LivekitClient...' : liveKitSDKAvailable ? 'Authenticating with LiveKit server...' : 'Loading LiveKit SDK...'}
            </p>
          </div>
        )}

        {isParticipant && liveKitConnectionState === 'connecting' && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950 p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-semibold">Connecting to LiveKit</span>
            </div>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              Fetching broadcaster token from Vercel server...
            </p>
          </div>
        )}

        {isParticipant && liveKitConnectionState === 'publishing' && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-semibold">Publishing to LiveKit</span>
            </div>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              Broadcasting your stream to spectators...
            </p>
          </div>
        )}

        {isParticipant && liveKitConnectionState === 'error' && liveKitError && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 rounded-lg border border-orange-500 bg-orange-50 dark:bg-orange-950 p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-200">
              <span className="font-semibold">⚠ LiveKit Publishing Failed</span>
            </div>
            <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
              {liveKitError} - Continuing with P2P streaming
            </p>
          </div>
        )}

        {isSpectator && liveKitConnectionState === 'connected' && allStreams.length === 0 && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 text-center">
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/10">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-white text-lg font-semibold mb-2">✓ Connected to Live Stream</p>
              <p className="text-white/80 text-sm mb-4">Waiting for broadcasters to publish...</p>
              <div className="text-left bg-black/40 rounded-lg p-4 mb-4 text-xs font-mono">
                <div className="text-green-400 mb-1">✓ Token authenticated</div>
                <div className="text-green-400 mb-1">✓ Room joined: {roomId}</div>
                <div className="text-green-400 mb-1">✓ SFU connection established</div>
                <div className="text-blue-400">ℹ Ready to receive streams</div>
                {liveKitSDKAvailable ? (
                  <div className="text-blue-400 mt-2">ℹ window.LivekitClient detected and active</div>
                ) : (
                  <div className="text-yellow-400 mt-2">⚠ window.LivekitClient not found</div>
                )}
              </div>
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="mt-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition-colors"
              >
                {showDiagnostics ? 'Hide' : 'Show'} Diagnostic Logs
              </button>
            </div>
          </div>
        )}

        {isSpectator && liveKitConnectionState === 'error' && liveKitSDKAvailable === false && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 text-center max-w-md">
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/10">
              <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
              <p className="text-white text-lg font-semibold mb-2">window.LivekitClient Not Found</p>
              <p className="text-white/80 text-sm mb-4">The LiveKit SDK must be loaded via /livekit-client.umd.js to watch live streams as a spectator.</p>
              <div className="text-left bg-black/40 rounded-lg p-4 mb-4 text-xs font-mono">
                <div className="text-yellow-400 mb-2 font-bold">SDK Check Failed:</div>
                <div className="text-white bg-black/60 rounded p-2 mb-2">window.LivekitClient is undefined</div>
                <div className="text-white/60 text-[10px]">Ensure /livekit-client.umd.js is loaded in index.html</div>
                <div className="text-blue-400 mt-3 text-[10px]">
                  Note: Participants can still broadcast via P2P mesh networking
                </div>
              </div>
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="mt-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition-colors"
              >
                {showDiagnostics ? 'Hide' : 'Show'} Diagnostic Logs
              </button>
            </div>
          </div>
        )}

        {showDiagnostics && liveKitDiagnostics.length > 0 && (
          <div className="fixed top-20 right-4 z-50 w-96 max-h-[70vh] bg-black/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">LiveKit Diagnostic Logs</h3>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-white/60 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {liveKitDiagnostics.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg text-xs font-mono ${
                    log.level === 'success'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : log.level === 'error'
                      ? 'bg-red-500/10 border border-red-500/30'
                      : log.level === 'warning'
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : 'bg-blue-500/10 border border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <div className="flex-1">
                      <div className={`font-semibold ${
                        log.level === 'success'
                          ? 'text-green-300'
                          : log.level === 'error'
                          ? 'text-red-300'
                          : log.level === 'warning'
                          ? 'text-yellow-300'
                          : 'text-blue-300'
                      }`}>
                        [{log.category.toUpperCase()}] {log.message}
                      </div>
                      <div className="text-white/40 text-[10px] mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                      {log.details && (
                        <div className="text-white/60 text-[10px] mt-1 bg-black/30 rounded p-1 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div 
          className="video-grid-container"
          style={{
            gridTemplateColumns: `repeat(${gridDimensions.cols}, 1fr)`,
            gridTemplateRows: `repeat(${gridDimensions.rows}, 1fr)`,
          }}
        >
          {allStreams.map(({ id, stream, isLocal }) => {
            const peerConn = peerConnectionsRef.current.get(id);
            const trackStatus = isLocal ? localStreamStatus : (peerConn?.trackStatus || 'active');
            
            return (
              <div key={id} className="video-grid-item">
                <video
                  autoPlay
                  muted={isLocal}
                  playsInline
                  data-participant={id}
                  ref={(el) => {
                    if (el && el.srcObject !== stream) {
                      el.srcObject = stream;
                    }
                    if (isLocal && localVideoRef.current !== el) {
                      localVideoRef.current = el;
                    }
                  }}
                />
                <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white font-mono">
                  {isLocal ? `You (${id})` : id}
                </div>
                {isLocal && liveKitConnectionState === 'connected' && (
                  <div className="absolute top-2 left-2 rounded bg-green-500/90 px-2 py-1 text-xs text-white font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    Broadcasting
                  </div>
                )}
                {trackStatus === 'recovering' && (
                  <div className="absolute top-2 right-2 rounded bg-yellow-500/90 px-2 py-1 text-xs text-white font-semibold flex items-center gap-1">
                    <span className="animate-spin">⟳</span>
                    {isLocal ? 'Restarting Camera' : 'Recovering'}
                  </div>
                )}
                {trackStatus === 'stalled' && (
                  <div className="absolute top-2 right-2 rounded bg-red-500/90 px-2 py-1 text-xs text-white font-semibold">
                    ⚠ {isLocal ? 'Camera Stalled' : 'Stalled'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden">
          <WebRTCDebugPanel
            peers={debugInfo}
            localStreamActive={!!localStream}
            localStreamStatus={localStreamStatus}
            audioEnabled={isAudioEnabled}
            videoEnabled={isVideoEnabled}
            signalingMessageCount={signalingMessages?.length || 0}
            knownPeerCount={activePeers?.length || 0}
            isMobile={false}
            mobileNetworkType="unknown"
          />
        </div>
      </>
    );
  }
);

WebRTCManager.displayName = 'WebRTC Manager';

export default WebRTCManager;
