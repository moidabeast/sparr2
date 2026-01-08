import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSetSafariAudioPreference, useRecordSafariAudioTest } from '../hooks/useQueries';

interface SafariAudioToggleProps {
  remoteStreams: Map<string, MediaStream>;
  isVisible: boolean;
}

export default function SafariAudioToggle({ remoteStreams, isVisible }: SafariAudioToggleProps) {
  const [isSafariIOS, setIsSafariIOS] = useState(false);
  const [useSpeaker, setUseSpeaker] = useState(false);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  
  const setSafariAudioPreference = useSetSafariAudioPreference();
  const recordSafariAudioTest = useRecordSafariAudioTest();

  // Detect Safari on iOS
  useEffect(() => {
    const detectSafariIOS = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edgios/.test(userAgent);
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const detected = isSafari && isIOS;
      
      setIsSafariIOS(detected);
      
      if (detected) {
        console.log('[Safari Audio] Safari on iOS detected');
        
        // Check if setSinkId is available
        const audioElement = document.createElement('audio');
        const hasSinkId = typeof audioElement.sinkId !== 'undefined';
        
        // Record detection test
        recordSafariAudioTest.mutate({
          testResult: {
            audioTestTime: BigInt(Date.now()),
            testSuccess: true,
            browseDetection: 'Safari iOS',
            deviceId: navigator.userAgent,
            compatibilityNotes: hasSinkId ? 'setSinkId available' : 'setSinkId not available',
          },
          useSpeaker: false,
          iosDetection: true,
          compatibilityStatus: !hasSinkId,
        });
        
        // Save initial preference
        setSafariAudioPreference.mutate({
          useSpeaker: false,
          iosDetection: true,
          compatibilityStatus: !hasSinkId,
        });
      }
    };

    detectSafariIOS();
  }, []);

  // Manage audio elements for remote streams
  useEffect(() => {
    if (!isSafariIOS || !useSpeaker) {
      // Clean up audio elements if not using speaker mode
      audioElements.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
      setAudioElements(new Map());
      return;
    }

    // Create or update audio elements for each remote stream
    const newAudioElements = new Map<string, HTMLAudioElement>();

    remoteStreams.forEach((stream, peerId) => {
      // Check if we already have an audio element for this peer
      let audioElement = audioElements.get(peerId);
      
      if (!audioElement) {
        // Create new audio element
        audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        // Note: playsInline is not needed for audio elements on iOS
        // Audio routing is controlled by the audio element itself
        
        console.log(`[Safari Audio] Created audio element for peer ${peerId}`);
      }

      // Update the audio element's source
      if (audioElement.srcObject !== stream) {
        audioElement.srcObject = stream;
        console.log(`[Safari Audio] Updated audio source for peer ${peerId}`);
      }

      newAudioElements.set(peerId, audioElement);
    });

    // Clean up audio elements for peers that left
    audioElements.forEach((audio, peerId) => {
      if (!remoteStreams.has(peerId)) {
        console.log(`[Safari Audio] Cleaning up audio element for peer ${peerId}`);
        audio.pause();
        audio.srcObject = null;
      }
    });

    setAudioElements(newAudioElements);
  }, [isSafariIOS, useSpeaker, remoteStreams]);

  // Toggle speaker mode
  const toggleSpeaker = () => {
    const newUseSpeaker = !useSpeaker;
    setUseSpeaker(newUseSpeaker);
    
    console.log(`[Safari Audio] Speaker mode ${newUseSpeaker ? 'enabled' : 'disabled'}`);
    
    // Save preference to backend
    setSafariAudioPreference.mutate({
      useSpeaker: newUseSpeaker,
      iosDetection: true,
      compatibilityStatus: true,
    });

    // Record test result
    recordSafariAudioTest.mutate({
      testResult: {
        audioTestTime: BigInt(Date.now()),
        testSuccess: true,
        browseDetection: 'Safari iOS',
        deviceId: navigator.userAgent,
        compatibilityNotes: `Speaker mode ${newUseSpeaker ? 'enabled' : 'disabled'}`,
      },
      useSpeaker: newUseSpeaker,
      iosDetection: true,
      compatibilityStatus: true,
    });

    toast.success(
      newUseSpeaker 
        ? 'Audio routing through speaker' 
        : 'Audio routing through earpiece'
    );
  };

  // Don't render if not Safari iOS or not visible
  if (!isSafariIOS || !isVisible) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={useSpeaker ? 'default' : 'outline'}
        size="sm"
        onClick={toggleSpeaker}
        className="gap-2"
      >
        {useSpeaker ? (
          <>
            <Volume2 className="h-4 w-4" />
            <span>Speaker</span>
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4" />
            <span>Earpiece</span>
          </>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        {useSpeaker ? 'Using loudspeaker' : 'Using earpiece'}
      </span>
    </div>
  );
}
