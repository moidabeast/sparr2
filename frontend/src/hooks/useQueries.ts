import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { 
  Room, 
  ChatMessage, 
  SignalingMessage, 
  RoomId, 
  SessionId, 
  ConnectionMetrics, 
  IceCandidate, 
  StateTransition, 
  EventBadge, 
  SessionEvent, 
  SessionDebugData, 
  SafariAudioTestResult, 
  EmojiReaction, 
  LobbyPreview,
  RoomRole,
} from '../types/backend';
import { ExternalBlob, RoomRole as BackendRoomRole, UserProfile, Category } from '../backend';
import { getSessionId } from '../lib/session';
import { toast } from 'sonner';

export function useGetRooms() {
  const { actor, isFetching } = useActor();

  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const rooms = await actor.getRooms();
        return rooms;
      } catch (error) {
        console.error('[useQueries] Failed to fetch rooms:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000,
  });
}

export function useGetRoomsByCategory(category: Category | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Room[]>({
    queryKey: ['rooms', 'category', category],
    queryFn: async () => {
      if (!actor || !category) return [];
      try {
        const rooms = await actor.getRoomsByCategory(category);
        return rooms;
      } catch (error) {
        console.error('[useQueries] Failed to fetch rooms by category:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!category,
    refetchInterval: 3000,
  });
}

export function useGetRoom(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<Room | null>({
    queryKey: ['room', roomId],
    queryFn: async () => {
      if (!actor) return null;
      try {
        const room = await actor.getRoom(roomId);
        return room;
      } catch (error) {
        console.error('[useQueries] Failed to fetch room:', error);
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!roomId,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useCreateRoom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subject,
      description,
      thumbnail,
      category,
    }: {
      subject: string;
      description: string;
      thumbnail: ExternalBlob;
      category: Category;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      
      try {
        // Backend automatically creates corresponding LiveKit room
        const roomId = await actor.createRoom(subject, description, thumbnail, category);
        return roomId;
      } catch (error: any) {
        console.error('[useQueries] Failed to create room:', error);
        throw new Error(error.message || 'Failed to create room');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useVerifyAndJoinRoom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, role }: { roomId: RoomId; role: RoomRole }) => {
      if (!actor) throw new Error('Actor not initialized');
      
      try {
        const sessionId = getSessionId();
        
        // Convert frontend role type to backend enum
        const backendRole = role === 'participant' 
          ? BackendRoomRole.participant 
          : BackendRoomRole.spectator;
        
        const success = await actor.joinRoom(roomId, sessionId, backendRole);
        
        if (!success) {
          throw new Error('Failed to join room');
        }
        
        return success;
      } catch (error: any) {
        console.error('[useQueries] Failed to join room:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('does not exist')) {
        toast.error('Room not available. Please refresh and try another room.');
      } else if (error.message.includes('multiple attempts')) {
        toast.error('Unable to connect to room. Please try again.');
      } else {
        toast.error('Failed to join room');
      }
    },
  });
}

export function useJoinRoom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, role }: { roomId: RoomId; role: RoomRole }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        // Convert frontend role type to backend enum
        const backendRole = role === 'participant' 
          ? BackendRoomRole.participant 
          : BackendRoomRole.spectator;
        
        const success = await actor.joinRoom(roomId, sessionId, backendRole);
        return success;
      } catch (error) {
        console.error('[useQueries] Failed to join room:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useLeaveRoom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        const success = await actor.leaveRoom(roomId, sessionId);
        return success;
      } catch (error) {
        console.error('[useQueries] Failed to leave room:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDisconnect() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        const success = await actor.leaveRoom(roomId, sessionId);
        return success;
      } catch (error) {
        console.error('[useQueries] Failed to disconnect:', error);
        return false;
      }
    },
  });
}

export function useGetMessages(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<ChatMessage[]>({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const messages = await actor.getMessages(roomId);
        return messages;
      } catch (error) {
        console.error('[useQueries] Failed to fetch messages:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!roomId,
    refetchInterval: 1000,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, content }: { roomId: RoomId; content: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        const messageId = await actor.sendMessage(roomId, sessionId, content);
        return messageId;
      } catch (error) {
        console.error('[useQueries] Failed to send message:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.roomId] });
    },
  });
}

export function useGetReactions(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<EmojiReaction[]>({
    queryKey: ['reactions', roomId],
    queryFn: async () => {
      if (!actor) return [];
      // Backend method not yet implemented
      return [];
    },
    enabled: !!actor && !isFetching && !!roomId,
    refetchInterval: 500,
  });
}

export function useSendReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, emoji }: { roomId: RoomId; emoji: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would send reaction in room ${roomId}: ${emoji}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reactions', variables.roomId] });
    },
  });
}

export function useSendSignalingMessage() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      receiver,
      messageType,
      payload,
    }: {
      receiver: SessionId;
      messageType: string;
      payload: string;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        await actor.sendSignalingMessage(sessionId, receiver, messageType, payload);
      } catch (error) {
        console.error('[useQueries] Failed to send signaling message:', error);
        throw error;
      }
    },
  });
}

export function useGetSignalingMessages() {
  const { actor, isFetching } = useActor();

  return useQuery<SignalingMessage[]>({
    queryKey: ['signalingMessages'],
    queryFn: async () => {
      if (!actor) return [];
      const sessionId = getSessionId();
      
      try {
        const messages = await actor.getSignalingMessages(sessionId);
        return messages;
      } catch (error) {
        console.error('[useQueries] Failed to fetch signaling messages:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 1000,
  });
}

export function useClearSignalingMessages() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        await actor.clearSignalingMessages(sessionId);
      } catch (error) {
        console.error('[useQueries] Failed to clear signaling messages:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signalingMessages'] });
    },
  });
}

