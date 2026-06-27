export type WhatsappTemplateSendParams = {
  toE164: string;
  templateName: string;
  languageCode?: string;
  bodyParameters: string[];
};

export type WhatsappSendResult = {
  messageId: string;
  mode: 'live' | 'sandbox';
  provider: string;
};
