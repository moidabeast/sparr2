import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Room, ChatMessage, SignalingMessage, RoomId, SessionId, ConnectionMetrics, IceCandidate, StateTransition, EventBadge, SessionEvent, SessionDebugData, SafariAudioTestResult } from '../backend';
import { ExternalBlob } from '../backend';
import { getSessionId } from '../lib/session';
import { toast } from 'sonner';

export function useGetRooms() {
  const { actor, isFetching } = useActor();

  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRooms();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000,
  });
}

export function useGetRoom(roomId: RoomId) {
  const { actor, isFetching } = useActor();

  return useQuery<Room | null>({
    queryKey: ['room', roomId],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getRoom(roomId);
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
    }: {
      subject: string;
      description: string;
      thumbnail: ExternalBlob;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.createRoom(subject, description, thumbnail);
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
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      
      // First, verify the room exists by fetching it
      const room = await actor.getRoom(roomId);
      
      if (!room) {
        throw new Error('Room does not exist or is no longer available');
      }

      // If room exists, attempt to join with retry logic
      const sessionId = getSessionId();
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await actor.joinRoom(roomId, sessionId);
          console.log(`[useQueries] Successfully joined room ${roomId}`);
          return room;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          // If it's a "Room does not exist" error, don't retry
          if (lastError.message.includes('does not exist')) {
            throw lastError;
          }
          
          // If it's "already in room", consider it a success (idempotent)
          if (lastError.message.includes('already in room')) {
            console.log(`[useQueries] Already in room ${roomId}, treating as success`);
            return room;
          }
          
          // Wait before retrying (exponential backoff)
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
          }
        }
      }
      
      // If all retries failed, throw the last error
      throw lastError || new Error('Failed to join room after multiple attempts');
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
    mutationFn: async (roomId: RoomId) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      
      try {
        await actor.joinRoom(roomId, sessionId);
        console.log(`[useQueries] Joined room ${roomId}`);
      } catch (error) {
        // If already in room, treat as success (idempotent behavior)
        if (error instanceof Error && error.message.includes('already in room')) {
          console.log(`[useQueries] Already in room ${roomId}, treating as success`);
          return;
        }
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
        await actor.leaveRoom(roomId, sessionId);
        console.log(`[useQueries] Left room ${roomId}`);
      } catch (error) {
        // If not in room, treat as success (idempotent behavior)
        if (error instanceof Error && error.message.includes('not in room')) {
          console.log(`[useQueries] Not in room ${roomId}, treating as success`);
          return;
        }
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
        const success = await actor.disconnect(roomId, sessionId);
        console.log(`[useQueries] Disconnected from room ${roomId}: ${success}`);
        return success;
      } catch (error) {
        console.error('[useQueries] Error disconnecting:', error);
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
      return actor.getMessages(roomId);
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
      return actor.sendMessage(roomId, sessionId, content);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.roomId] });
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
      return actor.sendSignalingMessage(sessionId, receiver, messageType, payload);
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
      return actor.getSignalingMessages(sessionId);
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
      return actor.clearSignalingMessages(sessionId);
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
      await actor.addActivePeer(roomId, sessionId);
      console.log(`[useQueries] Added as active peer in room ${roomId}`);
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
      await actor.removeActivePeer(roomId, sessionId);
      console.log(`[useQueries] Removed as active peer from room ${roomId}`);
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
      return actor.getActivePeers(roomId);
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
      await actor.updatePresence(roomId, sessionId, isVisible);
      console.log(`[useQueries] Updated presence in room ${roomId}: ${isVisible ? 'visible' : 'hidden'}`);
    },
  });
}

export function useSendHeartbeat() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ roomId }: { roomId: RoomId }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      const success = await actor.sendHeartbeat(roomId, sessionId);
      if (!success) {
        console.warn(`[useQueries] Heartbeat failed for room ${roomId}`);
      }
      return success;
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
      return actor.updateIcePolicy(sessionId, mode, successRate);
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
      return actor.updateNetworkPathStats(sessionId, udpLatency, tcpLatency, packetLoss, preferredRoute);
    },
  });
}

export function useAddConnectionMetrics() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (metrics: ConnectionMetrics) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.addConnectionMetrics(sessionId, metrics);
    },
  });
}

export function useAddIceCandidate() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (candidate: IceCandidate) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.addIceCandidate(sessionId, candidate);
    },
  });
}

export function useAddStateTransition() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (transition: StateTransition) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.addStateTransition(sessionId, transition);
    },
  });
}

export function useAddEventBadge() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (badge: EventBadge) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.addEventBadge(sessionId, badge);
    },
  });
}

export function useLogSessionEvent() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (event: SessionEvent) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.logSessionEvent(sessionId, event);
    },
  });
}

export function useGetSessionDebugData() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ startTime, endTime }: { startTime: bigint; endTime: bigint }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.getSessionDebugData(sessionId, startTime, endTime);
    },
  });
}

export function useSaveUploadSpeedTestResult() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ speedKbps, qualityTier }: { speedKbps: bigint; qualityTier: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.saveUploadSpeedTestResult(sessionId, speedKbps, qualityTier);
    },
  });
}

export function useSaveContinuousUploadMeasurement() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ speedKbps, qualityTier }: { speedKbps: bigint; qualityTier: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.saveContinuousUploadMeasurement(sessionId, speedKbps, qualityTier);
    },
  });
}

export function useSaveQualityAdjustmentEvent() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ fromTier, toTier, triggerSpeedKbps }: { fromTier: string; toTier: string; triggerSpeedKbps: bigint }) => {
      if (!actor) throw new Error('Actor not initialized');
      const sessionId = getSessionId();
      return actor.saveQualityAdjustmentEvent(sessionId, fromTier, toTier, triggerSpeedKbps);
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
      return actor.setSafariAudioPreference(sessionId, useSpeaker, iosDetection, compatibilityStatus);
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
      return actor.recordSafariAudioTest(sessionId, testResult, useSpeaker, iosDetection, compatibilityStatus);
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
      return actor.getSafariAudioPreference(sessionId);
    },
    enabled: !!actor && !isFetching,
  });
}
