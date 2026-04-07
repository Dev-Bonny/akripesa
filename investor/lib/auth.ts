import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionUser {
  userId: string;
  role: string;
  phoneNumber: string;
}

/**
 * Decodes the JWT access token payload client-free.
 * Does NOT verify the signature — verification happens on the backend
 * for every authenticated API call. This is used only for reading
 * non-sensitive display claims (userId, role) in Server Components.
 */
export const getSessionUser = (): SessionUser | null => {
  const cookieStore = cookies();
  const token = cookieStore.get('akripesa_access_token')?.value;

  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString('utf-8')
    );
    return {
      userId:      decoded.userId,
      role:        decoded.role,
      phoneNumber: decoded.phoneNumber,
    };
  } catch {
    return null;
  }
};

/**
 * Guards Server Components and layouts.
 * Redirects to /login if no valid session exists.
 */
export const requireInvestorSession = (): SessionUser => {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'RETAIL_INVESTOR' && user.role !== 'BULK_BROKER') {
    redirect('/login');
  }
  return user;
};