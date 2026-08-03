import { supabase } from "@/integrations/supabase/client";

/**
 * Certificates live in a private bucket. Stored file_url values may be legacy
 * public URLs, so we extract the object path and mint a short-lived signed URL.
 */
export async function getCertificateSignedUrl(fileUrl: string): Promise<string> {
  const marker = "/certificates/";
  const idx = fileUrl.indexOf(marker);
  const path = idx >= 0 ? fileUrl.slice(idx + marker.length) : fileUrl;
  const { data, error } = await supabase.storage
    .from("certificates")
    .createSignedUrl(decodeURIComponent(path), 60 * 10);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo generar el enlace del certificado");
  }
  return data.signedUrl;
}