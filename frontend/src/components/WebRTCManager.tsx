import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useGetSignalingMessages, useSendSignalingMessage, useClearSignalingMessages, useGetActivePeers, useRemoveActivePeer, useLeaveRoom, useUpdateIcePolicy, useUpdateNetworkPathStats, useLogSessionEvent, useAddEventBadge } from '../hooks/useQueries';
import { getSessionId } from '../lib/session';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import WebRTCDebugPanel, { PeerDebugInfo, TurnRetryInfo, ErrorRecoveryInfo } from './WebRTCDebugPanel';

interface WebRTCManagerProps {
  roomId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

interface QualityLevel {
  name: string;
  maxBitrate: number;
  width: number;
  height: number;
}

interface NetworkStats {
  bitrate: number;
  packetLoss: number;
  jitter: number;
  rtt: number;
  bytesReceived: number;
  bytesSent: number;
  timestamp: number;
}

interface NetworkPathProbe {
  udpLatency: number;
  tcpLatency: number;
  packetLoss: number;
  preferredRoute: 'udp' | 'tcp' | 'unknown';
  status: 'probing' | 'complete' | 'failed';
  timestamp: number;
}

interface NetworkChangeInfo {
  type: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  timestamp: number;
}

interface TurnCredentials {
  username: string;
  credential: string;
  timestamp: number;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  stream?: MediaStream;
  iceCandidateQueue: RTCIceCandidate[];
  localCandidatesCount: number;
  remoteCandidatesCount: number;
  usingRelay: boolean;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
  lastStatsCheck?: RTCStatsReport;
  trackStatus: 'active' | 'recovering' | 'stalled';
  isReconnecting: boolean;
  lastBytesReceived: number;
  frozenFrameCount: number;
  lastFramesDecoded: number;
  consecutiveFrozenChecks: number;
  lastVideoTrackCheck: number;
  isPolite: boolean;
  currentQuality: QualityLevel;
  networkStats: NetworkStats;
  lastNetworkStatsUpdate: number;
  qualityAdjustmentInProgress: boolean;
  icePolicy: 'direct' | 'relay-only';
  icePolicySwitchCount: number;
  lastIcePolicySwitch: number;
  connectionAttempts: number;
  networkPathProbe: NetworkPathProbe;
  turnRetryCount: number;
  lastTurnRetry: number;
  turnCredentials: TurnCredentials;
  tcpFallbackAttempted: boolean;
  lastErrorRecovery: number;
  errorRecoveryCount: number;
  iceStagnationTimer?: NodeJS.Timeout;
  lastIceStateChange: number;
  mobileOptimizedRetries: boolean;
  renegotiationInProgress: boolean;
  lastRenegotiation: number;
}

interface LocalStreamHealth {
  lastCheck: number;
  lastFrameCount: number;
  consecutiveStalls: number;
  isRecovering: boolean;
}

export interface WebRTCManagerRef {
  cleanup: () => Promise<void>;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const MAX_MOBILE_RECONNECT_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 3000;
const BASE_RECONNECT_DELAY = 1000;
const MOBILE_BASE_RECONNECT_DELAY = 2000;
const NETWORK_STATS_INTERVAL = 2000;
const QUALITY_ADJUSTMENT_COOLDOWN = 5000;
const LOCAL_STREAM_CHECK_INTERVAL = 4000;
const FROZEN_FRAME_THRESHOLD = 2;
const VIDEO_TRACK_TIMEOUT = 5000;
const ICE_GATHERING_TIMEOUT = 8000;
const CONNECTION_TIMEOUT = 10000;
const ICE_POLICY_SWITCH_COOLDOWN = 15000;
const NETWORK_PROBE_TIMEOUT = 3000;
const NETWORK_CHANGE_DEBOUNCE = 2000;
const MAX_TURN_RETRIES = 3;
const TURN_RETRY_DELAY = 2000;
const TCP_FALLBACK_DELAY = 5000;
const ERROR_RECOVERY_COOLDOWN = 10000;
const ICE_STAGNATION_TIMEOUT = 30000;
const MOBILE_RECONNECT_THROTTLE = 5000;
const RENEGOTIATION_COOLDOWN = 3000;
const RENEGOTIATION_RETRY_DELAY = 2000;
const MAX_RENEGOTIATION_RETRIES = 3;

const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'low', maxBitrate: 250, width: 320, height: 240 },
  { name: 'medium', maxBitrate: 500, width: 640, height: 480 },
  { name: 'high', maxBitrate: 1500, width: 1280, height: 720 },
];

const DEFAULT_QUALITY = QUALITY_LEVELS[1];

const PACKET_LOSS_THRESHOLD_HIGH = 5;
const PACKET_LOSS_THRESHOLD_LOW = 2;
const BITRATE_THRESHOLD_RATIO = 0.7;

const DEFAULT_TURN_CREDENTIALS: TurnCredentials = {
  username: '7094d3caa20544e7bd21926d',
  credential: '4XesGDN80SAzJUXK',
  timestamp: Date.now(),
};

