import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  DarajaAuthToken,
  StkPushRequest,
  StkPushResponse,
  B2CRequest,
  B2CResponse,
} from './daraja.types';

const DARAJA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
} as const;

class DarajaClient {
  private readonly http: AxiosInstance;
  private cachedToken: DarajaAuthToken | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: DARAJA_BASE_URLS[env.DARAJA_ENVIRONMENT],
      timeout: 30000,
    });
  }

  // ─── Auth Token (cached, auto-refreshed) ────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.access_token;
    }

    const credentials = Buffer.from(
      `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await this.http.get<DarajaAuthToken>(
      '/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    this.cachedToken = {
      ...response.data,
      expiresAt: now + parseInt(response.data.expires_in, 10) * 1000,
    };

    logger.debug('Daraja access token refreshed.');
    return this.cachedToken.access_token;
  }

  // ─── STK Push Password ───────────────────────────────────────────────────────

  private generateStkPassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14); // YYYYMMDDHHmmss

    const raw = `${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`;
    const password = Buffer.from(raw).toString('base64');
    return { password, timestamp };
  }

  // ─── STK Push (C2B Investment Collection) ───────────────────────────────────

  async initiateStkPush(req: StkPushRequest): Promise<StkPushResponse> {
    const token = await this.getAccessToken();
    const { password, timestamp } = this.generateStkPassword();

    // Daraja requires whole KES — investments stored in cents, convert here
    const amountKes = Math.ceil(req.amountKes / 100);

    const payload = {
      BusinessShortCode: env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountKes,
      PartyA: req.phoneNumber,
      PartyB: env.DARAJA_SHORTCODE,
      PhoneNumber: req.phoneNumber,
      CallBackURL: `${env.API_BASE_URL}/api/v1/daraja/stk-callback/${env.DARAJA_CALLBACK_SECRET}`,
      AccountReference: req.accountReference, // Investment._id
      TransactionDesc: req.transactionDesc.slice(0, 13), // Daraja 13-char limit
    };

    try {
      const response = await this.http.post<StkPushResponse>(
        '/mpesa/stkpush/v1/processrequest',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logger.info(
        `STK Push initiated | Phone: ${req.phoneNumber} | Ref: ${req.accountReference} | CheckoutID: ${response.data.CheckoutRequestID}`
      );

      return response.data;
    } catch (error: any) {
      logger.error('STK Push failed:', error?.response?.data ?? error.message);
      throw new Error(
        `STK Push failed: ${error?.response?.data?.errorMessage ?? error.message}`
      );
    }
  }

  // ─── B2C Payout ──────────────────────────────────────────────────────────────

  async initiateB2CPayout(req: B2CRequest): Promise<B2CResponse> {
    const token = await this.getAccessToken();

    // Convert cents to whole KES for Daraja
    const amountKes = Math.floor(req.amountKes / 100);

    if (amountKes < 1) {
      throw new Error(
        `B2C payout amount too small: ${req.amountKes} cents = KES ${amountKes}`
      );
    }

    const payload = {
      InitiatorName: env.DARAJA_B2C_INITIATOR_NAME,
      SecurityCredential: env.DARAJA_B2C_SECURITY_CREDENTIAL,
      CommandID: 'BusinessPayment',
      Amount: amountKes,
      PartyA: env.DARAJA_SHORTCODE,
      PartyB: req.phoneNumber,
      Remarks: req.remarks.slice(0, 100),
      QueueTimeOutURL: `${env.API_BASE_URL}/api/v1/daraja/b2c-timeout/${env.DARAJA_CALLBACK_SECRET}`,
      ResultURL: `${env.API_BASE_URL}/api/v1/daraja/b2c-callback/${env.DARAJA_CALLBACK_SECRET}`,
      Occasion: req.occasion, // Investment._id — matched in callback
    };

    try {
      const response = await this.http.post<B2CResponse>(
        '/mpesa/b2c/v3/paymentrequest',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logger.info(
        `B2C initiated | Phone: ${req.phoneNumber} | Occasion: ${req.occasion} | ConversationID: ${response.data.ConversationID}`
      );

      return response.data;
    } catch (error: any) {
      logger.error('B2C payout failed:', error?.response?.data ?? error.message);
      throw new Error(
        `B2C payout failed: ${error?.response?.data?.errorMessage ?? error.message}`
      );
    }
  }
}

// Singleton — one client instance shares the cached auth token
export const darajaClient = new DarajaClient();