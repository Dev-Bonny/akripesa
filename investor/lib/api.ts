import { cookies } from 'next/headers';
import { ApiResponse } from '@/types/api.types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const apiFetch = async <T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> => {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('akripesa_access_token')?.value;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options?.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    console.error(`API parse error at ${path}:`, text.slice(0, 200));
    throw new Error('Backend returned an unexpected response.');
  }
};