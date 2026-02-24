import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  companyInfo: {
    name: string;
    address: string;
    phone: string;
  };
}

// --- Raw PDF generation ---

function pdfStr(s: string): string {
  // Escape special PDF characters and encode to latin1-safe
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generateReceiptPdf(receipt: ReceiptData): string {
  const lineHeight = 16;
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 50;
  const contentWidth = pageWidth - 100;

  // Build content lines
  const lines: { x: number; y: number; text: string; fontSize?: number; bold?: boolean }[] = [];
  let y = pageHeight - 60;

  // Header
  lines.push({ x: marginLeft, y, text: receipt.companyInfo.name, fontSize: 20, bold: true });
  y -= 20;
  lines.push({ x: marginLeft, y, text: receipt.companyInfo.address, fontSize: 9 });
  y -= 14;
  lines.push({ x: marginLeft, y, text: `Tel: ${receipt.companyInfo.phone}`, fontSize: 9 });
  y -= 30;

  // Title
  lines.push({ x: marginLeft, y, text: 'KVITTO / RECEIPT', fontSize: 16, bold: true });
  y -= 28;

  // Customer info
  lines.push({ x: marginLeft, y, text: `Kund / Customer: ${receipt.customerName}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `E-post / Email: ${receipt.customerEmail}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `Datum / Date: ${receipt.date}`, fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `Order: ${receipt.orderId}`, fontSize: 10 });
  y -= 28;

  // Table header
  lines.push({ x: marginLeft, y, text: 'Beskrivning / Description', fontSize: 9, bold: true });
  lines.push({ x: 340, y, text: 'Antal', fontSize: 9, bold: true });
  lines.push({ x: 400, y, text: 'Styckpris', fontSize: 9, bold: true });
  lines.push({ x: 480, y, text: 'Summa', fontSize: 9, bold: true });
  y -= 4;

  // Line separator
  y -= 10;

  // Items
  for (const item of receipt.items) {
    const lineTotal = item.quantity * item.unitPrice;
    const formattedUnit = formatAmount(item.unitPrice, receipt.currency);
    const formattedTotal = formatAmount(lineTotal, receipt.currency);

    lines.push({ x: marginLeft, y, text: item.description, fontSize: 10 });
    lines.push({ x: 350, y, text: String(item.quantity), fontSize: 10 });
    lines.push({ x: 400, y, text: formattedUnit, fontSize: 10 });
    lines.push({ x: 480, y, text: formattedTotal, fontSize: 10 });
    y -= lineHeight + 2;
  }

  y -= 8;

  // Total
  const formattedTotal = formatAmount(receipt.totalAmount, receipt.currency);
  lines.push({ x: 400, y, text: 'TOTALT / TOTAL:', fontSize: 11, bold: true });
  lines.push({ x: 480, y, text: formattedTotal, fontSize: 11, bold: true });
  y -= 30;

  // Thank you
  lines.push({ x: marginLeft, y, text: 'Tack for ditt kop! / Thank you for your purchase!', fontSize: 10 });
  y -= lineHeight;
  lines.push({ x: marginLeft, y, text: `${receipt.companyInfo.name} - ${receipt.companyInfo.address}`, fontSize: 8 });

  // Build PDF objects
  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    offsets.push(-1); // placeholder
    objects.push(`${objCount} 0 obj\n${content}\nendobj\n`);
    return objCount;
  }

  // 1. Catalog
  addObj('<< /Type /Catalog /Pages 2 0 R >>');

  // 2. Pages
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');

  // Build content stream
  let stream = '';

  // Draw separator line under table header
  const separatorY = lines.find(l => l.text === 'Beskrivning / Description')?.y;
  if (separatorY) {
    stream += `${marginLeft} ${separatorY - 6} m ${marginLeft + contentWidth} ${separatorY - 6} l S\n`;
  }

  // Draw total separator
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

  // 4. Stream
  const streamObjId = addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);

  // 3. Page (insert at position 3, but we already used 3 for stream, let's reorder)
  // Actually let's build properly:
  objects.length = 0;
  offsets.length = 0;
  objCount = 0;

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`);
  addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Build final PDF
  let pdf = '%PDF-1.4\n';
  const actualOffsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    actualOffsets.push(pdf.length);
    pdf += objects[i];
  }

  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of actualOffsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';

  // Encode to base64
  const encoder = new TextEncoder();
  const pdfBytes = encoder.encode(pdf);
  return btoa(String.fromCharCode(...pdfBytes));
}

function formatAmount(cents: number, currency: string): string {
  const major = (cents / 100).toFixed(2);
  return `${major} ${currency.toUpperCase()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, receipt } = await req.json();

    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }

    console.log(`[send-email] Sending email to: ${to}, subject: ${subject}, hasReceipt: ${!!receipt}`);

    const emailOptions: any = {
      from: "Dance Vida Tickets <tickets@dancevida.se>",
      to: [to],
      subject: subject,
      html: html,
    };

    // If receipt data provided, generate PDF and attach
    if (receipt) {
      try {
        const pdfBase64 = generateReceiptPdf(receipt);
        emailOptions.attachments = [{
          filename: "kvitto-dancevida.pdf",
          content: pdfBase64,
        }];
        console.log(`[send-email] PDF receipt generated and attached`);
      } catch (pdfError) {
        console.error("[send-email] PDF generation failed, sending without attachment:", pdfError);
        // Continue sending email without PDF if generation fails
      }
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      throw new Error(`Resend error: ${JSON.stringify(error)}`);
    }

    console.log(`[send-email] Email sent successfully to: ${to}`, data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[send-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
