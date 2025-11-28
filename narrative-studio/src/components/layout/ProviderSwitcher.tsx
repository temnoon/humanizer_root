import { useProvider, type Provider } from '../../contexts/ProviderContext';

export function ProviderSwitcher() {
  const {
    provider,
    setProvider,
    isLocalAvailable,
    isCloudAvailable,
    isOllamaAvailable,
    isElectron,
    useOllamaForLocal,
  } = useProvider();

  const handleToggle = () => {
    const newProvider: Provider = provider === 'local' ? 'cloudflare' : 'local';
    setProvider(newProvider);
  };

  const getStatusIndicator = (providerType: Provider) => {
    const isActive = provider === providerType;

    if (providerType === 'local') {
      // In Electron with Ollama configured, check Ollama availability
      // Otherwise check wrangler dev availability
      const isAvailable = isElectron && useOllamaForLocal
        ? isOllamaAvailable
        : isLocalAvailable;

      if (isActive) {
        return isAvailable ? '🟢' : '🔴';
      }
      return isAvailable ? '⚪' : '⚫';
    } else {
      // Cloud provider
      if (isActive) {
        return isCloudAvailable ? '🟢' : '🔴';
      }
      return isCloudAvailable ? '⚪' : '⚫';
    }
  };

  const getProviderLabel = (providerType: Provider) => {
    if (providerType === 'local') {
      // Show "Ollama" in Electron mode, "Local API" in browser
      return isElectron && useOllamaForLocal ? 'Ollama' : 'Local (wrangler)';
    }
    return 'Cloud (CF Workers)';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Provider indicator */}
      <div
        className="text-tiny font-medium px-2 py-1 rounded"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
        }}
        title={`Using: ${getProviderLabel(provider)}`}
      >
        <span style={{ marginRight: '4px' }}>
          {getStatusIndicator(provider)}
        </span>
        {provider === 'local' ? 'Local' : 'Cloud'}
      </div>

      {/* Toggle switch */}
      <button
        onClick={handleToggle}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
        style={{
          backgroundColor: provider === 'cloudflare' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
        title={`Switch to ${provider === 'local' ? 'Cloud (Cloudflare Workers)' : 'Local (Ollama)'}`}
        aria-label="Toggle AI provider"
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full transition-transform"
          style={{
            backgroundColor: 'var(--text-inverse)',
            transform: provider === 'cloudflare' ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
          }}
        />
      </button>

      {/* Availability tooltips */}
      {provider === 'local' && (
        <>
          {isElectron && useOllamaForLocal && !isOllamaAvailable && (
            <div
              className="text-tiny"
              style={{ color: 'var(--error)' }}
              title="Ollama not running. Start Ollama or use Cloud provider."
            >
              ⚠️
            </div>
          )}
          {(!isElectron || !useOllamaForLocal) && !isLocalAvailable && (
            <div
              className="text-tiny"
              style={{ color: 'var(--error)' }}
              title="Local backend not running. Start with: npx wrangler dev --local"
            >
              ⚠️
            </div>
          )}
        </>
      )}
      {!isCloudAvailable && provider === 'cloudflare' && (
        <div
          className="text-tiny"
          style={{ color: 'var(--error)' }}
          title="Cloud backend unavailable"
        >
          ⚠️
        </div>
      )}
    </div>
  );
}
