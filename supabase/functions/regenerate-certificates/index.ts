import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { loadCertificateLogo } from "../_shared/certificate-logo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DARK_BLUE = rgb(0.04, 0.24, 0.42);
const ORANGE = rgb(0.91, 0.45, 0.08);
const LIGHT_BLUE = rgb(0.18, 0.47, 0.71);

function drawCenteredText(page: any, text: string, y: number, fontSize: number, font: any, color: any) {
  const { width } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = (width - textWidth) / 2;
  page.drawText(text, { x, y, size: fontSize, font, color });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Auth required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    // Small batches keep logo embedding within the function's compute budget.
    const body = await req.json().catch(() => ({}));
    const offset = Number.isSafeInteger(body.offset) && body.offset >= 0 ? body.offset : 0;
    const batchSize = 10;
    const { data: certificates, error: certsError, count } = await supabase
      .from('certificates')
      .select('*', { count: 'exact' })
      .order('id')
      .range(offset, offset + batchSize - 1);

    if (certsError || !certificates) {
      return new Response(JSON.stringify({ error: 'Failed to fetch certificates' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    // Fetch all needed profiles, trainings, and attempts
    const userIds = [...new Set(certificates.map(c => c.user_id))];
    const trainingIds = [...new Set(certificates.map(c => c.training_id))];
    const attemptIds = certificates.map(c => c.attempt_id).filter(Boolean);

    const [profilesRes, trainingsRes, attemptsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase.from('trainings').select('id, title, generates_certificate, generates_constancia').in('id', trainingIds),
      attemptIds.length > 0 
        ? supabase.from('evaluation_attempts').select('id, completed_at').in('id', attemptIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
    const trainingsMap = new Map((trainingsRes.data || []).map(t => [t.id, t]));
    const attemptsMap = new Map((attemptsRes.data || []).map(a => [a.id, a]));

    const logoBytes = await loadCertificateLogo(supabase.storage);

    let regenerated = 0;
    let failed = 0;

    for (const cert of certificates) {
      try {
        const profile = profilesMap.get(cert.user_id);
        const training = trainingsMap.get(cert.training_id);
        if (!profile || !training) { failed++; continue; }

        const attempt = cert.attempt_id ? attemptsMap.get(cert.attempt_id) : null;
        const isCertificate = cert.certificate_type === 'certificate';

        // Generate PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([792, 612]);

        const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        const timesRomanBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

        const { width, height } = page.getSize();

        // Borders
        page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: DARK_BLUE, borderWidth: 4 });
        page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: ORANGE, borderWidth: 2 });

        // Logo
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoScale = Math.min(200 / logoImage.width, 90 / logoImage.height);
        const logoWidth = logoImage.width * logoScale;
        const logoHeight = logoImage.height * logoScale;
        page.drawImage(logoImage, { x: (width - logoWidth) / 2, y: height - 55 - logoHeight, width: logoWidth, height: logoHeight });

        // Title
        const mainTitle = isCertificate ? 'CERTIFICADO' : 'CONSTANCIA';
        drawCenteredText(page, mainTitle, height - 175, 48, timesRomanBoldItalic, DARK_BLUE);

        const subtitle = isCertificate ? 'De aprobación' : 'De participación';
        drawCenteredText(page, subtitle, height - 210, 22, timesRomanItalic, ORANGE);

        const otorgadoText = isCertificate ? 'Otorgado a:' : 'Otorgada a:';
        drawCenteredText(page, otorgadoText, height - 265, 16, timesRoman, rgb(0.3, 0.3, 0.3));

        drawCenteredText(page, profile.full_name, height - 310, 36, timesRomanBold, LIGHT_BLUE);

        drawCenteredText(page, 'Por concluir satisfactoriamente el curso de capacitación de', height - 365, 14, timesRoman, rgb(0.2, 0.2, 0.2));

        // Training title with wrapping
        const maxCharsPerLine = 65;
        if (training.title.length <= maxCharsPerLine) {
          drawCenteredText(page, training.title, height - 395, 16, timesRomanBold, DARK_BLUE);
        } else {
          const words = training.title.split(' ');
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
        const dateStr = attempt?.completed_at || cert.issued_at;
        const completedDate = new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        drawCenteredText(page, completedDate, height - 445, 14, timesRomanBold, rgb(0.3, 0.3, 0.3));

        // Signatures
        const signatureY = 100;
        const leftX = width / 4;
        const rightX = (3 * width) / 4;
        const lineWidth = 150;

        // Handwritten signatures
        const leftSigName = 'Nathalia Figueroa';
        const leftSigSize = 22;
        const leftSigW = timesRomanBoldItalic.widthOfTextAtSize(leftSigName, leftSigSize);
        page.drawText(leftSigName, { x: leftX - leftSigW / 2, y: signatureY + 12, size: leftSigSize, font: timesRomanBoldItalic, color: rgb(0.1, 0.1, 0.35) });

        const rightSigName = 'Lorena Montes Beltran';
        const rightSigSize = 20;
        const rightSigW = timesRomanBoldItalic.widthOfTextAtSize(rightSigName, rightSigSize);
        page.drawText(rightSigName, { x: rightX - rightSigW / 2, y: signatureY + 12, size: rightSigSize, font: timesRomanBoldItalic, color: rgb(0.1, 0.1, 0.35) });

        // Lines
        page.drawLine({ start: { x: leftX - lineWidth / 2, y: signatureY }, end: { x: leftX + lineWidth / 2, y: signatureY }, thickness: 1, color: rgb(0.4, 0.4, 0.4) });
        page.drawLine({ start: { x: rightX - lineWidth / 2, y: signatureY }, end: { x: rightX + lineWidth / 2, y: signatureY }, thickness: 1, color: rgb(0.4, 0.4, 0.4) });

        // Titles under lines
        const gerenteText = 'Gerente';
        const gW = timesRomanBold.widthOfTextAtSize(gerenteText, 12);
        page.drawText(gerenteText, { x: leftX - gW / 2, y: signatureY - 20, size: 12, font: timesRomanBold, color: rgb(0.3, 0.3, 0.3) });

        const jefeText = 'Jefe de Gestión Humana';
        const jW = timesRomanBold.widthOfTextAtSize(jefeText, 12);
        page.drawText(jefeText, { x: rightX - jW / 2, y: signatureY - 20, size: 12, font: timesRomanBold, color: rgb(0.3, 0.3, 0.3) });

        const pdfBuffer = await pdfDoc.save();

        // Upload new PDF (overwrite old filename if possible, otherwise new name)
        const oldUrl = cert.file_url;
        const oldFileName = oldUrl.split('/').pop() || '';
        const newFileName = oldFileName || `regenerated-${cert.id}-${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage.from('certificates').upload(newFileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('certificates').getPublicUrl(newFileName);

        // Update certificate record with new URL
        const { error: updateError } = await supabase.from('certificates').update({ file_url: publicUrlData.publicUrl }).eq('id', cert.id);
        if (updateError) throw updateError;

        regenerated++;
      } catch (err) {
        console.error(`Failed to regenerate cert ${cert.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, regenerated, failed, total: count ?? certificates.length,
        nextOffset: offset + certificates.length < (count ?? 0) ? offset + certificates.length : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Regeneration error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to regenerate certificates' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
