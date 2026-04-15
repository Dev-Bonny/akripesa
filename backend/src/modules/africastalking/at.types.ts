export interface ATSmsPayload {
  to: string[];          // E.164 format: +2547XXXXXXXX
  message: string;
  from?: string;         // Shortcode or alphanumeric sender ID
}

export interface ATSmsResponse {
  SMSMessageData: {
    Message: string;
    Recipients: Array<{
      statusCode: number;
      number: string;
      status: string;
      cost: string;
      messageId: string;
    }>;
  };
}