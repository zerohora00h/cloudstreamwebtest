import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type PluginManifest } from '../services/api';

interface PluginContextType {
  plugins: PluginManifest[];
  activePlugin: PluginManifest | null;
  setActivePlugin: (plugin: PluginManifest) => void;
  loading: boolean;
}

const PluginContext = createContext<PluginContextType>({
  plugins: [],
  activePlugin: null,
  setActivePlugin: () => { },
  loading: true,
});

export function PluginProvider({ children }: { children: ReactNode }) {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activePlugin, setActivePlugin] = useState<PluginManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPlugins().then((list) => {
      setPlugins(list);
      if (list.length > 0) setActivePlugin(list[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <PluginContext.Provider value={{ plugins, activePlugin, setActivePlugin, loading }}>
      {children}
    </PluginContext.Provider>
  );
}

export function usePlugins() {
  return useContext(PluginContext);
}
