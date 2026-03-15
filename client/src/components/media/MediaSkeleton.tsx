import { Card, Skeleton } from '@heroui/react';

export default function MediaSkeleton() {
  return (
    <section className="mb-10 last:mb-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-4 px-1">
        <Skeleton className="w-1.5 h-6 rounded-full bg-default-200" />
        <Skeleton className="w-48 h-6 rounded-lg bg-default-200" />
      </div>

      <div className="flex gap-4 overflow-hidden px-1">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <Card
            key={idx}
            className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px] aspect-2/3 border-none bg-default-100"
            radius="lg"
          >
            <Skeleton className="w-full h-full rounded-lg bg-default-200" />
          </Card>
        ))}
      </div>
    </section>
  );
}
