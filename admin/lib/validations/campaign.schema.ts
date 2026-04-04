import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const campaignFormSchema = z
  .object({
    // ── Internal (Admin-only) ──────────────────────────────────────────────
    internalClientName: z
      .string()
      .min(2, 'Client name must be at least 2 characters')
      .max(200),
    internalContactName: z.string().min(2, 'Contact name required'),
    internalContactPhone: z
      .string()
      .regex(/^2547\d{8}$/, 'Phone must be in format 2547XXXXXXXX'),
    internalContactEmail: z.string().email('Valid email required'),
    lpoDocumentUrl: z
      .string()
      .url('Must be a valid URL to the uploaded LPO document'),
    contractValueKes: z
      .number({ invalid_type_error: 'Contract value must be a number' })
      .positive('Contract value must be greater than 0')
      .min(10000, 'Minimum contract value is KES 10,000'),
    expectedSettlementDate: z
      .string()
      .min(1, 'Settlement date required')
      .refine(
        (val) => new Date(val) > new Date(),
        'Settlement date must be in the future'
      ),
    internalNotes: z.string().max(1000).optional(),

    // ── Public (Investor-facing) ───────────────────────────────────────────
    publicClientCategory: z.enum([
      'Tier-1 Private Hospital',
      'Tier-2 Public Hospital',
      'National Boarding School',
      'County Boarding School',
      'Hotel Chain',
      'Supermarket Chain',
      'Government Institution',
      'Food Processor',
    ]),
    publicHistorySummary: z
      .string()
      .min(10, 'Summary must be at least 10 characters')
      .max(300, 'Summary must be under 300 characters'),
    verifiedByPlatform: z.boolean().default(false),

    // ── Campaign Financials ────────────────────────────────────────────────
    commodity: z.enum([
      'MAIZE', 'POTATOES', 'BEANS', 'TOMATOES', 'ONIONS',
      'CABBAGES', 'KALES', 'RICE', 'WHEAT', 'SORGHUM',
    ]),
    quantityKg: z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .positive()
      .min(1, 'Minimum 1 kg'),
    targetAmountKes: z
      .number({ invalid_type_error: 'Target amount must be a number' })
      .positive()
      .min(10000, 'Minimum target is KES 10,000'),
    expectedReturnPercent: z
      .number({ invalid_type_error: 'Return must be a number' })
      .min(0.01, 'Return must be greater than 0')
      .max(100, 'Return cannot exceed 100%'),
    durationDays: z
      .number({ invalid_type_error: 'Duration must be a number' })
      .int('Duration must be a whole number of days')
      .min(1)
      .max(365),
    deadline: z
      .string()
      .min(1, 'Deadline required')
      .refine(
        (val) => new Date(val) > new Date(),
        'Deadline must be in the future'
      ),

    // ── Locations ─────────────────────────────────────────────────────────
    pickupAddress: z.string().min(5, 'Pickup address required'),
    pickupLat: z
      .number({ invalid_type_error: 'Pickup latitude required' })
      .min(-90).max(90),
    pickupLng: z
      .number({ invalid_type_error: 'Pickup longitude required' })
      .min(-180).max(180),
    deliveryAddress: z.string().min(5, 'Delivery address required'),
    deliveryLat: z
      .number({ invalid_type_error: 'Delivery latitude required' })
      .min(-90).max(90),
    deliveryLng: z
      .number({ invalid_type_error: 'Delivery longitude required' })
      .min(-180).max(180),
  })
  .refine(
    (data) => data.targetAmountKes < data.contractValueKes,
    {
      message:
        'Target amount (crowdfunding) must be less than the contract value. The spread is platform gross margin.',
      path: ['targetAmountKes'],
    }
  );

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;