'use strict';

// Only browser-safe values may cross this endpoint. Never return process.env itself.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: '허용되지 않은 요청입니다.' });
  }

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  try {
    if (new URL(url).protocol !== 'https:') throw new Error('Invalid URL');
    // Fail closed if a privileged key was accidentally configured as a public key.
    let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
    if (key.startsWith('eyJ') && key.split('.').length === 3) {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      publicKey = claims.role === 'anon';
    }
    if (!publicKey) throw new Error('Invalid public key');
  } catch {
    return res.status(503).json({ error: '로그인 설정을 확인해 주세요. Vercel에 Supabase URL과 공개 키를 등록한 뒤 다시 배포해야 합니다.' });
  }

  return res.status(200).json({ supabaseUrl: url, supabaseKey: key });
};
