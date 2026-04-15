export const VALID_STATIC_ROUTES = new Set([
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/register',
  '/logout',
  '/setup-mfa',
  '/user',
  '/chat',
  '/leaderboards',
  '/guide',
  '/admin',
  '/admin/users',
  '/admin/users/all',
  '/404',
]);

export function isRoutePathValid(pathname) {
  if (VALID_STATIC_ROUTES.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/api/')) {
    return true;
  }

  if (/^\/admin\/users\/[^/]+$/.test(pathname)) {
    return true;
  }

  return false;
}
