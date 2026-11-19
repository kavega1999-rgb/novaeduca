import { expect, test } from 'bun:test';
import { loadCertificateLogo } from '../supabase/functions/_shared/certificate-logo';

test('loads the original Nova logo with authenticated private storage access', async () => {
  const calls: string[] = [];
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const result = await loadCertificateLogo({
    from(bucket) {
      calls.push(bucket);
      return { async download(path) {
        calls.push(path);
        return { data: new Blob([bytes]), error: null };
      } };
    },
  });
  expect(calls).toEqual(['certificates', 'NOVA .png']);
  expect(result).toEqual(bytes);
});

test('does not issue documents with a generic substitute when the logo is unavailable', async () => {
  await expect(loadCertificateLogo({
    from() { return { async download() { return { data: null, error: new Error('Unavailable') }; } }; },
  })).rejects.toThrow('logo original');
});