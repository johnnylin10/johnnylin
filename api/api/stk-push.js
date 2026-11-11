export default async function handler(req, res) {
  // Enable CORS so your frontend can talk to it freely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { phone, amount, shortcode, passkey, consumerKey, consumerSecret, environment, accountReference, transactionDesc } = req.body;

    if (!phone || !amount || !shortcode || !passkey || !consumerKey || !consumerSecret) {
      return res.status(400).json({ error: 'Missing required payment parameters' });
    }

    // 1. Determine Daraja API base URL
    const baseUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    // 2. Generate Safaricom Access Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to authenticate with Safaricom Daraja API');
    }
    const accessToken = tokenData.access_token;

    // 3. Generate Password & Timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // 4. Trigger STK Push Request
    // Note: We use your live Vercel callback URL here!
    const callbackUrl = `https://johnnylin.vercel.app/api/callback`;

    const stkResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Number(amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference || 'NETFYWIFI',
        TransactionDesc: transactionDesc || 'WiFi Payment'
      })
    });

    const stkResult = await stkResponse.json();
    return res.status(200).json(stkResult);

  } catch (err) {
    console.error('STK Push Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
