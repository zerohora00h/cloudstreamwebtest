import { Divider, Spinner } from '@heroui/react';
import { Ghost } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaCarousel from '../components/media/MediaCarousel';
import { api, type MultiSearchResult } from '../services/api';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<MultiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;

    const performSearch = async () => {
      setLoading(true);
      try {
        const data = await api.searchAll(query);
        setResults(data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-10 px-1">
        <h1 className="text-3xl font-extrabold mb-2 text-foreground/90 tracking-tight">
          Resultados para <span className="text-primary">"{query}"</span>
        </h1>
        <p className="text-default-500">
          Buscando em todos os plugins instalados...
        </p>
      </div>

      {loading && results.length === 0 && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" color="primary" label="Buscando..." labelColor="primary" />
        </div>
      )}

      <div className="space-y-12">
        {results.map((pluginResult) => (
          <div key={pluginResult.pluginId} className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <MediaCarousel
              title={pluginResult.pluginName}
              items={pluginResult.results}
              pluginId={pluginResult.pluginId}
            />
            <Divider className="opacity-5" />
          </div>
        ))}
      </div>

      {!loading && results.length === 0 && query && (
        <div className="flex flex-col items-center justify-center py-32 opacity-40">
          <Ghost className="w-16 h-16 mb-4" />
          <p className="text-xl font-medium">Nenhum resultado encontrado.</p>
          <p className="text-sm">Tente outros termos ou mude os plugins.</p>
        </div>
      )}
    </div>
  );
}
