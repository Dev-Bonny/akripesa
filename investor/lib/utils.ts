import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatKes = (cents: number): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(cents / 100);

export const formatDate = (date: Date | string): string =>
  format(new Date(date), 'dd MMM yyyy');

export const formatRelative = (date: Date | string): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const hoursUntil = (date: Date | string): number =>
  Math.max(0, differenceInHours(new Date(date), new Date()));

export const kesToCents = (kes: number): number => Math.round(kes * 100);

export const centsToKes = (cents: number): number => cents / 100;

/** Capitalises only the first letter of a string */
export const toTitleCase = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();