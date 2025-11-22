export const STORAGE_PATHS = {
  // Local storage (configurable)
  // Note: This is used by the archive server (Node.js), not the browser
  localSessionsDir: '~/.humanizer/sessions',

  // Cloud storage
  cloudTableName: 'sessions',
  cloudBuffersTableName: 'session_buffers',

  // Archive server endpoints
  archiveServerUrl: 'http://localhost:3002',
  sessionEndpoint: '/sessions'
};
