import { cookies } from 'next/headers';
import { ApiResponse } from '@/types/api.types';

// Temporarily hardcode this to guarantee the connection
const API_BASE_URL = 'http://localhost:5000/api/v1'; // Remove the /api/v1 here
/**
 * Server-side fetch wrapper.
 * Automatically forwards the HttpOnly accessToken cookie from the
 * browser session to our Node.js backend on every request.
 * Used exclusively inside Server Actions and Route Handlers.
 */
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

  const fullUrl = `${API_BASE_URL}${path}`;
  console.log(`🚀 Fetching from: ${fullUrl}`);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    cache: 'no-store', 
  });

  // --- THE X-RAY VISION ---
  const text = await response.text();
  try {
    const data: ApiResponse<T> = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("❌ BACKEND CRASH DETECTED AT:", fullUrl);
    console.error("❌ RAW ERROR MESSAGE:\n", text.substring(0, 500)); 
    throw new Error("Backend sent HTML instead of JSON.");
  }
};