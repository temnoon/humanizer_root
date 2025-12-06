// Detect if running in production (not localhost)
const isProduction = typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

export const STORAGE_PATHS = {
  // Local storage (configurable)
  // Note: This is used by the archive server (Node.js), not the browser
  localSessionsDir: '~/.humanizer/sessions',

  // Cloud storage
  cloudTableName: 'sessions',
  cloudBuffersTableName: 'session_buffers',

  // Archive server endpoints (for archive data only - local private archives)
  // Use Cloudflare Tunnel in production, localhost in development
  archiveServerUrl: isProduction
    ? 'https://late-guestbook-rat-calculators.trycloudflare.com'
    : 'http://localhost:3002',

  // NPE API endpoints (for sessions, transformations, auth - D1 backed)
  // Sessions now go through npe-api for consistency across local/cloud/electron
  npeApiUrl: isProduction
    ? 'https://npe-api.tem-527.workers.dev'
    : 'http://localhost:8787',
  sessionEndpoint: '/api/sessions'
};
