import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t-2 border-primary/10 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          © 2025. Built with{' '}
          <Heart className="inline h-4 w-4 fill-destructive text-destructive animate-pulse-soft" /> using{' '}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary hover:text-accent transition-colors hover:underline decoration-2 decoration-accent"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}

