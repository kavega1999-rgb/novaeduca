import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
    // Generate PDF
    console.log('Generating PDF certificate...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([792, 612]); // Letter size landscape
    
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const { width, height } = page.getSize();
    
    // Background border
    page.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: rgb(0.2, 0.3, 0.5),
      borderWidth: 3,
    });
    
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      borderColor: rgb(0.2, 0.3, 0.5),
      borderWidth: 1,
    });
    
    // Title
    const title = certificateType === 'certificate' ? 'CERTIFICADO' : 'CONSTANCIA';
    page.drawText(title, {
      x: width / 2 - (title.length * 20),
      y: height - 100,
      size: 48,
      font: helveticaBold,
      color: rgb(0.2, 0.3, 0.5),
    });
    
    // Subtitle
    const subtitle = certificateType === 'certificate' ? 'DE APROBACIÓN' : 'DE PARTICIPACIÓN';
    page.drawText(subtitle, {
      x: width / 2 - (subtitle.length * 8),
      y: height - 140,
      size: 24,
      font: timesRomanBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Body text
    const bodyText = 'Se otorga el presente certificado a:';
    page.drawText(bodyText, {
      x: width / 2 - (bodyText.length * 4.5),
      y: height - 200,
      size: 16,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    
    // User name
    const userName = profile.full_name;
    page.drawText(userName, {
      x: width / 2 - (userName.length * 9),
      y: height - 250,
      size: 32,
      font: timesRomanBold,
      color: rgb(0.2, 0.3, 0.5),
    });
    
    // Completion text
    const completionText = certificateType === 'certificate' 
      ? 'Por haber aprobado satisfactoriamente la capacitación:'
      : 'Por haber completado la capacitación:';
    page.drawText(completionText, {
      x: width / 2 - (completionText.length * 4),
      y: height - 300,
      size: 14,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    
    // Training title (with line wrapping)
    const trainingTitle = training.title;
    const maxLineLength = 60;
    const lines = [];
    let currentLine = '';
    
    trainingTitle.split(' ').forEach((word: string) => {
      if ((currentLine + word).length <= maxLineLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: width / 2 - (line.length * 5),
        y: height - 340 - (index * 20),
        size: 18,
        font: timesRomanBold,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    
    // Details
    const yOffset = height - 380 - (lines.length * 20);
    const areaText = `Área: ${training.areas?.name || 'N/A'}`;
    page.drawText(areaText, {
      x: 100,
      y: yOffset,
      size: 12,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    
    const durationText = `Duración: ${training.duration_minutes || 0} minutos`;
    page.drawText(durationText, {
      x: 100,
      y: yOffset - 25,
      size: 12,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    
    if (certificateType === 'certificate' && attempt) {
      const scoreText = `Calificación: ${attempt.score?.toFixed(1)}%`;
      page.drawText(scoreText, {
        x: 100,
        y: yOffset - 50,
        size: 12,
        font: timesRomanBold,
        color: rgb(0, 0.5, 0),
      });
    }
    
    // Date
    const completedDate = new Date(attempt.completed_at).toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const dateText = `Fecha: ${completedDate}`;
    page.drawText(dateText, {
      x: width / 2 - (dateText.length * 3.5),
      y: 100,
      size: 12,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    
    const pdfBuffer = await pdfDoc.save();
    console.log('PDF generated, size:', pdfBuffer.length);

    // Upload PDF to Storage
    const fileName = `${certificateType}-${userId}-${trainingId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('training-materials')
      .upload(`certificates/${fileName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('training-materials')
      .getPublicUrl(`certificates/${fileName}`);

    console.log('PDF uploaded to:', publicUrlData.publicUrl);

    // Store certificate record
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert({
        user_id: userId,
        training_id: trainingId,
        attempt_id: attemptId,
        certificate_type: certificateType,
        file_url: publicUrlData.publicUrl
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
