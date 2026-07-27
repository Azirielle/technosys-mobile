import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    const payload = await req.json();
    const ticket = payload.record;
    
    // We only want to send notifications to the user who created it (or admin if assigned)
    // For now, let's notify the creator that their ticket was successfully created/updated
    const userId = ticket.user_id;

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the push token for this user
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.log('No push token found for user:', userId);
      return new Response(JSON.stringify({ error: 'No token' }), { status: 200 });
    }

    const pushToken = tokenData.token;
    
    let title = "Ticket Update";
    let body = "Your ticket has been updated.";
    
    if (payload.type === 'INSERT') {
      title = "Ticket Created";
      body = `Your ticket "${ticket.title}" has been successfully logged.`;
    } else if (payload.type === 'UPDATE') {
      title = "Ticket Updated";
      body = `Status changed to ${ticket.status}.`;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: { ticketId: ticket.id },
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const expoRes = await res.json();
    return new Response(JSON.stringify(expoRes), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
