import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createRouteAccessLog } from '@/lib/server/db';
import { isRoutePathValid } from '@/lib/shared/routes';

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  if (isRoutePathValid(pathname)) {
    return NextResponse.next();
  }

  const userAgent = req.headers.get('user-agent') || 'unknown';
  let userId = null;

  try {
    const authData = await auth();
    userId = authData.userId ?? null;
  } catch (error) {
    userId = null;
  }

  try {
    await createRouteAccessLog({
      clerkUserId: userId,
      path: pathname,
      method: req.method,
      status: 'invalid_route',
      userAgent,
      metadata: {
        redirectedTo: '/404',
      },
    });
  } catch (error) {
    console.error('Failed to log invalid route:', error);
  }

  return NextResponse.redirect(new URL('/404', req.url));
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|map)$).*)',
  ],
};
