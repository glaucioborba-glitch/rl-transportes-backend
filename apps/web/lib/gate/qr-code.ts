export interface QRCodeData {
  protocolo: string;
  token: string;
  validade: string;
  clienteId: string;
  containerNumero: string;
}

export function generateQRPayload(data: QRCodeData): string {
  if (typeof btoa === 'function') {
    return btoa(JSON.stringify(data));
  }
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeQRPayload(payload: string): QRCodeData | null {
  try {
    const json =
      typeof atob === 'function'
        ? atob(payload)
        : Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as QRCodeData;
  } catch {
    return null;
  }
}

export function isQRValid(data: QRCodeData): boolean {
  if (!data.validade) return false;
  return new Date(data.validade) > new Date();
}
