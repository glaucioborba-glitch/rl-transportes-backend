import { isValidIso6346 } from '../../../common/utils/iso6346';

export function parseContainerNumber(textoBruto: string): { numero: string; confianca: number } {
  if (!textoBruto) return { numero: '', confianca: 0 };

  const texto = textoBruto.toUpperCase().replace(/[\s\-_\n\r]/g, '');

  const pattern = /([A-Z]{4})(\d{7})/;
  const match = texto.match(pattern);

  if (!match) {
    const loosePattern = /([A-Z0-9]{4})([A-Z0-9]{7})/;
    const looseMatch = texto.match(loosePattern);

    if (!looseMatch) {
      return { numero: '', confianca: 0 };
    }

    let letras = looseMatch[1];
    let digitos = looseMatch[2];

    letras = letras.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    digitos = digitos.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');

    const numeroCorrigido = letras + digitos;

    if (isValidIso6346(numeroCorrigido)) {
      return { numero: numeroCorrigido, confianca: 0.75 };
    }

    return { numero: numeroCorrigido, confianca: 0.4 };
  }

  const numero = match[1] + match[2];

  if (isValidIso6346(numero)) {
    return { numero, confianca: 0.95 };
  }

  return { numero, confianca: 0.6 };
}

export function parsePlaca(textoBruto: string): { placa: string; confianca: number } {
  if (!textoBruto) return { placa: '', confianca: 0 };

  const texto = textoBruto.toUpperCase().replace(/[\s\-_\n\r]/g, '');

  const mercosulPattern = /([A-Z]{3})(\d)([A-Z])(\d{2})/;
  const mercosulMatch = texto.match(mercosulPattern);

  if (mercosulMatch) {
    const placa = mercosulMatch[1] + mercosulMatch[2] + mercosulMatch[3] + mercosulMatch[4];
    return { placa, confianca: 0.9 };
  }

  const loose7 = texto.match(/([A-Z0-9]{3})([A-Z0-9])([A-Z0-9])([A-Z0-9]{2})/);
  if (loose7) {
    const letras = loose7[1].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const d1 = loose7[2].replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
    const letra = loose7[3].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const d2 = loose7[4].replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');

    const placaCorrigida = letras + d1 + letra + d2;
    if (/^([A-Z]{3})(\d)([A-Z])(\d{2})$/.test(placaCorrigida)) {
      return { placa: placaCorrigida, confianca: 0.75 };
    }
  }

  const antigoPattern = /([A-Z]{3})(\d{4})/;
  const antigoMatch = texto.match(antigoPattern);

  if (antigoMatch) {
    const placa = antigoMatch[1] + antigoMatch[2];
    return { placa, confianca: 0.9 };
  }

  if (loose7) {
    const letras = loose7[1].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const digitos = (loose7[2] + loose7[3] + loose7[4])
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    const placaCorrigida = letras + digitos;
    if (/^([A-Z]{3})(\d{4})$/.test(placaCorrigida)) {
      return { placa: placaCorrigida, confianca: 0.75 };
    }
  }

  const any7 = texto.match(/[A-Z0-9]{7}/);
  if (any7) {
    return { placa: any7[0], confianca: 0.3 };
  }

  return { placa: '', confianca: 0 };
}
