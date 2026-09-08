function isClientSafeKey(key) {
  if (key.startsWith('sb_publishable_')) return true;

  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

exports.handler = async function handler() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey || !isClientSafeKey(supabasePublishableKey)) {
    return {
      statusCode: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Admin authentication is not configured.' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ supabaseUrl, supabasePublishableKey }),
  };
};
