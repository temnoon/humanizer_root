export const STORAGE_PATHS = {
  // Local storage (configurable)
  localSessionsDir: process.env.SESSION_STORAGE_PATH || '~/.humanizer/sessions',

  // Cloud storage
  cloudTableName: 'sessions',
  cloudBuffersTableName: 'session_buffers',

  // Archive server endpoints
  archiveServerUrl: 'http://localhost:3002',
  sessionEndpoint: '/sessions'
};
