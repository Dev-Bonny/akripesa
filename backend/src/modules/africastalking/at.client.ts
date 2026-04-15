import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ATSmsPayload, ATSmsResponse } from './at.types';

/**
 * Africa's Talking SMS Client.
 *
 * In development (NODE_ENV !== 'production'):
 *   SMS is NOT sent. The raw OTP is logged to the console instead.
 *   This matches the tri-party OTP stub pattern from Sprint 4.
 *
 * In production:
 *   Real SMS is dispatched via the Africa's Talking API.
 *   Requires AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME
 *   in the environment.
 *
 * Sprint 8 will wire up the USSD session handling in this same client.
 */
class AfricasTalkingClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://api.africastalking.com/version1',
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey: env.AFRICAS_TALKING_API_KEY,
      },
    });
  }

  /**
   * Sends an SMS message to one or more recipients.
   * In development, logs the message instead of sending.
   */
  async sendSms(payload: ATSmsPayload): Promise<void> {
    const recipients = payload.to.join(',');
    const message    = payload.message;

    // ── Development stub ────────────────────────────────────────────────────
    if (env.NODE_ENV !== 'production') {
      logger.info(
        `[AT SMS STUB] To: ${recipients} | Message: "${message}"`
      );
      return;
    }

    // ── Production: real SMS dispatch ───────────────────────────────────────
    try {
      const formData = new URLSearchParams({
        username: env.AFRICAS_TALKING_USERNAME,
        to:       recipients,
        message,
        ...(payload.from ? { from: payload.from } : {}),
      });

      const response = await this.http.post<ATSmsResponse>(
        '/messaging',
        formData.toString()
      );

      const recipients_result =
        response.data.SMSMessageData.Recipients;

      const failed = recipients_result.filter(
        (r) => r.statusCode !== 101
      );

      if (failed.length > 0) {
        logger.error(
          `AT SMS partial failure for ${failed.map((f) => f.number).join(', ')}:`,
          failed
        );
      } else {
        logger.info(
          `AT SMS sent successfully to ${recipients_result.length} recipient(s).`
        );
      }
    } catch (error: any) {
      logger.error(
        'AT SMS dispatch failed:',
        error?.response?.data ?? error.message
      );
      // We throw so the caller can decide whether to surface this to the user
      throw new Error(
        `SMS dispatch failed: ${error?.response?.data?.error ?? error.message}`
      );
    }
  }

  /**
   * Sends an OTP specifically.
   * Formats the message consistently across the platform.
   */
  async sendOtp(phoneNumber: string, rawOtp: string): Promise<void> {
    await this.sendSms({
      to: [`+${phoneNumber}`], // Africa's Talking requires + prefix
      message:
        `Your Akripesa verification code is: ${rawOtp}. ` +
        `Valid for 10 minutes. Do not share this code with anyone.`,
    });
  }
}

// Singleton
export const atClient = new AfricasTalkingClient();