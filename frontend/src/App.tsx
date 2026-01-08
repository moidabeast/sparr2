import { useState, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import Header from './components/Header';
import Footer from './components/Footer';
import Lobby from './pages/Lobby';
import Room from './pages/Room';

const queryClient = new QueryClient();

export interface RoomRef {
  handleLeave: () => Promise<void>;
}

function AppContent() {
  const [currentView, setCurrentView] = useState<'lobby' | 'room'>('lobby');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const roomRef = useRef<RoomRef>(null);

  const handleEnterRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentView('room');
  };

  const handleBackToLobby = async () => {
    // If we're in a room, trigger the cleanup process
    if (currentView === 'room' && roomRef.current) {
      await roomRef.current.handleLeave();
    } else {
      // Otherwise just navigate
      setCurrentView('lobby');
      setSelectedRoomId(null);
    }
  };

  const handleRoomLeaveComplete = () => {
    setCurrentView('lobby');
    setSelectedRoomId(null);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="flex min-h-screen flex-col bg-background">
        <Header onBackToLobby={currentView === 'room' ? handleBackToLobby : undefined} />
        <main className="flex-1">
          {currentView === 'lobby' ? (
            <Lobby onEnterRoom={handleEnterRoom} />
          ) : (
            selectedRoomId && (
              <Room
                ref={roomRef}
                roomId={selectedRoomId}
                onLeave={handleRoomLeaveComplete}
              />
            )
          )}
        </main>
        <Footer />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

