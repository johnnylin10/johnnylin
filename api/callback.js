import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (e) {
    console.error('Firebase Admin Initialization Error:', e);
  }
}

const db = admin.apps.length ? admin.database() : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body;
    const stkCallback = data?.Body?.stkCallback;

    if (!stkCallback) {
      return res.status(400).json({ error: 'Invalid Safaricom payload' });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    let mpesaReceipt = "";
    let amountPaid = 0;
    let phoneNumber = "";

    if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      const items = stkCallback.CallbackMetadata.Item;
      for (let item of items) {
        if (item.Name === "MpesaReceiptNumber") mpesaReceipt = item.Value;
        if (item.Name === "Amount") amountPaid = item.Value;
        if (item.Name === "PhoneNumber") phoneNumber = item.Value;
      }
    }

    if (db) {
      const ledgerRef = db.ref('ledger');
      const snapshot = await ledgerRef.orderByChild('ref').equalTo(checkoutRequestId).once('value');

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const key = childSnapshot.key;
          if (resultCode === 0) {
            db.ref(`ledger/${key}`).update({
              status: 'Completed (Verified)',
              mpesaReceipt: mpesaReceipt,
              amount: amountPaid,
              phoneNumber: phoneNumber,
              updatedAt: new Date().toLocaleString()
            });
          } else {
            db.ref(`ledger/${key}`).update({
              status: `Failed: ${resultDesc}`,
              updatedAt: new Date().toLocaleString()
            });
          }
        });
      } else {
        await ledgerRef.push({
          ref: checkoutRequestId,
          status: resultCode === 0 ? 'Completed (Verified)' : `Failed: ${resultDesc}`,
          mpesaReceipt: mpesaReceipt,
          amount: amountPaid,
          phone: phoneNumber,
          time: new Date().toLocaleString(),
          gateway: 'VERCEL DARAJA CALLBACK',
          used: false,
          deviceBound: null
        });
      }
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (err) {
    console.error("Callback Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
