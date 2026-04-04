// ─── STK Push (C2B) ───────────────────────────────────────────────────────────

export interface StkPushRequest {
  phoneNumber: string;      // 2547XXXXXXXX
  amountKes: number;        // Whole KES (Daraja does not accept cents)
  accountReference: string; // Investment ID — used to match callback
  transactionDesc: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface StkCallbackItem {
  Name: string;
  Value?: string | number;
}

export interface StkCallbackMetadata {
  Item: StkCallbackItem[];
}

export interface StkCallbackBody {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;         // 0 = success
  ResultDesc: string;
  CallbackMetadata?: StkCallbackMetadata;
}

export interface StkPushCallback {
  Body: {
    stkCallback: StkCallbackBody;
  };
}

// ─── B2C (Payout) ─────────────────────────────────────────────────────────────

export interface B2CRequest {
  phoneNumber: string;
  amountKes: number;          // Whole KES
  remarks: string;            // e.g., "LPO Payout - Campaign #XYZ"
  occasion: string;           // Investment ID — used to match callback
}

export interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface B2CResultParameters {
  ResultParameter: Array<{ Key: string; Value: string | number }>;
}

export interface B2CCallback {
  Result: {
    ResultType: number;
    ResultCode: number;         // 0 = success
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;      // M-Pesa receipt number
    ResultParameters?: B2CResultParameters;
    ReferenceData?: {
      ReferenceItem: { Key: string; Value: string };
    };
  };
}

// ─── Auth Token ───────────────────────────────────────────────────────────────

export interface DarajaAuthToken {
  access_token: string;
  expires_in: string;
  expiresAt: number; // Unix timestamp — computed locally for caching
}