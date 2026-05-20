import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

interface ReceiptData {
  customerName: string;
  customerEmail: string;
  date: string;
  paymentMethod: string;
  status: string;
  items: ReceiptItem[];
  totalAmount: number;
  currency: string;
  orderId: string;
  receiptNumber: string;
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    company?: string;
    orgNumber?: string;
    vatNumber?: string;
    email?: string;
  };
}

function fmt(cents: number, currency: string): string {
  const v = (cents / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency.toUpperCase()}`;
}

// Gold brand color (#c59333 -> 0.773, 0.576, 0.2)
const GOLD = rgb(0.773, 0.576, 0.2);
const GOLD_TINT = rgb(0.98, 0.95, 0.87);
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.42, 0.42, 0.46);
const BORDER = rgb(0.88, 0.86, 0.82);
const ZEBRA = rgb(0.985, 0.98, 0.97);
const WHITE = rgb(1, 1, 1);

async function generateReceiptPdf(receipt: ReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Kvitto ${receipt.receiptNumber}`);
  pdfDoc.setAuthor(receipt.companyInfo.company || receipt.companyInfo.name);
  pdfDoc.setProducer('Tropical Studios');

  const page: PDFPage = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595;
  const H = 842;
  const M = 50;

  const draw = (text: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: any; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? TEXT;
    let str = text ?? '';
    if (opts.maxWidth) {
      while (str.length > 4 && f.widthOfTextAtSize(str, size) > opts.maxWidth) str = str.slice(0, -1);
      if (str !== text) str = str.slice(0, -1) + '…';
    }
    let drawX = x;
    if (opts.align === 'right') drawX = x - f.widthOfTextAtSize(str, size);
    else if (opts.align === 'center') drawX = x - f.widthOfTextAtSize(str, size) / 2;
    page.drawText(str, { x: drawX, y, size, font: f, color });
  };

  // ===== Header band =====
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: GOLD });
  draw((receipt.companyInfo.company || receipt.companyInfo.name).toUpperCase(), M, H - 40, { size: 18, bold: true, color: WHITE });
  draw('Dansstudio · Göteborg', M, H - 58, { size: 9, color: WHITE });
  draw('KVITTO', W - M, H - 40, { size: 22, bold: true, color: WHITE, align: 'right' });
  draw(`Nr ${receipt.receiptNumber}`, W - M, H - 60, { size: 9, color: WHITE, align: 'right' });

  let y = H - 130;

  // ===== Two columns: Från / Kvitto till =====
  draw('FRÅN', M, y, { size: 8, bold: true, color: MUTED });
  draw('KVITTO TILL', W / 2 + 10, y, { size: 8, bold: true, color: MUTED });
  y -= 16;

  const leftLines = [
    receipt.companyInfo.company || receipt.companyInfo.name,
    receipt.companyInfo.address,
    receipt.companyInfo.orgNumber ? `Org.nr ${receipt.companyInfo.orgNumber}` : '',
    receipt.companyInfo.vatNumber ? `VAT ${receipt.companyInfo.vatNumber}` : '',
    receipt.companyInfo.email ? receipt.companyInfo.email : '',
    receipt.companyInfo.phone ? `Tel ${receipt.companyInfo.phone}` : '',
  ].filter(Boolean);

  const rightLines = [
    receipt.customerName || 'Medlem',
    receipt.customerEmail || '',
  ].filter(Boolean);

  const maxRows = Math.max(leftLines.length, rightLines.length);
  let blockY = y;
  for (let i = 0; i < maxRows; i++) {
    if (leftLines[i]) draw(leftLines[i], M, blockY, { size: 9.5, color: i === 0 ? TEXT : MUTED, bold: i === 0, maxWidth: W / 2 - M - 10 });
    if (rightLines[i]) draw(rightLines[i], W / 2 + 10, blockY, { size: 9.5, color: i === 0 ? TEXT : MUTED, bold: i === 0, maxWidth: W / 2 - M - 10 });
    blockY -= 13;
  }
  y = blockY - 16;

  // ===== Metadata strip =====
  page.drawRectangle({ x: M, y: y - 32, width: W - 2 * M, height: 38, color: GOLD_TINT });
  const metaCols = [
    { label: 'DATUM', value: receipt.date },
    { label: 'METOD', value: receipt.paymentMethod },
    { label: 'STATUS', value: receipt.status },
    { label: 'REFERENS', value: receipt.orderId.slice(0, 14) },
  ];
  const colW = (W - 2 * M) / metaCols.length;
  metaCols.forEach((c, i) => {
    const cx = M + i * colW + 12;
    draw(c.label, cx, y - 8, { size: 7.5, color: MUTED, bold: true });
    draw(c.value, cx, y - 22, { size: 10.5, bold: true, color: TEXT });
  });
  y -= 56;

  // ===== Items table =====
  const colX = { desc: M + 8, qty: W - M - 230, unit: W - M - 130, sum: W - M - 8 };
  const headerY = y;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: TEXT });
  draw('BESKRIVNING', colX.desc, y, { size: 8.5, bold: true, color: WHITE });
  draw('ANTAL', colX.qty + 30, y, { size: 8.5, bold: true, color: WHITE, align: 'right' });
  draw('À-PRIS', colX.unit + 60, y, { size: 8.5, bold: true, color: WHITE, align: 'right' });
  draw('SUMMA', colX.sum, y, { size: 8.5, bold: true, color: WHITE, align: 'right' });
  y -= 22;

  receipt.items.forEach((item, idx) => {
    const rowH = 26;
    if (idx % 2 === 0) {
      page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: rowH - 4, color: ZEBRA });
    }
    const lineTotal = item.quantity * item.unitPrice;
    draw(item.description, colX.desc, y, { size: 10, maxWidth: colX.qty - colX.desc - 10 });
    draw(String(item.quantity), colX.qty + 30, y, { size: 10, align: 'right' });
    draw(fmt(item.unitPrice, item.currency), colX.unit + 60, y, { size: 10, align: 'right' });
    draw(fmt(lineTotal, item.currency), colX.sum, y, { size: 10, bold: true, align: 'right' });
    y -= rowH;
  });

  // Bottom border
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 0.5, color: BORDER });
  y -= 6;

  // ===== Totals block =====
  const totalsX = W - M;
  draw('Subtotal', totalsX - 100, y, { size: 9.5, color: MUTED });
  draw(fmt(receipt.totalAmount, receipt.currency), totalsX, y, { size: 9.5, align: 'right' });
  y -= 16;
  draw('Moms', totalsX - 100, y, { size: 9.5, color: MUTED });
  draw('0,00 ' + receipt.currency.toUpperCase(), totalsX, y, { size: 9.5, align: 'right' });
  y -= 18;

  page.drawLine({ start: { x: totalsX - 180, y: y + 12 }, end: { x: totalsX, y: y + 12 }, thickness: 0.5, color: BORDER });
  draw('TOTALT', totalsX - 100, y - 4, { size: 13, bold: true, color: TEXT });
  draw(fmt(receipt.totalAmount, receipt.currency), totalsX, y - 4, { size: 14, bold: true, color: GOLD, align: 'right' });
  y -= 50;

  // ===== Footer =====
  page.drawLine({ start: { x: M, y: 90 }, end: { x: W - M, y: 90 }, thickness: 0.5, color: BORDER });
  draw('Tack för att du dansar med oss!', M, 70, { size: 11, bold: true, color: GOLD });
  draw('Detta kvitto är genererat automatiskt och är giltigt utan underskrift.', M, 54, { size: 8.5, color: MUTED });
  draw(`${receipt.companyInfo.company || receipt.companyInfo.name} · ${receipt.companyInfo.email ?? ''}`, M, 40, { size: 8.5, color: MUTED });
  draw('Sida 1 / 1', W - M, 40, { size: 8.5, color: MUTED, align: 'right' });

  return await pdfDoc.save();
}

