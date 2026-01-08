import { useState, useEffect, useRef } from 'react';
import { Plus, Users, Image as ImageIcon, Video, Search, Menu, Filter, TrendingUp, Clock, Star, UserCircle, ChevronLeft, ChevronRight, MessageSquare, Flame, Lightbulb, Briefcase, Sparkles, DollarSign, Eye, Atom, Vote, HeartHandshake, Gamepad2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from '@tanstack/react-router';
import { useGetRooms, useGetRoomsByCategory, useCreateRoom, useGetLatestLivePreview, useGetCallerUserProfile, useSaveCallerUserProfile } from '../hooks/useQueries';
import { ExternalBlob, Category } from '../backend';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import RoomJoinModal from '../components/RoomJoinModal';
import ProfileEditModal from '../components/ProfileEditModal';
import SearchModal from '../components/SearchModal';
import type { RoomRole } from '../types/backend';
import { getSessionId } from '../lib/session';

interface LobbyProps {
  onEnterRoom: (roomId: string, role: RoomRole) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  [Category.justChatting]: 'Just Chatting',
  [Category.politics]: 'Politics',
  [Category.technology]: 'Science and Technology',
  [Category.culture]: 'Culture & Society',
  [Category.philosophy]: 'Philosophy',
  [Category.entertainment]: 'Religion',
  [Category.economics]: 'Economics',
  [Category.games]: 'Games',
  [Category.conspiracy]: 'Conspiracy',
  [Category.uncategorized]: 'Other',
};

const CATEGORY_THUMBNAILS: Record<Category, string> = {
  [Category.economics]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795292/4_m7gsgm.png',
  [Category.politics]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795284/1_lywcvr.png',
  [Category.technology]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795282/5_hgbjk6.png',
  [Category.philosophy]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795284/2_axojbp.png',
  [Category.entertainment]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795286/3_p8rlpk.png',
  [Category.culture]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795288/6_j1t4kt.png',
  [Category.justChatting]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795290/7_kgqsfd.png',
  [Category.games]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766907325/Copy_of_Extenda_10_Pica_z9yg0u.png',
  [Category.conspiracy]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795976/Copy_of_Extenda_10_Pica_wcdgfg.png',
  [Category.uncategorized]: 'https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795288/6_j1t4kt.png',
};

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  [Category.justChatting]: <MessageSquare className="h-6 w-6" />,
  [Category.politics]: <Vote className="h-6 w-6" />,
  [Category.technology]: <Atom className="h-6 w-6" />,
  [Category.culture]: <HeartHandshake className="h-6 w-6" />,
  [Category.philosophy]: <Lightbulb className="h-6 w-6" />,
  [Category.entertainment]: <Flame className="h-6 w-6" />,
  [Category.economics]: <DollarSign className="h-6 w-6" />,
  [Category.games]: <Gamepad2 className="h-6 w-6" />,
  [Category.conspiracy]: <Eye className="h-6 w-6" />,
  [Category.uncategorized]: <Star className="h-6 w-6" />,
};

interface ActiveDebater {
  sessionId: string;
  roomId: string;
  roomSubject: string;
  roomCategory: Category;
}

