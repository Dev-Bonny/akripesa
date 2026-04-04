import { z } from 'zod';

/**
 * Validates the optional request body for a capital injection.
 *
 * The injection amount is normally computed automatically from the campaign
 * shortfall. The optional `overrideAmountKes` field allows an admin to
 * inject a partial amount (e.g., cover only 50% of the shortfall) rather
 * than the full gap. If omitted, the service defaults to full shortfall coverage.
 */
export const injectCapitalSchema = z.object({
  overrideAmountKes: z
    .number({
      invalid_type_error: 'Override amount must be a number.',
    })
    .positive('Override amount must be greater than zero.')
    .optional(),
  confirmationNote: z
    .string()
    .max(500, 'Confirmation note must be under 500 characters.')
    .optional(),
});

export type InjectCapitalDto = z.infer<typeof injectCapitalSchema>;