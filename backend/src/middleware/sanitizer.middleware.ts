import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User.model';

/**
 * Strips all internal/admin-only fields from LPOCampaign objects
 * before the response leaves the server.
 *
 * This middleware is the SECOND line of defense (after select: false on the schema).
 * It intercepts res.json() and scrubs sensitive fields even if a developer
 * accidentally includes them in a query via .select('+internalData').
 *
 * Apply to ALL routes accessible by non-admin roles.
 */

const INTERNAL_CAMPAIGN_FIELDS = [
  'internalData',
  'platformInjection',      // Hides underwriting activity from investors
  'farmerAllocations',      // Farm-level detail not for public view
  'settlementTransactionRef',
  'createdBy',
] as const;

export const sanitizeCampaignResponse = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Admins see everything — skip sanitization
  if (req.user?.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  // Intercept res.json to scrub before sending
  const originalJson = res.json.bind(res);

  res.json = (body: unknown): Response => {
    const sanitized = deepScrubCampaign(body);
    return originalJson(sanitized);
  };

  next();
};

/**
 * Recursively strips internal fields from any object/array structure.
 * Handles both single campaign objects and paginated arrays.
 */
const deepScrubCampaign = (data: unknown): unknown => {
  if (Array.isArray(data)) {
    return data.map(deepScrubCampaign);
  }

  if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // If this object looks like an API response wrapper, scrub its data field
    if ('data' in obj) {
      return { ...obj, data: deepScrubCampaign(obj.data) };
    }

    // If this object looks like a campaign document, strip internal fields
    if ('publicData' in obj || 'targetAmountKes' in obj) {
      const scrubbed = { ...obj };
      for (const field of INTERNAL_CAMPAIGN_FIELDS) {
        delete scrubbed[field];
      }
      return scrubbed;
    }
  }

  return data;
};