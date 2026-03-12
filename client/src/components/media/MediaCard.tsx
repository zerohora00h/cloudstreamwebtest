import { Card, CardFooter, Chip, Image } from '@heroui/react';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '../../services/api';

interface MediaCardProps {
  item: MediaItem;
  pluginId: string;
}

export default function MediaCard({ item, pluginId }: MediaCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const encodedUrl = encodeURIComponent(item.url);
    navigate(`/details/${pluginId}/${encodedUrl}`);
  };

  return (
    <Card
      isPressable
      onPress={handleClick}
      className="group relative w-full aspect-2/3 border-none bg-transparent overflow-hidden"
      radius="lg"
    >
      <Image
        removeWrapper
        alt={item.name}
        className="z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        src={item.posterUrl || 'https://via.placeholder.com/300x450?text=No+Image'}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 z-10 bg-linear-to-t from-black/95 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Audio badge (Dub/Leg) */}
      {item.audio && (
        <div className="absolute top-2 left-2 z-20">
          <Chip
            size="sm"
            variant="solid"
            classNames={{
              base: `${item.audio.toLowerCase().includes('dub') ? 'bg-blue-600' : 'bg-green-600'} border-none`,
              content: 'text-white font-black text-[10px]',
            }}
          >
            {item.audio.toUpperCase()}
          </Chip>
        </div>
      )}

      {/* Score badge */}
      {item.score && (
        <div className="absolute top-2 right-2 z-20">
          <Chip
            size="sm"
            variant="shadow"
            classNames={{
              base: 'bg-warning/90 backdrop-blur-sm border-none',
              content: 'text-black font-bold text-xs',
            }}
            startContent={<Star className="w-3 h-3 fill-black" />}
          >
            {item.score.toFixed(1)}
          </Chip>
        </div>
      )}

      {/* Bottom info */}
      <CardFooter className="absolute bottom-0 z-20 flex-col items-start gap-1 p-3">
        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 drop-shadow-sm">
          {item.name}
        </h3>
        <div className="flex items-center gap-2">
          {item.year && (
            <Chip size="sm" variant="flat" classNames={{ base: 'bg-primary/20', content: 'text-primary-300 text-[10px] font-medium' }}>
              {item.year}
            </Chip>
          )}
          <Chip
            size="sm"
            variant="dot"
            color={item.type === 'TvSeries' ? 'secondary' : 'primary'}
            classNames={{ content: 'text-[10px] text-default-400 font-medium' }}
          >
            {item.type === 'TvSeries' ? 'Série' : item.type === 'Anime' ? 'Anime' : 'Filme'}
          </Chip>
        </div>
      </CardFooter>
    </Card>
  );
}
