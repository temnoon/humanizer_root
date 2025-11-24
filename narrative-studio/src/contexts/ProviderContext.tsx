import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'narrative-studio-provider';
const MODEL_CONFIG_KEY = 'narrative-studio-model-config';

export function ProviderProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<Provider>('local');
  const [modelConfig, setModelConfigState] = useState<ModelConfig>({
    persona: 'qwen3:latest',
    style: 'qwen3:latest',
    translation: 'qwen3:latest',
  });
  const [isLocalAvailable, setIsLocalAvailable] = useState(false);
  const [isCloudAvailable, setIsCloudAvailable] = useState(false);

  // Load saved provider preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Provider | null;
    if (saved === 'local' || saved === 'cloudflare') {
      setProviderState(saved);
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

  // Check local availability (wrangler dev on :8787)
  useEffect(() => {
    fetch('http://localhost:8787/health', { signal: AbortSignal.timeout(2000) })
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
