'use server';

import { cookies } from 'next/headers';

export async function loginWithGoogleAction(googleIdToken: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // 1. Send the token to your Express backend
    const res = await fetch(`${apiUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleIdToken }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Google login failed' };
    }

    // 2. Set the JWT inside an HttpOnly cookie so Next.js middleware can read it
    cookies().set('akripesa_access_token', data.data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return { success: true };
  } catch (error) {
    console.error('Google Login Action Error:', error);
    return { success: false, error: 'Internal server error during login' };
  }
}