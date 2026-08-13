import * as pdfkitModule from 'pdfkit';

type PDFDocumentConstructor = typeof import('pdfkit');

/**
 * Resolve construtor PDFKit em runtime CJS/ESM (evita `pdfkit_1.default is not a constructor`).
 */
function resolvePDFDocumentConstructor(): PDFDocumentConstructor {
  const mod = pdfkitModule as PDFDocumentConstructor & { default?: PDFDocumentConstructor };
  const ctor = mod.default ?? (mod as unknown as PDFDocumentConstructor);
  if (typeof ctor === 'function') {
    return ctor;
  }
  throw new TypeError('pdfkit: PDFDocument is not a constructor');
}

export const PDFDocument = resolvePDFDocumentConstructor();
