// WhatsApp template test — run with: node test-whatsapp.js
// Uses sendWhatsApp() from config/whatsapp.js so the same path as production.
require('dotenv').config()

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).replace(',', '')

const TO    = '916379034696'
const NAME  = 'Arun'
const CODE  = 'LR-INV-042'
const ITEMS = 'Sony A7IV, 50mm Lens'
const OTP   = '482916'
const REASON = 'Documents were blurry. Please re-upload clear photos.'
const LOC   = 'Lensmen Studio, T.Nagar, Chennai'
const START = fmtDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
const END   = fmtDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000))

const AUTH_TEMPLATES = new Set(['lr_otp_login', 'lr_otp_register', 'lr_password_resets'])

const templates = [
  // ── AUTHENTICATION ──────────────────────────────────────────────────
  { name: 'lr_otp_login',          body: [OTP],                                      btn: null },
  { name: 'lr_otp_register',       body: [OTP],                                      btn: null },
  { name: 'lr_password_resets',    body: [OTP],                                      btn: null },

  // ── UTILITY ─────────────────────────────────────────────────────────
  { name: 'lr_booking_submitted',  body: [NAME, CODE, ITEMS, START, END, '4500'],   btn: CODE },
  { name: 'lr_booking_cancelled',  body: [NAME, CODE],                               btn: null },
  { name: 'lr_kyc_submitted',      body: [NAME],                                     btn: null },
  { name: 'lr_kyc_approved',       body: [NAME],                                     btn: null },
  { name: 'lr_kyc_rejected',       body: [NAME, REASON],                             btn: null },
  { name: 'lr_order_approved',     body: [NAME, CODE, ITEMS, LOC, START],            btn: CODE },
  { name: 'lr_order_ready_pickup', body: [NAME, CODE, ITEMS, LOC, START],            btn: CODE },
  { name: 'lr_order_picked_up',    body: [NAME, CODE, ITEMS, END],                   btn: CODE },
  { name: 'lr_return_due_soon',    body: [NAME, CODE, ITEMS, END],                   btn: CODE },
  { name: 'lr_order_returned',     body: [NAME, CODE, ITEMS],                        btn: CODE },
  { name: 'lr_order_closed',       body: [NAME, CODE, ITEMS],                        btn: CODE },
  { name: 'lr_order_rejected',     body: [NAME, CODE, 'Item not available on requested dates'], btn: null },
  { name: 'lr_payment_received',   body: [NAME, CODE, 'Advance', '2000', '2500'],   btn: CODE },
]

const delay = (ms) => new Promise(r => setTimeout(r, ms))

;(async () => {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  console.log(`\nSending ${templates.length} templates to ${TO}\n`)
  let pass = 0, fail = 0

  for (const t of templates) {
    process.stdout.write(`  ${t.name.padEnd(26)} → `)

    const components = []

    if (AUTH_TEMPLATES.has(t.name)) {
      // Auth: body {{1}} = OTP + copy-code button = OTP
      const otp = t.body[0]
      components.push({ type: 'body', parameters: [{ type: 'text', text: String(otp) }] })
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(otp) }] })
    } else {
      if (t.body.length > 0)
        components.push({ type: 'body', parameters: t.body.map(p => ({ type: 'text', text: String(p) })) })
      if (t.btn !== null)
        components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(t.btn) }] })
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: TO,
          type: 'template',
          template: { name: t.name, language: { code: 'en_US' }, components },
        }),
      })
      const data = await res.json()
      if (res.ok && data.messages) {
        console.log(`✓ sent  (id: ${data.messages[0]?.id?.slice(-8)})`)
        pass++
      } else {
        console.log(`✗ FAILED — ${data?.error?.message || JSON.stringify(data)}`)
        fail++
      }
    } catch (e) {
      console.log(`✗ ERROR — ${e.message}`)
      fail++
    }

    await delay(600)
  }

  console.log(`\n  Result: ${pass} passed, ${fail} failed out of ${templates.length}\n`)
})()
