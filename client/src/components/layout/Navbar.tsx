import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar as HeroNavbar,
  Input,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from '@heroui/react';
import { Play, Puzzle, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlugins } from '../../hooks/usePlugins';

export default function Navbar() {
  const navigate = useNavigate();
  const { plugins, activePlugin, setActivePlugin } = usePlugins();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <HeroNavbar
      maxWidth="full"
      isBordered
      classNames={{
        base: 'bg-background/80 backdrop-blur-xl border-b border-white/5',
        wrapper: 'px-4 sm:px-6',
      }}
    >
      <NavbarBrand
        className="cursor-pointer gap-3"
        onClick={() => navigate('/')}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Play className="text-white w-5 h-5 fill-white" />
          </div>
          <p className="font-bold text-lg text-foreground hidden sm:block">
            CloudStream<span className="text-primary">Web</span>
          </p>
        </div>
      </NavbarBrand>

      <NavbarContent className="flex-1 max-w-xl mx-4" justify="center">
        <NavbarItem className="w-full">
          <Input
            classNames={{
              base: 'w-full',
              inputWrapper: 'bg-default-100/50 hover:bg-default-100 border border-white/5 transition-colors',
            }}
            placeholder="Search movies, series, anime..."
            size="sm"
            startContent={
              <Search className="w-4 h-4 text-default-400" />
            }
            type="search"
            value={searchQuery}
            onValueChange={setSearchQuery}
            onKeyDown={handleKeyDown}
          />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem>
          <Dropdown backdrop="blur">
            <DropdownTrigger>
              <Button
                variant="flat"
                size="sm"
                className="bg-default-100/50 border border-white/5 font-medium"
                startContent={
                  <Puzzle className="w-4 h-4 text-primary" />
                }
              >
                {activePlugin?.name || 'Plugins'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Plugin selection"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={activePlugin ? new Set([activePlugin.id]) : new Set()}
              onSelectionChange={(keys) => {
                const id = Array.from(keys)[0] as string;
                const plugin = plugins.find(p => p.id === id);
                if (plugin) setActivePlugin(plugin);
              }}
            >
              {plugins.map((p) => (
                <DropdownItem
                  key={p.id}
                  description={`v${p.version}`}
                  startContent={<Puzzle className="w-4 h-4 opacity-50 text-primary" />}
                >
                  {p.name}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>
    </HeroNavbar>
  );
}
