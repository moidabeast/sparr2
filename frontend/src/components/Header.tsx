import { MessageSquare, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onBackToLobby?: () => void;
}

export default function Header({ onBackToLobby }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-4">
          {onBackToLobby && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBackToLobby}
              className="rounded-2xl hover:bg-primary/10 hover:scale-110 transition-all"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-accent to-primary shadow-lg shadow-primary/30 animate-pulse-soft">
                <MessageSquare className="h-8 w-8 text-primary-foreground" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-accent animate-bounce-soft" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Chattr
              </h1>
              <p className="text-sm font-medium text-muted-foreground">Live & Fun! 🎉</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

