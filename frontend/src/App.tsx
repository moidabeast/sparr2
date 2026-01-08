import { useState, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import CategoryPage from './pages/CategoryPage';
import type { RoomRole } from './types/backend';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

export interface RoomRef {
  handleLeave: () => Promise<void>;
}

// Root route component
function RootComponent() {
  return <Outlet />;
}

// Lobby route component
function LobbyRouteComponent() {
  const [currentView, setCurrentView] = useState<'lobby' | 'room'>('lobby');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoomRole>('spectator');
  const roomRef = useRef<RoomRef>(null);

  const handleEnterRoom = (roomId: string, role: RoomRole) => {
    setCurrentRoomId(roomId);
    setCurrentRole(role);
    setCurrentView('room');
  };

  const handleBackToLobby = () => {
    setCurrentView('lobby');
    setCurrentRoomId(null);
    setCurrentRole('spectator');
  };

  const handleLeaveRoom = async () => {
    handleBackToLobby();
  };

  return (
    <div className="min-h-screen">
      {currentView === 'lobby' && (
        <Lobby onEnterRoom={handleEnterRoom} />
      )}
      {currentView === 'room' && currentRoomId && (
        <Room 
          ref={roomRef}
          roomId={currentRoomId} 
          onLeave={handleLeaveRoom}
          onBackToLobby={handleBackToLobby}
          userRole={currentRole}
        />
      )}
    </div>
  );
}

// Category route component
function CategoryRouteComponent() {
  const [currentView, setCurrentView] = useState<'category' | 'room'>('category');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoomRole>('spectator');
  const roomRef = useRef<RoomRef>(null);

  const handleEnterRoom = (roomId: string, role: RoomRole) => {
    setCurrentRoomId(roomId);
    setCurrentRole(role);
    setCurrentView('room');
  };

  const handleBackToCategory = () => {
    setCurrentView('category');
    setCurrentRoomId(null);
    setCurrentRole('spectator');
  };

  const handleLeaveRoom = async () => {
    handleBackToCategory();
  };

  return (
    <>
      {currentView === 'category' && (
        <CategoryPage onEnterRoom={handleEnterRoom} />
      )}
      {currentView === 'room' && currentRoomId && (
        <Room 
          ref={roomRef}
          roomId={currentRoomId} 
          onLeave={handleLeaveRoom}
          onBackToLobby={handleBackToCategory}
          userRole={currentRole}
        />
      )}
    </>
  );
}

// Create root route
const rootRoute = createRootRoute({
  component: RootComponent,
});

// Create lobby route
const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LobbyRouteComponent,
});

// Create category route
const categoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/category/$categoryName',
  component: CategoryRouteComponent,
});

// Create router
const routeTree = rootRoute.addChildren([lobbyRoute, categoryRoute]);
const router = createRouter({ routeTree });

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
