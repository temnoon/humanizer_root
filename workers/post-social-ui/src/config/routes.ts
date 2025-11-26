/**
 * Route Definitions
 */

export const ROUTES = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  post: (id: string) => `/post/${id}`,
  search: '/search',
  profile: '/profile',
  settings: '/settings',
} as const;