async function resolveSwishDescription(adminClient: any, payment: any): Promise<string> {
  const meta = (payment.metadata || {}) as any;
  if (meta.description) return String(meta.description);

  const created = new Date(payment.created_at).getTime();
  const lo = new Date(created - 30 * 60 * 1000).toISOString();
  const hi = new Date(created + 30 * 60 * 1000).toISOString();

  if (payment.payment_type === 'event' || meta.event_id) {
    const { data: bk } = await adminClient
      .from('event_bookings')
      .select('ticket_count, events!event_bookings_event_id_fkey(title)')
      .eq('member_id', payment.member_id)
      .gte('created_at', lo)
      .lte('created_at', hi)
      .limit(1)
      .maybeSingle();
    if (bk) {
      const title = (bk.events as any)?.title || 'Event';
      const count = bk.ticket_count || 1;
      return `Eventbiljett: ${title} — ${count} biljett${count > 1 ? 'er' : ''}`;
    }
    if (meta.event_title) return `Eventbiljett: ${meta.event_title}`;
  }

  if (payment.payment_type === 'tickets' || payment.payment_type === 'klippkort') {
    const { data: tk } = await adminClient
      .from('tickets')
      .select('total_tickets')
      .eq('member_id', payment.member_id)
      .gte('purchased_at', lo)
      .lte('purchased_at', hi)
      .limit(1)
      .maybeSingle();
    if (tk) return `Klippkort: ${tk.total_tickets} klipp`;
  }

  return meta.event_title || meta.course_title || payment.payment_type || 'Betalning';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = authData.user.id;

    const { payment_id, payment_source } = await req.json();
    if (!payment_id || !payment_source) {
      return new Response(JSON.stringify({ error: 'MISSING_PARAMS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    const isAdmin = !!roleData;

    const companyInfo = {
      name: 'Dance Vida',
      company: 'Tropical Studios AB',
      orgNumber: '559326-1778',
      vatNumber: 'SE559326177801',
      address: 'Gamlestadsvägen 14, 415 02 Göteborg',
      phone: '073-702 11 34',
      email: 'info@tropicalstudios.se',
    };

    let receipt: ReceiptData;
    let filenameId: string;

    if (payment_source === 'swish') {
      const { data: payment, error } = await adminClient
        .from('swish_payments')
        .select('*, profiles!swish_payments_member_id_fkey(full_name, email)')
        .eq('id', payment_id)
        .single();
      if (error || !payment) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (payment.member_id !== userId && !isAdmin) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const profile = payment.profiles as any;
      const description = await resolveSwishDescription(adminClient, payment);

      receipt = {
        customerName: profile?.full_name || 'Medlem',
        customerEmail: profile?.email || '',
        date: new Date(payment.created_at).toLocaleDateString('sv-SE'),
        paymentMethod: 'Swish',
        status: (payment.status || '').toLowerCase() === 'paid' ? 'Betald' : payment.status,
        items: [{ description, quantity: 1, unitPrice: payment.amount_cents, currency: payment.currency }],
        totalAmount: payment.amount_cents,
        currency: payment.currency,
        orderId: payment.payment_request_id || payment.id,
        receiptNumber: payment.id.slice(0, 8).toUpperCase(),
        companyInfo,
      };
      filenameId = payment.id.slice(0, 8);
    } else if (payment_source === 'stripe') {
      const { data: payment, error } = await adminClient
        .from('payments')
        .select('*, profiles!payments_member_id_fkey(full_name, email)')
        .eq('id', payment_id)
        .single();
      if (error || !payment) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (payment.member_id !== userId && !isAdmin) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const profile = payment.profiles as any;
      const statusLower = (payment.status || '').toLowerCase();
      receipt = {
        customerName: profile?.full_name || 'Medlem',
        customerEmail: profile?.email || '',
        date: new Date(payment.created_at).toLocaleDateString('sv-SE'),
        paymentMethod: 'Kort (Stripe)',
        status: statusLower === 'paid' || statusLower === 'succeeded' || statusLower === 'complete' ? 'Betald' : payment.status,
        items: [{ description: payment.description || 'Betalning', quantity: 1, unitPrice: payment.amount_cents, currency: payment.currency }],
        totalAmount: payment.amount_cents,
        currency: payment.currency,
        orderId: payment.order_id || payment.id,
        receiptNumber: payment.id.slice(0, 8).toUpperCase(),
        companyInfo,
      };
      filenameId = payment.id.slice(0, 8);
    } else {
      return new Response(JSON.stringify({ error: 'INVALID_SOURCE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pdfBytes = await generateReceiptPdf(receipt);
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="kvitto-${filenameId}.pdf"`,
      },
    });
  } catch (e) {
    console.error('generate-receipt error:', e);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String((e as any)?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
