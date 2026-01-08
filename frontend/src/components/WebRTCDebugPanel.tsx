import { useState } from 'react';
import { Bug, ChevronDown, ChevronUp, Activity, Users, Radio, Video as VideoIcon, Wifi, RefreshCw, AlertTriangle, CheckCircle2, Gauge, Signal, Smartphone, Camera, Network, Zap, Download, TrendingUp, TrendingDown, Clock, Hash, GitBranch, Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface NetworkPathProbe {
  udpLatency: number;
  tcpLatency: number;
  packetLoss: number;
  preferredRoute: 'udp' | 'tcp' | 'unknown';
  status: 'probing' | 'complete' | 'failed';
  timestamp: number;
}

interface ICECandidateInfo {
  candidateId: string;
  candidateType: 'host' | 'srflx' | 'relay';
  isSelected: boolean;
  timestamp: number;
}

interface StateTransitionInfo {
  previousState: string;
  newState: string;
  timestamp: number;
  duration: number;
}

interface EventBadgeInfo {
  eventType: 'track-started' | 'track-ended' | 'renegotiation' | 'turn-active' | 'revalidation-success' | 'revalidation-failure' | 'turn-retry' | 'tcp-fallback' | 'error-recovery';
  timestamp: number;
  mediaType?: 'audio' | 'video';
  outcome?: 'success' | 'failure' | 'initiated';
}

export interface TurnRetryInfo {
  retryCount: number;
  lastRetryTimestamp: number;
  tcpFallbackAttempted: boolean;
}

export interface ErrorRecoveryInfo {
  recoveryCount: number;
  lastRecoveryTimestamp: number;
}

export interface PeerDebugInfo {
  sessionId: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  remoteTrackCount: number;
  hasRemoteDescription: boolean;
  hasLocalDescription: boolean;
  localCandidatesCount: number;
  remoteCandidatesCount: number;
  usingRelay: boolean;
  reconnectAttempts: number;
  trackStatus: 'active' | 'recovering' | 'stalled';
  isReconnecting: boolean;
  currentQuality?: string;
  bitrate?: number;
  packetLoss?: number;
  resolution?: string;
  jitter?: number;
  rtt?: number;
  icePolicy?: 'direct' | 'relay-only';
  icePolicySwitchCount?: number;
  networkPathProbe?: NetworkPathProbe;
  iceCandidates?: ICECandidateInfo[];
  stateTransitions?: StateTransitionInfo[];
  eventBadges?: EventBadgeInfo[];
  incomingAudioBitrate?: number;
  outgoingAudioBitrate?: number;
  incomingVideoBitrate?: number;
  outgoingVideoBitrate?: number;
  turnRetryInfo?: TurnRetryInfo;
  errorRecoveryInfo?: ErrorRecoveryInfo;
  mobileOptimized?: boolean;
}

interface WebRTCDebugPanelProps {
  peers: PeerDebugInfo[];
  localStreamActive: boolean;
  localStreamStatus?: 'active' | 'recovering' | 'stalled';
  audioEnabled: boolean;
  videoEnabled: boolean;
  signalingMessageCount: number;
  knownPeerCount: number;
  isMobile?: boolean;
  mobileNetworkType?: string;
  onExportSessionLog?: () => void;
}

export default function WebRTCDebugPanel({
  peers,
  localStreamActive,
  localStreamStatus = 'active',
  audioEnabled,
  videoEnabled,
  signalingMessageCount,
  knownPeerCount,
  isMobile = false,
  mobileNetworkType = 'unknown',
  onExportSessionLog,
}: WebRTCDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPeers, setExpandedPeers] = useState<Set<string>>(new Set());

  const togglePeerExpanded = (peerId: string) => {
    setExpandedPeers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(peerId)) {
        newSet.delete(peerId);
      } else {
        newSet.add(peerId);
      }
      return newSet;
    });
  };

  const getConnectionStateColor = (state: RTCPeerConnectionState) => {
    switch (state) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
      case 'failed':
        return 'bg-red-500';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getConnectionStateLabel = (state: RTCPeerConnectionState) => {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Failed';
      case 'closed':
        return 'Closed';
      default:
        return 'New';
    }
  };

  const getIceStateLabel = (state: RTCIceConnectionState) => {
    switch (state) {
      case 'connected':
      case 'completed':
        return 'ICE Connected';
      case 'checking':
        return 'ICE Checking';
      case 'disconnected':
        return 'ICE Disconnected';
      case 'failed':
        return 'ICE Failed';
      case 'closed':
        return 'ICE Closed';
      default:
        return 'ICE New';
    }
  };

  const getIceStateColor = (state: RTCIceConnectionState) => {
    switch (state) {
      case 'connected':
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'checking':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'disconnected':
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSignalingStateLabel = (state: RTCSignalingState) => {
    switch (state) {
      case 'stable':
        return 'Stable';
      case 'have-local-offer':
        return 'Awaiting Answer';
      case 'have-remote-offer':
        return 'Awaiting Offer';
      case 'have-local-pranswer':
      case 'have-remote-pranswer':
        return 'Provisional';
      case 'closed':
        return 'Closed';
      default:
        return state;
    }
  };

  const getTrackStatusBadge = (status: 'active' | 'recovering' | 'stalled') => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="text-xs flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
      case 'recovering':
        return (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Recovering
          </Badge>
        );
      case 'stalled':
        return (
          <Badge variant="destructive" className="text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Stalled
          </Badge>
        );
    }
  };

  const getLocalStreamStatusBadge = (status: 'active' | 'recovering' | 'stalled') => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="text-xs flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Active
          </Badge>
        );
      case 'recovering':
        return (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Restarting
          </Badge>
        );
      case 'stalled':
        return (
          <Badge variant="destructive" className="text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Stalled
          </Badge>
        );
    }
  };

  const getQualityBadgeVariant = (quality?: string) => {
    switch (quality) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPacketLossBadge = (packetLoss?: number) => {
    if (packetLoss === undefined) return null;
    
    if (packetLoss < 2) {
      return (
        <Badge variant="default" className="text-xs">
          {packetLoss.toFixed(1)}%
        </Badge>
      );
    } else if (packetLoss < 5) {
      return (
        <Badge variant="secondary" className="text-xs">
          {packetLoss.toFixed(1)}%
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          {packetLoss.toFixed(1)}%
        </Badge>
      );
    }
  };

  const getIcePolicyBadge = (policy?: 'direct' | 'relay-only') => {
    if (!policy) return null;
    
    if (policy === 'direct') {
      return (
        <Badge variant="default" className="text-xs flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Direct
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="text-xs flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          Relay-Only
        </Badge>
      );
    }
  };

  const getProbeStatusBadge = (status?: 'probing' | 'complete' | 'failed') => {
    if (!status) return null;
    
    switch (status) {
      case 'probing':
        return (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Probing
          </Badge>
        );
      case 'complete':
        return (
          <Badge variant="default" className="text-xs flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  const getCandidateTypeBadge = (type: 'host' | 'srflx' | 'relay', isSelected: boolean) => {
    const variant = isSelected ? 'default' : 'outline';
    const icon = type === 'relay' ? <Wifi className="h-3 w-3" /> : type === 'srflx' ? <Signal className="h-3 w-3" /> : <Network className="h-3 w-3" />;
    
    return (
      <Badge variant={variant} className="text-xs flex items-center gap-1">
        {icon}
        {type.toUpperCase()}
      </Badge>
    );
  };

  const getEventBadge = (badge: EventBadgeInfo) => {
    const getIcon = () => {
      switch (badge.eventType) {
        case 'track-started':
          return <Play className="h-3 w-3" />;
        case 'track-ended':
          return <Square className="h-3 w-3" />;
        case 'renegotiation':
          return <RotateCcw className="h-3 w-3" />;
        case 'turn-active':
          return <Wifi className="h-3 w-3" />;
        case 'revalidation-success':
          return <CheckCircle className="h-3 w-3" />;
        case 'revalidation-failure':
          return <XCircle className="h-3 w-3" />;
        case 'turn-retry':
          return <Repeat className="h-3 w-3" />;
        case 'tcp-fallback':
          return <Network className="h-3 w-3" />;
        case 'error-recovery':
          return <AlertCircle className="h-3 w-3" />;
      }
    };

    const getVariant = () => {
      if (badge.outcome === 'failure' || badge.eventType === 'track-ended' || badge.eventType === 'revalidation-failure') {
        return 'destructive';
      }
      if (badge.eventType === 'track-started' || badge.eventType === 'revalidation-success' || badge.outcome === 'success') {
        return 'default';
      }
      return 'secondary';
    };

    const getLabel = () => {
      const labels: Record<string, string> = {
        'track-started': 'Track Started',
        'track-ended': 'Track Ended',
        'renegotiation': 'Renegotiation',
        'turn-active': 'TURN Active',
        'revalidation-success': 'Revalidation ✓',
        'revalidation-failure': 'Revalidation ✗',
        'turn-retry': 'TURN Retry',
        'tcp-fallback': 'TCP Fallback',
        'error-recovery': 'Error Recovery',
      };
      return labels[badge.eventType] || badge.eventType;
    };

    return (
      <Badge variant={getVariant()} className="text-xs flex items-center gap-1">
        {getIcon()}
        {getLabel()}
        {badge.mediaType && <span className="text-[10px]">({badge.mediaType})</span>}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleExportLog = () => {
    if (onExportSessionLog) {
      onExportSessionLog();
    } else {
      toast.info('Export functionality not available');
    }
  };

  const getMobileNetworkTypeBadge = (networkType: string) => {
    const getVariant = () => {
      switch (networkType) {
        case '4g':
        case '5g':
          return 'default';
        case '3g':
          return 'secondary';
        case '2g':
        case 'slow-2g':
          return 'destructive';
        default:
          return 'outline';
      }
    };

    return (
      <Badge variant={getVariant()} className="text-xs uppercase">
        {networkType}
      </Badge>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[480px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-lg border-2">
        <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Bug className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">WebRTC Debug</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {peers.length} {peers.length === 1 ? 'peer' : 'peers'}
              </Badge>
              {isMobile && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Mobile
                </Badge>
              )}
              {isMobile && mobileNetworkType !== 'unknown' && getMobileNetworkTypeBadge(mobileNetworkType)}
            </div>
            <div className="flex items-center gap-2">
              {onExportSessionLog && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportLog();
                  }}
                  title="Export Session Log"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <>
            <Separator />
            <CardContent className="p-4">
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-4">
                  {/* Local Stream Status */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <VideoIcon className="h-4 w-4" />
                      <span>Local Media</span>
                    </div>
                    <div className="ml-6 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Stream Status:</span>
                        {getLocalStreamStatusBadge(localStreamStatus)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Stream Active:</span>
                        <Badge variant={localStreamActive ? 'default' : 'secondary'} className="text-xs">
                          {localStreamActive ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Audio:</span>
                        <Badge variant={audioEnabled ? 'default' : 'outline'} className="text-xs">
                          {audioEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Video:</span>
                        <Badge variant={videoEnabled ? 'default' : 'outline'} className="text-xs">
                          {videoEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {isMobile && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">TURN Priority:</span>
                          <Badge variant="default" className="text-xs flex items-center gap-1">
                            <Wifi className="h-3 w-3" />
                            Enabled
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Signaling Status */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Radio className="h-4 w-4" />
                      <span>Signaling</span>
                    </div>
                    <div className="ml-6 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pending Messages:</span>
                        <Badge variant="secondary" className="text-xs">
                          {signalingMessageCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Known Peers:</span>
                        <Badge variant="secondary" className="text-xs">
                          {knownPeerCount}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Peer Connections */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4" />
                      <span>Peer Connections</span>
                    </div>
                    {peers.length === 0 ? (
                      <div className="ml-6 text-xs text-muted-foreground">
                        No active peer connections
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {peers.map((peer) => (
                          <Collapsible
                            key={peer.sessionId}
                            open={expandedPeers.has(peer.sessionId)}
                            onOpenChange={() => togglePeerExpanded(peer.sessionId)}
                          >
                            <div className="ml-6 space-y-2 rounded-lg border p-3">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div
                                    className={`h-2 w-2 rounded-full ${getConnectionStateColor(
                                      peer.connectionState
                                    )}`}
                                  />
                                  <span className="font-mono text-xs font-semibold">
                                    {peer.sessionId}
                                  </span>
                                  {peer.usingRelay && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                                      <Wifi className="h-3 w-3" />
                                      TURN
                                    </Badge>
                                  )}
                                  {peer.isReconnecting && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                      Reconnecting
                                    </Badge>
                                  )}
                                  {peer.mobileOptimized && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                                      <Smartphone className="h-3 w-3" />
                                      Mobile
                                    </Badge>
                                  )}
                                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${expandedPeers.has(peer.sessionId) ? 'rotate-180' : ''}`} />
                                </div>
                              </CollapsibleTrigger>

                              <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Status:</span>
                                  <Badge
                                    variant={
                                      peer.connectionState === 'connected'
                                        ? 'default'
                                        : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {getConnectionStateLabel(peer.connectionState)}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Track Status:</span>
                                  {getTrackStatusBadge(peer.trackStatus)}
                                </div>
                              </div>

                              <CollapsibleContent className="space-y-2 pt-2">
                                {/* Connection Details */}
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">ICE:</span>
                                    <span className={`text-xs font-medium ${getIceStateColor(peer.iceConnectionState)}`}>
                                      {getIceStateLabel(peer.iceConnectionState)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Signaling:</span>
                                    <span className="text-xs">
                                      {getSignalingStateLabel(peer.signalingState)}
                                    </span>
                                  </div>
                                  {peer.reconnectAttempts > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Reconnect Attempts:</span>
                                      <Badge variant="outline" className="text-xs">
                                        {peer.reconnectAttempts}/{peer.mobileOptimized ? '5' : '3'}
                                      </Badge>
                                    </div>
                                  )}
                                </div>

                                {/* TURN Retry Info */}
                                {peer.turnRetryInfo && peer.turnRetryInfo.retryCount > 0 && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Repeat className="h-3 w-3" />
                                      <span>TURN Connection</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Retry Count:</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {peer.turnRetryInfo.retryCount}/3
                                        </Badge>
                                      </div>
                                      {peer.turnRetryInfo.tcpFallbackAttempted && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">TCP Fallback:</span>
                                          <Badge variant="default" className="text-xs flex items-center gap-1">
                                            <Network className="h-3 w-3" />
                                            Active
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* Error Recovery Info */}
                                {peer.errorRecoveryInfo && peer.errorRecoveryInfo.recoveryCount > 0 && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>Error Recovery</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Recovery Count:</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {peer.errorRecoveryInfo.recoveryCount}
                                        </Badge>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Advanced Metrics */}
                                {(peer.bitrate !== undefined || peer.packetLoss !== undefined || peer.jitter !== undefined || peer.rtt !== undefined) && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Gauge className="h-3 w-3" />
                                      <span>Real-time Metrics</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {peer.incomingVideoBitrate !== undefined && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Video In:</span>
                                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                                            <TrendingDown className="h-3 w-3" />
                                            {peer.incomingVideoBitrate} kbps
                                          </Badge>
                                        </div>
                                      )}
                                      {peer.outgoingVideoBitrate !== undefined && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Video Out:</span>
                                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            {peer.outgoingVideoBitrate} kbps
                                          </Badge>
                                        </div>
                                      )}
                                      {peer.incomingAudioBitrate !== undefined && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Audio In:</span>
                                          <Badge variant="outline" className="text-xs">
                                            {peer.incomingAudioBitrate} kbps
                                          </Badge>
                                        </div>
                                      )}
                                      {peer.outgoingAudioBitrate !== undefined && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Audio Out:</span>
                                          <Badge variant="outline" className="text-xs">
                                            {peer.outgoingAudioBitrate} kbps
                                          </Badge>
                                        </div>
                                      )}
                                      {peer.packetLoss !== undefined && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Packet Loss:</span>
                                          {getPacketLossBadge(peer.packetLoss)}
                                        </div>
                                      )}
                                      {peer.jitter !== undefined && peer.jitter > 0 && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Jitter:</span>
                                          <span className="text-xs">{peer.jitter}ms</span>
                                        </div>
                                      )}
                                      {peer.rtt !== undefined && peer.rtt > 0 && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Latency (RTT):</span>
                                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {peer.rtt}ms
                                          </Badge>
                                        </div>
                                      )}
                                      {peer.currentQuality && (
                                        <>
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Quality Level:</span>
                                            <Badge variant={getQualityBadgeVariant(peer.currentQuality)} className="text-xs uppercase">
                                              {peer.currentQuality}
                                            </Badge>
                                          </div>
                                          {peer.resolution && (
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">Resolution:</span>
                                              <span className="text-xs font-mono">{peer.resolution}</span>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* ICE Candidates */}
                                {peer.iceCandidates && peer.iceCandidates.length > 0 && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Hash className="h-3 w-3" />
                                      <span>ICE Candidates ({peer.iceCandidates.length})</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {peer.iceCandidates.slice(0, 6).map((candidate) => (
                                        <div key={candidate.candidateId}>
                                          {getCandidateTypeBadge(candidate.candidateType, candidate.isSelected)}
                                        </div>
                                      ))}
                                      {peer.iceCandidates.length > 6 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{peer.iceCandidates.length - 6} more
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* State Transitions */}
                                {peer.stateTransitions && peer.stateTransitions.length > 0 && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <GitBranch className="h-3 w-3" />
                                      <span>State Transitions</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {peer.stateTransitions.slice(-3).map((transition, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[10px]">
                                          <span className="text-muted-foreground">
                                            {transition.previousState} → {transition.newState}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {transition.duration}ms
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}

                                {/* Event Badges */}
                                {peer.eventBadges && peer.eventBadges.length > 0 && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Activity className="h-3 w-3" />
                                      <span>Recent Events</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {peer.eventBadges.slice(-4).map((badge, idx) => (
                                        <div key={idx}>
                                          {getEventBadge(badge)}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}

                                {/* ICE Policy */}
                                {peer.icePolicy && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Network className="h-3 w-3" />
                                      <span>ICE Policy</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground text-xs">Mode:</span>
                                      {getIcePolicyBadge(peer.icePolicy)}
                                    </div>
                                    {peer.icePolicySwitchCount !== undefined && peer.icePolicySwitchCount > 0 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-xs">Policy Switches:</span>
                                        <Badge variant="outline" className="text-xs">
                                          {peer.icePolicySwitchCount}
                                        </Badge>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Network Path Probing */}
                                {peer.networkPathProbe && (
                                  <>
                                    <Separator className="my-2" />
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                      <Signal className="h-3 w-3" />
                                      <span>Network Path Probing</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground text-xs">Status:</span>
                                      {getProbeStatusBadge(peer.networkPathProbe.status)}
                                    </div>
                                    {peer.networkPathProbe.status === 'complete' && (
                                      <>
                                        {peer.networkPathProbe.udpLatency > 0 && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-xs">UDP Latency:</span>
                                            <span className="text-xs font-mono">{peer.networkPathProbe.udpLatency}ms</span>
                                          </div>
                                        )}
                                        {peer.networkPathProbe.tcpLatency > 0 && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-xs">TCP Latency:</span>
                                            <span className="text-xs font-mono">{peer.networkPathProbe.tcpLatency}ms</span>
                                          </div>
                                        )}
                                        {peer.networkPathProbe.preferredRoute !== 'unknown' && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-xs">Preferred Route:</span>
                                            <Badge variant="default" className="text-xs uppercase">
                                              {peer.networkPathProbe.preferredRoute}
                                            </Badge>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
