import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  items: ReceiptItem[];
  totalAmount: number;
  currency: string;
  orderId: string;
  companyInfo: { name: string; address: string; phone: string };
}

function pdfStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function generateReceiptPdf(receipt: ReceiptData): Uint8Array {
  const lineHeight = 16;
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 50;
  const contentWidth = pageWidth - 100;

  const lines: { x: number; y: number; text: string; fontSize?: number; bold?: boolean }[] = [];
  let y = pageHeight - 60;

  lines.push({ x: marginLeft, y, text: receipt.companyInfo.name, fontSize: 20, bold: true });
  y -= 20;
  lines.push({ x: marginLeft, y, text: receipt.companyInfo.address, fontSize: 9 });
  y -= 14;
  lines.push({ x: marginLeft, y, text: `Tel: ${receipt.companyInfo.phone}`, fontSize: 9 });
  y -= 30;
  lines.push({ x: marginLeft, y, text: 'KVITTO / RECEIPT', fontSize: 16, bold: true });
  y -= 28;
  lines.push({ x: marginLeft, y, text: `Kund / Customer: ${receipt.customerName}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `E-post / Email: ${receipt.customerEmail}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `Datum / Date: ${receipt.date}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `Order: ${receipt.orderId}`, fontSize: 10 });
  y -= 28;

  lines.push({ x: marginLeft, y, text: 'Beskrivning / Description', fontSize: 9, bold: true });
  lines.push({ x: 340, y, text: 'Antal', fontSize: 9, bold: true });
  lines.push({ x: 400, y, text: 'Styckpris', fontSize: 9, bold: true });
  lines.push({ x: 480, y, text: 'Summa', fontSize: 9, bold: true });
  y -= 14;

  for (const item of receipt.items) {
    const lineTotal = item.quantity * item.unitPrice;
    lines.push({ x: marginLeft, y, text: item.description, fontSize: 10 });
    lines.push({ x: 350, y, text: String(item.quantity), fontSize: 10 });
    lines.push({ x: 400, y, text: formatAmount(item.unitPrice, receipt.currency), fontSize: 10 });
    lines.push({ x: 480, y, text: formatAmount(lineTotal, receipt.currency), fontSize: 10 });
    y -= lineHeight + 2;
  }

  y -= 8;
  lines.push({ x: 400, y, text: 'TOTALT / TOTAL:', fontSize: 11, bold: true });
  lines.push({ x: 480, y, text: formatAmount(receipt.totalAmount, receipt.currency), fontSize: 11, bold: true });
  y -= 30;
  lines.push({ x: marginLeft, y, text: 'Tack for ditt kop! / Thank you for your purchase!', fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `${receipt.companyInfo.name} - ${receipt.companyInfo.address}`, fontSize: 8 });

  let stream = '';
  const separatorY = lines.find(l => l.text === 'Beskrivning / Description')?.y;
  if (separatorY) {
    stream += `${marginLeft} ${separatorY - 6} m ${marginLeft + contentWidth} ${separatorY - 6} l S\n`;
  }
  const totalLine = lines.find(l => l.text === 'TOTALT / TOTAL:');
  if (totalLine) {
    stream += `380 ${totalLine.y + 14} m ${marginLeft + contentWidth} ${totalLine.y + 14} l S\n`;
  }
  for (const line of lines) {
    const fontSize = line.fontSize || 10;
    const font = line.bold ? '/F2' : '/F1';
    stream += `BT ${font} ${fontSize} Tf ${line.x} ${line.y} Td (${pdfStr(line.text)}) Tj ET\n`;
  }

  const streamBytes = new TextEncoder().encode(stream);
  const objects: string[] = [];
  let objCount = 0;
  function addObj(content: string) { objCount++; objects.push(`${objCount} 0 obj\n${content}\nendobj\n`); }

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`);
  addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let pdf = '%PDF-1.4\n';
  const actualOffsets: number[] = [];
  for (let i = 0; i < objects.length; i++) { actualOffsets.push(pdf.length); pdf += objects[i]; }
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of actualOffsets) { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
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

    // Check if user is admin
    const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    const isAdmin = !!roleData;

    const companyInfo = { name: 'DanceVida', address: 'Stockholm, Sweden', phone: '+46 70 123 4567' };

    if (payment_source === 'swish') {
      const { data: payment, error } = await adminClient
        .from('swish_payments')
        .select('*, profiles!swish_payments_member_id_fkey(full_name, email)')
        .eq('id', payment_id)
        .single();

      if (error || !payment) {
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (payment.member_id !== userId && !isAdmin) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const profile = payment.profiles as any;
      const metadata = payment.metadata as any;
      const description = metadata?.description || metadata?.event_title || metadata?.course_title || payment.payment_type || 'Betalning';

      const receipt: ReceiptData = {
        customerName: profile?.full_name || 'Medlem',
        customerEmail: profile?.email || '',
        date: new Date(payment.created_at).toLocaleDateString('sv-SE'),
        items: [{ description, quantity: 1, unitPrice: payment.amount_cents, currency: payment.currency }],
        totalAmount: payment.amount_cents,
        currency: payment.currency,
        orderId: payment.payment_request_id || payment.id,
        companyInfo,
      };

      const pdfBytes = generateReceiptPdf(receipt);
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="kvitto-${payment.id.slice(0, 8)}.pdf"`,
        },
      });
    }

    // For Stripe, we query payments table
    if (payment_source === 'stripe') {
      const { data: payment, error } = await adminClient
        .from('payments')
        .select('*, profiles!payments_member_id_fkey(full_name, email)')
        .eq('id', payment_id)
        .single();

      if (error || !payment) {
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (payment.member_id !== userId && !isAdmin) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const profile = payment.profiles as any;
      const receipt: ReceiptData = {
        customerName: profile?.full_name || 'Medlem',
        customerEmail: profile?.email || '',
        date: new Date(payment.created_at).toLocaleDateString('sv-SE'),
        items: [{ description: payment.description || 'Betalning', quantity: 1, unitPrice: payment.amount_cents, currency: payment.currency }],
        totalAmount: payment.amount_cents,
        currency: payment.currency,
        orderId: payment.id,
        companyInfo,
      };

      const pdfBytes = generateReceiptPdf(receipt);
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="kvitto-${payment.id.slice(0, 8)}.pdf"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: 'INVALID_SOURCE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-receipt error:', e);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
