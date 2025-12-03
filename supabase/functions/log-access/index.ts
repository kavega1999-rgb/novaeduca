import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccessLogRequest {
  userId?: string;
  userName?: string;
  userEmail: string;
  userRole?: string;
  eventType: 'registro' | 'login' | 'logout';
  status: 'exitoso' | 'fallido';
  details?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: AccessLogRequest = await req.json();
    console.log('Access log request:', { eventType: body.eventType, email: body.userEmail });

    // Extract IP from headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // Extract user agent
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Detect device type from user agent
    const isMobile = /mobile|android|iphone|ipad|tablet/i.test(userAgent);
    const deviceType = isMobile ? 'móvil' : 'desktop';

    // Get geolocation from IP (using free service)
    let country = null;
    let region = null;
    
    if (ipAddress && ipAddress !== 'unknown' && !ipAddress.startsWith('192.168') && !ipAddress.startsWith('10.') && ipAddress !== '127.0.0.1') {
      try {
        const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,regionName`);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData.status !== 'fail') {
            country = geoData.country;
            region = geoData.regionName;
          }
        }
      } catch (geoError) {
        console.log('Geolocation lookup failed:', geoError);
      }
    }

    // Insert access log
    const { data, error } = await supabase
      .from('access_logs')
      .insert({
        user_id: body.userId || null,
        user_name: body.userName || null,
        user_email: body.userEmail,
        user_role: body.userRole || null,
        event_type: body.eventType,
        status: body.status,
        details: body.details || null,
        ip_address: ipAddress,
        country: country,
        region: region,
        user_agent: userAgent,
        device_type: deviceType,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting access log:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access log created:', data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in log-access function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
