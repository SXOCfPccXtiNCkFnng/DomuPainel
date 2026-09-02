/**
 * Domu Tech - Meta Cloud API Server Helper
 * Securely executes Meta Graph API calls exclusively on the Node.js server.
 */

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
}

export interface SendTextOptions {
  to: string;
  textBody: string;
}

const META_GRAPH_API_VERSION = 'v20.0';

export async function sendMetaTemplate({
  to,
  templateName,
  languageCode = 'en_US',
  components = []
}: SendTemplateOptions) {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    throw new Error('Meta API credentials (META_ACCESS_TOKEN or META_PHONE_NUMBER_ID) are missing from environment variables.');
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneId}/messages`;

  // Sanitize phone number (remove +, spaces, dashes)
  const sanitizedTo = to.replace(/\D/g, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedTo,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      }
    }
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Meta API Error]', data);
    return {
      success: false,
      status: response.status,
      error: data.error || { message: 'Meta API call failed' }
    };
  }

  return {
    success: true,
    status: response.status,
    messageId: data.messages?.[0]?.id,
    data
  };
}

export async function sendMetaText({ to, textBody }: SendTextOptions) {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    throw new Error('Meta API credentials are missing from environment variables.');
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneId}/messages`;
  const sanitizedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedTo,
    type: 'text',
    text: {
      preview_url: false,
      body: textBody
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Meta API Error]', data);
    return {
      success: false,
      status: response.status,
      error: data.error || { message: 'Meta API call failed' }
    };
  }

  return {
    success: true,
    status: response.status,
    messageId: data.messages?.[0]?.id,
    data
  };
}
