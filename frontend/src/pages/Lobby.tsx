import { useState } from 'react';
import { Plus, Users, Image as ImageIcon, Sparkles, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useGetRooms, useCreateRoom, useVerifyAndJoinRoom } from '../hooks/useQueries';
import { ExternalBlob } from '../backend';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface LobbyProps {
  onEnterRoom: (roomId: string) => void;
}

export default function Lobby({ onEnterRoom }: LobbyProps) {
  const { data: rooms, isLoading } = useGetRooms();
  const createRoom = useCreateRoom();
  const verifyAndJoinRoom = useVerifyAndJoinRoom();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !description.trim() || !imageFile) {
      toast.error('Please fill in all fields and upload an image');
      return;
    }

    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const thumbnail = ExternalBlob.fromBytes(uint8Array);

      await createRoom.mutateAsync({ subject, description, thumbnail });
      
      toast.success('Room created successfully! 🎉');
      setIsDialogOpen(false);
      setSubject('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      toast.error('Failed to create room');
      console.error(error);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);
    
    try {
      await verifyAndJoinRoom.mutateAsync(roomId);
      onEnterRoom(roomId);
    } catch (error) {
      setJoiningRoomId(null);
    }
  };

  return (
    <div className="container py-8 md:py-12">
      {/* Header Section */}
      <div className="mb-8 md:mb-12 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border-2 border-primary/20">
          <Sparkles className="h-4 w-4 text-primary animate-pulse-soft" />
          <span className="text-sm font-semibold text-primary">Discover Fun Rooms</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Room Lobby
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Browse and join active rooms for text, audio, and video chat! 🎮
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all gap-2 text-base font-bold px-8 py-6">
              <Plus className="h-6 w-6" />
              Create New Room
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Video className="h-6 w-6 text-primary" />
                Create New Room
              </DialogTitle>
              <DialogDescription className="text-base">
                Set up a new room for text, audio, and video communication 🎉
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRoom} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-base font-semibold">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter room subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="rounded-xl h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this room is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  className="rounded-xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thumbnail" className="text-base font-semibold">Thumbnail Image</Label>
                <div className="flex flex-col gap-3">
                  <Input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    required
                    className="rounded-xl h-12"
                  />
                  {imagePreview && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-primary/20 shadow-lg">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full rounded-2xl h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all" 
                disabled={createRoom.isPending}
              >
                {createRoom.isPending ? 'Creating...' : 'Create Room 🚀'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="rounded-3xl overflow-hidden">
              <CardHeader className="p-0">
                <Skeleton className="aspect-video w-full" />
              </CardHeader>
              <CardContent className="p-5">
                <Skeleton className="mb-3 h-7 w-3/4" />
                <Skeleton className="mb-4 h-5 w-full" />
                <Skeleton className="h-11 w-full rounded-2xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rooms && rooms.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card 
              key={room.id} 
              className="rounded-3xl overflow-hidden border-2 hover:border-primary/40 transition-all hover-lift group"
            >
              <CardHeader className="p-0 relative">
                <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                  <img
                    src={room.thumbnail.getDirectURL()}
                    alt={room.subject}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110 duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge className="rounded-full px-3 py-1 bg-background/90 backdrop-blur-sm border-2 border-primary/20 shadow-lg">
                      <Users className="h-3 w-3 mr-1" />
                      {Number(room.participantCount)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <CardTitle className="text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors">
                  {room.subject}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-base">
                  {room.description}
                </CardDescription>
                <Button 
                  onClick={() => handleJoinRoom(room.id)} 
                  className="w-full rounded-2xl h-11 font-bold shadow-md hover:shadow-lg transition-all"
                  disabled={joiningRoomId === room.id}
                >
                  {joiningRoomId === room.id ? (
                    <>
                      <span className="animate-pulse">Joining...</span>
                    </>
                  ) : (
                    <>Join Room 🎮</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed border-primary/30 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse-soft">
                <ImageIcon className="h-12 w-12 text-primary" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-accent animate-bounce-soft" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">No rooms yet</h3>
              <p className="text-muted-foreground text-lg max-w-md">
                Be the first to create a room and start chatting! 🚀
              </p>
            </div>
            <Button 
              onClick={() => setIsDialogOpen(true)} 
              size="lg"
              className="rounded-2xl shadow-lg hover:shadow-xl transition-all gap-2 text-base font-bold px-8 py-6"
            >
              <Plus className="h-6 w-6" />
              Create First Room
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

