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

    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
