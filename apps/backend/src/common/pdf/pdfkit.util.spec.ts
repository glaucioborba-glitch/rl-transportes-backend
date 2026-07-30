import { PDFDocument } from './pdfkit.util';

describe('pdfkit.util', () => {
  it('expõe construtor PDFDocument utilizável', () => {
    expect(typeof PDFDocument).toBe('function');
    const doc = new PDFDocument({ size: 'A4' });
    expect(doc).toBeDefined();
    doc.end();
  });
});
