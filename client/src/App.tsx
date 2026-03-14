import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { PluginProvider } from './hooks/usePlugins';
import Details from './pages/Details';
import Home from './pages/Home';
import Search from './pages/Search';
import Watch from './pages/Watch';

import { SettingsProvider } from './contexts/SettingsContext';
import { SyncProvider } from './contexts/SyncContext';

export default function App() {
  return (
    <SettingsProvider>
      <SyncProvider>
        <PluginProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/details/:pluginId/:url" element={<Details />} />
              <Route path="/watch" element={<Watch />} />
            </Route>
          </Routes>
        </PluginProvider>
      </SyncProvider>
    </SettingsProvider>

  );
}
