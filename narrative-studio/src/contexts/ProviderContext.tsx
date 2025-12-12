import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { isOllamaAvailable } from '../services/ollamaService';
import { STORAGE_PATHS } from '../config/storage-paths';
import { isElectron as isElectronApp } from '../config/feature-flags';

export type Provider = 'local' | 'cloudflare';

export interface ModelConfig {
  persona?: string;
  style?: string;
  translation?: string;
}

interface ProviderContextType {
  provider: Provider;
  setProvider: (provider: Provider) => void;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => void;
  isLocalAvailable: boolean;
  isCloudAvailable: boolean;
  isOllamaAvailable: boolean;
  isElectron: boolean;
  useOllamaForLocal: boolean; // When true, 'local' provider uses Ollama directly
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'narrative-studio-provider';
const MODEL_CONFIG_KEY = 'narrative-studio-model-config';

export function ProviderProvider({ children }: { children: ReactNode }) {
  // Default to 'cloudflare' in web app, 'local' in Electron
  const defaultProvider: Provider = isElectronApp ? 'local' : 'cloudflare';
  const [provider, setProviderState] = useState<Provider>(defaultProvider);
  const [modelConfig, setModelConfigState] = useState<ModelConfig>({
    persona: 'qwen3:latest',
    style: 'qwen3:latest',
    translation: 'qwen3:latest',
  });
  const [isLocalAvailable, setIsLocalAvailable] = useState(false);
  const [isCloudAvailable, setIsCloudAvailable] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [isElectron, setIsElectron] = useState(isElectronApp);
  const [useOllamaForLocal, setUseOllamaForLocal] = useState(false);

  // Load saved provider preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Provider | null;
    if (saved === 'local' || saved === 'cloudflare') {
      // In web app, ignore 'local' preference (force cloudflare)
      if (!isElectronApp && saved === 'local') {
        setProviderState('cloudflare');
        localStorage.setItem(STORAGE_KEY, 'cloudflare');
      } else {
        setProviderState(saved);
      }
    }

    const savedConfig = localStorage.getItem(MODEL_CONFIG_KEY);
    if (savedConfig) {
      try {
        setModelConfigState(JSON.parse(savedConfig));
      } catch (e) {
        console.warn('Failed to parse model config:', e);
      }
    }
  }, []);

  // Check local availability (wrangler dev)
  useEffect(() => {
    fetch(`${STORAGE_PATHS.npeApiUrl}/health`, { signal: AbortSignal.timeout(2000) })
      .then(res => res.ok)
      .then(ok => {
        setIsLocalAvailable(ok);
        console.log('[Provider] Local backend:', ok ? 'Available ✅' : 'Unavailable ❌');
      })
      .catch(() => {
        setIsLocalAvailable(false);
        console.log('[Provider] Local backend: Unavailable ❌');
      });
  }, []);

  // Check cloud availability
  useEffect(() => {
    fetch('https://npe-api.tem-527.workers.dev/health', { signal: AbortSignal.timeout(3000) })
      .then(res => res.ok)
      .then(ok => {
        setIsCloudAvailable(ok);
        console.log('[Provider] Cloud backend:', ok ? 'Available ✅' : 'Unavailable ❌');
      })
      .catch(() => {
        setIsCloudAvailable(false);
        console.log('[Provider] Cloud backend: Unavailable ❌');
      });
  }, []);

  // Log Electron mode (state is initialized from feature-flags)
  useEffect(() => {
    console.log('[Provider] Electron mode:', isElectronApp ? 'Yes ✅' : 'No ❌');
    console.log('[Provider] Default provider:', defaultProvider);
  }, []);

  // Check Ollama availability (for Electron mode)
  useEffect(() => {
    async function checkOllama() {
      try {
        const available = await isOllamaAvailable();
        setOllamaAvailable(available);
        console.log('[Provider] Ollama:', available ? 'Available ✅' : 'Unavailable ❌');

        // In Electron with Ollama available, use Ollama for local provider
        if (isElectron && available) {
          // Check if user has configured Ollama (not skipped)
          const ollamaSkipped = window.electronAPI
            ? await window.electronAPI.store.get('ollamaSkipped')
            : true;

          setUseOllamaForLocal(!ollamaSkipped);
          console.log('[Provider] Use Ollama for local:', !ollamaSkipped ? 'Yes ✅' : 'No ❌');
        }
      } catch {
        setOllamaAvailable(false);
      }
    }

    checkOllama();
    // Re-check every 30 seconds
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, [isElectron]);

  const setProvider = (newProvider: Provider) => {
    setProviderState(newProvider);
    localStorage.setItem(STORAGE_KEY, newProvider);
    console.log(`[Provider] Switched to: ${newProvider.toUpperCase()}`);
  };

  const setModelConfig = (config: ModelConfig) => {
    setModelConfigState(config);
    localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
    console.log('[Provider] Model config updated:', config);
  };

  return (
    <ProviderContext.Provider
      value={{
        provider,
        setProvider,
        modelConfig,
        setModelConfig,
        isLocalAvailable,
        isCloudAvailable,
        isOllamaAvailable: ollamaAvailable,
        isElectron,
        useOllamaForLocal,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new Error('useProvider must be used within ProviderProvider');
  }
  return context;
}
