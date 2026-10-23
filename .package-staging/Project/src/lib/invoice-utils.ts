export type InvoiceDocType = 'invoice' | 'quotation' | 'proforma' | 'purchase_order' | 'delivery_challan';

export interface InvoiceItem {
  id: string;
  description: string;
  itemCode: string;
  taxRate: number;
  quantity: number;
  rate: number;
  amount: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceData {
  docType: InvoiceDocType;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poNumber: string;
  logo: string;

  billerName: string;
  billerPhone: string;
  billerCountryCode: string;
  billerTaxId: string;
  billerAddress: string;
  billerCity: string;
  billerPostal: string;
  billerState: string;
  billerCountry: string;
  billerEmail: string;

  clientName: string;
  clientPhone: string;
  clientCountryCode: string;
  clientTaxId: string;
  clientAddress: string;
  clientCity: string;
  clientPostal: string;
  clientState: string;
  clientCountry: string;
  clientEmail: string;

  showShipping: boolean;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;

  taxLabel: string;
  currency: string;
  currencySymbol: string;

  items: InvoiceItem[];

  discountType: 'amount' | 'percent';
  discountValue: number;

  showBankDetails: boolean;
  bankName: string;
  accountNumber: string;
  routingCode: string;
  accountHolder: string;
  additionalPayment: string;

  showTotalInWords: boolean;
  totalInWords: string;
  signature: string;
  termsConditions: string;
  notes: string;
}

export interface InvoiceTotals {
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountAmount: number;
  total: number;
}

let _counter = 0;
export function newItemId() { return `item-${++_counter}-${Date.now()}`; }

export function emptyItem(): InvoiceItem {
  return { id: newItemId(), description: '', itemCode: '', taxRate: 15, quantity: 1, rate: 0, amount: 0, taxAmount: 0, total: 0 };
}

export function calcItem(item: InvoiceItem): InvoiceItem {
  const amount = item.quantity * item.rate;
  const taxAmount = amount * item.taxRate / 100;
  return { ...item, amount, taxAmount, total: amount + taxAmount };
}

export function calcTotals(data: InvoiceData): InvoiceTotals {
  const items = data.items.map(calcItem);
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0);
  const discountAmount = data.discountType === 'percent'
    ? subtotal * data.discountValue / 100
    : data.discountValue;
  const total = Math.max(0, subtotal + taxTotal - discountAmount);
  return { items, subtotal, taxTotal, discountAmount, total };
}

export const DOC_TITLES: Record<InvoiceDocType, string> = {
  invoice: 'INVOICE',
  quotation: 'QUOTATION',
  proforma: 'PROFORMA INVOICE',
  purchase_order: 'PURCHASE ORDER',
  delivery_challan: 'DELIVERY CHALLAN',
};

export const CURRENCIES = [
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
];

export const COUNTRY_CODES = [
  { code: '+880', country: 'Bangladesh' },
  { code: '+1', country: 'USA / Canada' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'Singapore' },
  { code: '+60', country: 'Malaysia' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+61', country: 'Australia' },
  { code: '+92', country: 'Pakistan' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+81', country: 'Japan' },
];

export const TAX_RATES = [0, 5, 7.5, 10, 12, 15, 18, 20, 25, 28];

export function defaultInvoiceData(): InvoiceData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    docType: 'invoice',
    invoiceNumber: 'INV-001',
    invoiceDate: today,
    dueDate: '',
    poNumber: '',
    logo: '',
    billerName: '', billerPhone: '', billerCountryCode: '+880', billerTaxId: '',
    billerAddress: '', billerCity: '', billerPostal: '', billerState: '',
    billerCountry: 'Bangladesh', billerEmail: '',
    clientName: '', clientPhone: '', clientCountryCode: '+880', clientTaxId: '',
    clientAddress: '', clientCity: '', clientPostal: '', clientState: '',
    clientCountry: 'Bangladesh', clientEmail: '',
    showShipping: false, shippingName: '', shippingAddress: '', shippingCity: '',
    shippingState: '', shippingPostal: '', shippingCountry: '',
    taxLabel: 'VAT',
    currency: 'BDT', currencySymbol: '৳',
    items: [emptyItem()],
    discountType: 'amount', discountValue: 0,
    showBankDetails: false, bankName: '', accountNumber: '', routingCode: '',
    accountHolder: '', additionalPayment: '',
    showTotalInWords: true, totalInWords: '', signature: '', termsConditions: '', notes: '',
  };
}
