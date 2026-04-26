import "server-only";

export async function sendWhatsAppTextMessage(input: {
  phoneNumber: string;
  message: string;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn(
      "WhatsApp credentials missing. Skipping outbound message delivery.",
    );
    return null;
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.phoneNumber,
        type: "text",
        text: {
          body: input.message,
        },
      }),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Meta WhatsApp API error:", {
      status: response.status,
      statusText: response.statusText,
      data,
    });

    throw new Error(`Meta WhatsApp send failed with status ${response.status}`);
  }

  return data;
}
