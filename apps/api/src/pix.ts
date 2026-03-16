/**
 * PIX BR Code (EMV QR Code) generator
 * Follows BACEN specification for static PIX codes
 * Ref: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualPadroesParaIniciacaodoPix.pdf
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type PixCodeParams = {
  /** PIX key (CNPJ, CPF, email, phone, or random key) */
  pixKey: string;
  /** Merchant/receiver name (max 25 chars) */
  merchantName: string;
  /** City (max 15 chars) */
  merchantCity: string;
  /** Amount in BRL (e.g. 170.00) */
  amount: number;
  /** Transaction ID (max 25 chars, alphanumeric, used for reconciliation) */
  txId: string;
};

export function generatePixCode(params: PixCodeParams): string {
  const { pixKey, merchantName, merchantCity, amount, txId } = params;

  // 00 - Payload Format Indicator
  const pfi = tlv('00', '01');

  // 26 - Merchant Account Information (PIX)
  const gui = tlv('00', 'br.gov.bcb.pix'); // GUI for PIX
  const key = tlv('01', pixKey);
  const mai = tlv('26', gui + key);

  // 52 - Merchant Category Code (0000 = not specified)
  const mcc = tlv('52', '0000');

  // 53 - Transaction Currency (986 = BRL)
  const currency = tlv('53', '986');

  // 54 - Transaction Amount
  const amountStr = amount.toFixed(2);
  const ta = tlv('54', amountStr);

  // 58 - Country Code
  const cc = tlv('58', 'BR');

  // 59 - Merchant Name (truncate to 25 chars)
  const name = merchantName.slice(0, 25);
  const mn = tlv('59', name);

  // 60 - Merchant City (truncate to 15 chars)
  const city = merchantCity.slice(0, 15);
  const mc = tlv('60', city);

  // 62 - Additional Data Field Template
  const txIdField = tlv('05', txId.slice(0, 25));
  const adf = tlv('62', txIdField);

  // Build payload without CRC
  const payloadWithoutCrc = pfi + mai + mcc + currency + ta + cc + mn + mc + adf + '6304';

  // 63 - CRC16
  const crcValue = crc16(payloadWithoutCrc);

  return payloadWithoutCrc + crcValue;
}
