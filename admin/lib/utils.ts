import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format } from 'date-fns'  // ← add format here

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKes(cents: number): string {
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES' 
  }).format(cents / 100);
}

export function kesToCents(kes: number): number {
  return Math.round(kes * 100);
}

export function centsToKes(cents: number): number {
  return cents / 100;
}

export function formatRelative(date: Date | string | number): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string): string {  // ← add this
  return format(new Date(date), 'dd MMM yyyy');
}