function HeroCarousel({ rooms, onJoin }: { rooms: any[]; onJoin: (roomId: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance (in px) to trigger slide change
  const minSwipeDistance = 50;

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (rooms.length <= 1) return;

    const interval = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, rooms.length]);

  const handlePrevious = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === 0 ? rooms.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === rooms.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const handleDotClick = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 600);
  };

  // Touch event handlers for swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }

    // Reset touch positions
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (rooms.length === 0) return null;

  // Calculate slide positions for desktop stacked layout
  const getSlideClass = (index: number) => {
    const diff = index - currentIndex;
    const totalSlides = rooms.length;
    
    // Normalize difference to handle wrap-around
    let normalizedDiff = diff;
    if (Math.abs(diff) > totalSlides / 2) {
      normalizedDiff = diff > 0 ? diff - totalSlides : diff + totalSlides;
    }
    
    if (normalizedDiff === 0) return 'hero-carousel-slide-active';
    if (normalizedDiff === 1) return 'hero-carousel-slide-next';
    if (normalizedDiff === -1) return 'hero-carousel-slide-prev';
    if (normalizedDiff === 2) return 'hero-carousel-slide-far-next';
    if (normalizedDiff === -2) return 'hero-carousel-slide-far-prev';
    return '';
  };

  return (
    <div 
      className="hero-carousel-container"
      ref={carouselRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero-carousel-slides">
        {rooms.map((room, index) => (
          <HeroSlide
            key={room.id}
            room={room}
            isActive={index === currentIndex}
            slideClass={getSlideClass(index)}
            onJoin={onJoin}
          />
        ))}
      </div>

      {/* Navigation Arrows - Desktop Only */}
      {rooms.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="hero-carousel-arrow hero-carousel-arrow-left hero-carousel-arrow-desktop"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={handleNext}
            className="hero-carousel-arrow hero-carousel-arrow-right hero-carousel-arrow-desktop"
            aria-label="Next slide"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Indicator Dots */}
      {rooms.length > 1 && (
        <div className="hero-carousel-indicators">
          {rooms.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`hero-carousel-dot ${index === currentIndex ? 'hero-carousel-dot-active' : ''}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroSlide({ room, isActive, slideClass, onJoin }: { room: any; isActive: boolean; slideClass: string; onJoin: (roomId: string) => void }) {
  const { data: livePreview } = useGetLatestLivePreview(room.id);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  useEffect(() => {
    if (livePreview?.image) {
      const newPreviewUrl = livePreview.image.getDirectURL();
      if (newPreviewUrl !== currentPreview) {
        setCurrentPreview(newPreviewUrl);
      }
    }
  }, [livePreview, currentPreview]);

  const displayImage = currentPreview || room.thumbnail.getDirectURL();
  
  // Generate a consistent placeholder initial for the room creator
  const creatorInitial = room.id.substring(room.id.length - 2).toUpperCase();

  return (
    <div className={`hero-carousel-slide ${slideClass}`}>
      <div className="hero-slide-image-container">
        <img
          src={displayImage}
          alt={room.subject}
          className="hero-slide-image"
          loading="eager"
        />
        
        {/* LIVE badge positioned at top left of thumbnail */}
        <div className="hero-slide-live-badge">
          <div className="streaming-live-badge">
            <span className="streaming-live-dot" />
            <span className="streaming-live-text">LIVE</span>
          </div>
        </div>
        
        <div className="hero-slide-gradient" />
        
        <div className="hero-slide-content">
          <div className="hero-slide-header">
            <Avatar className="hero-slide-avatar">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-white">
                {creatorInitial}
              </AvatarFallback>
            </Avatar>
            <div className="hero-slide-text-content">
              <h2 className="hero-slide-title">{room.subject}</h2>
              <p className="hero-slide-description">{room.description}</p>
            </div>
          </div>
          
          <div className="hero-slide-meta">
            <div className="hero-slide-viewers">
              <Users className="h-5 w-5" />
              <span>{Number(room.participantCount)} watching now</span>
            </div>
            <Badge variant="secondary" className="hero-category-badge">
              {CATEGORY_LABELS[room.category as Category]}
            </Badge>
          </div>
          
          <Button 
            onClick={() => onJoin(room.id)} 
            className="hero-slide-cta"
            size="lg"
          >
            Join the Debate
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, roomCount }: { category: Category; roomCount: number }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate({ to: '/category/$categoryName', params: { categoryName: category } });
  };

  return (
    <div 
      className="category-card"
      onClick={handleClick}
    >
      <div className="category-card-thumbnail-container">
        <img
          src={CATEGORY_THUMBNAILS[category]}
          alt={CATEGORY_LABELS[category]}
          className="category-card-thumbnail"
          loading="lazy"
        />
      </div>
      <div className="category-card-overlay">
        <div className="category-card-icon">
          {CATEGORY_ICONS[category]}
        </div>
        <div className="category-card-content">
          <h3 className="category-card-title">{CATEGORY_LABELS[category]}</h3>
          <p className="category-card-count">{roomCount} {roomCount === 1 ? 'debate' : 'debates'}</p>
        </div>
      </div>
    </div>
  );
}

function CategoryRoomCard({ room, onJoin }: { room: any; onJoin: (roomId: string) => void }) {
  const { data: livePreview } = useGetLatestLivePreview(room.id);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (livePreview?.image) {
      const newPreviewUrl = livePreview.image.getDirectURL();
      
      if (newPreviewUrl !== currentPreview) {
        setIsTransitioning(true);
        
        const img = new Image();
        img.onload = () => {
          setTimeout(() => {
            setCurrentPreview(newPreviewUrl);
            setIsTransitioning(false);
          }, 150);
        };
        img.src = newPreviewUrl;
      }
    }
  }, [livePreview, currentPreview]);

  const displayImage = currentPreview || room.thumbnail.getDirectURL();
  
  // Generate a consistent placeholder initial for the room creator
  const creatorInitial = room.id.substring(room.id.length - 2).toUpperCase();

  return (
    <div 
      className="category-room-card"
      onClick={() => onJoin(room.id)}
    >
      <div className="category-room-thumbnail-container">
        <img
          src={displayImage}
          alt={room.subject}
          className={`category-room-thumbnail ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
          style={{
            transition: 'opacity 300ms ease-in-out',
          }}
          loading="lazy"
        />
        
        {/* LIVE badge positioned at top left of thumbnail */}
        <div className="category-room-live-badge">
          <div className="streaming-live-badge">
            <span className="streaming-live-dot" />
            <span className="streaming-live-text">LIVE</span>
          </div>
        </div>
        
        {/* User count positioned at bottom left of thumbnail */}
        <div className="category-room-user-count">
          <div className="streaming-viewer-count">
            <Users className="h-3.5 w-3.5" />
            <span>{Number(room.participantCount)}</span>
          </div>
        </div>
      </div>
      
      <div className="category-room-info">
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-10 w-10 flex-shrink-0 border-2 border-primary/20">
            <AvatarFallback className="text-xs font-medium bg-primary/10 text-white">
              {creatorInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="category-room-title">{room.subject}</h3>
            <p className="category-room-description">{room.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryDivider({ category, onNavigate }: { category: Category; onNavigate: () => void }) {
  return (
    <div className="category-divider">
      <div className="category-divider-line" />
      <button
        onClick={onNavigate}
        className="category-divider-link"
        aria-label={`Show all ${CATEGORY_LABELS[category]} debates`}
      >
        Show all &gt;
      </button>
      <div className="category-divider-line" />
    </div>
  );
}

export default function Lobby({ onEnterRoom }: LobbyProps) {
  const navigate = useNavigate();
  const { data: allRooms, isLoading: allRoomsLoading } = useGetRooms();
  const createRoom = useCreateRoom();
  const { data: userProfile, isLoading: profileLoading, isFetched: profileFetched } = useGetCallerUserProfile();
  const saveProfile = useSaveCallerUserProfile();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>(Category.uncategorized);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isJoining, setIsJoining] = useState(false);

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [activeDebaters, setActiveDebaters] = useState<ActiveDebater[]>([]);
  
  const [categoryCardsExpanded, setCategoryCardsExpanded] = useState(false);

  const sessionId = getSessionId();

  // Fetch active debaters for all rooms
  useEffect(() => {
    if (!allRooms) return;

    const fetchActiveDebaters = async () => {
      const debaters: ActiveDebater[] = [];
      
      for (const room of allRooms) {
        if (Number(room.participantCount) > 0) {
          // Create placeholder debaters based on participant count
          for (let i = 0; i < Math.min(Number(room.participantCount), 3); i++) {
            debaters.push({
              sessionId: `${room.id}_user_${i}`,
              roomId: room.id,
              roomSubject: room.subject,
              roomCategory: room.category as Category,
            });
          }
        }
      }
      
      setActiveDebaters(debaters);
    };

    fetchActiveDebaters();
    const interval = setInterval(fetchActiveDebaters, 5000);
    return () => clearInterval(interval);
  }, [allRooms]);

  // Get top 5 featured rooms (highest participant count)
  const featuredRooms = allRooms
    ?.slice()
    .sort((a, b) => Number(b.participantCount) - Number(a.participantCount))
    .slice(0, 5) || [];

  // Group rooms by category
  const roomsByCategory = allRooms?.reduce((acc, room) => {
    const cat = room.category;
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(room);
    return acc;
  }, {} as Record<Category, typeof allRooms>);

  // Calculate category counts
  const categoryCounts = allRooms?.reduce((acc, room) => {
    const cat = room.category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<Category, number>);

  const categories: Category[] = [
    Category.justChatting,
    Category.politics,
    Category.technology,
    Category.culture,
    Category.philosophy,
    Category.entertainment,
    Category.economics,
    Category.games,
    Category.conspiracy,
  ];

  // Filter categories to only include those with rooms
  const categoriesWithRooms = categories.filter(cat => {
    const categoryRooms = roomsByCategory?.[cat] || [];
    return categoryRooms.length > 0;
  });

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

      await createRoom.mutateAsync({ subject, description, thumbnail, category });
      
      toast.success('Room created successfully!');
      setIsDialogOpen(false);
      setSubject('');
      setDescription('');
      setCategory(Category.uncategorized);
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      toast.error('Failed to create room');
      console.error(error);
    }
  };

  const handleJoinRoomClick = (roomId: string) => {
    const room = allRooms?.find(r => r.id === roomId);
    if (room) {
      setSelectedRoom(room);
      setJoinModalOpen(true);
    }
  };

  const handleJoinWithRole = async (role: RoomRole) => {
    if (!selectedRoom) return;
    
    setIsJoining(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onEnterRoom(selectedRoom.id, role);
    } catch (error) {
      toast.error('Failed to join room');
      console.error(error);
      setIsJoining(false);
    }
  };

  const handleCancelJoin = () => {
    setJoinModalOpen(false);
    setSelectedRoom(null);
    setIsJoining(false);
  };

  const handleSaveProfile = async (profile: { name: string; avatar: ExternalBlob; sessionId: string }) => {
    await saveProfile.mutateAsync(profile);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCategoryClick = (cat: Category) => {
    setSelectedCategory(cat);
    // Scroll to the category section
    const categoryElement = document.getElementById(`category-section-${cat}`);
    if (categoryElement) {
      categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleViewMoreClick = (cat: Category) => {
    // Navigate to category page
    navigate({ to: '/category/$categoryName', params: { categoryName: cat } });
  };

  const filteredRooms = allRooms?.filter(room => 
    room.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if user has a valid avatar
  const hasValidAvatar = userProfile?.avatar && userProfile.avatar.getDirectURL() && userProfile.avatar.getDirectURL().trim() !== '';

  // Determine how many category cards to show - show all 10 or fewer by default, accordion only appears when more than 10
  const visibleCategoryCount = categoryCardsExpanded ? categories.length : 10;
  const visibleCategories = categories.slice(0, visibleCategoryCount);
  const hasMoreCategories = categories.length > 10;

  return (
    <div className="streaming-platform-layout">
      {/* Top Navigation Bar */}
      <nav className="streaming-top-nav">
        <div className="streaming-nav-content">
          {/* Left: Logo and Sidebar Toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="streaming-sidebar-toggle"
            >
              <Menu style={{ width: '1.25rem', height: '1.25rem' }} />
            </Button>
            <div className="flex items-center">
              <span className="text-xl font-bold sparr-logo-text">sparr</span>
            </div>
          </div>

          {/* Center: Search Bar (Desktop) */}
          <div className="streaming-search-container hidden md:flex">
            <Search className="streaming-search-icon" style={{ width: '1.25rem', height: '1.25rem' }} />
            <Input
              type="text"
              placeholder="Search debates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="streaming-search-input"
            />
          </div>

          {/* Right: Search Icon (Mobile), Create Button, User Profile */}
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="streaming-create-button">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <Video className="h-6 w-6 text-primary" />
                    Create New Room
                  </DialogTitle>
                  <DialogDescription>
                    Set up a new room for live communication
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateRoom} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Enter room subject..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this room is about..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={category}
                      onValueChange={(value) => setCategory(value as Category)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Category.justChatting}>Just Chatting</SelectItem>
                        <SelectItem value={Category.politics}>Politics</SelectItem>
                        <SelectItem value={Category.technology}>Tech</SelectItem>
                        <SelectItem value={Category.culture}>Culture</SelectItem>
                        <SelectItem value={Category.philosophy}>Philosophy</SelectItem>
                        <SelectItem value={Category.entertainment}>Entertainment</SelectItem>
                        <SelectItem value={Category.economics}>Economics</SelectItem>
                        <SelectItem value={Category.games}>Games</SelectItem>
                        <SelectItem value={Category.conspiracy}>Conspiracy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thumbnail">Thumbnail Image</Label>
                    <div className="flex flex-col gap-3">
                      <Input
                        id="thumbnail"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        required
                      />
                      {imagePreview && (
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
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
                    className="w-full" 
                    disabled={createRoom.isPending}
                  >
                    {createRoom.isPending ? 'Creating...' : 'Create Room'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Mobile Search Icon */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchModalOpen(true)}
              className="md:hidden"
            >
              <Search style={{ width: '1.25rem', height: '1.25rem' }} />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="streaming-user-avatar p-0 h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    {hasValidAvatar ? (
                      <AvatarImage src={userProfile.avatar.getDirectURL()} alt={userProfile.name} className="object-cover" />
                    ) : (
                      <AvatarFallback className="text-xs font-medium text-white">
                        {userProfile?.name ? getInitials(userProfile.name) : sessionId.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setProfileEditOpen(true)}>
                  <UserCircle className="h-4 w-4 mr-2" />
                  Edit Profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <div className="streaming-main-layout">
        {/* Left Sidebar with Active Debaters */}
        <aside className={`streaming-sidebar ${sidebarOpen ? 'streaming-sidebar-open' : 'streaming-sidebar-closed'}`}>
          <div className="streaming-sidebar-content">
            <div className="streaming-sidebar-section">
              <h3 className="streaming-sidebar-title">Browse</h3>
              <nav className="streaming-sidebar-nav">
                <button className="streaming-sidebar-item streaming-sidebar-item-active">
                  <TrendingUp className="h-5 w-5" />
                  <span>Featured</span>
                </button>
                <button className="streaming-sidebar-item">
                  <Clock className="h-5 w-5" />
                  <span>Recent</span>
                </button>
                <button className="streaming-sidebar-item">
                  <Star className="h-5 w-5" />
                  <span>Popular</span>
                </button>
              </nav>
            </div>

            <div className="streaming-sidebar-section">
              <h3 className="streaming-sidebar-title">Categories</h3>
              <nav className="streaming-sidebar-nav">
                <button className="streaming-sidebar-item">
                  <Filter className="h-5 w-5" />
                  <span>All Debates</span>
                </button>
                <button className="streaming-sidebar-item">
                  <Video className="h-5 w-5" />
                  <span>Live Now</span>
                </button>
                <button className="streaming-sidebar-item">
                  <Users className="h-5 w-5" />
                  <span>Community</span>
                </button>
              </nav>
            </div>

            {/* Active Debaters Section */}
            {sidebarOpen && (
              <div className="streaming-sidebar-section">
                <div className="flex items-center justify-between px-4 mb-2">
                  <h3 className="streaming-sidebar-title">Active Debaters</h3>
                  <Badge variant="secondary" className="text-xs">
                    {activeDebaters.length}
                  </Badge>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="flex flex-col gap-2 px-2">
                    {activeDebaters.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                        <Users className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-xs text-muted-foreground text-center">No active debaters</p>
                      </div>
                    ) : (
                      activeDebaters.map((debater, index) => (
                        <div key={`${debater.sessionId}-${index}`} className="sidebar-debater-card">
                          <div className="sidebar-avatar-container">
                            <Avatar className="sidebar-debater-avatar">
                              <AvatarFallback className="sidebar-avatar-fallback">
                                {debater.sessionId.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="sidebar-live-ring" />
                          </div>
                          
                          <div className="sidebar-debater-info">
                            <p className="sidebar-debater-id">
                              {debater.sessionId.substring(0, 8)}
                            </p>
                            <p className="sidebar-room-name">
                              {debater.roomSubject}
                            </p>
                            <Badge variant="outline" className="sidebar-category-badge">
                              {CATEGORY_LABELS[debater.roomCategory]}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="streaming-content-area-full">
          {allRoomsLoading ? (
            <div className="space-y-8">
              <Skeleton className="w-full h-96 rounded-xl" />
              <Skeleton className="w-48 h-8" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-64 rounded-lg" />
                ))}
              </div>
            </div>
          ) : !allRooms || allRooms.length === 0 ? (
            <Card className="streaming-empty-state">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">No debates found</h3>
                  <p className="text-muted-foreground">
                    Be the first to create a debate room
                  </p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Room
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Hero Carousel Section */}
              {featuredRooms.length > 0 && (
                <section className="hero-spotlight-section">
                  <HeroCarousel
                    rooms={featuredRooms}
                    onJoin={handleJoinRoomClick}
                  />
                </section>
              )}

              {/* Category Cards Section - Show all 10 or fewer by default, accordion only when more than 10 */}
              <section className="category-cards-section">
                <div className="category-cards-header">
                  <h2 className="category-cards-title">Browse by Category</h2>
                </div>
                
                <div className={`category-cards-static-grid ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                  {visibleCategories.map((cat) => (
                    <CategoryCard
                      key={cat}
                      category={cat}
                      roomCount={categoryCounts?.[cat] || 0}
                    />
                  ))}
                </div>
                
                {/* Show more accordion - only appears when there are more than 10 categories */}
                {hasMoreCategories && !categoryCardsExpanded && (
                  <div className="category-cards-show-more">
                    <button
                      onClick={() => setCategoryCardsExpanded(true)}
                      className="category-cards-show-more-button"
                      aria-label="Show more categories"
                    >
                      <span>Show more</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </section>

              {/* Category-Based Sections with Responsive Static Grid and Dividers */}
              {categoriesWithRooms.map((cat, index) => {
                const categoryRooms = roomsByCategory?.[cat] || [];

                return (
                  <div key={cat}>
                    <section id={`category-section-${cat}`} className="category-section">
                      <div className="category-section-header">
                        <h2 className="category-section-title">{CATEGORY_LABELS[cat]}</h2>
                      </div>
                      
                      <div className="category-rooms-grid">
                        {categoryRooms.map((room) => (
                          <CategoryRoomCard
                            key={room.id}
                            room={room}
                            onJoin={handleJoinRoomClick}
                          />
                        ))}
                      </div>
                    </section>

                    {/* Add divider after each category section except the last one */}
                    {index < categoriesWithRooms.length - 1 && (
                      <CategoryDivider
                        category={cat}
                        onNavigate={() => handleViewMoreClick(cat)}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>

      {/* Room Join Modal */}
      {selectedRoom && (
        <RoomJoinModal
          isOpen={joinModalOpen}
          roomSubject={selectedRoom.subject}
          participantCount={Number(selectedRoom.participantCount)}
          onJoin={handleJoinWithRole}
          onCancel={handleCancelJoin}
          isJoining={isJoining}
        />
      )}

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={profileEditOpen}
        onClose={() => setProfileEditOpen(false)}
        currentProfile={userProfile ?? null}
        onSave={handleSaveProfile}
        sessionId={sessionId}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}
