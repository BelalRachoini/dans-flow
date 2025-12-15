import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildCourseEmail(customerName: string, courseName: string, ticketCount: number, expiryDate: string, isPackage: boolean = false, selectedClasses: string[] = []): string {
  const classListHtml = selectedClasses.length > 0 
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
        <strong>Valda klasser:</strong><br/>
        ${selectedClasses.map(c => `• ${c}`).join('<br/>')}
       </div>`
    : '';

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Kursköp</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Tack för ditt kursköp hos DanceVida – dina kursuppgifter finns här.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#3b82f6);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Bekräftelse på kursköp
                      </div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <img src="https://cms.dancevida.se/logo.png" width="44" height="44" alt="DanceVida"
                        style="display:block;border:0;border-radius:10px;background:#ffffff1a;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:26px 24px 20px 24px;">
                <!-- Swedish -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827;font-weight:800;">
                  Tack för ditt köp, ${customerName}! 💃
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Vi är superglada att ha dig med. Här kommer en sammanfattning av ditt kursköp:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        ${isPackage ? 'Paketdetaljer' : 'Kursdetaljer'}
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>${isPackage ? 'Paket' : 'Kurs'}:</strong> ${courseName}<br/>
                        <strong>Antal klipp/biljetter:</strong> ${ticketCount}<br/>
                        <strong>Giltig till:</strong> ${expiryDate}
                      </div>
                      ${classListHtml}
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Din biljett & QR-kod
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        QR-koden finns i vår portal (inte i detta mejl). Logga in på
                        <a href="https://cms.dancevida.se/" style="color:#2563eb;text-decoration:underline;">https://cms.dancevida.se/</a>
                        och gå till <strong>Tickets</strong> för att se din biljett.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#2563eb;padding:12px 16px;border-radius:12px;font-weight:700;">
                        Logga in & öppna Tickets
                      </a>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  Thank you for your purchase, ${customerName}! 💙
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  We're happy to have you with us. Here's a summary of your course purchase:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        ${isPackage ? 'Package details' : 'Course details'}
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>${isPackage ? 'Package' : 'Course'}:</strong> ${courseName}<br/>
                        <strong>Ticket count:</strong> ${ticketCount}<br/>
                        <strong>Valid until:</strong> ${expiryDate}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Your ticket & QR code
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        Your QR code is available in our portal (not in this email). Log in at
                        <a href="https://cms.dancevida.se/" style="color:#2563eb;text-decoration:underline;">https://cms.dancevida.se/</a>
                        and go to <strong>Tickets</strong> to view your ticket.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:12px 16px;border-radius:12px;font-weight:700;">
                        Log in & open Tickets
                      </a>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 24px 24px 24px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding-top:14px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
                        DanceVida · Gamlestadsvägen 14, 415 02 Göteborg · 073-702 11 34
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;margin-top:6px;">
                        Frågor? Svara på detta mejl eller ring oss. / Questions? Reply to this email or call us.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("Missing session_id");

    console.log("Verifying course payment for session:", session_id);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("Session status:", session.payment_status);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get course_id and package info from metadata
    const course_id = session.metadata?.course_id;
    const isPackage = session.metadata?.is_package === "true";
    const selectedClassIds: string[] = session.metadata?.selected_class_ids 
      ? JSON.parse(session.metadata.selected_class_ids) 
      : [];

    if (!course_id) {
      throw new Error("Course ID not found in session metadata");
    }

    console.log("Payment verified for course:", course_id, "Is package:", isPackage, "Selected classes:", selectedClassIds);

    // Get course details
    const { data: course } = await supabaseClient
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (!course) throw new Error("Course not found");

    // Check if ticket already exists
    const { data: existingTicket } = await supabaseClient
      .from("tickets")
      .select("id")
      .eq("member_id", user.id)
      .eq("course_id", course_id)
      .single();

    if (existingTicket) {
      console.log("Ticket already exists:", existingTicket.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          ticket_id: existingTicket.id,
          already_exists: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let total_tickets = 0;
    let selectedClassNames: string[] = [];

    if (isPackage && selectedClassIds.length > 0) {
      // PACKAGE COURSE: Create class selections and count lessons in selected classes
      
      // Get class names for email
      const { data: classesData } = await supabaseClient
        .from("course_classes")
        .select("id, name")
        .in("id", selectedClassIds);
      
      selectedClassNames = classesData?.map(c => c.name) || [];

      // Create course_class_selections records
      const selectionsToInsert = selectedClassIds.map(classId => ({
        member_id: user.id,
        course_id: course_id,
        class_id: classId,
        order_id: session_id,
      }));

      const { error: selectionsError } = await supabaseClient
        .from("course_class_selections")
        .insert(selectionsToInsert);

      if (selectionsError) {
        console.error("Error creating class selections:", selectionsError);
        // Don't throw - continue with ticket creation
      }

      // Count lessons in selected classes
      const { count: lessonsCount } = await supabaseClient
        .from("course_lessons")
        .select("*", { count: "exact", head: true })
        .in("class_id", selectedClassIds);

      total_tickets = lessonsCount || selectedClassIds.length * 8; // Default fallback
      console.log("Package: Created selections for", selectedClassIds.length, "classes with", total_tickets, "total lessons");

    } else {
      // REGULAR COURSE: Count all lessons
      const { count: lessonsCount } = await supabaseClient
        .from("course_lessons")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course_id);

      total_tickets = lessonsCount || 10;
    }

    // Calculate expiry date based on course end date (or 3 months if no end date)
    const expires_at = course.ends_at 
      ? new Date(course.ends_at).toISOString()
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Create ticket with QR code
    const { data: ticket, error: ticketError } = await supabaseClient
      .from("tickets")
      .insert({
        member_id: user.id,
        course_id: course_id,
        source_course_id: course_id,
        status: "valid",
        qr_payload: crypto.randomUUID(),
        total_tickets: total_tickets,
        tickets_used: 0,
        expires_at: expires_at,
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    console.log("Ticket created:", ticket.id, "with", total_tickets, "tickets");

    // Get user profile for email
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const customerName = profile?.full_name || user.email?.split("@")[0] || "Dansare";
    const expiryDateFormatted = new Date(expires_at).toLocaleDateString("sv-SE");

    // Send confirmation email
    try {
      const emailHtml = buildCourseEmail(customerName, course.title, total_tickets, expiryDateFormatted, isPackage, selectedClassNames);
      const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user.email,
          subject: `${isPackage ? 'Paketköp' : 'Kursköp'} bekräftat: ${course.title} / ${isPackage ? 'Package' : 'Course'} purchase confirmed`,
          html: emailHtml
        })
      });
      
      if (emailResponse.ok) {
        console.log("Course confirmation email sent to:", user.email);
      } else {
        const emailError = await emailResponse.text();
        console.error("Email send failed:", emailError);
      }
    } catch (emailError) {
      console.error("Failed to send course email:", emailError);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: ticket.id,
        qr_payload: ticket.qr_payload,
        total_tickets: total_tickets,
        is_package: isPackage,
        selected_classes: selectedClassNames,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error verifying course payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
