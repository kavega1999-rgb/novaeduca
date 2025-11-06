import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { attemptId, userId, trainingId } = await req.json();

    console.log('Generating certificate for:', { attemptId, userId, trainingId });

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .select(`
        *,
        areas (name)
      `)
      .eq('id', trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error('Training not found');
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Fetch evaluation attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('evaluation_attempts')
      .select('score, completed_at')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      throw new Error('Attempt not found');
    }

    // Determine certificate type
    const certificateType = training.generates_certificate ? 'certificate' : 'constancia';
    
    // Generate PDF content (simple HTML that can be converted to PDF)
    const html = generateCertificateHTML({
      userName: profile.full_name,
      trainingTitle: training.title,
      areaName: training.areas?.name || 'N/A',
      completedDate: new Date(attempt.completed_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      score: attempt.score?.toFixed(1) || '0',
      certificateType,
      duration: training.duration_minutes || 0
    });

    // Convert HTML to base64 data URL (simplified approach)
    const base64Html = btoa(unescape(encodeURIComponent(html)));
    const dataUrl = `data:text/html;base64,${base64Html}`;

    // Store certificate record
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert({
        user_id: userId,
        training_id: trainingId,
        attempt_id: attemptId,
        certificate_type: certificateType,
        file_url: dataUrl
      })
      .select()
      .single();

    if (certError) {
      console.error('Error storing certificate:', certError);
      throw certError;
    }

    // Update user progress to completed
    const { error: progressError } = await supabase
      .from('user_progress')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('training_id', trainingId);

    if (progressError) {
      console.error('Error updating progress:', progressError);
    }

    console.log('Certificate generated successfully:', certificate.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        certificateId: certificate.id,
        fileUrl: certificate.file_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating certificate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateCertificateHTML(data: {
  userName: string;
  trainingTitle: string;
  areaName: string;
  completedDate: string;
  score: string;
  certificateType: string;
  duration: number;
}): string {
  const title = data.certificateType === 'certificate' ? 'CERTIFICADO' : 'CONSTANCIA';
  const subtitle = data.certificateType === 'certificate' 
    ? 'DE FINALIZACIÓN Y APROBACIÓN' 
    : 'DE PARTICIPACIÓN';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: letter landscape;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 40px;
          font-family: 'Georgia', serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .certificate {
          background: white;
          padding: 60px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 900px;
          text-align: center;
          border: 8px solid #f0f0f0;
          position: relative;
        }
        .certificate::before {
          content: '';
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          bottom: 20px;
          border: 2px solid #667eea;
          pointer-events: none;
        }
        h1 {
          color: #667eea;
          font-size: 48px;
          margin: 0 0 10px 0;
          font-weight: bold;
          letter-spacing: 4px;
        }
        h2 {
          color: #764ba2;
          font-size: 24px;
          margin: 0 0 40px 0;
          font-weight: normal;
        }
        .content {
          margin: 40px 0;
          line-height: 2;
        }
        .name {
          font-size: 36px;
          color: #333;
          font-weight: bold;
          margin: 20px 0;
          border-bottom: 2px solid #667eea;
          display: inline-block;
          padding: 0 40px 10px;
        }
        .training-title {
          font-size: 28px;
          color: #764ba2;
          font-weight: bold;
          margin: 20px 0;
        }
        .details {
          font-size: 18px;
          color: #666;
          margin: 30px 0;
        }
        .detail-item {
          margin: 10px 0;
        }
        .footer {
          margin-top: 60px;
          display: flex;
          justify-content: space-around;
          align-items: center;
        }
        .signature {
          text-align: center;
          flex: 1;
        }
        .signature-line {
          border-top: 2px solid #333;
          width: 200px;
          margin: 0 auto 10px;
          padding-top: 10px;
        }
        .seal {
          width: 100px;
          height: 100px;
          border: 3px solid #667eea;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: #667eea;
          margin: 0 auto;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
        
        <div class="content">
          <p style="font-size: 20px; color: #666;">Se otorga el presente documento a</p>
          <div class="name">${data.userName}</div>
          <p style="font-size: 20px; color: #666;">Por haber completado exitosamente</p>
          <div class="training-title">${data.trainingTitle}</div>
          
          <div class="details">
            <div class="detail-item"><strong>Área:</strong> ${data.areaName}</div>
            <div class="detail-item"><strong>Duración:</strong> ${data.duration} minutos</div>
            ${data.certificateType === 'certificate' 
              ? `<div class="detail-item"><strong>Calificación:</strong> ${data.score}%</div>` 
              : ''}
            <div class="detail-item"><strong>Fecha de emisión:</strong> ${data.completedDate}</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="signature">
            <div class="seal">SELLO OFICIAL</div>
          </div>
          <div class="signature">
            <div class="signature-line">Dirección General</div>
            <p style="font-size: 14px; color: #999; margin: 0;">Firma Autorizada</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
