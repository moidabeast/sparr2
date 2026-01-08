import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SessionId } from '../types/backend';

interface ConnectedUsersListProps {
  activePeers: SessionId[];
  currentSessionId: SessionId;
}

export default function ConnectedUsersList({ activePeers, currentSessionId }: ConnectedUsersListProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <Users className="h-5 w-5" />
          <span className="font-bold text-lg">Connected Users</span>
        </div>
        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
          {activePeers.length}
        </Badge>
      </div>
      
      <Separator className="bg-white/20 mb-4" />
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {activePeers.length > 0 ? (
            activePeers.map((sessionId) => {
              const isCurrentUser = sessionId === currentSessionId;
              return (
                <div
                  key={sessionId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                    isCurrentUser
                      ? 'bg-primary/20 border border-primary/40'
                      : 'bg-white/10 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isCurrentUser ? 'bg-primary' : 'bg-green-500'
                      }`}
                    />
                    <span className="font-mono text-sm font-medium text-white">
                      {sessionId}
                    </span>
                  </div>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/30">
                      You
                    </Badge>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex h-[200px] items-center justify-center text-center text-sm text-white/60">
              No users connected yet
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
