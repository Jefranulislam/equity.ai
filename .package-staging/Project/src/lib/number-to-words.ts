const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunk(n: number): string {
  if (n <= 0) return '';
  if (n < 20) return ones[n] + ' ';
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
  return ones[Math.floor(n / 100)] + ' Hundred ' + chunk(n % 100);
}

function inWords(n: number): string {
  if (n === 0) return 'Zero';
  let result = '';
  if (n >= 10000000) { result += chunk(Math.floor(n / 10000000)).trim() + ' Crore '; n %= 10000000; }
  if (n >= 100000) { result += chunk(Math.floor(n / 100000)).trim() + ' Lakh '; n %= 100000; }
  if (n >= 1000) { result += chunk(Math.floor(n / 1000)).trim() + ' Thousand '; n %= 1000; }
  result += chunk(n);
  return result.trim();
}

const CURRENCY_NAMES: Record<string, [string, string]> = {
  INR: ['Rupee', 'Paise'],
  BDT: ['Taka', 'Paisa'],
  USD: ['Dollar', 'Cent'],
  EUR: ['Euro', 'Cent'],
  GBP: ['Pound', 'Penny'],
  AED: ['Dirham', 'Fils'],
  SGD: ['Dollar', 'Cent'],
  SAR: ['Riyal', 'Halala'],
};

export function numberToWords(amount: number, currency = 'INR'): string {
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);
  const [main, sub] = CURRENCY_NAMES[currency] ?? [currency, 'Cent'];
  let result = inWords(intPart) + ' ' + (intPart === 1 ? main : main + 's');
  if (decPart > 0) result += ' and ' + inWords(decPart) + ' ' + (decPart === 1 ? sub : sub + 's');
  return result + ' Only';
}
