import { createFileRoute } from '@tanstack/react-router';
import type { InvoiceDocType } from '@/lib/invoice-utils';
import type React from 'react';
import { FileText, Receipt, ShoppingCart, Truck, Package, FileCheck, Briefcase, DollarSign, Globe, BookOpen } from 'lucide-react';

export const Route = createFileRoute('/tools/')({
  component: ToolsLanding,
});

const TOOLS: { id: string; title: string; description: string; icon: React.ComponentType<{ style?: React.CSSProperties }>; color: string; bg: string; docType: InvoiceDocType; badge?: string }[] = [
  { id: 'invoice', title: 'Invoice Generator', description: 'Create professional GST invoices with CGST, SGST & IGST calculation. Free, no login required.', icon: Receipt, color: '#1d4ed8', bg: '#eff6ff', docType: 'invoice', badge: 'Popular' },
  { id: 'quotation', title: 'Quotation Generator', description: 'Create professional quotations for your clients with itemised pricing.', icon: FileText, color: '#065f46', bg: '#f0fdf4', docType: 'quotation' },
  { id: 'proforma', title: 'Proforma Invoice', description: 'Generate a proforma invoice for advance payments and international trade.', icon: FileCheck, color: '#7c3aed', bg: '#f5f3ff', docType: 'proforma' },
  { id: 'po', title: 'Purchase Order', description: 'Create formal purchase orders for procurement and vendor management.', icon: ShoppingCart, color: '#ea580c', bg: '#fff7ed', docType: 'purchase_order' },
  { id: 'delivery', title: 'Delivery Challan', description: 'Generate delivery challans for goods dispatch with full item details.', icon: Truck, color: '#d97706', bg: '#fffbeb', docType: 'delivery_challan' },
  { id: 'commercial', title: 'Commercial Invoice', description: 'Create commercial invoices for international shipments and customs.', icon: Globe, color: '#0891b2', bg: '#ecfeff', docType: 'invoice' },
  { id: 'consulting', title: 'Consulting Invoice', description: 'Bill clients for consulting services with professional invoice templates.', icon: Briefcase, color: '#be185d', bg: '#fdf2f8', docType: 'invoice' },
  { id: 'vat', title: 'Invoice with VAT', description: 'Create invoices with VAT calculation for international billing.', icon: DollarSign, color: '#15803d', bg: '#f0fdf4', docType: 'invoice' },
  { id: 'formats', title: 'Invoice Formats', description: 'Browse 8+ professional invoice templates and choose your style.', icon: BookOpen, color: '#6d28d9', bg: '#faf5ff', docType: 'invoice' },
  { id: 'packing', title: 'Packing List', description: 'Generate packing lists for shipments with item-by-item details.', icon: Package, color: '#b45309', bg: '#fffbeb', docType: 'delivery_challan' },
];

function ToolsLanding() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', padding: '56px 24px 64px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '4px 16px', fontSize: 12, color: '#c7d2fe', marginBottom: 16, fontWeight: 500 }}>
          100% Free · No Login Required · No Watermarks
        </div>
        <h1 style={{ color: '#fff', fontSize: 42, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.2 }}>
          Free Business Document Tools
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, margin: '0 auto', maxWidth: 520 }}>
          Create professional invoices, quotations, purchase orders and more.
          Download as PDF instantly — no signup needed.
        </p>
      </div>

      {/* Tools grid */}
      <div style={{ maxWidth: 1080, margin: '-32px auto 0', padding: '0 24px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <a key={tool.id} href={`/tools/invoice?type=${tool.docType}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: '#fff', borderRadius: 12, padding: '24px',
                  border: '1px solid #e5e7eb', cursor: 'pointer',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: tool.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 22, height: 22, color: tool.color }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{tool.title}</span>
                      {tool.badge && (
                        <span style={{ backgroundColor: tool.color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{tool.badge}</span>
                      )}
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{tool.description}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Features strip */}
        <div style={{ marginTop: 56, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>WHY USE OUR TOOLS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24 }}>
            {[
              ['✓ GST Ready', 'Auto-calculates CGST, SGST & IGST'],
              ['✓ 8+ Templates', 'Professional designs for every industry'],
              ['✓ PDF Download', 'Save or print as PDF instantly'],
              ['✓ No Login', 'No account or credit card required'],
              ['✓ 100% Free', 'All tools are completely free to use'],
              ['✓ HSN / SAC', 'Full support for GST item codes'],
            ].map(([title, sub]) => (
              <div key={title} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 700, color: '#111', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
