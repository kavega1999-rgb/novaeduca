import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID format"),
  trainingId: z.string().uuid("Invalid training ID format"),
});

// Novasalud colors
const DARK_BLUE = rgb(0.04, 0.24, 0.42);      // #0A3D6B - Dark navy blue
const ORANGE = rgb(0.91, 0.45, 0.08);          // #E87314 - Orange
const LIGHT_BLUE = rgb(0.18, 0.47, 0.71);      // #2E78B5 - Lighter blue for name

// Helper function to center text
function centerText(text: string, pageWidth: number, fontSize: number, font: any): number {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  return (pageWidth - textWidth) / 2;
}

// Helper function to draw text centered
function drawCenteredText(
  page: any, 
  text: string, 
  y: number, 
  fontSize: number, 
  font: any, 
  color: any
) {
  const { width } = page.getSize();
  const x = centerText(text, width, fontSize, font);
  page.drawText(text, { x, y, size: fontSize, font, color });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Extract and validate the JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a client with service role for auth validation
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authenticated user by passing the token directly
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const authenticatedUserId = user.id;
    console.log('Authenticated user:', authenticatedUserId);

    // Parse and validate request body
    const body = await req.json();
    const parseResult = requestSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { attemptId, trainingId } = parseResult.data;

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch evaluation attempt and verify ownership AND passing status
    const { data: attempt, error: attemptError } = await supabase
      .from('evaluation_attempts')
      .select('id, user_id, score, max_score, passed, status, completed_at, evaluation_id')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error('Attempt not found:', attemptId);
      return new Response(
        JSON.stringify({ error: 'Evaluation attempt not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // CRITICAL: Verify the attempt belongs to the authenticated user
    if (attempt.user_id !== authenticatedUserId) {
      console.error('Authorization failed: attempt user_id mismatch', { 
        attemptUserId: attempt.user_id, 
        authenticatedUserId 
      });
      return new Response(
        JSON.stringify({ error: 'You are not authorized to generate this certificate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // CRITICAL: Verify the attempt was completed and passed
    if (attempt.status !== 'completed') {
      console.error('Attempt not completed:', attempt.status);
      return new Response(
        JSON.stringify({ error: 'Cannot generate certificate for incomplete evaluation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!attempt.passed) {
      console.error('Attempt not passed:', { score: attempt.score, passed: attempt.passed });
      return new Response(
        JSON.stringify({ error: 'Cannot generate certificate for failed evaluation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify the evaluation belongs to the specified training
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluations')
      .select('training_id')
      .eq('id', attempt.evaluation_id)
      .single();

    if (evalError || !evaluation || evaluation.training_id !== trainingId) {
      console.error('Training/evaluation mismatch');
      return new Response(
        JSON.stringify({ error: 'Invalid training/evaluation combination' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if certificate already exists for this attempt
    const { data: existingCert } = await supabase
      .from('certificates')
      .select('id, file_url')
      .eq('attempt_id', attemptId)
      .eq('user_id', authenticatedUserId)
      .single();

    if (existingCert) {
      console.log('Certificate already exists:', existingCert.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          certificateId: existingCert.id,
          fileUrl: existingCert.file_url,
          message: 'Certificate already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .select(`*, areas (name)`)
      .eq('id', trainingId)
      .single();

    if (trainingError || !training) {
      return new Response(
        JSON.stringify({ error: 'Training not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', authenticatedUserId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Determine certificate type
    const certificateType = training.generates_certificate ? 'certificate' : 'constancia';
    const isCertificate = certificateType === 'certificate';
    
    // Generate PDF with Novasalud design
    console.log('Generating PDF certificate...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([792, 612]); // Letter size landscape
    
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const timesRomanBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    
    const { width, height } = page.getSize();
    
    // Draw outer dark blue border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: DARK_BLUE,
      borderWidth: 4,
    });
    
    // Draw inner orange border
    page.drawRectangle({
      x: 28,
      y: 28,
      width: width - 56,
      height: height - 56,
      borderColor: ORANGE,
      borderWidth: 2,
    });
    
    // Embed Novasalud logo - try colored logo first, then other variations
    let logoEmbedded = false;
    const logoFormats = ['novasalud-logo-color.png', 'NOVA.png', 'NOVA .png', 'novasalud-logo.png', 'novasalud-logo.jpg', 'logo.png', 'logo.jpg'];
    
    for (const logoFileName of logoFormats) {
      if (logoEmbedded) break;
      try {
        const encodedFileName = encodeURIComponent(logoFileName);
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${encodedFileName}`;
        console.log('Trying to load logo from:', logoUrl);
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBytes = await logoResponse.arrayBuffer();
          const logoImage = logoFileName.endsWith('.png') 
            ? await pdfDoc.embedPng(new Uint8Array(logoBytes))
            : await pdfDoc.embedJpg(new Uint8Array(logoBytes));
          const logoWidth = 200;
          const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
          const logoX = (width - logoWidth) / 2;
          page.drawImage(logoImage, {
            x: logoX,
            y: height - 55 - logoHeight,
            width: logoWidth,
            height: logoHeight,
          });
          logoEmbedded = true;
          console.log('Logo embedded successfully');
        }
      } catch (logoError) {
        console.error('Error loading logo:', logoFileName, logoError);
      }
    }
    
    // Fallback to text if no logo loaded
    if (!logoEmbedded) {
      console.log('Using text fallback for logo');
      const logoY = height - 90;
      page.drawText('N', { x: 335, y: logoY, size: 28, font: timesRomanBold, color: DARK_BLUE });
      page.drawText('O', { x: 355, y: logoY, size: 28, font: timesRomanBold, color: ORANGE });
      page.drawText('VASALUD', { x: 375, y: logoY, size: 28, font: timesRomanBold, color: DARK_BLUE });
      drawCenteredText(page, 'CARIBE I.P.S.', height - 115, 14, timesRomanBold, ORANGE);
    }
    
    // Main title - CERTIFICADO or CONSTANCIA
    const mainTitle = isCertificate ? 'CERTIFICADO' : 'CONSTANCIA';
    drawCenteredText(page, mainTitle, height - 175, 48, timesRomanBoldItalic, DARK_BLUE);
    
    // Subtitle - De aprobación or De participación
    const subtitle = isCertificate ? 'De aprobación' : 'De participación';
    drawCenteredText(page, subtitle, height - 210, 22, timesRomanItalic, ORANGE);
    
    // "Otorgado a:" or "Otorgada a:"
    const otorgadoText = isCertificate ? 'Otorgado a:' : 'Otorgada a:';
    drawCenteredText(page, otorgadoText, height - 265, 16, timesRoman, rgb(0.3, 0.3, 0.3));
    
    // User name - larger and bold
    const userName = profile.full_name;
    drawCenteredText(page, userName, height - 310, 36, timesRomanBold, LIGHT_BLUE);
    
    // Description text
    const descText = 'Por concluir satisfactoriamente el curso de capacitación de';
    drawCenteredText(page, descText, height - 365, 14, timesRoman, rgb(0.2, 0.2, 0.2));
    
    // Training title - with wrapping if needed
    const trainingTitle = training.title;
    const maxCharsPerLine = 65;
    
    if (trainingTitle.length <= maxCharsPerLine) {
      drawCenteredText(page, trainingTitle, height - 395, 16, timesRomanBold, DARK_BLUE);
    } else {
      // Split into multiple lines
      const words = trainingTitle.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      words.forEach((word: string) => {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);
      
      lines.forEach((line, index) => {
        drawCenteredText(page, line, height - 395 - (index * 22), 16, timesRomanBold, DARK_BLUE);
      });
    }
    
    // Date
    const completedDate = new Date(attempt.completed_at!).toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    drawCenteredText(page, completedDate, height - 445, 14, timesRomanBold, rgb(0.3, 0.3, 0.3));
    
    // Signature lines
    const signatureY = 100;
    const leftSignatureX = 130;
    const rightSignatureX = 520;
    
    // Left signature line
    page.drawLine({
      start: { x: leftSignatureX - 60, y: signatureY },
      end: { x: leftSignatureX + 60, y: signatureY },
      thickness: 1,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText('Gerente', {
      x: leftSignatureX - 25,
      y: signatureY - 20,
      size: 12,
      font: timesRomanBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Right signature line
    page.drawLine({
      start: { x: rightSignatureX - 80, y: signatureY },
      end: { x: rightSignatureX + 80, y: signatureY },
      thickness: 1,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText('Jefe de Gestión Humana', {
      x: rightSignatureX - 70,
      y: signatureY - 20,
      size: 12,
      font: timesRomanBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    const pdfBuffer = await pdfDoc.save();
    console.log('PDF generated, size:', pdfBuffer.length);

    // Upload PDF to Storage - using the public certificates bucket
    const fileName = `${certificateType}-${authenticatedUserId}-${trainingId}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to save certificate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    // Store certificate record
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert({
        user_id: authenticatedUserId,
        training_id: trainingId,
        attempt_id: attemptId,
        certificate_type: certificateType,
        file_url: publicUrlData.publicUrl
      })
      .select()
      .single();

    if (certError) {
      console.error('Error storing certificate:', certError);
      return new Response(
        JSON.stringify({ error: 'Failed to record certificate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update user progress to completed
    await supabase
      .from('user_progress')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', authenticatedUserId)
      .eq('training_id', trainingId);

    console.log('Certificate generated successfully for user:', authenticatedUserId);

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
    return new Response(
      JSON.stringify({ error: 'An error occurred while generating the certificate' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
