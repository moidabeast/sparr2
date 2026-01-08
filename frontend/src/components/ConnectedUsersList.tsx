import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SessionId } from '../backend';

interface ConnectedUsersListProps {
  activePeers: SessionId[];
  currentSessionId: SessionId;
}

export default function ConnectedUsersList({ activePeers, currentSessionId }: ConnectedUsersListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connected Users
          </span>
          <Badge variant="secondary">{activePeers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4">
            {activePeers.length > 0 ? (
              activePeers.map((sessionId) => {
                const isCurrentUser = sessionId === currentSessionId;
                return (
                  <div
                    key={sessionId}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                      isCurrentUser
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isCurrentUser ? 'bg-primary' : 'bg-green-500'
                        }`}
                      />
                      <span className="font-mono text-sm font-medium">
                        {sessionId}
                      </span>
                    </div>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
                No users connected yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
