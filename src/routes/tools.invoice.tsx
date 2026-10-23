import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, Download, Printer, Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  type InvoiceData, type InvoiceDocType, calcTotals, calcItem, defaultInvoiceData,
  emptyItem, CURRENCIES, COUNTRY_CODES, TAX_RATES, DOC_TITLES,
} from '@/lib/invoice-utils';
import { numberToWords } from '@/lib/number-to-words';
import { TEMPLATES, type TemplateId } from '@/components/invoice-maker/templates';

export const Route = createFileRoute('/tools/invoice')({
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type as InvoiceDocType) || 'invoice',
  }),
  component: InvoiceMakerPage,
});

type Step = 'form' | 'templates';

// ─── small UI helpers ─────────────────────────────────────────────────────────

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{children}</label>;
}

function Inp({ value, onChange, placeholder, type = 'text', style, step, min }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; style?: React.CSSProperties; step?: string; min?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} step={step} min={min}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', ...style }} />
  );
}

function Sel({ value, onChange, children, style }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box', ...style }}>
      {children}
    </select>
  );
}

function Card({ title, children, collapsible = false, defaultOpen = true }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
      <div onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{ padding: '12px 20px', backgroundColor: '#f9fafb', borderBottom: open ? '1px solid #e5e7eb' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: collapsible ? 'pointer' : 'default' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{title}</span>
        {collapsible && (open ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </div>
      {open && <div style={{ padding: '16px 20px' }}>{children}</div>}
    </div>
  );
}

function PartyFields({ prefix, data, update }: { prefix: 'biller' | 'client'; data: InvoiceData; update: (p: Partial<InvoiceData>) => void }) {
  const f = (field: string) => `${prefix}${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof InvoiceData;
  const v = (field: string) => (data[f(field)] ?? '') as string;
  const u = (field: string) => (val: string) => update({ [f(field)]: val } as Partial<InvoiceData>);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <Lbl>Business / Person Name *</Lbl>
        <Inp value={v('name')} onChange={u('name')} placeholder={prefix === 'biller' ? 'Your business name' : "Client's name"} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
        <div><Lbl>Code</Lbl><Sel value={v('countryCode')} onChange={u('countryCode')}>{COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</Sel></div>
        <div><Lbl>Phone</Lbl><Inp value={v('phone')} onChange={u('phone')} placeholder="Phone number" type="tel" /></div>
      </div>
      <div>
        <Lbl>Tax ID / VAT No</Lbl>
        <Inp value={v('taxId')} onChange={u('taxId')} placeholder="Optional — BIN, TIN, VAT number…" />
      </div>
      <div>
        <Lbl>Address</Lbl>
        <Inp value={v('address')} onChange={u('address')} placeholder="Street / Building / Area" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><Lbl>City</Lbl><Inp value={v('city')} onChange={u('city')} placeholder="City" /></div>
        <div><Lbl>State / Province</Lbl><Inp value={v('state')} onChange={u('state')} placeholder="State / District" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><Lbl>Postal / ZIP</Lbl><Inp value={v('postal')} onChange={u('postal')} placeholder="Postal code" /></div>
        <div><Lbl>Country</Lbl><Inp value={v('country')} onChange={u('country')} placeholder="Country" /></div>
      </div>
      <div>
        <Lbl>Email</Lbl>
        <Inp value={v('email')} onChange={u('email')} placeholder="email@example.com" type="email" />
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

function InvoiceMakerPage() {
  const { type } = Route.useSearch();
  const [data, setData] = useState<InvoiceData>(() => ({ ...defaultInvoiceData(), docType: type }));
  const [step, setStep] = useState<Step>('form');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern-blue');
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const update = useCallback((patch: Partial<InvoiceData>) => setData(d => ({ ...d, ...patch })), []);

  const totals = calcTotals(data);

  useEffect(() => {
    if (data.showTotalInWords) {
      update({ totalInWords: numberToWords(totals.total, data.currency) });
    }
  }, [totals.total, data.currency, data.showTotalInWords]);

  const updateItem = (id: string, patch: Partial<typeof data.items[0]>) =>
    setData(d => ({ ...d, items: d.items.map(it => it.id === id ? calcItem({ ...it, ...patch }) : it) }));

  const removeItem = (id: string) => {
    if (data.items.length === 1) return;
    setData(d => ({ ...d, items: d.items.filter(it => it.id !== id) }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => update({ logo: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => update({ signature: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    update({ totalInWords: numberToWords(totals.total, data.currency) });
    setStep('templates');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const jsPDFMod = await import('jspdf');
      const html2canvasMod = await import('html2canvas');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const JsPDF = (jsPDFMod as any).default ?? jsPDFMod;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas = (html2canvasMod as any).default ?? html2canvasMod;
      const el = printRef.current!;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height / canvas.width) * pdfW;
      if (imgH <= pdfH) {
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, pdfW, imgH);
      } else {
        let y = 0;
        while (y < imgH) {
          pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, -y, pdfW, imgH);
          y += pdfH;
          if (y < imgH) pdf.addPage();
        }
      }
      pdf.save(`${data.invoiceNumber || DOC_TITLES[data.docType]}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${data.invoiceNumber}</title><style>body{margin:0;padding:0;}@media print{body{margin:0;}}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const SelectedTemplate = TEMPLATES.find(t => t.id === selectedTemplate)?.component;
  const fmtAmt = (n: number) => `${data.currencySymbol}${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── STEP 2: TEMPLATE SELECTION ────────────────────────────────────────────

  if (step === 'templates') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: "'Inter', Arial, sans-serif" }}>
        <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <button onClick={() => setStep('form')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={16} /> Edit Invoice
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Choose Template</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
              <Printer size={15} /> Print
            </button>
            <button onClick={handleDownloadPDF} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', backgroundColor: '#1d4ed8', color: '#fff', fontSize: 13, cursor: downloading ? 'wait' : 'pointer', fontWeight: 600, opacity: downloading ? 0.7 : 1 }}>
              <Download size={15} /> {downloading ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
          {/* Template grid */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 12 }}>Select Template</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map(tpl => {
                const Cmp = tpl.component;
                const isActive = selectedTemplate === tpl.id;
                const scale = 220 / 794;
                const thumbH = Math.round(1123 * scale);
                return (
                  <button key={tpl.id} onClick={() => setSelectedTemplate(tpl.id)}
                    style={{ border: `2px solid ${isActive ? tpl.accent : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'none', padding: 0, width: '100%', textAlign: 'left' }}>
                    <div style={{ width: '100%', height: thumbH, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                        <Cmp data={data} />
                      </div>
                    </div>
                    <div style={{ padding: '6px 10px', backgroundColor: isActive ? tpl.accent : '#f9fafb', color: isActive ? '#fff' : '#374151', fontSize: 12, fontWeight: 700, borderTop: `1px solid ${isActive ? tpl.accent : '#e5e7eb'}` }}>
                      {tpl.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 12 }}>Preview</div>
            <div style={{ backgroundColor: '#e2e8f0', borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'center' }}>
              <div ref={printRef} style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                {SelectedTemplate && <SelectedTemplate data={data} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: FORM ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', Arial, sans-serif" }}>
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link to="/tools" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> All Tools
        </Link>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{DOC_TITLES[data.docType]} Maker</div>
        <button onClick={handleContinue} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', backgroundColor: '#1d4ed8', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Save & Continue →
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 80px' }}>

        {/* Document Details */}
        <Card title="Document Details">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <div>
              <Lbl>Document Type</Lbl>
              <Sel value={data.docType} onChange={v => update({ docType: v as InvoiceDocType })}>
                <option value="invoice">Invoice</option>
                <option value="quotation">Quotation</option>
                <option value="proforma">Proforma Invoice</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="delivery_challan">Delivery Challan</option>
              </Sel>
            </div>
            <div><Lbl>Document No *</Lbl><Inp value={data.invoiceNumber} onChange={v => update({ invoiceNumber: v })} placeholder="INV-001" /></div>
            <div><Lbl>Date *</Lbl><Inp type="date" value={data.invoiceDate} onChange={v => update({ invoiceDate: v })} /></div>
            <div><Lbl>Due Date</Lbl><Inp type="date" value={data.dueDate} onChange={v => update({ dueDate: v })} /></div>
            <div><Lbl>Reference / PO No</Lbl><Inp value={data.poNumber} onChange={v => update({ poNumber: v })} placeholder="Optional" /></div>
          </div>
        </Card>

        {/* Logo */}
        <Card title="Business Logo" collapsible defaultOpen={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {data.logo ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={data.logo} alt="Logo" style={{ height: 72, borderRadius: 8, objectFit: 'contain', border: '1px solid #e5e7eb' }} />
                <button onClick={() => update({ logo: '' })} style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 160, height: 80, borderRadius: 8, border: '2px dashed #d1d5db', cursor: 'pointer', gap: 6, color: '#9ca3af', fontSize: 12 }}>
                <Upload size={20} />
                <span>Upload Logo</span>
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </label>
            )}
            <div style={{ fontSize: 12, color: '#9ca3af' }}>PNG, JPEG or SVG · recommended 200×80px</div>
          </div>
        </Card>

        {/* Biller + Client */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {(['biller', 'client'] as const).map(prefix => (
            <div key={prefix} style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{prefix === 'biller' ? 'Your Details' : "Client's Details"}</span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <PartyFields prefix={prefix} data={data} update={update} />
              </div>
            </div>
          ))}
        </div>

        {/* Shipping */}
        <Card title="Shipping Details" collapsible defaultOpen={false}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: data.showShipping ? 16 : 0, fontSize: 13 }}>
            <input type="checkbox" checked={data.showShipping} onChange={e => update({ showShipping: e.target.checked })} />
            Add shipping / delivery address
          </label>
          {data.showShipping && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div><Lbl>Ship To (Name)</Lbl><Inp value={data.shippingName} onChange={v => update({ shippingName: v })} placeholder="Recipient name" /></div>
              <div><Lbl>Address</Lbl><Inp value={data.shippingAddress} onChange={v => update({ shippingAddress: v })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><Lbl>City</Lbl><Inp value={data.shippingCity} onChange={v => update({ shippingCity: v })} /></div>
                <div><Lbl>State</Lbl><Inp value={data.shippingState} onChange={v => update({ shippingState: v })} /></div>
                <div><Lbl>Country</Lbl><Inp value={data.shippingCountry} onChange={v => update({ shippingCountry: v })} /></div>
              </div>
            </div>
          )}
        </Card>

        {/* Currency & Tax Label */}
        <Card title="Currency & Tax">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <Lbl>Currency</Lbl>
              <Sel value={data.currency} onChange={v => {
                const cur = CURRENCIES.find(c => c.code === v);
                update({ currency: v, currencySymbol: cur?.symbol ?? v });
              }}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Sel>
            </div>
            <div>
              <Lbl>Tax Label</Lbl>
              <Inp value={data.taxLabel} onChange={v => update({ taxLabel: v })} placeholder="VAT, GST, Tax…" />
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card title="Items / Services">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['#', 'Item / Description', 'Code', `${data.taxLabel || 'Tax'}%`, 'Qty', 'Rate', 'Amount', data.taxLabel || 'Tax', 'Total', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 8px', fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: i === 0 ? 'center' : i >= 5 ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => {
                  const ci = calcItem(item);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: '6px 4px', minWidth: 150 }}>
                        <input value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} placeholder="Item name / description"
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 4px', minWidth: 80 }}>
                        <input value={item.itemCode} onChange={e => updateItem(item.id, { itemCode: e.target.value })} placeholder="Optional"
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 4px', minWidth: 80 }}>
                        <select value={item.taxRate} onChange={e => updateItem(item.id, { taxRate: parseFloat(e.target.value) })}
                          style={{ width: '100%', padding: '6px 4px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, outline: 'none', backgroundColor: '#fff' }}>
                          {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 4px', minWidth: 66 }}>
                        <input type="number" step="0.01" min="0" value={item.quantity}
                          onChange={e => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 4px', minWidth: 90 }}>
                        <input type="number" step="0.01" min="0" value={item.rate}
                          onChange={e => updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtAmt(ci.amount)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtAmt(ci.taxAmount)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtAmt(ci.total)}</td>
                      <td style={{ padding: '6px 4px', width: 32 }}>
                        <button onClick={() => removeItem(item.id)} disabled={data.items.length === 1}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: data.items.length === 1 ? 0.3 : 1, padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <button onClick={() => setData(d => ({ ...d, items: [...d.items, emptyItem()] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px dashed #d1d5db', backgroundColor: '#f9fafb', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
              <Plus size={14} /> Add Line
            </button>
            {/* Summary */}
            <div style={{ minWidth: 220, backgroundColor: '#f9fafb', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
              {[
                ['Subtotal', fmtAmt(totals.subtotal)],
                ...(totals.taxTotal > 0 ? [[data.taxLabel || 'Tax', fmtAmt(totals.taxTotal)]] : []),
                ...(totals.discountAmount > 0 ? [['Discount', `−${fmtAmt(totals.discountAmount)}`]] : []),
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: 700, fontSize: 15, color: '#111' }}>
                <span>Total</span><span>{fmtAmt(totals.total)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Discount */}
        <Card title="Discount" collapsible defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <Lbl>Type</Lbl>
              <Sel value={data.discountType} onChange={v => update({ discountType: v as 'amount' | 'percent' })}>
                <option value="amount">Fixed Amount</option>
                <option value="percent">Percentage (%)</option>
              </Sel>
            </div>
            <div>
              <Lbl>Value</Lbl>
              <Inp type="number" step="0.01" min="0" value={String(data.discountValue)} onChange={v => update({ discountValue: parseFloat(v) || 0 })} placeholder={data.discountType === 'percent' ? '10' : '100'} />
            </div>
          </div>
        </Card>

        {/* Bank Details */}
        <Card title="Bank / Payment Details" collapsible defaultOpen={false}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: data.showBankDetails ? 16 : 0, fontSize: 13 }}>
            <input type="checkbox" checked={data.showBankDetails} onChange={e => update({ showBankDetails: e.target.checked })} />
            Show bank details on invoice
          </label>
          {data.showBankDetails && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><Lbl>Bank Name</Lbl><Inp value={data.bankName} onChange={v => update({ bankName: v })} placeholder="e.g. Dutch-Bangla Bank" /></div>
                <div><Lbl>Account Holder</Lbl><Inp value={data.accountHolder} onChange={v => update({ accountHolder: v })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><Lbl>Account No</Lbl><Inp value={data.accountNumber} onChange={v => update({ accountNumber: v })} /></div>
                <div><Lbl>Routing / SWIFT</Lbl><Inp value={data.routingCode} onChange={v => update({ routingCode: v })} placeholder="Routing or SWIFT code" /></div>
                <div><Lbl>Mobile / bKash / Others</Lbl><Inp value={data.additionalPayment} onChange={v => update({ additionalPayment: v })} placeholder="e.g. 01xxxxxxxxx" /></div>
              </div>
            </div>
          )}
        </Card>

        {/* Additional */}
        <Card title="Notes & Extras" collapsible defaultOpen={false}>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={data.showTotalInWords} onChange={e => update({ showTotalInWords: e.target.checked })} />
              Show amount in words on invoice
            </label>
            {data.showTotalInWords && (
              <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                {numberToWords(totals.total, data.currency)}
              </div>
            )}
            <div>
              <Lbl>Terms & Conditions</Lbl>
              <textarea value={data.termsConditions} onChange={e => update({ termsConditions: e.target.value })} rows={3}
                placeholder="e.g. Payment due within 30 days. Goods once sold will not be returned."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div>
              <Lbl>Notes</Lbl>
              <textarea value={data.notes} onChange={e => update({ notes: e.target.value })} rows={2}
                placeholder="Additional notes for your client…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div>
              <Lbl>Signature</Lbl>
              {data.signature ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={data.signature} alt="Sig" style={{ height: 60, border: '1px solid #e5e7eb', borderRadius: 6, padding: 4 }} />
                  <button onClick={() => update({ signature: '' })} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px dashed #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
                  <Upload size={14} /> Upload Signature
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleSigUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={handleContinue} style={{ padding: '12px 32px', borderRadius: 10, border: 'none', backgroundColor: '#1d4ed8', color: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
            Save & Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
