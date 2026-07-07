// middleware.ts — runs at Vercel Edge before /course is served
// If no valid token in URL or cookie → redirect to /celar_products.html#modal-smm

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/course', '/course/'],
};

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenFromUrl = searchParams.get('token');
  const tokenFromCookie = request.cookies.get('smm_access')?.value;
  const token = tokenFromUrl || tokenFromCookie;

  // No token at all → redirect to buy page
  if (!token) {
    return NextResponse.redirect(
      new URL('/celar_products.html?ref=course#modal-smm', request.url)
    );
  }

  // Token looks valid (64-char hex) — let the page through
  // The page itself will call /api/validate-token to confirm with KV
  // We do a lightweight format check here to block obvious fakes fast
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(
      new URL('/celar_products.html?ref=course#modal-smm', request.url)
    );
  }

  // If token came from URL, set it as a cookie (30-day expiry)
  // so user doesn't need the URL parameter on every visit
  const response = NextResponse.next();
  if (tokenFromUrl && !tokenFromCookie) {
    response.cookies.set('smm_access', tokenFromUrl, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/course',
    });
  }

  return response;
}
