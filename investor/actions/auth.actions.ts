'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  fullName:    z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^2547\d{8}$/, 'Format: 2547XXXXXXXX'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/,  'Must contain at least one number'),
  email: z.string().email().optional().or(z.literal('')),
});

const loginSchema = z.object({
  phoneNumber: z.string().regex(/^2547\d{8}$/, 'Format: 2547XXXXXXXX'),
  password:    z.string().min(1, 'Password is required'),
});

// ─── State Types ──────────────────────────────────────────────────────────────

export interface AuthActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerAction = async (
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> => {
  const parsed = registerSchema.safeParse({
    fullName:    formData.get('fullName'),
    phoneNumber: formData.get('phoneNumber'),
    password:    formData.get('password'),
    email:       formData.get('email') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const response = await apiFetch<{ userId: string }>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        ...parsed.data,
        role: 'RETAIL_INVESTOR',
      }),
    }
  );

  if (!response.success) {
    return { success: false, message: response.message };
  }

  // Auto-login after registration
  return loginAction(_prev, formData);
};

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginAction = async (
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> => {
  const parsed = loginSchema.safeParse({
    phoneNumber: formData.get('phoneNumber'),
    password:    formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const response = await apiFetch<{ accessToken: string }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }
  );

  if (!response.success) {
    return { success: false, message: response.message };
  }

  // Store access token in HttpOnly cookie
  cookies().set('akripesa_access_token', response.data.accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   15 * 60, // 15 minutes — matches JWT_ACCESS_EXPIRES_IN
    path:     '/',
  });

  redirect('/dashboard');
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logoutAction = async (): Promise<void> => {
  await apiFetch('/auth/logout', { method: 'POST' });
  cookies().delete('akripesa_access_token');
  redirect('/login');
};