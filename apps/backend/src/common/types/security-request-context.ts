/** Payload padronizado após validação dos headers do Security Engine (middleware). */
export interface SecurityDevicePayload {
  os: string;
  browser: string;
  screen: string;
  timezone: string;
}

export interface SecurityRequestContext {
  device: SecurityDevicePayload;
  fingerprint: string;
  sessionId: string;
}
