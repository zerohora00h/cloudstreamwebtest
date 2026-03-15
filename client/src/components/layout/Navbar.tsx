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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Switch,
  Slider
} from '@heroui/react';
import { Play, Puzzle, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlugins } from '../../hooks/usePlugins';
import { useSettings } from '../../contexts/SettingsContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { plugins, activePlugin, setActivePlugin } = usePlugins();
  const { settings, updateSetting } = useSettings();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
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
    <>
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
                  if (plugin) {
                    setActivePlugin(plugin);
                    navigate('/');
                  }
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

          <NavbarItem>
            <Button
              isIconOnly
              variant="flat"
              size="sm"
              className="bg-default-100/50 border border-white/5"
              onPress={onOpen}
            >
              <Settings className="w-4 h-4 text-default-500 hover:text-primary transition-colors" />
            </Button>
          </NavbarItem>
        </NavbarContent>
      </HeroNavbar>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Configurações do Sistema</ModalHeader>
              <ModalBody>
                {settings ? (
                  <div className="flex flex-col gap-6 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Cache no Servidor</p>
                        <p className="text-xs text-default-500">Salvar dados de catálogo localmente para agilizar próximos carregamentos</p>
                      </div>
                      <Switch 
                        size="sm" 
                        color="primary"
                        isSelected={settings.cacheData}
                        onValueChange={(val) => updateSetting('cacheData', val)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Sincronização em Segundo Plano</p>
                        <p className="text-xs text-default-500">Buscar novos episódios em 2º plano e notificar interface</p>
                      </div>
                      <Switch 
                        size="sm" 
                        color="primary"
                        isSelected={settings.syncEnabled}
                        onValueChange={(val) => updateSetting('syncEnabled', val)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Baixar Imagens (Futuro)</p>
                        <p className="text-xs text-default-500">Salvar posters no disco para uso completamente offline</p>
                      </div>
                      <Switch 
                        size="sm" 
                        color="secondary"
                        isSelected={settings.downloadImagesLocally}
                        onValueChange={(val) => updateSetting('downloadImagesLocally', val)}
                      />
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <p className="text-xs text-default-400 uppercase tracking-wider mb-4 font-semibold">Pré-Carregamento Recursivo</p>

                      <div className="flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">Home Recursiva</p>
                            <p className="text-xs text-default-500">Pré-carregar detalhes de todos os itens da Home automaticamente</p>
                          </div>
                          <Switch 
                            size="sm" 
                            color="warning"
                            isSelected={settings.recursiveHomeSync}
                            onValueChange={(val) => updateSetting('recursiveHomeSync', val)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">Séries Recursiva</p>
                            <p className="text-xs text-default-500">Pré-carregar episódios de todas as temporadas ao abrir uma série</p>
                          </div>
                          <Switch 
                            size="sm" 
                            color="warning"
                            isSelected={settings.recursiveSeriesSync}
                            onValueChange={(val) => updateSetting('recursiveSeriesSync', val)}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">Carregamentos Simultâneos</p>
                            <p className="text-xs text-default-500">Quantidade de requisições paralelas durante o pré-carregamento</p>
                          </div>
                          <Slider
                            size="sm"
                            step={1}
                            minValue={1}
                            maxValue={3}
                            value={settings.recursiveConcurrency}
                            onChange={(val) => updateSetting('recursiveConcurrency', val as number)}
                            color="warning"
                            showSteps
                            marks={[
                              { value: 1, label: '1' },
                              { value: 2, label: '2' },
                              { value: 3, label: '3' },
                            ]}
                            className="max-w-full"
                            isDisabled={!settings.recursiveHomeSync && !settings.recursiveSeriesSync}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 flex justify-center text-sm text-default-500">
                    Carregando configurações...
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="flat" onPress={onClose}>
                  Fechar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
