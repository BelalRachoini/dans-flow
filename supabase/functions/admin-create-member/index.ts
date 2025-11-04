// Admin-create-member edge function
// Creates an auth user with service role and then inserts a profile row to satisfy FK
// Requires Authorization header of an admin caller

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: 'MISSING_ENV' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Client bound to requester (to read their session and role)
    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authUserData, error: getUserError } = await requesterClient.auth.getUser();
    if (getUserError || !authUserData.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check caller is admin
    const { data: callerProfile, error: roleError } = await requesterClient
      .from('profiles')
      .select('role')
      .eq('id', authUserData.user.id)
      .single();

    if (roleError || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await req.json();
    const email = (body?.email || '').toString().trim();
    const password = (body?.password || '').toString();
    const full_name = (body?.full_name || '').toString().trim();
    const phone = body?.phone ? body.phone.toString().trim() : null;
    const level = (body?.level || 'bronze').toString();
    const role = (body?.role || 'member').toString();

    // Basic validation
    const allowedLevels = ['bronze', 'silver', 'gold', 'platinum', 'vip'];
    const allowedRoles = ['member', 'instructor', 'admin'];

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'MISSING_REQUIRED_FIELDS' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!allowedLevels.includes(level)) {
      return new Response(JSON.stringify({ error: 'INVALID_LEVEL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'INVALID_ROLE' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Admin client to create auth user and write profile bypassing RLS
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create the auth user (email confirmed)
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !created.user) {
      console.error('createUser error:', createError);
      return new Response(JSON.stringify({ error: createError?.message || 'CREATE_USER_FAILED' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const newUserId = created.user.id;

    // Upsert profile row (in case a signup trigger already inserted one)
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: newUserId,
          email,
          full_name,
          phone,
          level,
          role,
          status: 'active',
          points: 0,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('upsert profile error:', profileError);
      return new Response(JSON.stringify({ error: profileError.message || 'PROFILE_UPSERT_FAILED' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('Unexpected error:', e);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});