export function useAddActivePeer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented - active peers are managed via joinRoom with participant role
      console.log(`[useQueries] Active peer management handled by joinRoom for ${sessionId}`);
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ['activePeers', roomId] });
    },
  });
}

export function useRemoveActivePeer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented - active peers are managed via leaveRoom
      console.log(`[useQueries] Active peer management handled by leaveRoom for ${sessionId}`);
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ['activePeers', roomId] });
    },
  });
}

export function useGetActivePeers(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<SessionId[]>({
    queryKey: ['activePeers', roomId],
    queryFn: async () => {
      if (!actor) return [];
      
      try {
        const peers = await actor.getActivePeers(roomId);
        return peers;
      } catch (error) {
        console.error('[useQueries] Failed to fetch active peers:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!roomId,
    refetchInterval: 2000,
  });
}

export function useUpdatePresence() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ roomId, isVisible }: { roomId: RoomId; isVisible: boolean }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would update presence in room ${roomId}: ${isVisible ? 'visible' : 'hidden'}`);
    },
  });
}

export function useSendHeartbeat() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ roomId }: { roomId: RoomId }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        await actor.updateHeartbeat(sessionId, roomId);
        return true;
      } catch (error) {
        console.error('[useQueries] Failed to send heartbeat:', error);
        return false;
      }
    },
  });
}

export function useUpdateIcePolicy() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      mode,
      successRate,
    }: {
      mode: string;
      successRate: bigint;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would update ICE policy for ${sessionId}`);
    },
  });
}

export function useUpdateNetworkPathStats() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      udpLatency,
      tcpLatency,
      packetLoss,
      preferredRoute,
    }: {
      udpLatency: bigint;
      tcpLatency: bigint;
      packetLoss: bigint;
      preferredRoute: string;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would update network path stats for ${sessionId}`);
    },
  });
}

export function useAddConnectionMetrics() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (metrics: ConnectionMetrics) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        await actor.storeConnectionMetrics(sessionId, metrics);
      } catch (error) {
        console.error('[useQueries] Failed to add connection metrics:', error);
        throw error;
      }
    },
  });
}

export function useAddIceCandidate() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (candidate: IceCandidate) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would add ICE candidate for ${sessionId}`);
    },
  });
}

export function useAddStateTransition() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (transition: StateTransition) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would add state transition for ${sessionId}`);
    },
  });
}

export function useAddEventBadge() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (badge: EventBadge) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would add event badge for ${sessionId}`);
    },
  });
}

export function useLogSessionEvent() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (event: SessionEvent) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        // Convert null to undefined for backend compatibility
        const backendEvent = {
          ...event,
          peerId: event.peerId ?? undefined,
          severity: event.severity ?? undefined,
        };
        await actor.storeSessionEvent(sessionId, backendEvent);
      } catch (error) {
        console.error('[useQueries] Failed to log session event:', error);
        throw error;
      }
    },
  });
}

export function useGetSessionDebugData() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ startTime, endTime }: { startTime: bigint; endTime: bigint }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      return null;
    },
  });
}

export function useSaveUploadSpeedTestResult() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ speedKbps, qualityTier }: { speedKbps: bigint; qualityTier: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would save upload speed test result for ${sessionId}`);
    },
  });
}

export function useSaveContinuousUploadMeasurement() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ speedKbps, qualityTier }: { speedKbps: bigint; qualityTier: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would save continuous upload measurement for ${sessionId}`);
    },
  });
}

export function useSaveQualityAdjustmentEvent() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ fromTier, toTier, triggerSpeedKbps }: { fromTier: string; toTier: string; triggerSpeedKbps: bigint }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would save quality adjustment event for ${sessionId}`);
    },
  });
}

export function useSetSafariAudioPreference() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      useSpeaker,
      iosDetection,
      compatibilityStatus,
    }: {
      useSpeaker: boolean;
      iosDetection: boolean;
      compatibilityStatus: boolean;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would set Safari audio preference for ${sessionId}`);
    },
  });
}

export function useRecordSafariAudioTest() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      testResult,
      useSpeaker,
      iosDetection,
      compatibilityStatus,
    }: {
      testResult: SafariAudioTestResult;
      useSpeaker: boolean;
      iosDetection: boolean;
      compatibilityStatus: boolean;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      // Backend method not yet implemented
      console.log(`[useQueries] Would record Safari audio test for ${sessionId}`);
    },
  });
}

export function useGetSafariAudioPreference() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['safariAudioPreference'],
    queryFn: async () => {
      if (!actor) return null;
      const sessionId = getSessionId();
      // Backend method not yet implemented
      return null;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveLivePreview() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, image }: { roomId: RoomId; image: ExternalBlob }) => {
      if (!actor) throw new Error('Actor not initialized');
      
      try {
        await actor.storeLivePreview(roomId, image);
      } catch (error) {
        console.error('[useQueries] Failed to save live preview:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['livePreview', variables.roomId] });
    },
  });
}

export function useGetLatestLivePreview(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<LobbyPreview | null>({
    queryKey: ['livePreview', roomId],
    queryFn: async () => {
      if (!actor) return null;
      
      try {
        const preview = await actor.getLivePreview(roomId);
        if (preview) {
          return {
            roomId,
            image: preview,
            timestamp: BigInt(Date.now()),
          };
        }
        return null;
      } catch (error) {
        console.error('[useQueries] Failed to fetch live preview:', error);
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!roomId,
    refetchInterval: 30000,
  });
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}
