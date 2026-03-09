import { Button } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import type { MediaItem } from '../../services/api';
import MediaCard from './MediaCard';

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
  pluginId: string;
}

export default function MediaCarousel({ title, items, pluginId }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (!items.length) return null;

  return (
    <section className="mb-10 last:mb-4">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <div className="w-1.5 h-6 bg-linear-to-b from-primary-400 to-primary-600 rounded-full" />
          {title}
        </h2>
        <div className="flex gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="bg-default-100/50 hover:bg-default-200"
            onPress={() => scroll('left')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="bg-default-100/50 hover:bg-default-200"
            onPress={() => scroll('right')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, i) => (
          <div key={`${item.url}-${i}`} className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px]">
            <MediaCard item={item} pluginId={pluginId} />
          </div>
        ))}
      </div>
    </section>
  );
}