const WebRTCManager = forwardRef<WebRTCManagerRef, WebRTCManagerProps>(
  ({ roomId, isAudioEnabled, isVideoEnabled }, ref) => {
    const { data: signalingMessages } = useGetSignalingMessages();
    const { data: activePeers } = useGetActivePeers(roomId);
    const sendSignalingMessage = useSendSignalingMessage();
    const clearSignalingMessages = useClearSignalingMessages();
    const removeActivePeer = useRemoveActivePeer();
    const leaveRoomMutation = useLeaveRoom();
    const updateIcePolicy = useUpdateIcePolicy();
    const updateNetworkPathStats = useUpdateNetworkPathStats();
    const logSessionEvent = useLogSessionEvent();
    const addEventBadge = useAddEventBadge();
    
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [debugInfo, setDebugInfo] = useState<PeerDebugInfo[]>([]);
    const [localStreamStatus, setLocalStreamStatus] = useState<'active' | 'recovering' | 'stalled'>('active');
    const [networkChangeInfo, setNetworkChangeInfo] = useState<NetworkChangeInfo | null>(null);
    const [isReconnectingFromNetworkChange, setIsReconnectingFromNetworkChange] = useState(false);
    const [isRenegotiating, setIsRenegotiating] = useState(false);
    const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const hasInitializedRef = useRef(false);
    const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const networkStatsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const localStreamCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const previousActivePeersRef = useRef<Set<string>>(new Set());
    const makingOfferRef = useRef<Map<string, boolean>>(new Map());
    const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
    const isMobileRef = useRef<boolean>(false);
    const mobileNetworkTypeRef = useRef<string>('unknown');
    const localStreamHealthRef = useRef<LocalStreamHealth>({
      lastCheck: Date.now(),
      lastFrameCount: 0,
      consecutiveStalls: 0,
      isRecovering: false,
    });
    const cleanupInProgressRef = useRef(false);
    const networkChangeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastNetworkChangeRef = useRef<NetworkChangeInfo | null>(null);
    const isOnlineRef = useRef(true);
    const lastMobileReconnectRef = useRef<number>(0);
    const renegotiationInProgressRef = useRef(false);
    const lastFullMeshRenegotiationRef = useRef<number>(0);

    const currentSessionId = getSessionId();

    useEffect(() => {
      const detectMobile = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
        isMobileRef.current = isMobile || isTablet;
        
        if ('connection' in navigator && (navigator as any).connection) {
          const connection = (navigator as any).connection;
          mobileNetworkTypeRef.current = connection.effectiveType || 'unknown';
          console.log(`[WebRTC Mobile] Network type: ${mobileNetworkTypeRef.current}`);
        }
        
        console.log(`[WebRTC] Device type detected: ${isMobileRef.current ? 'Mobile/Tablet' : 'Desktop'}`);
      };
      detectMobile();
    }, []);

    const generateFreshTurnCredentials = (): TurnCredentials => {
      console.log('[WebRTC TURN] Generating fresh TURN credentials');
      return {
        ...DEFAULT_TURN_CREDENTIALS,
        timestamp: Date.now(),
      };
    };

    const logEvent = (eventType: string, details: string, severity?: string, peerId?: string) => {
      logSessionEvent.mutate({
        eventType,
        timestamp: BigInt(Date.now()),
        details,
        severity,
        peerId,
      });
    };

    const addBadge = (eventType: string, mediaType?: string, outcome?: string) => {
      addEventBadge.mutate({
        eventType,
        timestamp: BigInt(Date.now()),
        mediaType,
        outcome,
      });
    };

    useEffect(() => {
      const handleNetworkChange = (changeInfo: NetworkChangeInfo) => {
        console.log('[WebRTC Network] Network change detected:', changeInfo);
        logEvent('network-change', `Network changed to ${changeInfo.type}`, 'info');
        
        if (networkChangeDebounceTimerRef.current) {
          clearTimeout(networkChangeDebounceTimerRef.current);
        }

        networkChangeDebounceTimerRef.current = setTimeout(() => {
          const isSignificantChange = 
            !lastNetworkChangeRef.current ||
            lastNetworkChangeRef.current.type !== changeInfo.type ||
            (lastNetworkChangeRef.current.effectiveType !== changeInfo.effectiveType);

          if (isSignificantChange && isOnlineRef.current) {
            console.log('[WebRTC Network] Significant network change detected, initiating reconnection');
            lastNetworkChangeRef.current = changeInfo;
            setNetworkChangeInfo(changeInfo);
            handleNetworkChangeReconnection(changeInfo);
          }
        }, NETWORK_CHANGE_DEBOUNCE);
      };

      const handleOnline = () => {
        console.log('[WebRTC Network] Browser online event detected');
        isOnlineRef.current = true;
        const changeInfo: NetworkChangeInfo = {
          type: 'online',
          timestamp: Date.now(),
        };
        handleNetworkChange(changeInfo);
        toast.info('Network connection restored, reconnecting...');
        logEvent('network-online', 'Network connection restored', 'info');
      };

      const handleOffline = () => {
        console.log('[WebRTC Network] Browser offline event detected');
        isOnlineRef.current = false;
        setNetworkChangeInfo({
          type: 'offline',
          timestamp: Date.now(),
        });
        toast.warning('Network connection lost');
        logEvent('network-offline', 'Network connection lost', 'warning');
      };

      const handleConnectionChange = () => {
        if ('connection' in navigator && (navigator as any).connection) {
          const connection = (navigator as any).connection;
          const changeInfo: NetworkChangeInfo = {
            type: connection.type || 'unknown',
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            timestamp: Date.now(),
          };
          
          if (isMobileRef.current) {
            mobileNetworkTypeRef.current = connection.effectiveType || 'unknown';
            console.log(`[WebRTC Mobile] Network type changed to: ${mobileNetworkTypeRef.current}`);
          }
          
          console.log('[WebRTC Network] Connection change event:', changeInfo);
          handleNetworkChange(changeInfo);
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      if ('connection' in navigator && (navigator as any).connection) {
        const connection = (navigator as any).connection;
        connection.addEventListener('change', handleConnectionChange);
        console.log('[WebRTC Network] Network Information API available, monitoring connection changes');
      }

      console.log('[WebRTC Network] Network change detection initialized');

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        
        if ('connection' in navigator && (navigator as any).connection) {
          const connection = (navigator as any).connection;
          connection.removeEventListener('change', handleConnectionChange);
        }

        if (networkChangeDebounceTimerRef.current) {
          clearTimeout(networkChangeDebounceTimerRef.current);
        }
      };
    }, []);

    const handleNetworkChangeReconnection = async (changeInfo: NetworkChangeInfo) => {
      if (isReconnectingFromNetworkChange || peerConnectionsRef.current.size === 0) {
        console.log('[WebRTC Network] Reconnection already in progress or no peers, skipping');
        return;
      }

      if (isMobileRef.current) {
        const timeSinceLastReconnect = Date.now() - lastMobileReconnectRef.current;
        if (timeSinceLastReconnect < MOBILE_RECONNECT_THROTTLE) {
          console.log('[WebRTC Mobile] Reconnection throttled, too soon since last attempt');
          return;
        }
        lastMobileReconnectRef.current = Date.now();
      }

      setIsReconnectingFromNetworkChange(true);
      console.log('[WebRTC Network] Starting network change reconnection for all peers');
      toast.info(`Network switched to ${changeInfo.type}, reconnecting...`);
      addBadge('network-change', undefined, 'initiated');

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const reconnectionPromises: Promise<void>[] = [];

        for (const [peerId, peerConn] of peerConnectionsRef.current.entries()) {
          console.log(`[WebRTC Network] Initiating ICE restart for peer ${peerId}`);
          
          const reconnectPromise = (async () => {
            try {
              const offer = await peerConn.pc.createOffer({ iceRestart: true });
              await peerConn.pc.setLocalDescription(offer);
              
              sendSignalingMessage.mutate({
                receiver: peerId,
                messageType: 'offer',
                payload: JSON.stringify(offer),
              });

              console.log(`[WebRTC Network] ICE restart offer sent to ${peerId}`);
              logEvent('ice-restart', `ICE restart initiated for peer ${peerId}`, 'info', peerId);
              
              peerConn.isReconnecting = true;
              peerConn.trackStatus = 'recovering';
              
            } catch (error) {
              console.error(`[WebRTC Network] Failed to restart ICE for ${peerId}:`, error);
              logEvent('ice-restart-failed', `ICE restart failed for peer ${peerId}: ${error}`, 'error', peerId);
            }
          })();

          reconnectionPromises.push(reconnectPromise);
        }

        await Promise.all(reconnectionPromises);

        console.log('[WebRTC Network] Network change reconnection initiated for all peers');
        toast.success('Reconnection initiated, waiting for peers...');

        updateDebugInfo();

        setTimeout(() => {
          setIsReconnectingFromNetworkChange(false);
          
          let allRecovered = true;
          peerConnectionsRef.current.forEach((peerConn, peerId) => {
            if (peerConn.pc.connectionState !== 'connected') {
              console.log(`[WebRTC Network] Peer ${peerId} did not recover after network change`);
              allRecovered = false;
            } else {
              peerConn.isReconnecting = false;
              peerConn.trackStatus = 'active';
            }
          });

          if (allRecovered) {
            toast.success('All connections recovered successfully');
            addBadge('network-change', undefined, 'success');
          } else {
            toast.warning('Some connections may need manual reconnection');
            addBadge('network-change', undefined, 'partial');
          }

          updateDebugInfo();
        }, 15000);

      } catch (error) {
        console.error('[WebRTC Network] Error during network change reconnection:', error);
        setIsReconnectingFromNetworkChange(false);
        toast.error('Failed to reconnect after network change');
        logEvent('network-reconnect-failed', `Network reconnection failed: ${error}`, 'error');
        addBadge('network-change', undefined, 'failure');
      }
    };

    const performNetworkPathProbing = async (peerId: string): Promise<NetworkPathProbe> => {
      console.log(`[WebRTC Probe] Starting network path probing for ${peerId}`);
      
      const probe: NetworkPathProbe = {
        udpLatency: -1,
        tcpLatency: -1,
        packetLoss: 0,
        preferredRoute: 'unknown',
        status: 'probing',
        timestamp: Date.now(),
      };

      try {
        const probeConfig: RTCConfiguration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        };

        const probePc = new RTCPeerConnection(probeConfig);
        
        const udpStartTime = Date.now();
        let udpResolved = false;
        
        probePc.onicecandidate = (event) => {
          if (event.candidate && event.candidate.protocol === 'udp' && !udpResolved) {
            probe.udpLatency = Date.now() - udpStartTime;
            udpResolved = true;
            console.log(`[WebRTC Probe] UDP latency: ${probe.udpLatency}ms`);
          }
        };

        probePc.createDataChannel('probe');
        await probePc.createOffer();

        await Promise.race([
          new Promise<void>((resolve) => {
            probePc.onicegatheringstatechange = () => {
              if (probePc.iceGatheringState === 'complete') {
                resolve();
              }
            };
          }),
          new Promise<void>((resolve) => setTimeout(resolve, NETWORK_PROBE_TIMEOUT)),
        ]);

        const tcpStartTime = Date.now();
        const turnConfig: RTCConfiguration = {
          iceServers: [
            {
              urls: 'turn:relay.metered.ca:443?transport=tcp',
              username: DEFAULT_TURN_CREDENTIALS.username,
              credential: DEFAULT_TURN_CREDENTIALS.credential,
            },
          ],
        };

        const tcpProbePc = new RTCPeerConnection(turnConfig);
        let tcpResolved = false;

        tcpProbePc.onicecandidate = (event) => {
          if (event.candidate && event.candidate.type === 'relay' && !tcpResolved) {
            probe.tcpLatency = Date.now() - tcpStartTime;
            tcpResolved = true;
            console.log(`[WebRTC Probe] TCP/TURN latency: ${probe.tcpLatency}ms`);
          }
        };

        tcpProbePc.createDataChannel('probe-tcp');
        await tcpProbePc.createOffer();

        await Promise.race([
          new Promise<void>((resolve) => {
            tcpProbePc.onicegatheringstatechange = () => {
              if (tcpProbePc.iceGatheringState === 'complete') {
                resolve();
              }
            };
          }),
          new Promise<void>((resolve) => setTimeout(resolve, NETWORK_PROBE_TIMEOUT)),
        ]);

        probePc.close();
        tcpProbePc.close();

        if (probe.udpLatency > 0 && probe.tcpLatency > 0) {
          probe.preferredRoute = probe.udpLatency < probe.tcpLatency ? 'udp' : 'tcp';
        } else if (probe.udpLatency > 0) {
          probe.preferredRoute = 'udp';
        } else if (probe.tcpLatency > 0) {
          probe.preferredRoute = 'tcp';
        }

        probe.status = 'complete';
        console.log(`[WebRTC Probe] Probing complete for ${peerId}:`, probe);

        updateNetworkPathStats.mutate({
          udpLatency: BigInt(probe.udpLatency),
          tcpLatency: BigInt(probe.tcpLatency),
          packetLoss: BigInt(Math.round(probe.packetLoss)),
          preferredRoute: probe.preferredRoute,
        });

      } catch (error) {
        console.error(`[WebRTC Probe] Probing failed for ${peerId}:`, error);
        probe.status = 'failed';
      }

      return probe;
    };

    const getRtcConfiguration = (
      icePolicy: 'direct' | 'relay-only' = 'direct',
      useTcpFallback: boolean = false,
      credentials: TurnCredentials = DEFAULT_TURN_CREDENTIALS
    ): RTCConfiguration => {
      const config: RTCConfiguration = {
        iceServers: [],
        iceTransportPolicy: icePolicy === 'relay-only' ? 'relay' : 'all',
      };

      if (icePolicy === 'relay-only') {
        console.log(`[WebRTC ICE] Using relay-only mode (TURN only)${useTcpFallback ? ' with TCP fallback' : ''}`);
        
        if (useTcpFallback) {
          config.iceServers = [
            {
              urls: 'turn:relay.metered.ca:443?transport=tcp',
              username: credentials.username,
              credential: credentials.credential,
            },
          ];
        } else {
          config.iceServers = [
            {
              urls: 'turn:relay.metered.ca:443',
              username: credentials.username,
              credential: credentials.credential,
            },
          ];
        }
      } else {
        console.log(`[WebRTC ICE] Using direct mode (STUN + TURN)${useTcpFallback ? ' with TCP fallback' : ''}`);
        
        if (isMobileRef.current) {
          if (useTcpFallback) {
            config.iceServers = [
              {
                urls: 'turn:relay.metered.ca:443?transport=tcp',
                username: credentials.username,
                credential: credentials.credential,
              },
              { urls: 'stun:stun.l.google.com:19302' },
            ];
          } else {
            config.iceServers = [
              {
                urls: 'turn:relay.metered.ca:443',
                username: credentials.username,
                credential: credentials.credential,
              },
              { urls: 'stun:stun.l.google.com:19302' },
            ];
          }
        } else {
          if (useTcpFallback) {
            config.iceServers = [
              { urls: 'stun:stun.l.google.com:19302' },
              {
                urls: 'turn:relay.metered.ca:443?transport=tcp',
                username: credentials.username,
                credential: credentials.credential,
              },
            ];
          } else {
            config.iceServers = [
              { urls: 'stun:stun.l.google.com:19302' },
              {
                urls: 'turn:relay.metered.ca:443',
                username: credentials.username,
                credential: credentials.credential,
              },
            ];
          }
        }
      }

      return config;
    };

    const retryTurnConnection = async (peerId: string, reason: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn) return;

      if (peerConn.turnRetryCount >= MAX_TURN_RETRIES) {
        console.log(`[WebRTC TURN] Max TURN retries reached for ${peerId}`);
        toast.error(`TURN connection failed for peer ${peerId.substring(0, 4)}... after ${MAX_TURN_RETRIES} attempts`);
        logEvent('turn-retry-failed', `Max TURN retries reached for peer ${peerId}`, 'error', peerId);
        return;
      }

      const timeSinceLastRetry = Date.now() - peerConn.lastTurnRetry;
      if (timeSinceLastRetry < TURN_RETRY_DELAY) {
        console.log(`[WebRTC TURN] TURN retry cooldown active for ${peerId}`);
        return;
      }

      peerConn.turnRetryCount++;
      peerConn.lastTurnRetry = Date.now();

      console.log(`[WebRTC TURN] Retrying TURN connection for ${peerId} (attempt ${peerConn.turnRetryCount}/${MAX_TURN_RETRIES}). Reason: ${reason}`);
      toast.info(`Retrying TURN connection for peer ${peerId.substring(0, 4)}... (${peerConn.turnRetryCount}/${MAX_TURN_RETRIES})`);
      logEvent('turn-retry', `TURN retry attempt ${peerConn.turnRetryCount} for peer ${peerId}: ${reason}`, 'info', peerId);
      addBadge('turn-retry', undefined, 'initiated');

      const freshCredentials = generateFreshTurnCredentials();
      peerConn.turnCredentials = freshCredentials;

      peerConn.pc.close();

      const newConfig = getRtcConfiguration(peerConn.icePolicy, peerConn.tcpFallbackAttempted, freshCredentials);
      const newPc = new RTCPeerConnection(newConfig);
      
      peerConn.pc = newPc;
      
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          newPc.addTrack(track, localStream);
        });
      }

      setupPeerConnectionHandlers(peerId, peerConn);

      try {
        const offer = await newPc.createOffer({ iceRestart: true });
        await newPc.setLocalDescription(offer);
        
        sendSignalingMessage.mutate({
          receiver: peerId,
          messageType: 'offer',
          payload: JSON.stringify(offer),
        });

        console.log(`[WebRTC TURN] New offer sent with fresh credentials to ${peerId}`);
        addBadge('turn-retry', undefined, 'success');
      } catch (error) {
        console.error(`[WebRTC TURN] Failed to create offer with fresh credentials for ${peerId}:`, error);
        logEvent('turn-retry-failed', `Failed to create offer for peer ${peerId}: ${error}`, 'error', peerId);
        addBadge('turn-retry', undefined, 'failure');
      }

      updateDebugInfo();
    };

    const attemptTcpFallback = async (peerId: string, reason: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn || peerConn.tcpFallbackAttempted) {
        console.log(`[WebRTC TCP] TCP fallback already attempted for ${peerId}`);
        return;
      }

      console.log(`[WebRTC TCP] Attempting TCP fallback for ${peerId}. Reason: ${reason}`);
      toast.info(`Switching to TCP for peer ${peerId.substring(0, 4)}...`);
      logEvent('tcp-fallback', `TCP fallback initiated for peer ${peerId}: ${reason}`, 'info', peerId);
      addBadge('tcp-fallback', undefined, 'initiated');

      peerConn.tcpFallbackAttempted = true;

      peerConn.pc.close();

      const newConfig = getRtcConfiguration(peerConn.icePolicy, true, peerConn.turnCredentials);
      const newPc = new RTCPeerConnection(newConfig);
      
      peerConn.pc = newPc;
      
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          newPc.addTrack(track, localStream);
        });
      }

      setupPeerConnectionHandlers(peerId, peerConn);

      try {
        const offer = await newPc.createOffer({ iceRestart: true });
        await newPc.setLocalDescription(offer);
        
        sendSignalingMessage.mutate({
          receiver: peerId,
          messageType: 'offer',
          payload: JSON.stringify(offer),
        });

        console.log(`[WebRTC TCP] TCP fallback offer sent to ${peerId}`);
        addBadge('tcp-fallback', undefined, 'success');
      } catch (error) {
        console.error(`[WebRTC TCP] Failed to create TCP fallback offer for ${peerId}:`, error);
        logEvent('tcp-fallback-failed', `TCP fallback failed for peer ${peerId}: ${error}`, 'error', peerId);
        addBadge('tcp-fallback', undefined, 'failure');
      }

      updateDebugInfo();
    };

    const handleErrorRecovery = async (peerId: string, errorCode: number, errorMessage: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn) return;

      const timeSinceLastRecovery = Date.now() - peerConn.lastErrorRecovery;
      if (timeSinceLastRecovery < ERROR_RECOVERY_COOLDOWN) {
        console.log(`[WebRTC Error] Error recovery cooldown active for ${peerId}`);
        return;
      }

      peerConn.lastErrorRecovery = Date.now();
      peerConn.errorRecoveryCount++;

      console.log(`[WebRTC Error] Handling error ${errorCode} for ${peerId}: ${errorMessage}`);
      logEvent('error-recovery', `Error ${errorCode} for peer ${peerId}: ${errorMessage}`, 'warning', peerId);
      addBadge('error-recovery', undefined, 'initiated');

      switch (errorCode) {
        case 403:
          console.log(`[WebRTC Error] 403 error - retrying with fresh credentials`);
          toast.warning(`Authentication error for peer ${peerId.substring(0, 4)}..., retrying...`);
          await retryTurnConnection(peerId, `403 Forbidden error: ${errorMessage}`);
          break;
        
        case 437:
          console.log(`[WebRTC Error] 437 error - allocation mismatch, retrying`);
          toast.warning(`Connection mismatch for peer ${peerId.substring(0, 4)}..., retrying...`);
          await retryTurnConnection(peerId, `437 Allocation Mismatch: ${errorMessage}`);
          break;
        
        case 486:
          console.log(`[WebRTC Error] 486 error - quota exceeded, attempting TCP fallback`);
          toast.warning(`Connection quota exceeded for peer ${peerId.substring(0, 4)}..., trying TCP...`);
          await attemptTcpFallback(peerId, `486 Quota Exceeded: ${errorMessage}`);
          break;
        
        default:
          console.log(`[WebRTC Error] Unknown error ${errorCode}, attempting general recovery`);
          await retryTurnConnection(peerId, `Error ${errorCode}: ${errorMessage}`);
      }

      addBadge('error-recovery', undefined, 'success');
      updateDebugInfo();
    };

    const monitorIceStagnation = (peerId: string, peerConn: PeerConnection) => {
      if (peerConn.iceStagnationTimer) {
        clearTimeout(peerConn.iceStagnationTimer);
      }

      peerConn.iceStagnationTimer = setTimeout(() => {
        if (peerConn.pc.iceConnectionState === 'checking' || peerConn.pc.iceConnectionState === 'new') {
          console.log(`[WebRTC ICE] ICE stagnation detected for ${peerId}, triggering renegotiation`);
          toast.warning(`Connection stalled for peer ${peerId.substring(0, 4)}..., renegotiating...`);
          logEvent('ice-stagnation', `ICE stagnation detected for peer ${peerId}`, 'warning', peerId);
          
          performRenegotiation(peerId);
        }
      }, ICE_STAGNATION_TIMEOUT);
    };

    const switchIcePolicy = async (peerId: string, newPolicy: 'direct' | 'relay-only', reason: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn) return;

      const timeSinceLastSwitch = Date.now() - peerConn.lastIcePolicySwitch;
      if (timeSinceLastSwitch < ICE_POLICY_SWITCH_COOLDOWN) {
        console.log(`[WebRTC ICE] Policy switch cooldown active for ${peerId}, skipping`);
        return;
      }

      console.log(`[WebRTC ICE] Switching ICE policy for ${peerId} to ${newPolicy}. Reason: ${reason}`);
      
      peerConn.icePolicy = newPolicy;
      peerConn.icePolicySwitchCount++;
      peerConn.lastIcePolicySwitch = Date.now();

      updateIcePolicy.mutate({
        mode: newPolicy,
        successRate: BigInt(peerConn.connectionAttempts > 0 ? Math.round((1 / peerConn.connectionAttempts) * 100) : 0),
      });

      peerConn.pc.close();

      const newConfig = getRtcConfiguration(newPolicy, peerConn.tcpFallbackAttempted, peerConn.turnCredentials);
      const newPc = new RTCPeerConnection(newConfig);
      
      peerConn.pc = newPc;
      
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          newPc.addTrack(track, localStream);
        });
      }

      setupPeerConnectionHandlers(peerId, peerConn);

      try {
        const offer = await newPc.createOffer({ iceRestart: true });
        await newPc.setLocalDescription(offer);
        
        sendSignalingMessage.mutate({
          receiver: peerId,
          messageType: 'offer',
          payload: JSON.stringify(offer),
        });

        console.log(`[WebRTC ICE] New offer sent with ${newPolicy} policy to ${peerId}`);
        toast.info(`Switched to ${newPolicy === 'relay-only' ? 'relay' : 'direct'} connection mode`);
      } catch (error) {
        console.error(`[WebRTC ICE] Failed to create offer with new policy for ${peerId}:`, error);
      }

      updateDebugInfo();
    };

    const monitorConnectionEstablishment = (peerId: string, peerConn: PeerConnection) => {
      let iceGatheringTimer: NodeJS.Timeout | undefined;
      let connectionTimer: NodeJS.Timeout | undefined;

      iceGatheringTimer = setTimeout(() => {
        if (peerConn.pc.iceGatheringState !== 'complete') {
          console.log(`[WebRTC ICE] ICE gathering timeout for ${peerId}, switching to relay-only`);
          switchIcePolicy(peerId, 'relay-only', 'ICE gathering timeout');
        }
      }, ICE_GATHERING_TIMEOUT);

      connectionTimer = setTimeout(() => {
        if (peerConn.pc.connectionState !== 'connected') {
          console.log(`[WebRTC ICE] Connection timeout for ${peerId}, attempting TCP fallback`);
          attemptTcpFallback(peerId, 'Connection establishment timeout');
        }
      }, CONNECTION_TIMEOUT);

      const clearTimers = () => {
        if (iceGatheringTimer) clearTimeout(iceGatheringTimer);
        if (connectionTimer) clearTimeout(connectionTimer);
      };

      peerConn.pc.onicegatheringstatechange = () => {
        if (peerConn.pc.iceGatheringState === 'complete') {
          console.log(`[WebRTC ICE] ICE gathering complete for ${peerId}`);
          if (iceGatheringTimer) clearTimeout(iceGatheringTimer);
        }
      };

      const originalConnectionStateChange = peerConn.pc.onconnectionstatechange;
      
      peerConn.pc.onconnectionstatechange = (event) => {
        if (peerConn.pc.connectionState === 'connected') {
          clearTimers();
        } else if (peerConn.pc.connectionState === 'failed') {
          clearTimers();
          if (peerConn.icePolicy === 'direct') {
            switchIcePolicy(peerId, 'relay-only', 'Connection failed');
          } else {
            attemptTcpFallback(peerId, 'Connection failed in relay-only mode');
          }
        }
        if (originalConnectionStateChange) {
          originalConnectionStateChange.call(peerConn.pc, event);
        }
      };

      monitorIceStagnation(peerId, peerConn);
    };

    const restartLocalVideoCapture = async () => {
      if (localStreamHealthRef.current.isRecovering) {
        console.log('[WebRTC Local] Already recovering local stream, skipping restart');
        return;
      }

      console.log('[WebRTC Local] Restarting local video capture due to stall');
      localStreamHealthRef.current.isRecovering = true;
      setLocalStreamStatus('recovering');
      toast.info('Restarting camera...');

      try {
        if (localStream) {
          const videoTracks = localStream.getVideoTracks();
          videoTracks.forEach(track => {
            console.log('[WebRTC Local] Stopping stalled video track');
            track.stop();
          });
        }

        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: DEFAULT_QUALITY.width },
            height: { ideal: DEFAULT_QUALITY.height },
            frameRate: { ideal: 30 },
          },
        });

        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        if (!newVideoTrack) {
          throw new Error('Failed to get new video track');
        }

        newVideoTrack.enabled = isVideoEnabled;

        if (localStream) {
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStream.removeTrack(oldVideoTrack);
          }
          localStream.addTrack(newVideoTrack);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }

          for (const [peerId, peerConn] of peerConnectionsRef.current.entries()) {
            const senders = peerConn.pc.getSenders();
            const videoSender = senders.find(sender => sender.track?.kind === 'video');
            
            if (videoSender) {
              try {
                await videoSender.replaceTrack(newVideoTrack);
                console.log(`[WebRTC Local] Replaced video track for peer ${peerId}`);
                
                await applyQualityConstraints(peerId, peerConn.currentQuality);
              } catch (error) {
                console.error(`[WebRTC Local] Error replacing track for ${peerId}:`, error);
              }
            }
          }

          console.log('[WebRTC Local] Local video capture restarted successfully');
          toast.success('Camera restarted successfully');
          setLocalStreamStatus('active');
          localStreamHealthRef.current.consecutiveStalls = 0;
        }
      } catch (error) {
        console.error('[WebRTC Local] Error restarting local video capture:', error);
        toast.error('Failed to restart camera');
        setLocalStreamStatus('stalled');
      } finally {
        localStreamHealthRef.current.isRecovering = false;
      }
    };

    const checkLocalStreamHealth = async () => {
      if (!localStream || !isVideoEnabled || localStreamHealthRef.current.isRecovering) {
        return;
      }

      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.log('[WebRTC Local] No video track found in local stream');
        return;
      }

      if (videoTrack.readyState === 'ended') {
        console.log('[WebRTC Local] Video track ended unexpectedly, restarting');
        await restartLocalVideoCapture();
        return;
      }

      if (localVideoRef.current) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx && localVideoRef.current.videoWidth > 0) {
            canvas.width = localVideoRef.current.videoWidth;
            canvas.height = localVideoRef.current.videoHeight;
            ctx.drawImage(localVideoRef.current, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixelSum = imageData.data.reduce((sum, val) => sum + val, 0);
            
            if (pixelSum === localStreamHealthRef.current.lastFrameCount && pixelSum > 0) {
              localStreamHealthRef.current.consecutiveStalls++;
              console.log(`[WebRTC Local] Local video appears frozen (stall count: ${localStreamHealthRef.current.consecutiveStalls})`);
              
              if (localStreamHealthRef.current.consecutiveStalls >= FROZEN_FRAME_THRESHOLD) {
                console.log('[WebRTC Local] Local video stalled, initiating restart');
                setLocalStreamStatus('stalled');
                await restartLocalVideoCapture();
              }
            } else {
              if (localStreamHealthRef.current.consecutiveStalls > 0) {
                console.log('[WebRTC Local] Local video recovered');
                setLocalStreamStatus('active');
              }
              localStreamHealthRef.current.consecutiveStalls = 0;
              localStreamHealthRef.current.lastFrameCount = pixelSum;
            }
          }
        } catch (error) {
          console.error('[WebRTC Local] Error checking local stream health:', error);
        }
      }

      localStreamHealthRef.current.lastCheck = Date.now();
    };

    const applyQualityConstraints = async (peerId: string, quality: QualityLevel) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn || !localStream) return;

      try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        await videoTrack.applyConstraints({
          width: { ideal: quality.width },
          height: { ideal: quality.height },
          frameRate: { ideal: 30 },
        });

        const senders = peerConn.pc.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');
        
        if (videoSender) {
          const parameters = videoSender.getParameters();
          
          if (!parameters.encodings || parameters.encodings.length === 0) {
            parameters.encodings = [{}];
          }

          parameters.encodings[0].maxBitrate = quality.maxBitrate * 1000;
          
          await videoSender.setParameters(parameters);
          
          peerConn.currentQuality = quality;
          console.log(`[WebRTC Adaptive] Applied ${quality.name} quality to ${peerId}: ${quality.width}x${quality.height} @ ${quality.maxBitrate}kbps`);
        }
      } catch (error) {
        console.error(`[WebRTC Adaptive] Error applying quality constraints for ${peerId}:`, error);
      }
    };

    const collectNetworkStats = async (peerId: string): Promise<NetworkStats | null> => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn) return null;

      try {
        const stats = await peerConn.pc.getStats();
        let networkStats: NetworkStats = {
          bitrate: 0,
          packetLoss: 0,
          jitter: 0,
          rtt: 0,
          bytesReceived: 0,
          bytesSent: 0,
          timestamp: Date.now(),
        };

        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.bytesSent !== undefined) {
              networkStats.bytesSent = report.bytesSent;
              
              if (peerConn.networkStats.bytesSent > 0) {
                const timeDiff = (networkStats.timestamp - peerConn.networkStats.timestamp) / 1000;
                const bytesDiff = networkStats.bytesSent - peerConn.networkStats.bytesSent;
                networkStats.bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000);
              }
            }
          }

          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.bytesReceived !== undefined) {
              networkStats.bytesReceived = report.bytesReceived;
            }
            if (report.jitter !== undefined) {
              networkStats.jitter = Math.round(report.jitter * 1000);
            }
            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              const totalPackets = report.packetsLost + report.packetsReceived;
              if (totalPackets > 0) {
                networkStats.packetLoss = (report.packetsLost / totalPackets) * 100;
              }
            }
          }

          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            if (report.roundTripTime !== undefined) {
              networkStats.rtt = Math.round(report.roundTripTime * 1000);
            }
          }
        });

        return networkStats;
      } catch (error) {
        console.error(`[WebRTC Stats] Error collecting stats for ${peerId}:`, error);
        return null;
      }
    };

    const adjustQualityBasedOnNetwork = async (peerId: string, stats: NetworkStats) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn || peerConn.qualityAdjustmentInProgress) return;

      const timeSinceLastAdjustment = Date.now() - peerConn.lastNetworkStatsUpdate;
      if (timeSinceLastAdjustment < QUALITY_ADJUSTMENT_COOLDOWN) {
        return;
      }

      const currentQuality = peerConn.currentQuality;
      const currentQualityIndex = QUALITY_LEVELS.findIndex(q => q.name === currentQuality.name);
      
      let newQualityIndex = currentQualityIndex;
      let reason = '';

      const packetLossThresholdHigh = isMobileRef.current ? 3 : PACKET_LOSS_THRESHOLD_HIGH;
      const packetLossThresholdLow = isMobileRef.current ? 1 : PACKET_LOSS_THRESHOLD_LOW;

      if (stats.packetLoss > packetLossThresholdHigh) {
        if (currentQualityIndex > 0) {
          newQualityIndex = currentQualityIndex - 1;
          reason = `High packet loss (${stats.packetLoss.toFixed(1)}%)`;
        }
      } else if (stats.bitrate > 0 && stats.bitrate < currentQuality.maxBitrate * BITRATE_THRESHOLD_RATIO) {
        if (currentQualityIndex > 0) {
          newQualityIndex = currentQualityIndex - 1;
          reason = `Low bitrate (${stats.bitrate}kbps < ${Math.round(currentQuality.maxBitrate * BITRATE_THRESHOLD_RATIO)}kbps)`;
        }
      }
      else if (stats.packetLoss < packetLossThresholdLow && stats.bitrate > currentQuality.maxBitrate * 0.9) {
        if (currentQualityIndex < QUALITY_LEVELS.length - 1) {
          newQualityIndex = currentQualityIndex + 1;
          reason = `Good network conditions (loss: ${stats.packetLoss.toFixed(1)}%, bitrate: ${stats.bitrate}kbps)`;
        }
      }

      if (newQualityIndex !== currentQualityIndex) {
        const newQuality = QUALITY_LEVELS[newQualityIndex];
        console.log(`[WebRTC Adaptive] Adjusting quality for ${peerId}: ${currentQuality.name} → ${newQuality.name}. Reason: ${reason}`);
        
        peerConn.qualityAdjustmentInProgress = true;
        peerConn.lastNetworkStatsUpdate = Date.now();
        
        await applyQualityConstraints(peerId, newQuality);
        
        peerConn.qualityAdjustmentInProgress = false;
        
        toast.info(`Video quality adjusted to ${newQuality.name} for peer ${peerId.substring(0, 4)}...`);
      }
    };

    const monitorNetworkStats = async () => {
      for (const [peerId, peerConn] of peerConnectionsRef.current.entries()) {
        if (peerConn.pc.connectionState !== 'connected') continue;

        const stats = await collectNetworkStats(peerId);
        if (stats) {
          peerConn.networkStats = stats;
          
          await adjustQualityBasedOnNetwork(peerId, stats);
        }
      }
      
      updateDebugInfo();
    };

    useImperativeHandle(ref, () => ({
      cleanup: async () => {
        if (cleanupInProgressRef.current) {
          console.log('[WebRTC] Cleanup already in progress, skipping');
          return;
        }

        cleanupInProgressRef.current = true;
        console.log('[WebRTC] Starting cleanup...');
        
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }

        if (networkStatsIntervalRef.current) {
          clearInterval(networkStatsIntervalRef.current);
          networkStatsIntervalRef.current = null;
        }

        if (localStreamCheckIntervalRef.current) {
          clearInterval(localStreamCheckIntervalRef.current);
          localStreamCheckIntervalRef.current = null;
        }

        peerConnectionsRef.current.forEach((peerConn, peerId) => {
          console.log(`[WebRTC] Closing connection to ${peerId}`);
          if (peerConn.reconnectTimer) {
            clearTimeout(peerConn.reconnectTimer);
          }
          if (peerConn.iceStagnationTimer) {
            clearTimeout(peerConn.iceStagnationTimer);
          }
          peerConn.pc.close();
        });
        peerConnectionsRef.current.clear();

        if (localStream) {
          console.log('[WebRTC] Stopping local media tracks');
          localStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`[WebRTC] Stopped ${track.kind} track`);
          });
          setLocalStream(null);
        }

        try {
          await clearSignalingMessages.mutateAsync();
          console.log('[WebRTC] Cleared signaling messages');
        } catch (error) {
          console.error('[WebRTC] Error clearing signaling messages:', error);
        }

        makingOfferRef.current.clear();
        ignoreOfferRef.current.clear();
        processedMessagesRef.current.clear();
        previousActivePeersRef.current.clear();
        setDebugInfo([]);

        console.log('[WebRTC] Cleanup complete');
        cleanupInProgressRef.current = false;
      },
    }));

    const updateDebugInfo = () => {
      const info: PeerDebugInfo[] = [];
      peerConnectionsRef.current.forEach((peerConn, sessionId) => {
        const remoteTrackCount = peerConn.stream?.getTracks().length || 0;
        
        const turnRetryInfo: TurnRetryInfo = {
          retryCount: peerConn.turnRetryCount,
          lastRetryTimestamp: peerConn.lastTurnRetry,
          tcpFallbackAttempted: peerConn.tcpFallbackAttempted,
        };

        const errorRecoveryInfo: ErrorRecoveryInfo = {
          recoveryCount: peerConn.errorRecoveryCount,
          lastRecoveryTimestamp: peerConn.lastErrorRecovery,
        };

        info.push({
          sessionId,
          connectionState: peerConn.pc.connectionState,
          iceConnectionState: peerConn.pc.iceConnectionState,
          signalingState: peerConn.pc.signalingState,
          remoteTrackCount,
          hasRemoteDescription: !!peerConn.pc.remoteDescription,
          hasLocalDescription: !!peerConn.pc.localDescription,
          localCandidatesCount: peerConn.localCandidatesCount,
          remoteCandidatesCount: peerConn.remoteCandidatesCount,
          usingRelay: peerConn.usingRelay,
          reconnectAttempts: peerConn.reconnectAttempts,
          trackStatus: peerConn.trackStatus,
          isReconnecting: peerConn.isReconnecting,
          currentQuality: peerConn.currentQuality.name,
          bitrate: peerConn.networkStats.bitrate,
          packetLoss: peerConn.networkStats.packetLoss,
          resolution: `${peerConn.currentQuality.width}x${peerConn.currentQuality.height}`,
          jitter: peerConn.networkStats.jitter,
          rtt: peerConn.networkStats.rtt,
          icePolicy: peerConn.icePolicy,
          icePolicySwitchCount: peerConn.icePolicySwitchCount,
          networkPathProbe: peerConn.networkPathProbe,
          turnRetryInfo,
          errorRecoveryInfo,
          mobileOptimized: peerConn.mobileOptimizedRetries,
        });
      });
      setDebugInfo(info);
    };

    const getReconnectDelay = (attempt: number): number => {
      const baseDelay = isMobileRef.current ? MOBILE_BASE_RECONNECT_DELAY : BASE_RECONNECT_DELAY;
      return baseDelay * Math.pow(2, attempt);
    };

    const getMaxReconnectAttempts = (): number => {
      return isMobileRef.current ? MAX_MOBILE_RECONNECT_ATTEMPTS : MAX_RECONNECT_ATTEMPTS;
    };

    const performHealthCheck = async () => {
      for (const [peerId, peerConn] of peerConnectionsRef.current.entries()) {
        if (peerConn.pc.connectionState !== 'connected') continue;

        try {
          const stats = await peerConn.pc.getStats();
          let bytesReceived = 0;
          let framesDecoded = 0;
          let hasActiveInbound = false;
          let hasVideoTrack = false;

          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              hasActiveInbound = true;
              if (report.bytesReceived !== undefined) {
                bytesReceived += report.bytesReceived;
              }
              if (report.framesDecoded !== undefined) {
                framesDecoded = report.framesDecoded;
              }
            }
          });

          if (peerConn.stream) {
            const videoTracks = peerConn.stream.getVideoTracks();
            hasVideoTrack = videoTracks.length > 0 && videoTracks[0].readyState === 'live';
          }

          const bytesDiff = bytesReceived - peerConn.lastBytesReceived;
          const framesDiff = framesDecoded - peerConn.lastFramesDecoded;
          const isStalled = hasActiveInbound && bytesDiff === 0 && peerConn.lastBytesReceived > 0;
          const hasFrozenFrames = hasActiveInbound && framesDiff === 0 && peerConn.lastFramesDecoded > 0;
          const noVideoTrack = !hasVideoTrack && (Date.now() - peerConn.lastVideoTrackCheck) > VIDEO_TRACK_TIMEOUT;

          if (hasFrozenFrames || isStalled) {
            peerConn.consecutiveFrozenChecks++;
          } else {
            peerConn.consecutiveFrozenChecks = 0;
          }

          if (peerConn.consecutiveFrozenChecks >= FROZEN_FRAME_THRESHOLD || noVideoTrack) {
            if (peerConn.trackStatus !== 'recovering' && peerConn.trackStatus !== 'stalled') {
              console.log(`[WebRTC Health] Stream issue detected for ${peerId}:`, {
                frozenChecks: peerConn.consecutiveFrozenChecks,
                noVideoTrack,
                bytesDiff,
                framesDiff,
              });
              peerConn.trackStatus = 'stalled';
              updateDebugInfo();
              
              await performRenegotiation(peerId);
            }
          } else if (bytesReceived > 0 && bytesDiff > 0 && framesDiff > 0) {
            if (peerConn.trackStatus !== 'active') {
              console.log(`[WebRTC Health] Stream recovered for ${peerId}`);
              peerConn.trackStatus = 'active';
              peerConn.consecutiveFrozenChecks = 0;
              toast.success(`Video stream recovered for peer ${peerId.substring(0, 4)}...`);
              updateDebugInfo();
            }
          }

          peerConn.lastBytesReceived = bytesReceived;
          peerConn.lastFramesDecoded = framesDecoded;
          if (hasVideoTrack) {
            peerConn.lastVideoTrackCheck = Date.now();
          }
          peerConn.lastStatsCheck = stats;
        } catch (error) {
          console.error(`[WebRTC Health] Error checking stats for ${peerId}:`, error);
        }
      }
    };

    const performRenegotiation = async (peerId: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn || peerConn.isReconnecting) return;

      console.log(`[WebRTC Revalidation] Performing renegotiation with ${peerId} due to video track issues`);
      peerConn.trackStatus = 'recovering';
      peerConn.isReconnecting = true;
      updateDebugInfo();
      toast.info(`Recovering video stream for peer ${peerId.substring(0, 4)}...`);
      addBadge('renegotiation', undefined, 'initiated');

      try {
        const offer = await peerConn.pc.createOffer({ iceRestart: true });
        await peerConn.pc.setLocalDescription(offer);
        
        sendSignalingMessage.mutate({
          receiver: peerId,
          messageType: 'offer',
          payload: JSON.stringify(offer),
        });

        console.log(`[WebRTC Revalidation] Renegotiation offer sent to ${peerId}`);
        
        peerConn.consecutiveFrozenChecks = 0;
        
        setTimeout(() => {
          if (peerConn.trackStatus === 'recovering') {
            console.log(`[WebRTC Revalidation] Recovery timeout for ${peerId}`);
            peerConn.trackStatus = 'stalled';
            peerConn.isReconnecting = false;
            addBadge('revalidation-failure', 'video', 'timeout');
            updateDebugInfo();
          }
        }, 10000);
      } catch (error) {
        console.error(`[WebRTC Revalidation] Renegotiation failed for ${peerId}:`, error);
        peerConn.trackStatus = 'stalled';
        peerConn.isReconnecting = false;
        addBadge('revalidation-failure', 'video', 'error');
        updateDebugInfo();
      }
    };

    const attemptReconnection = async (peerId: string) => {
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (!peerConn) return;

      const maxAttempts = getMaxReconnectAttempts();

      if (peerConn.reconnectAttempts >= maxAttempts) {
        console.log(`[WebRTC] Max reconnection attempts reached for ${peerId}, marking as disconnected`);
        peerConn.isReconnecting = false;
        peerConn.trackStatus = 'stalled';
        updateDebugInfo();
        toast.error(`Connection to peer ${peerId} failed after ${maxAttempts} attempts`);
        return;
      }

      peerConn.reconnectAttempts++;
      peerConn.isReconnecting = true;
      peerConn.trackStatus = 'recovering';
      updateDebugInfo();

      const delay = getReconnectDelay(peerConn.reconnectAttempts - 1);
      console.log(`[WebRTC] Reconnection attempt ${peerConn.reconnectAttempts}/${maxAttempts} for ${peerId} in ${delay}ms`);

      peerConn.reconnectTimer = setTimeout(async () => {
        try {
          if (!activePeers?.includes(peerId)) {
            console.log(`[WebRTC] Peer ${peerId} no longer active, aborting reconnection`);
            handlePeerDisconnect(peerId);
            return;
          }

          console.log(`[WebRTC] Initiating ICE restart for ${peerId}`);
          const offer = await peerConn.pc.createOffer({ iceRestart: true });
          await peerConn.pc.setLocalDescription(offer);
          
          sendSignalingMessage.mutate({
            receiver: peerId,
            messageType: 'offer',
            payload: JSON.stringify(offer),
          });

          console.log(`[WebRTC] ICE restart offer sent to ${peerId}`);
        } catch (error) {
          console.error(`[WebRTC] Reconnection attempt failed for ${peerId}:`, error);
          if (peerConn.reconnectAttempts < maxAttempts) {
            attemptReconnection(peerId);
          } else {
            peerConn.isReconnecting = false;
            peerConn.trackStatus = 'stalled';
            updateDebugInfo();
          }
        }
      }, delay);
    };

    // FULL MESH RENEGOTIATION: Trigger renegotiation for ALL peers when room membership changes
    const triggerFullMeshRenegotiation = async (reason: string) => {
      // Check cooldown to prevent rapid renegotiations
      const timeSinceLastRenegotiation = Date.now() - lastFullMeshRenegotiationRef.current;
      if (timeSinceLastRenegotiation < RENEGOTIATION_COOLDOWN) {
        console.log(`[WebRTC Mesh] Renegotiation cooldown active, skipping (${timeSinceLastRenegotiation}ms since last)`);
        return;
      }

      if (renegotiationInProgressRef.current) {
        console.log('[WebRTC Mesh] Renegotiation already in progress, skipping');
        return;
      }

      if (peerConnectionsRef.current.size === 0) {
        console.log('[WebRTC Mesh] No peers to renegotiate with');
        return;
      }

      renegotiationInProgressRef.current = true;
      lastFullMeshRenegotiationRef.current = Date.now();
      setIsRenegotiating(true);

      console.log(`[WebRTC Mesh] ========== FULL MESH RENEGOTIATION TRIGGERED ==========`);
      console.log(`[WebRTC Mesh] Reason: ${reason}`);
      console.log(`[WebRTC Mesh] Current peers: ${Array.from(peerConnectionsRef.current.keys()).join(', ')}`);
      
      toast.info('Synchronizing connections with all peers...');
      logEvent('full-mesh-renegotiation', `Triggered: ${reason}`, 'info');
      addBadge('full-mesh-sync', undefined, 'initiated');

      try {
        const renegotiationPromises: Promise<void>[] = [];

        // Renegotiate with ALL existing peers
        for (const [peerId, peerConn] of peerConnectionsRef.current.entries()) {
          console.log(`[WebRTC Mesh] Initiating renegotiation with peer ${peerId}`);
          
          const renegotiatePromise = (async () => {
            try {
              // Mark as renegotiating
              peerConn.renegotiationInProgress = true;
              peerConn.lastRenegotiation = Date.now();

              // Create new offer
              const offer = await peerConn.pc.createOffer({ iceRestart: false });
              await peerConn.pc.setLocalDescription(offer);
              
              // Send offer to peer
              sendSignalingMessage.mutate({
                receiver: peerId,
                messageType: 'offer',
                payload: JSON.stringify(offer),
              });

              console.log(`[WebRTC Mesh] Renegotiation offer sent to ${peerId}`);
              logEvent('mesh-renegotiation', `Offer sent to peer ${peerId}`, 'info', peerId);
              
            } catch (error) {
              console.error(`[WebRTC Mesh] Failed to renegotiate with ${peerId}:`, error);
              logEvent('mesh-renegotiation-failed', `Failed for peer ${peerId}: ${error}`, 'error', peerId);
              peerConn.renegotiationInProgress = false;
            }
          })();

          renegotiationPromises.push(renegotiatePromise);
        }

        // Wait for all renegotiation offers to be sent
        await Promise.all(renegotiationPromises);

        console.log(`[WebRTC Mesh] All renegotiation offers sent successfully`);
        toast.success('Connection synchronization initiated');
        addBadge('full-mesh-sync', undefined, 'success');

        // Set timeout to clear renegotiation state
        setTimeout(() => {
          renegotiationInProgressRef.current = false;
          setIsRenegotiating(false);
          
          // Clear individual peer renegotiation flags
          peerConnectionsRef.current.forEach((peerConn) => {
            peerConn.renegotiationInProgress = false;
          });

          // Validate mesh completeness
          validateMeshCompleteness();
          
          updateDebugInfo();
        }, 5000); // 5 second timeout

      } catch (error) {
        console.error('[WebRTC Mesh] Error during full mesh renegotiation:', error);
        renegotiationInProgressRef.current = false;
        setIsRenegotiating(false);
        toast.error('Failed to synchronize connections');
        logEvent('full-mesh-renegotiation-failed', `Failed: ${error}`, 'error');
        addBadge('full-mesh-sync', undefined, 'failure');
      }

      console.log(`[WebRTC Mesh] ========== FULL MESH RENEGOTIATION COMPLETE ==========`);
    };

    // Validate that we have connections to all expected peers
    const validateMeshCompleteness = () => {
      if (!activePeers || activePeers.length === 0) {
        console.log('[WebRTC Mesh] No active peers to validate');
        return;
      }

      const expectedPeers = activePeers.filter(peerId => peerId !== currentSessionId);
      const connectedPeers = Array.from(peerConnectionsRef.current.keys());
      
      const missingPeers = expectedPeers.filter(peerId => !connectedPeers.includes(peerId));
      const extraPeers = connectedPeers.filter(peerId => !expectedPeers.includes(peerId));

      if (missingPeers.length > 0) {
        console.log(`[WebRTC Mesh] Missing connections to peers: ${missingPeers.join(', ')}`);
        toast.warning(`Missing connections to ${missingPeers.length} peer(s), reconnecting...`);
        
        // Create connections to missing peers
        missingPeers.forEach(peerId => {
          console.log(`[WebRTC Mesh] Creating missing connection to ${peerId}`);
          createPeerConnection(peerId);
        });
      }

      if (extraPeers.length > 0) {
        console.log(`[WebRTC Mesh] Extra connections to peers: ${extraPeers.join(', ')}`);
        
        // Clean up extra connections
        extraPeers.forEach(peerId => {
          console.log(`[WebRTC Mesh] Removing extra connection to ${peerId}`);
          handlePeerDisconnect(peerId);
        });
      }

      if (missingPeers.length === 0 && extraPeers.length === 0) {
        console.log('[WebRTC Mesh] Mesh is complete - all expected connections established');
      }
    };

    const setupPeerConnectionHandlers = (peerId: string, peerConn: PeerConnection) => {
      const pc = peerConn.pc;

      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received ${event.track.kind} track from ${peerId}`);
        const [remoteStream] = event.streams;
        peerConn.stream = remoteStream;
        peerConn.trackStatus = 'active';
        peerConn.lastVideoTrackCheck = Date.now();
        peerConn.consecutiveFrozenChecks = 0;
        addBadge('track-started', event.track.kind, 'success');
        
        event.track.onended = () => {
          console.log(`[WebRTC] Track ${event.track.kind} ended for ${peerId}, triggering revalidation`);
          peerConn.trackStatus = 'stalled';
          addBadge('track-ended', event.track.kind, undefined);
          updateDebugInfo();
          performRenegotiation(peerId);
        };
        
        event.track.onmute = () => {
          console.log(`[WebRTC] Track ${event.track.kind} muted for ${peerId}`);
          if (event.track.kind === 'video') {
            peerConn.trackStatus = 'recovering';
            updateDebugInfo();
          }
        };
        
        event.track.onunmute = () => {
          console.log(`[WebRTC] Track ${event.track.kind} unmuted for ${peerId}`);
          if (event.track.kind === 'video') {
            peerConn.trackStatus = 'active';
            updateDebugInfo();
          }
        };
        
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(peerId, remoteStream);
          return newMap;
        });
        updateDebugInfo();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          peerConn.localCandidatesCount++;
          
          if (event.candidate.type === 'relay') {
            peerConn.usingRelay = true;
            console.log(`[WebRTC] Generated TURN relay candidate #${peerConn.localCandidatesCount} for ${peerId}`);
            addBadge('turn-active', undefined, 'success');
          } else {
            console.log(`[WebRTC] Generated local ICE candidate #${peerConn.localCandidatesCount} for ${peerId}: ${event.candidate.type}`);
          }
          
          sendSignalingMessage.mutate({
            receiver: peerId,
            messageType: 'ice-candidate',
            payload: JSON.stringify(event.candidate),
          });
          updateDebugInfo();
        } else {
          console.log(`[WebRTC] ICE candidate gathering complete for ${peerId}`);
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          console.log(`[WebRTC] Negotiation needed for ${peerId}`);
          makingOfferRef.current.set(peerId, true);
          await pc.setLocalDescription();
          
          sendSignalingMessage.mutate({
            receiver: peerId,
            messageType: 'offer',
            payload: JSON.stringify(pc.localDescription),
          });
          
          console.log(`[WebRTC] Sent offer to ${peerId} (negotiation needed)`);
        } catch (error) {
          console.error(`[WebRTC] Error during negotiation for ${peerId}:`, error);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state changed for ${peerId}: ${pc.connectionState}`);
        peerConn.lastIceStateChange = Date.now();
        updateDebugInfo();
        
        if (pc.connectionState === 'connected') {
          peerConn.reconnectAttempts = 0;
          peerConn.isReconnecting = false;
          peerConn.trackStatus = 'active';
          peerConn.consecutiveFrozenChecks = 0;
          peerConn.connectionAttempts++;
          peerConn.renegotiationInProgress = false;
          if (peerConn.reconnectTimer) {
            clearTimeout(peerConn.reconnectTimer);
            peerConn.reconnectTimer = undefined;
          }
          if (peerConn.iceStagnationTimer) {
            clearTimeout(peerConn.iceStagnationTimer);
            peerConn.iceStagnationTimer = undefined;
          }
          updateDebugInfo();
        } else if (pc.connectionState === 'disconnected') {
          console.log(`[WebRTC] Connection disconnected for ${peerId}, attempting reconnection`);
          attemptReconnection(peerId);
        } else if (pc.connectionState === 'failed') {
          console.log(`[WebRTC] Connection failed for ${peerId}, attempting error recovery`);
          
          handleErrorRecovery(peerId, 0, 'Connection failed');
          
          attemptReconnection(peerId);
          
          if (peerConn.icePolicy === 'direct') {
            switchIcePolicy(peerId, 'relay-only', 'Connection failed');
          }
        } else if (pc.connectionState === 'closed') {
          handlePeerDisconnect(peerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE connection state changed for ${peerId}: ${pc.iceConnectionState}`);
        peerConn.lastIceStateChange = Date.now();
        
        if (pc.iceConnectionState === 'checking' || pc.iceConnectionState === 'new') {
          monitorIceStagnation(peerId, peerConn);
        } else {
          if (peerConn.iceStagnationTimer) {
            clearTimeout(peerConn.iceStagnationTimer);
            peerConn.iceStagnationTimer = undefined;
          }
        }
        
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          pc.getStats().then((stats) => {
            stats.forEach((report) => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                const localCandidateId = report.localCandidateId;
                const remoteCandidateId = report.remoteCandidateId;
                
                stats.forEach((candidateReport) => {
                  if (candidateReport.id === localCandidateId || candidateReport.id === remoteCandidateId) {
                    if (candidateReport.candidateType === 'relay') {
                      peerConn.usingRelay = true;
                      console.log(`[WebRTC] Connection to ${peerId} is using TURN relay`);
                    }
                  }
                });
              }
            });
            updateDebugInfo();
          });
          
          peerConn.reconnectAttempts = 0;
          peerConn.isReconnecting = false;
          if (peerConn.reconnectTimer) {
            clearTimeout(peerConn.reconnectTimer);
            peerConn.reconnectTimer = undefined;
          }
        } else if (pc.iceConnectionState === 'disconnected') {
          console.log(`[WebRTC] ICE disconnected for ${peerId}, attempting reconnection`);
          attemptReconnection(peerId);
        } else if (pc.iceConnectionState === 'failed') {
          console.log(`[WebRTC] ICE failed for ${peerId}, attempting error recovery`);
          
          handleErrorRecovery(peerId, 0, 'ICE connection failed');
          
          attemptReconnection(peerId);
          
          if (peerConn.icePolicy === 'direct') {
            switchIcePolicy(peerId, 'relay-only', 'ICE connection failed');
          } else {
            attemptTcpFallback(peerId, 'ICE failed in relay-only mode');
          }
        }
        
        updateDebugInfo();
      };

      pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling state changed for ${peerId}: ${pc.signalingState}`);
        updateDebugInfo();
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[WebRTC] ICE gathering state changed for ${peerId}: ${pc.iceGatheringState}`);
      };
    };

    useEffect(() => {
      const initLocalStream = async () => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
              width: { ideal: DEFAULT_QUALITY.width },
              height: { ideal: DEFAULT_QUALITY.height },
              frameRate: { ideal: 30 },
            },
          });
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          console.log('[WebRTC] Local media stream initialized with default quality:', DEFAULT_QUALITY.name);
          toast.success('Camera and microphone access granted');
          setLocalStreamStatus('active');
        } catch (error) {
          console.error('[WebRTC] Error accessing media devices:', error);
          toast.error('Failed to access camera/microphone. Please grant permissions.');
          setLocalStreamStatus('stalled');
        }
      };

      initLocalStream();
    }, []);

    useEffect(() => {
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = isAudioEnabled;
        });
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = isVideoEnabled;
        });
      }
    }, [isAudioEnabled, isVideoEnabled, localStream]);

    useEffect(() => {
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }, [localStream]);

    const createPeerConnection = (peerId: string): PeerConnection => {
      const initialIcePolicy: 'direct' | 'relay-only' = 'direct';
      const initialCredentials = DEFAULT_TURN_CREDENTIALS;
      const rtcConfig = getRtcConfiguration(initialIcePolicy, false, initialCredentials);
      console.log(`[WebRTC] Creating peer connection for ${peerId} with ICE policy: ${initialIcePolicy}`);
      
      const pc = new RTCPeerConnection(rtcConfig);
      
      const isPolite = currentSessionId < peerId;
      
      const peerConn: PeerConnection = {
        pc,
        iceCandidateQueue: [],
        localCandidatesCount: 0,
        remoteCandidatesCount: 0,
        usingRelay: false,
        reconnectAttempts: 0,
        trackStatus: 'active',
        isReconnecting: false,
        lastBytesReceived: 0,
        frozenFrameCount: 0,
        lastFramesDecoded: 0,
        consecutiveFrozenChecks: 0,
        lastVideoTrackCheck: Date.now(),
        isPolite,
        currentQuality: DEFAULT_QUALITY,
        networkStats: {
          bitrate: 0,
          packetLoss: 0,
          jitter: 0,
          rtt: 0,
          bytesReceived: 0,
          bytesSent: 0,
          timestamp: Date.now(),
        },
        lastNetworkStatsUpdate: 0,
        qualityAdjustmentInProgress: false,
        icePolicy: initialIcePolicy,
        icePolicySwitchCount: 0,
        lastIcePolicySwitch: 0,
        connectionAttempts: 0,
        networkPathProbe: {
          udpLatency: -1,
          tcpLatency: -1,
          packetLoss: 0,
          preferredRoute: 'unknown',
          status: 'probing',
          timestamp: Date.now(),
        },
        turnRetryCount: 0,
        lastTurnRetry: 0,
        turnCredentials: initialCredentials,
        tcpFallbackAttempted: false,
        lastErrorRecovery: 0,
        errorRecoveryCount: 0,
        lastIceStateChange: Date.now(),
        mobileOptimizedRetries: isMobileRef.current,
        renegotiationInProgress: false,
        lastRenegotiation: 0,
      };

      console.log(`[WebRTC] Peer ${peerId} politeness: ${isPolite ? 'polite' : 'impolite'}`);
      console.log(`[WebRTC] Peer ${peerId} mobile optimized: ${peerConn.mobileOptimizedRetries}`);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
          console.log(`[WebRTC] Added ${track.kind} track to peer ${peerId}`);
        });
        
        applyQualityConstraints(peerId, DEFAULT_QUALITY);
      }

      setupPeerConnectionHandlers(peerId, peerConn);

      monitorConnectionEstablishment(peerId, peerConn);

      performNetworkPathProbing(peerId).then((probe) => {
        peerConn.networkPathProbe = probe;
        updateDebugInfo();
      });

      peerConnectionsRef.current.set(peerId, peerConn);
      updateDebugInfo();
      return peerConn;
    };

    const handlePeerDisconnect = (peerId: string) => {
      console.log(`[WebRTC] Disconnecting peer ${peerId}`);
      const peerConn = peerConnectionsRef.current.get(peerId);
      if (peerConn) {
        if (peerConn.reconnectTimer) {
          clearTimeout(peerConn.reconnectTimer);
        }
        if (peerConn.iceStagnationTimer) {
          clearTimeout(peerConn.iceStagnationTimer);
        }
        peerConn.pc.close();
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
        makingOfferRef.current.delete(peerId);
        ignoreOfferRef.current.delete(peerId);
        updateDebugInfo();
      }
    };

    // Monitor active peers and trigger full mesh renegotiation on changes
    useEffect(() => {
      if (!activePeers || activePeers.length === 0 || !localStream) {
        if (peerConnectionsRef.current.size > 0) {
          console.log('[WebRTC] No active peers or no local stream, cleaning up all connections');
          peerConnectionsRef.current.forEach((peerConn, peerId) => {
            handlePeerDisconnect(peerId);
          });
        }
        previousActivePeersRef.current.clear();
        return;
      }

      const currentActivePeersSet = new Set(activePeers);
      const previousActivePeersSet = previousActivePeersRef.current;

      console.log(`[WebRTC] Active peers in room:`, activePeers);
      console.log(`[WebRTC] Current connections:`, Array.from(peerConnectionsRef.current.keys()));

      const newPeers = activePeers.filter(
        (peerId) => peerId !== currentSessionId && !previousActivePeersSet.has(peerId)
      );

      const leftPeers = Array.from(previousActivePeersSet).filter(
        (peerId) => !currentActivePeersSet.has(peerId)
      );

      // Detect if room membership changed
      const membershipChanged = newPeers.length > 0 || leftPeers.length > 0;

      if (newPeers.length > 0) {
        console.log(`[WebRTC] New peers detected:`, newPeers);
        newPeers.forEach((peerId) => {
          if (!peerConnectionsRef.current.has(peerId)) {
            console.log(`[WebRTC] Creating peer connection with new peer ${peerId}`);
            createPeerConnection(peerId);
          }
        });
      }

      activePeers.forEach((peerId) => {
        if (peerId !== currentSessionId && !peerConnectionsRef.current.has(peerId)) {
          console.log(`[WebRTC] Missing connection to active peer ${peerId}, creating connection`);
          createPeerConnection(peerId);
        }
      });

      if (leftPeers.length > 0) {
        console.log(`[WebRTC] Peers left:`, leftPeers);
        leftPeers.forEach((peerId) => {
          console.log(`[WebRTC] Peer ${peerId} left, cleaning up connection`);
          handlePeerDisconnect(peerId);
        });
      }

      peerConnectionsRef.current.forEach((peerConn, peerId) => {
        if (!currentActivePeersSet.has(peerId)) {
          console.log(`[WebRTC] Ghost connection detected for ${peerId}, cleaning up`);
          handlePeerDisconnect(peerId);
        }
      });

      // TRIGGER FULL MESH RENEGOTIATION when room membership changes
      if (membershipChanged && peerConnectionsRef.current.size > 0) {
        const reason = newPeers.length > 0 
          ? `New peer(s) joined: ${newPeers.join(', ')}`
          : `Peer(s) left: ${leftPeers.join(', ')}`;
        
        console.log(`[WebRTC Mesh] Room membership changed, triggering full mesh renegotiation`);
        triggerFullMeshRenegotiation(reason);
      }

      previousActivePeersRef.current = currentActivePeersSet;
    }, [activePeers, currentSessionId, localStream]);

    useEffect(() => {
      if (!signalingMessages || signalingMessages.length === 0 || !currentSessionId || !activePeers) return;

      const processMessages = async () => {
        let hasNewMessages = false;
        const activePeersSet = new Set(activePeers);

        for (const msg of signalingMessages) {
          if (msg.sender === currentSessionId) continue;

          if (!activePeersSet.has(msg.sender)) {
            console.log(`[WebRTC] Ignoring message from stale peer ${msg.sender}`);
            hasNewMessages = true;
            continue;
          }

          const messageKey = `${msg.sender}-${msg.messageType}-${msg.payload.substring(0, 100)}`;
          
          if (processedMessagesRef.current.has(messageKey)) continue;
          processedMessagesRef.current.add(messageKey);
          hasNewMessages = true;

          const peerId = msg.sender;

          try {
            if (msg.messageType === 'offer') {
              console.log(`[WebRTC] Received offer from ${peerId}`);
              const offer = JSON.parse(msg.payload);
              let peerConn = peerConnectionsRef.current.get(peerId);
              if (!peerConn) {
                peerConn = createPeerConnection(peerId);
              }

              const offerCollision = 
                (msg.messageType === 'offer') &&
                (makingOfferRef.current.get(peerId) || peerConn.pc.signalingState !== 'stable');

              ignoreOfferRef.current.set(peerId, !peerConn.isPolite && offerCollision);
              
              if (ignoreOfferRef.current.get(peerId)) {
                console.log(`[WebRTC] Ignoring offer from ${peerId} due to collision (we are impolite)`);
                continue;
              }

              await peerConn.pc.setRemoteDescription(new RTCSessionDescription(offer));
              console.log(`[WebRTC] Set remote description (offer) from ${peerId}`);
              
              console.log(`[WebRTC] Processing ${peerConn.iceCandidateQueue.length} queued ICE candidates for ${peerId}`);
              while (peerConn.iceCandidateQueue.length > 0) {
                const candidate = peerConn.iceCandidateQueue.shift();
                if (candidate) {
                  await peerConn.pc.addIceCandidate(candidate);
                  peerConn.remoteCandidatesCount++;
                  
                  if (candidate.type === 'relay') {
                    console.log(`[WebRTC] Added queued TURN relay candidate #${peerConn.remoteCandidatesCount} for ${peerId}`);
                  } else {
                    console.log(`[WebRTC] Added queued ICE candidate #${peerConn.remoteCandidatesCount} for ${peerId}`);
                  }
                }
              }

              await peerConn.pc.setLocalDescription();
              console.log(`[WebRTC] Set local description (answer) for ${peerId}`);

              sendSignalingMessage.mutate({
                receiver: peerId,
                messageType: 'answer',
                payload: JSON.stringify(peerConn.pc.localDescription),
              });
              
              if (peerConn.isReconnecting) {
                peerConn.isReconnecting = false;
              }
              
              updateDebugInfo();
            } else if (msg.messageType === 'answer') {
              console.log(`[WebRTC] Received answer from ${peerId}`);
              const answer = JSON.parse(msg.payload);
              const peerConn = peerConnectionsRef.current.get(peerId);
              if (peerConn) {
                await peerConn.pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`[WebRTC] Set remote description (answer) from ${peerId}`);
                
                console.log(`[WebRTC] Processing ${peerConn.iceCandidateQueue.length} queued ICE candidates for ${peerId}`);
                while (peerConn.iceCandidateQueue.length > 0) {
                  const candidate = peerConn.iceCandidateQueue.shift();
                  if (candidate) {
                    await peerConn.pc.addIceCandidate(candidate);
                    peerConn.remoteCandidatesCount++;
                    
                    if (candidate.type === 'relay') {
                      console.log(`[WebRTC] Added queued TURN relay candidate #${peerConn.remoteCandidatesCount} for ${peerId}`);
                    } else {
                      console.log(`[WebRTC] Added queued ICE candidate #${peerConn.remoteCandidatesCount} for ${peerId}`);
                    }
                  }
                }
                updateDebugInfo();
              }
            } else if (msg.messageType === 'ice-candidate') {
              const candidate = JSON.parse(msg.payload);
              const peerConn = peerConnectionsRef.current.get(peerId);
              if (peerConn) {
                try {
                  if (peerConn.pc.remoteDescription) {
                    await peerConn.pc.addIceCandidate(new RTCIceCandidate(candidate));
                    peerConn.remoteCandidatesCount++;
                    
                    if (candidate.type === 'relay') {
                      console.log(`[WebRTC] Added TURN relay candidate #${peerConn.remoteCandidatesCount} from ${peerId}`);
                    } else {
                      console.log(`[WebRTC] Added ICE candidate #${peerConn.remoteCandidatesCount} from ${peerId}: ${candidate.type}`);
                    }
                    updateDebugInfo();
                  } else {
                    peerConn.iceCandidateQueue.push(new RTCIceCandidate(candidate));
                    console.log(`[WebRTC] Queued ICE candidate from ${peerId} (no remote description yet)`);
                  }
                } catch (error) {
                  console.error(`[WebRTC] Error adding ICE candidate from ${peerId}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`[WebRTC] Error processing ${msg.messageType} from ${peerId}:`, error);
          }
        }

        if (hasNewMessages) {
          clearSignalingMessages.mutate();
        }
      };

      processMessages();
    }, [signalingMessages, currentSessionId, activePeers]);

    useEffect(() => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }

      healthCheckIntervalRef.current = setInterval(() => {
        performHealthCheck();
      }, HEALTH_CHECK_INTERVAL);

      return () => {
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (networkStatsIntervalRef.current) {
        clearInterval(networkStatsIntervalRef.current);
      }

      networkStatsIntervalRef.current = setInterval(() => {
        monitorNetworkStats();
      }, NETWORK_STATS_INTERVAL);

      return () => {
        if (networkStatsIntervalRef.current) {
          clearInterval(networkStatsIntervalRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (localStreamCheckIntervalRef.current) {
        clearInterval(localStreamCheckIntervalRef.current);
      }

      localStreamCheckIntervalRef.current = setInterval(() => {
        checkLocalStreamHealth();
      }, LOCAL_STREAM_CHECK_INTERVAL);

      return () => {
        if (localStreamCheckIntervalRef.current) {
          clearInterval(localStreamCheckIntervalRef.current);
        }
      };
    }, [localStream, isVideoEnabled]);

    useEffect(() => {
      const interval = setInterval(() => {
        updateDebugInfo();
      }, 1000);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      return () => {
        console.log('[WebRTC] Component unmounting, performing fallback cleanup');
        
        peerConnectionsRef.current.forEach((peerConn) => {
          if (peerConn.reconnectTimer) {
            clearTimeout(peerConn.reconnectTimer);
          }
          if (peerConn.iceStagnationTimer) {
            clearTimeout(peerConn.iceStagnationTimer);
          }
          peerConn.pc.close();
        });
        peerConnectionsRef.current.clear();

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }

        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }

        if (networkStatsIntervalRef.current) {
          clearInterval(networkStatsIntervalRef.current);
        }

        if (localStreamCheckIntervalRef.current) {
          clearInterval(localStreamCheckIntervalRef.current);
        }

        if (networkChangeDebounceTimerRef.current) {
          clearTimeout(networkChangeDebounceTimerRef.current);
        }

        makingOfferRef.current.clear();
        ignoreOfferRef.current.clear();
        previousActivePeersRef.current.clear();
      };
    }, []);

    return (
      <>
        <div className="space-y-4">
          {isReconnectingFromNetworkChange && networkChangeInfo && (
            <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-3">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="font-semibold">Network Change Detected</span>
              </div>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                Switched to {networkChangeInfo.type}
                {networkChangeInfo.effectiveType && ` (${networkChangeInfo.effectiveType})`}
                . Reconnecting all peers...
              </p>
            </div>
          )}

          {isRenegotiating && (
            <div className="rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950 p-3">
              <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="font-semibold">Synchronizing Connections</span>
              </div>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                Renegotiating with all peers to ensure complete mesh connectivity...
              </p>
            </div>
          )}

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white font-mono">
              You ({currentSessionId})
            </div>
            {localStreamStatus === 'recovering' && (
              <div className="absolute top-2 right-2 rounded bg-yellow-500/90 px-2 py-1 text-xs text-white font-semibold flex items-center gap-1">
                <span className="animate-spin">⟳</span>
                Restarting Camera
              </div>
            )}
            {localStreamStatus === 'stalled' && (
              <div className="absolute top-2 right-2 rounded bg-red-500/90 px-2 py-1 text-xs text-white font-semibold">
                ⚠ Camera Stalled
              </div>
            )}
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <p className="text-sm text-muted-foreground">Requesting camera access...</p>
              </div>
            )}
          </div>

          {remoteStreams.size > 0 && (
            <div className={`grid gap-4 ${
              remoteStreams.size === 1 ? 'grid-cols-1' :
              remoteStreams.size === 2 ? 'sm:grid-cols-2' :
              remoteStreams.size === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' :
              'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
                const peerConn = peerConnectionsRef.current.get(peerId);
                const trackStatus = peerConn?.trackStatus || 'active';
                
                return (
                  <div key={peerId} className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && el.srcObject !== stream) {
                          el.srcObject = stream;
                        }
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white font-mono">
                      {peerId}
                    </div>
                    {trackStatus === 'recovering' && (
                      <div className="absolute top-2 right-2 rounded bg-yellow-500/90 px-2 py-1 text-xs text-white font-semibold flex items-center gap-1">
                        <span className="animate-spin">⟳</span>
                        Recovering
                      </div>
                    )}
                    {trackStatus === 'stalled' && (
                      <div className="absolute top-2 right-2 rounded bg-red-500/90 px-2 py-1 text-xs text-white font-semibold">
                        ⚠ Stalled
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {remoteStreams.size === 0 && localStream && (
            <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
              Waiting for other participants to join...
            </div>
          )}
        </div>

        <WebRTCDebugPanel
          peers={debugInfo}
          localStreamActive={!!localStream}
          localStreamStatus={localStreamStatus}
          audioEnabled={isAudioEnabled}
          videoEnabled={isVideoEnabled}
          signalingMessageCount={signalingMessages?.length || 0}
          knownPeerCount={activePeers?.length || 0}
          isMobile={isMobileRef.current}
          mobileNetworkType={mobileNetworkTypeRef.current}
        />
      </>
    );
  }
);

WebRTCManager.displayName = 'WebRTCManager';

export default WebRTCManager;
