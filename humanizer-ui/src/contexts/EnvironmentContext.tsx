/**
 * Environment Context
 * Detects and provides environment information (Electron vs Web)
 * Manages API routing and feature availability
 */

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';

export type Environment = 'electron' | 'web';
export type Provider = 'local' | 'cloudflare';

interface EnvironmentContextValue {
  environment: Environment;
  isElectron: boolean;
  isWeb: boolean;
  provider: Provider;
  setProvider: (provider: Provider) => void;

  // Feature availability based on environment
  features: {
    localArchives: boolean;
    localTransforms: boolean;
    cloudTransforms: boolean;
    nodeNetwork: boolean;
    bookBuilder: boolean;
  };

  // API endpoints
  api: {
    archive: string | null;
    npe: string;
    postSocial: string;
  };
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined);

interface EnvironmentProviderProps {
  children: ReactNode;
}

export function EnvironmentProvider({ children }: EnvironmentProviderProps) {
  const [environment, setEnvironment] = useState<Environment>('web');
  const [provider, setProvider] = useState<Provider>(() => {
    const saved = localStorage.getItem('humanizer-provider');
    return (saved === 'local' || saved === 'cloudflare') ? saved : 'cloudflare';
  });

  // Detect environment on mount
  useEffect(() => {
    const isElectronEnv = !!(window as any).electronAPI || navigator.userAgent.includes('Electron');
    setEnvironment(isElectronEnv ? 'electron' : 'web');
  }, []);

  // Persist provider choice
  useEffect(() => {
    localStorage.setItem('humanizer-provider', provider);
  }, [provider]);

  const isElectron = environment === 'electron';
  const isWeb = environment === 'web';

  // Determine feature availability
  const features = {
    localArchives: isElectron, // Only in Electron
    localTransforms: isElectron && provider === 'local', // Electron + local provider
    cloudTransforms: true, // Always available
    nodeNetwork: true, // Always available
    bookBuilder: true, // Always available
  };

  // Determine API endpoints
  const api = {
    // Archive server runs on localhost:3002 and is accessible to both web and Electron
    archive: 'http://localhost:3002',
    npe: provider === 'local'
      ? 'http://localhost:8787'
      : 'https://npe-api.tem-527.workers.dev',
    postSocial: provider === 'local'
      ? 'http://localhost:8788'
      : 'https://post-social-api.tem-527.workers.dev',
  };

  const value: EnvironmentContextValue = {
    environment,
    isElectron,
    isWeb,
    provider,
    setProvider,
    features,
    api,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}
