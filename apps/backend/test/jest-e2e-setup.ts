/** Evita 400 por headers x-device-* ausentes nos testes e2e (ambiente ≠ production). */
process.env.SECURITY_HEADERS_ENFORCE = '0';

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));
jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: { executablePath: jest.fn(), args: [] },
}));