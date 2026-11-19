// The original institutional logo lives alongside PDFs in a private bucket.
// Use the authenticated storage client, never a public URL or a text substitute.
export async function loadCertificateLogo(storage: {
  from(bucket: string): {
    download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  };
}): Promise<Uint8Array> {
  const { data, error } = await storage.from('certificates').download('NOVA .png');
  if (error || !data) {
    throw new Error('No se pudo cargar el logo original de Novasalud');
  }
  return new Uint8Array(await data.arrayBuffer());
}