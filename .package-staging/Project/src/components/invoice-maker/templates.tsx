import { type InvoiceData, type InvoiceTotals, calcTotals, DOC_TITLES } from '@/lib/invoice-utils';

export interface TemplateProps { data: InvoiceData }

// ─── shared helpers ───────────────────────────────────────────────────────────

const sym = (d: InvoiceData) => d.currencySymbol;
const fmt = (n: number, s: string) =>
  `${s}${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const joinAddr = (...parts: string[]) => parts.filter(Boolean).join(', ');
const hasCode = (t: InvoiceTotals) => t.items.some(i => i.itemCode);
const hasTax = (t: InvoiceTotals) => t.items.some(i => i.taxRate > 0);

function ItemsTable({ data, totals, headerBg, headerColor, rowAlt, borderColor }: {
  data: InvoiceData; totals: InvoiceTotals;
  headerBg: string; headerColor: string; rowAlt: string; borderColor: string;
}) {
  const s = sym(data);
  const showCode = hasCode(totals);
  const showTax = hasTax(totals);
  const th: React.CSSProperties = { padding: '7px 8px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '7px 8px', fontSize: 11, verticalAlign: 'top', borderBottom: `1px solid ${borderColor}` };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ backgroundColor: headerBg, color: headerColor }}>
          <th style={th}>#</th>
          <th style={{ ...th, width: '35%' }}>Item / Description</th>
          {showCode && <th style={th}>Code</th>}
          {showTax && <th style={{ ...th, textAlign: 'center' }}>{data.taxLabel || 'Tax'}%</th>}
          <th style={{ ...th, textAlign: 'right' }}>Qty</th>
          <th style={{ ...th, textAlign: 'right' }}>Rate</th>
          <th style={{ ...th, textAlign: 'right' }}>Amount</th>
          {showTax && <th style={{ ...th, textAlign: 'right' }}>{data.taxLabel || 'Tax'}</th>}
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {totals.items.map((item, idx) => (
          <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? rowAlt : '#fff' }}>
            <td style={{ ...td, color: '#888', width: 24 }}>{idx + 1}</td>
            <td style={td}>{item.description || '—'}</td>
            {showCode && <td style={{ ...td, color: '#666' }}>{item.itemCode || '—'}</td>}
            {showTax && <td style={{ ...td, textAlign: 'center' }}>{item.taxRate}%</td>}
            <td style={{ ...td, textAlign: 'right' }}>{item.quantity}</td>
            <td style={{ ...td, textAlign: 'right' }}>{fmt(item.rate, s)}</td>
            <td style={{ ...td, textAlign: 'right' }}>{fmt(item.amount, s)}</td>
            {showTax && <td style={{ ...td, textAlign: 'right', color: '#666' }}>{fmt(item.taxAmount, s)}</td>}
            <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(item.total, s)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ data, totals, accentColor }: { data: InvoiceData; totals: InvoiceTotals; accentColor: string }) {
  const s = sym(data);
  const row = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: 12 } as React.CSSProperties;
  return (
    <div style={{ width: 240, marginLeft: 'auto' }}>
      <div style={row}><span style={{ color: '#666' }}>Subtotal</span><span>{fmt(totals.subtotal, s)}</span></div>
      {totals.taxTotal > 0 && (
        <div style={row}><span style={{ color: '#666' }}>{data.taxLabel || 'Tax'}</span><span>{fmt(totals.taxTotal, s)}</span></div>
      )}
      {totals.discountAmount > 0 && (
        <div style={{ ...row, color: '#16a34a' }}><span>Discount</span><span>−{fmt(totals.discountAmount, s)}</span></div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: 700, fontSize: 14, color: accentColor, borderTop: `2px solid ${accentColor}`, marginTop: 4 }}>
        <span>Total</span><span>{fmt(totals.total, s)}</span>
      </div>
    </div>
  );
}

function PartyBlock({ label, name, taxId, taxLabel, address, city, state, postal, country, email, phone, countryCode }: {
  label: string; name: string; taxId?: string; taxLabel?: string;
  address?: string; city?: string; state?: string; postal?: string; country?: string;
  email?: string; phone?: string; countryCode?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 5 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{name || '—'}</div>
      {address && <div style={{ fontSize: 11, color: '#555' }}>{address}</div>}
      {(city || state || postal) && <div style={{ fontSize: 11, color: '#555' }}>{joinAddr(city ?? '', state ?? '', postal ?? '')}</div>}
      {country && <div style={{ fontSize: 11, color: '#555' }}>{country}</div>}
      {taxId && <div style={{ fontSize: 11, color: '#555' }}>{taxLabel || 'Tax ID'}: {taxId}</div>}
      {email && <div style={{ fontSize: 11, color: '#555' }}>{email}</div>}
      {phone && <div style={{ fontSize: 11, color: '#555' }}>{countryCode} {phone}</div>}
    </div>
  );
}

function Footer({ data }: { data: InvoiceData }) {
  return (
    <>
      {data.showBankDetails && data.bankName && (
        <div style={{ fontSize: 11, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Bank Details</div>
          <div>Bank: {data.bankName}</div>
          {data.accountHolder && <div>Account: {data.accountHolder}</div>}
          {data.accountNumber && <div>A/C No: {data.accountNumber}</div>}
          {data.routingCode && <div>Routing: {data.routingCode}</div>}
          {data.additionalPayment && <div>{data.additionalPayment}</div>}
        </div>
      )}
      {data.termsConditions && (
        <div style={{ fontSize: 10, color: '#555', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 3 }}>Terms & Conditions</div>
          {data.termsConditions}
        </div>
      )}
      {data.notes && (
        <div style={{ fontSize: 11, color: '#555' }}>
          <div style={{ fontWeight: 700, color: '#333', marginBottom: 3 }}>Notes</div>
          {data.notes}
        </div>
      )}
    </>
  );
}

function SignatureBlock({ data, borderColor, labelColor }: { data: InvoiceData; borderColor: string; labelColor: string }) {
  if (!data.signature) return null;
  return (
    <div style={{ textAlign: 'center', width: 160, flexShrink: 0 }}>
      <img src={data.signature} alt="" style={{ height: 52, marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
      <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 4, fontSize: 10, color: labelColor }}>Authorised Signatory</div>
    </div>
  );
}

// ─── Template 1: Classic ─────────────────────────────────────────────────────

export function TemplateClassic({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const s = sym(data);
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#1a1a1a', padding: '44px 48px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 20, borderBottom: '2px solid #1a1a1a', marginBottom: 24 }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 60, marginBottom: 8, display: 'block' }} />}
          <div style={{ fontWeight: 700, fontSize: 17 }}>{data.billerName || 'Your Business'}</div>
          {data.billerAddress && <div style={{ color: '#555', marginTop: 2, fontSize: 11 }}>{data.billerAddress}</div>}
          {(data.billerCity || data.billerState) && <div style={{ color: '#555', fontSize: 11 }}>{joinAddr(data.billerCity, data.billerState, data.billerPostal)}</div>}
          {data.billerCountry && <div style={{ color: '#555', fontSize: 11 }}>{data.billerCountry}</div>}
          {data.billerTaxId && <div style={{ color: '#555', fontSize: 11 }}>Tax ID: {data.billerTaxId}</div>}
          {data.billerEmail && <div style={{ color: '#555', fontSize: 11 }}>{data.billerEmail}</div>}
          {data.billerPhone && <div style={{ color: '#555', fontSize: 11 }}>{data.billerCountryCode} {data.billerPhone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ marginTop: 10, color: '#555', fontSize: 11 }}>
            <div><strong style={{ color: '#1a1a1a' }}>No:</strong> {data.invoiceNumber}</div>
            <div><strong style={{ color: '#1a1a1a' }}>Date:</strong> {data.invoiceDate}</div>
            {data.dueDate && <div><strong style={{ color: '#1a1a1a' }}>Due:</strong> {data.dueDate}</div>}
            {data.poNumber && <div><strong style={{ color: '#1a1a1a' }}>Ref:</strong> {data.poNumber}</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
        <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} postal={data.clientPostal} country={data.clientCountry} email={data.clientEmail} phone={data.clientPhone} countryCode={data.clientCountryCode} />
        {data.showShipping && (
          <PartyBlock label="Ship To" name={data.shippingName} address={data.shippingAddress} city={data.shippingCity} state={data.shippingState} postal={data.shippingPostal} country={data.shippingCountry} />
        )}
      </div>

      <div style={{ border: '1px solid #e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <ItemsTable data={data} totals={totals} headerBg="#f5f5f5" headerColor="#333" rowAlt="#fafafa" borderColor="#eee" />
      </div>
      <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor="#1a1a1a" /></div>
      {data.showTotalInWords && data.totalInWords && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: '#555', padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: 4, marginBottom: 16 }}>
          <strong>Amount in words:</strong> {data.totalInWords}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #eee', paddingTop: 16, marginTop: 8 }}>
        <div style={{ flex: 1 }}><Footer data={data} /></div>
        <SignatureBlock data={data} borderColor="#1a1a1a" labelColor="#555" />
      </div>
    </div>
  );
}

// ─── Template 2: Modern Blue ─────────────────────────────────────────────────

export function TemplateModernBlue({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const blue = '#1d4ed8';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, color: '#1a1a1a', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: blue, color: '#fff', padding: '32px 48px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 52, marginBottom: 10, display: 'block', filter: 'brightness(0) invert(1)' }} />}
          <div style={{ fontWeight: 700, fontSize: 20 }}>{data.billerName || 'Your Business'}</div>
          {data.billerAddress && <div style={{ opacity: 0.8, fontSize: 11, marginTop: 2 }}>{data.billerAddress}</div>}
          {(data.billerCity || data.billerCountry) && <div style={{ opacity: 0.8, fontSize: 11 }}>{joinAddr(data.billerCity, data.billerState, data.billerCountry)}</div>}
          {data.billerTaxId && <div style={{ opacity: 0.8, fontSize: 11 }}>Tax ID: {data.billerTaxId}</div>}
          {data.billerEmail && <div style={{ opacity: 0.8, fontSize: 11 }}>{data.billerEmail}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 3, opacity: 0.9 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            <div>No: <strong style={{ opacity: 1, color: '#fff' }}>{data.invoiceNumber}</strong></div>
            <div>Date: <strong style={{ color: '#fff' }}>{data.invoiceDate}</strong></div>
            {data.dueDate && <div>Due: <strong style={{ color: '#fff' }}>{data.dueDate}</strong></div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 48px' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, backgroundColor: '#f0f4ff', borderRadius: 8, padding: '16px 20px' }}>
          <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} postal={data.clientPostal} country={data.clientCountry} email={data.clientEmail} phone={data.clientPhone} countryCode={data.clientCountryCode} />
          {data.showShipping && (
            <PartyBlock label="Ship To" name={data.shippingName} address={data.shippingAddress} city={data.shippingCity} state={data.shippingState} postal={data.shippingPostal} country={data.shippingCountry} />
          )}
        </div>
        <div style={{ border: '1px solid #dbeafe', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
          <ItemsTable data={data} totals={totals} headerBg={blue} headerColor="#fff" rowAlt="#f8faff" borderColor="#dbeafe" />
        </div>
        <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={blue} /></div>
        {data.showTotalInWords && data.totalInWords && (
          <div style={{ fontSize: 11, color: '#555', padding: '8px 12px', backgroundColor: '#f0f4ff', borderLeft: `3px solid ${blue}`, marginBottom: 16 }}>
            <strong>Amount in words:</strong> {data.totalInWords}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #dbeafe', paddingTop: 16 }}>
          <div style={{ flex: 1 }}><Footer data={data} /></div>
          <SignatureBlock data={data} borderColor={blue} labelColor={blue} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 3: Minimalist ──────────────────────────────────────────────────

export function TemplateMinimalist({ data }: TemplateProps) {
  const totals = calcTotals(data);
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 12, color: '#2d2d2d', padding: '56px 60px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48 }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 48, display: 'block', marginBottom: 12 }} />}
          <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: 2 }}>{data.billerName || 'Your Business'}</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{[data.billerAddress, joinAddr(data.billerCity, data.billerCountry)].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 100, letterSpacing: 6, color: '#ccc' }}>{DOC_TITLES[data.docType]}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
        <PartyBlock label="Billed To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} postal={data.clientPostal} country={data.clientCountry} email={data.clientEmail} />
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ color: '#aaa' }}>Invoice Number</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{data.invoiceNumber}</div>
          <div style={{ color: '#aaa' }}>Date</div>
          <div style={{ fontWeight: 500 }}>{data.invoiceDate}</div>
          {data.dueDate && <><div style={{ color: '#aaa', marginTop: 4 }}>Due Date</div><div style={{ fontWeight: 500 }}>{data.dueDate}</div></>}
        </div>
      </div>
      <ItemsTable data={data} totals={totals} headerBg="#f7f7f7" headerColor="#888" rowAlt="#fafafa" borderColor="#f0f0f0" />
      <div style={{ marginTop: 24, marginBottom: 16 }}><Totals data={data} totals={totals} accentColor="#2d2d2d" /></div>
      {data.showTotalInWords && data.totalInWords && (
        <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic', marginBottom: 16 }}>{data.totalInWords}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #eee', paddingTop: 20, marginTop: 16 }}>
        <div style={{ flex: 1 }}><Footer data={data} /></div>
        <SignatureBlock data={data} borderColor="#ddd" labelColor="#aaa" />
      </div>
    </div>
  );
}

// ─── Template 4: Elegant Dark ────────────────────────────────────────────────

export function TemplateElegantDark({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const dark = '#1c2434'; const gold = '#d97706';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: 'Georgia, serif', fontSize: 12, color: '#1c2434', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: dark, padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 56, marginBottom: 12, display: 'block', filter: 'brightness(0) invert(1)' }} />}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{data.billerName || 'Your Business'}</div>
          {data.billerAddress && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }}>{data.billerAddress}</div>}
          {(data.billerCity || data.billerCountry) && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{joinAddr(data.billerCity, data.billerState, data.billerCountry)}</div>}
          {data.billerTaxId && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Tax ID: {data.billerTaxId}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: gold, fontSize: 28, fontWeight: 700, letterSpacing: 3 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            <div>No: <span style={{ color: '#fff', fontWeight: 600 }}>{data.invoiceNumber}</span></div>
            <div>Date: <span style={{ color: '#fff' }}>{data.invoiceDate}</span></div>
            {data.dueDate && <div>Due: <span style={{ color: '#fff' }}>{data.dueDate}</span></div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '28px 48px' }}>
        <div style={{ display: 'flex', gap: 32, marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${gold}` }}>
          <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} postal={data.clientPostal} country={data.clientCountry} email={data.clientEmail} />
          {data.showShipping && <PartyBlock label="Ship To" name={data.shippingName} address={data.shippingAddress} city={data.shippingCity} state={data.shippingState} postal={data.shippingPostal} country={data.shippingCountry} />}
        </div>
        <div style={{ border: '1px solid #e8dcc8', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <ItemsTable data={data} totals={totals} headerBg={dark} headerColor={gold} rowAlt="#fdf8f0" borderColor="#e8dcc8" />
        </div>
        <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={gold} /></div>
        {data.showTotalInWords && data.totalInWords && (
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#555', padding: '8px 12px', borderLeft: `3px solid ${gold}`, backgroundColor: '#fdf8f0', marginBottom: 16 }}>
            <strong>Amount in words:</strong> {data.totalInWords}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: `1px solid ${gold}`, paddingTop: 16 }}>
          <div style={{ flex: 1 }}><Footer data={data} /></div>
          <SignatureBlock data={data} borderColor={gold} labelColor={gold} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 5: Green Corporate ─────────────────────────────────────────────

export function TemplateGreenCorp({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const green = '#065f46'; const light = '#d1fae5';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#1a1a1a', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: green, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 50, display: 'block', marginBottom: 8, filter: 'brightness(0) invert(1)' }} />}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{data.billerName || 'Your Business'}</div>
          {data.billerAddress && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{data.billerAddress}</div>}
          {(data.billerCity || data.billerCountry) && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{joinAddr(data.billerCity, data.billerCountry)}</div>}
        </div>
        <div style={{ textAlign: 'right', color: '#fff' }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, opacity: 0.9 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 11 }}>
            <div>No: <strong style={{ opacity: 1, color: '#fff' }}>{data.invoiceNumber}</strong></div>
            <div>Date: {data.invoiceDate}</div>
            {data.dueDate && <div>Due: {data.dueDate}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ backgroundColor: light, padding: '14px 16px', borderRadius: 6 }}>
            <PartyBlock label="From" name={data.billerName} taxId={data.billerTaxId} address={data.billerAddress} city={data.billerCity} state={data.billerState} country={data.billerCountry} email={data.billerEmail} />
          </div>
          <div style={{ backgroundColor: '#f0fdf4', padding: '14px 16px', borderRadius: 6 }}>
            <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} country={data.clientCountry} email={data.clientEmail} />
          </div>
        </div>
        <div style={{ border: `1px solid ${light}`, borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
          <ItemsTable data={data} totals={totals} headerBg={green} headerColor="#fff" rowAlt="#f0fdf4" borderColor={light} />
        </div>
        <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={green} /></div>
        {data.showTotalInWords && data.totalInWords && (
          <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', padding: '8px 12px', backgroundColor: light, borderRadius: 4, marginBottom: 16 }}>
            <strong>Amount in words:</strong> {data.totalInWords}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: `1px solid ${light}`, paddingTop: 16 }}>
          <div style={{ flex: 1 }}><Footer data={data} /></div>
          <SignatureBlock data={data} borderColor={green} labelColor={green} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 6: Bold Orange ─────────────────────────────────────────────────

export function TemplateBoldOrange({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const orange = '#ea580c';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: "'Arial Black', Arial, sans-serif", fontSize: 12, color: '#1a1a1a', boxSizing: 'border-box' }}>
      <div style={{ padding: '36px 48px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `4px solid ${orange}`, marginBottom: 24 }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 56, display: 'block', marginBottom: 10 }} />}
          <div style={{ fontWeight: 900, fontSize: 22 }}>{data.billerName || 'YOUR BUSINESS'}</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#666', marginTop: 4 }}>{[data.billerAddress, joinAddr(data.billerCity, data.billerCountry)].filter(Boolean).join(', ')}</div>
          {data.billerTaxId && <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#666' }}>Tax ID: {data.billerTaxId}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: orange, fontSize: 34, fontWeight: 900, letterSpacing: 2 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#555', marginTop: 8 }}>
            <div>No: <strong style={{ color: '#1a1a1a' }}>{data.invoiceNumber}</strong></div>
            <div>Date: {data.invoiceDate}</div>
            {data.dueDate && <div>Due: {data.dueDate}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 48px 24px' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1, borderLeft: `4px solid ${orange}`, paddingLeft: 12 }}>
            <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} country={data.clientCountry} email={data.clientEmail} />
          </div>
          {data.showShipping && (
            <div style={{ flex: 1, borderLeft: '4px solid #fca87a', paddingLeft: 12 }}>
              <PartyBlock label="Ship To" name={data.shippingName} address={data.shippingAddress} city={data.shippingCity} country={data.shippingCountry} />
            </div>
          )}
        </div>
        <div style={{ border: `2px solid ${orange}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <ItemsTable data={data} totals={totals} headerBg={orange} headerColor="#fff" rowAlt="#fff7f0" borderColor="#fde8d8" />
        </div>
        <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={orange} /></div>
        {data.showTotalInWords && data.totalInWords && (
          <div style={{ fontSize: 11, color: '#555', fontFamily: 'Arial, sans-serif', padding: '8px 12px', borderLeft: `3px solid ${orange}`, marginBottom: 16 }}>
            <strong>Amount in words:</strong> {data.totalInWords}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: `2px solid ${orange}`, paddingTop: 16 }}>
          <div style={{ flex: 1 }}><Footer data={data} /></div>
          <SignatureBlock data={data} borderColor={orange} labelColor={orange} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 7: Purple Creative ─────────────────────────────────────────────

export function TemplatePurple({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const purple = '#7c3aed'; const light = '#ede9fe';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, color: '#1a1a1a', boxSizing: 'border-box' }}>
      <div style={{ background: `linear-gradient(135deg, ${purple}, #4f46e5)`, padding: '36px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {data.logo && <img src={data.logo} alt="" style={{ height: 52, display: 'block', marginBottom: 10, filter: 'brightness(0) invert(1)' }} />}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{data.billerName || 'Your Business'}</div>
          {data.billerAddress && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{data.billerAddress}</div>}
          {(data.billerCity || data.billerCountry) && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{joinAddr(data.billerCity, data.billerCountry)}</div>}
          {data.billerTaxId && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Tax ID: {data.billerTaxId}</div>}
        </div>
        <div style={{ textAlign: 'right', color: '#fff' }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, opacity: 0.95 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7 }}>
            <div>No: <strong style={{ opacity: 1, color: '#fff' }}>{data.invoiceNumber}</strong></div>
            <div>Date: {data.invoiceDate}</div>
            {data.dueDate && <div>Due: {data.dueDate}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 48px' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1, backgroundColor: light, padding: '14px 16px', borderRadius: 8 }}>
            <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} country={data.clientCountry} email={data.clientEmail} />
          </div>
          {data.showShipping && (
            <div style={{ flex: 1, backgroundColor: '#f5f3ff', padding: '14px 16px', borderRadius: 8 }}>
              <PartyBlock label="Ship To" name={data.shippingName} address={data.shippingAddress} city={data.shippingCity} country={data.shippingCountry} />
            </div>
          )}
        </div>
        <div style={{ border: `1px solid ${light}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <ItemsTable data={data} totals={totals} headerBg={purple} headerColor="#fff" rowAlt="#faf8ff" borderColor={light} />
        </div>
        <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={purple} /></div>
        {data.showTotalInWords && data.totalInWords && (
          <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', padding: '8px 12px', backgroundColor: light, borderRadius: 4, marginBottom: 16 }}>
            <strong>Amount in words:</strong> {data.totalInWords}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: `1px solid ${light}`, paddingTop: 16 }}>
          <div style={{ flex: 1 }}><Footer data={data} /></div>
          <SignatureBlock data={data} borderColor={purple} labelColor={purple} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 8: Warm Paper ──────────────────────────────────────────────────

export function TemplateWarm({ data }: TemplateProps) {
  const totals = calcTotals(data);
  const brown = '#78350f'; const gold = '#d97706'; const cream = '#fef3c7';
  return (
    <div style={{ width: 794, minHeight: 1123, backgroundColor: '#fffbf0', fontFamily: 'Georgia, serif', fontSize: 12, color: '#3d2c00', padding: '48px', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center', borderBottom: `2px solid ${gold}`, paddingBottom: 20, marginBottom: 28 }}>
        {data.logo && <img src={data.logo} alt="" style={{ height: 52, display: 'block', margin: '0 auto 12px' }} />}
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: 1 }}>{data.billerName || 'Your Business Name'}</div>
        <div style={{ fontSize: 10, color: brown, marginTop: 4 }}>
          {[data.billerAddress, joinAddr(data.billerCity, data.billerCountry), data.billerEmail, data.billerTaxId ? `Tax ID: ${data.billerTaxId}` : ''].filter(Boolean).join(' | ')}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div style={{ backgroundColor: cream, padding: '12px 16px', borderRadius: 6 }}>
          <PartyBlock label="Bill To" name={data.clientName} taxId={data.clientTaxId} address={data.clientAddress} city={data.clientCity} state={data.clientState} country={data.clientCountry} email={data.clientEmail} />
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: brown, letterSpacing: 2, marginBottom: 8 }}>{DOC_TITLES[data.docType]}</div>
          <div style={{ color: '#555' }}>No: <strong style={{ color: '#3d2c00' }}>{data.invoiceNumber}</strong></div>
          <div style={{ color: '#555' }}>Date: {data.invoiceDate}</div>
          {data.dueDate && <div style={{ color: '#555' }}>Due: {data.dueDate}</div>}
        </div>
      </div>
      <div style={{ border: `1px solid ${gold}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
        <ItemsTable data={data} totals={totals} headerBg={brown} headerColor={cream} rowAlt="#fffbf0" borderColor="#fde68a" />
      </div>
      <div style={{ marginBottom: 16 }}><Totals data={data} totals={totals} accentColor={brown} /></div>
      {data.showTotalInWords && data.totalInWords && (
        <div style={{ fontSize: 11, color: brown, fontStyle: 'italic', padding: '8px 12px', borderLeft: `3px solid ${gold}`, backgroundColor: cream, marginBottom: 16 }}>
          <strong>Amount in words:</strong> {data.totalInWords}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: `1px dashed ${gold}`, paddingTop: 20 }}>
        <div style={{ flex: 1 }}><Footer data={data} /></div>
        <SignatureBlock data={data} borderColor={gold} labelColor={brown} />
      </div>
    </div>
  );
}

// ─── Template registry ────────────────────────────────────────────────────────

export const TEMPLATES = [
  { id: 'classic',      name: 'Classic',          accent: '#1a1a1a', component: TemplateClassic },
  { id: 'modern-blue',  name: 'Modern Blue',      accent: '#1d4ed8', component: TemplateModernBlue },
  { id: 'minimalist',   name: 'Minimalist',       accent: '#888888', component: TemplateMinimalist },
  { id: 'elegant-dark', name: 'Elegant Dark',     accent: '#d97706', component: TemplateElegantDark },
  { id: 'green-corp',   name: 'Green Corporate',  accent: '#065f46', component: TemplateGreenCorp },
  { id: 'bold-orange',  name: 'Bold Orange',      accent: '#ea580c', component: TemplateBoldOrange },
  { id: 'purple',       name: 'Purple Creative',  accent: '#7c3aed', component: TemplatePurple },
  { id: 'warm',         name: 'Warm Paper',       accent: '#78350f', component: TemplateWarm },
] as const;

export type TemplateId = typeof TEMPLATES[number]['id'];
