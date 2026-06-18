// WhatsApp Business API helper — Lensmen Rentals
// All templates registered under language en_US.
// Templates with Dynamic buttons pass the order ID as buttonParam.
// Templates with Static buttons (KYC, My Orders) pass buttonParam = null.
// AUTHENTICATION templates: pass otpPayload = otp string, bodyParams = [], buttonParam = null.
//   Meta auto-generates the body; OTP is delivered via button payload component.

const AUTH_TEMPLATES = new Set(['lr_otp_login', 'lr_otp_register', 'lr_password_resets'])

const sendWhatsApp = async (mobile, templateName, bodyParams = [], buttonParam = null) => {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return

  // Normalise: strip non-digits, remove leading 0, prepend 91 if 10 digits
  let phone = String(mobile || '').replace(/\D/g, '')
  if (phone.startsWith('0')) phone = phone.slice(1)
  if (phone.length === 10)   phone = '91' + phone
  if (!phone || phone.length < 10) return

  const components = []

  if (AUTH_TEMPLATES.has(templateName)) {
    // Auth templates: body {{1}} = OTP (Meta fills the sentence), copy-code button = OTP
    const otp = bodyParams[0]
    if (otp) {
      components.push({ type: 'body', parameters: [{ type: 'text', text: String(otp) }] })
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(otp) }] })
    }
  } else {
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map(p => ({ type: 'text', text: String(p) })),
      })
    }
    if (buttonParam !== null) {
      components.push({
        type: 'button', sub_type: 'url', index: '0',
        parameters: [{ type: 'text', text: String(buttonParam) }],
      })
    }
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components,
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`[WhatsApp] ${templateName} failed:`, err?.error?.message || JSON.stringify(err))
    }
  } catch (e) {
    console.error(`[WhatsApp] ${templateName} request error:`, e.message)
  }
}

// "18 Jun 2026, 10:30 AM"
const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).replace(',', '')

const itemNames = (booking) =>
  (booking.items || []).map(i => i.name).join(', ') || 'Equipment'

module.exports = { sendWhatsApp, fmtDate, itemNames }
