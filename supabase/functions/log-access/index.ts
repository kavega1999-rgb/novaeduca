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

// Simple in-memory rate limiting (per IP, per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // max requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute in ms

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Validate event type
function isValidEventType(eventType: string): eventType is 'registro' | 'login' | 'logout' {
  return ['registro', 'login', 'logout'].includes(eventType);
}

// Validate status
function isValidStatus(status: string): status is 'exitoso' | 'fallido' {
  return ['exitoso', 'fallido'].includes(status);
}

// Sanitize string input
function sanitizeString(input: string | undefined, maxLength: number): string | null {
  if (!input) return null;
  return input.trim().slice(0, maxLength);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract IP for rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // Check rate limit
    if (isRateLimited(ipAddress)) {
      console.log('Rate limited:', ipAddress);
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: AccessLogRequest = await req.json();
    
    // Validate required fields
    if (!body.userEmail || !isValidEmail(body.userEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.eventType || !isValidEventType(body.eventType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.status || !isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (body.userId && !uuidRegex.test(body.userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access log request:', { eventType: body.eventType, email: body.userEmail });

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

    // Insert access log with sanitized inputs
    const { data, error } = await supabase
      .from('access_logs')
      .insert({
        user_id: body.userId || null,
        user_name: sanitizeString(body.userName, 100),
        user_email: body.userEmail.trim().slice(0, 255),
        user_role: sanitizeString(body.userRole, 20),
        event_type: body.eventType,
        status: body.status,
        details: sanitizeString(body.details, 500),
        ip_address: ipAddress.slice(0, 45),
        country: country,
        region: region,
        user_agent: userAgent.slice(0, 500),
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
