// ── Shared HTML email templates for Lensmen Rentals ──────────────────────────

const BRAND   = '#E5550F'
const NAVY    = '#1e1b4b'
const LIGHT   = '#f8f9fa'

// Pickup location lookup (matches frontend PICKUP_LOCATIONS)
const LOCATION_MAP = {
  velachery: { label: 'Velachery Studio',  address: '15 Film City Road, Velachery, Chennai – 600042' },
  tnagar:    { label: 'T. Nagar Office',   address: '45 Usman Road, T. Nagar, Chennai – 600017' },
}

const resolveLocation = (id) => {
  const loc = LOCATION_MAP[id]
  if (!loc) return id || 'Our Store'
  return `${loc.label} — ${loc.address}`
}

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fmtTime = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

// ── Base wrapper ──────────────────────────────────────────────────────────────
const base = (title, accentColor, icon, content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px 40px;">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:${NAVY};padding:28px 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1;">
                    Lensmen <span style="color:${BRAND};">Rentals</span>
                  </div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;">Camera Equipment Rental · Chennai</div>
                </td>
                <td align="right" style="font-size:32px;line-height:1;">${icon}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr><td height="4" style="background:${accentColor};font-size:0;">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:20px 36px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;line-height:1.8;">
              © 2026 Lensmen Rentals · Chennai, India<br/>
              <a href="mailto:support@lensmenrentals.com" style="color:${BRAND};text-decoration:none;font-weight:600;">support@lensmenrentals.com</a>
              &nbsp;·&nbsp; Mon–Sat, 9am – 7pm
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

// ── Info row helper (label : value) ──────────────────────────────────────────
const infoRow = (label, value, last = false) => `
  <tr>
    <td style="padding:9px 0;${last ? '' : 'border-bottom:1px solid #f3f4f6;'}color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;width:140px;">${label}</td>
    <td style="padding:9px 0 9px 12px;${last ? '' : 'border-bottom:1px solid #f3f4f6;'}color:#111827;font-size:13px;font-weight:600;">${value}</td>
  </tr>`

// ── Status badge ─────────────────────────────────────────────────────────────
const statusBadge = (status, color) => `
  <span style="display:inline-block;background:${color}1a;color:${color};font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.08em;border:1px solid ${color}33;">${status}</span>`

// ── Order summary box ─────────────────────────────────────────────────────────
const orderBox = (booking) => {
  const items   = booking.items?.length ? booking.items : [{ name: booking.productId?.name || 'Equipment', pricePerDay: booking.totalPrice }]
  const itemRows = items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;color:#111827;">${it.name || 'Equipment'}${(it.quantity > 1) ? ` ×${it.quantity}` : ''}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;text-align:right;">${rupee(it.pricePerDay)}/day</td>
    </tr>`).join('')

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fb;border-radius:12px;padding:16px 20px;margin:20px 0;">
    <tr><td colspan="2" style="padding-bottom:10px;font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;">Order Summary</td></tr>
    ${itemRows}
    <tr>
      <td style="padding-top:12px;font-size:12px;color:#6b7280;">Rental Period</td>
      <td style="padding-top:12px;font-size:12px;font-weight:600;color:#374151;text-align:right;">${fmtDate(booking.startDate)} → ${fmtDate(booking.endDate)} (${booking.totalDays || 1} day${(booking.totalDays || 1) !== 1 ? 's' : ''})</td>
    </tr>
    ${booking.discountAmount > 0 ? `<tr><td style="padding-top:6px;font-size:12px;color:#10b981;">Discount Applied</td><td style="padding-top:6px;font-size:12px;font-weight:600;color:#10b981;text-align:right;">−${rupee(booking.discountAmount)}</td></tr>` : ''}
    <tr>
      <td style="padding-top:12px;border-top:2px solid #e5e7eb;font-size:14px;font-weight:800;color:#1e1b4b;">Total</td>
      <td style="padding-top:12px;border-top:2px solid #e5e7eb;font-size:18px;font-weight:900;color:${BRAND};text-align:right;">${rupee(booking.totalPrice)}</td>
    </tr>
  </table>`
}

// ── OTP / Verification ────────────────────────────────────────────────────────
exports.otp = (name, otp, purpose = 'verification') => {
  const isLogin    = purpose === 'login'
  const subject    = isLogin ? 'Sign-in Verification Code' : 'Verify Your Account'
  const title      = isLogin ? 'Sign-in Verification' : 'Verify Your Account'
  const desc       = isLogin
    ? 'Use the code below to complete your sign-in to Lensmen Rentals.'
    : 'You\'re almost there! Use the code below to verify your account and start renting.'

  const content = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">${title}</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${name}</strong>, ${desc}</p>

    <!-- OTP box -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,${NAVY} 0%,#2d2a5e 100%);border-radius:16px;padding:28px 20px;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.16em;margin-bottom:12px;">Your Verification Code</div>
          <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#ffffff;font-family:'Courier New',monospace;line-height:1;">${otp}</div>
          <div style="margin-top:14px;background:rgba(255,255,255,0.08);border-radius:8px;padding:8px 16px;display:inline-block;">
            <span style="font-size:12px;color:rgba(255,255,255,0.55);">⏱ Expires in <strong style="color:#ffffff;">10 minutes</strong></span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      If you didn't request this code, please ignore this email.<br/>Your account remains secure.
    </p>`

  return { subject, html: base(subject, BRAND, '🔐', content) }
}

// ── Password Reset ────────────────────────────────────────────────────────────
exports.passwordReset = (name, otp) => {
  const subject = 'Reset Your Password'
  const content = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">Password Reset</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${name}</strong>, we received a request to reset your password. Use the code below.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background:#fff3ed;border:2px solid #fed7aa;border-radius:16px;padding:28px 20px;">
          <div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.16em;margin-bottom:12px;">Reset Code</div>
          <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:${NAVY};font-family:'Courier New',monospace;line-height:1;">${otp}</div>
          <div style="margin-top:14px;">
            <span style="font-size:12px;color:#9a3412;">⏱ Expires in <strong>10 minutes</strong></span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      If you didn't request a password reset, please contact us immediately.<br/>
      <a href="mailto:support@lensmenrentals.com" style="color:${BRAND};text-decoration:none;font-weight:600;">support@lensmenrentals.com</a>
    </p>`

  return { subject, html: base(subject, '#f97316', '🔑', content) }
}

// ── Booking Confirmed (new booking created) ───────────────────────────────────
exports.bookingSubmitted = (booking) => {
  const subject = `Booking Request Received — #${booking._id?.toString().slice(-8).toUpperCase()}`
  const content = `
    <h2 style="margin:0 0 4px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">We've received your request!</h2>
    <p style="margin:0 0 6px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${booking.userName}</strong>, your rental request has been submitted successfully.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#166534;">
      ✅ &nbsp;Our team will review your order within a few hours. You'll receive updates at every step.
    </div>

    ${orderBox(booking)}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      ${infoRow('Order ID', `#${booking._id?.toString().slice(-8).toUpperCase()}`)}
      ${infoRow('Submitted', fmtDate(booking.createdAt || new Date()))}
      ${infoRow('Status', statusBadge(booking.status || 'Request Submitted', '#f59e0b'))}
      ${booking.notes ? infoRow('Your Notes', booking.notes, true) : infoRow('Customer', booking.userName, true)}
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Track your order status in your dashboard under <strong>My Orders</strong>.
    </p>`

  return { subject, html: base(subject, '#10b981', '📋', content) }
}

// ── Booking Cancelled (by user) ───────────────────────────────────────────────
exports.bookingCancelled = (booking) => {
  const subject = `Booking Cancelled — #${booking._id?.toString().slice(-8).toUpperCase()}`
  const content = `
    <h2 style="margin:0 0 4px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">Booking Cancelled</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${booking.userName}</strong>, your rental request has been cancelled as requested.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:10px;padding:12px 16px;margin:0 0 20px;font-size:13px;color:#991b1b;">
      ❌ &nbsp;Order #${booking._id?.toString().slice(-8).toUpperCase()} has been removed. If this was a mistake, please place a new request.
    </div>

    ${orderBox(booking)}

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      If you have any questions, contact us at <a href="mailto:support@lensmenrentals.com" style="color:${BRAND};text-decoration:none;font-weight:600;">support@lensmenrentals.com</a>
    </p>`

  return { subject, html: base(subject, '#ef4444', '❌', content) }
}

// ── Status Update ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'KYC Pending': {
    color: '#f59e0b', icon: '🪪',
    headline: 'KYC Review in Progress',
    message: (b) => `We've received your identity documents and they're currently under review. This usually takes 1–2 hours during business hours.`,
    extra: () => `<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#92400e;">📋 &nbsp;Ensure all 4 documents are uploaded clearly (Aadhaar front &amp; back, PAN front &amp; back).</div>`,
  },
  'KYC Approved': {
    color: '#10b981', icon: '✅',
    headline: 'Identity Verified!',
    message: (b) => `Great news! Your KYC documents have been verified and approved. Your rental request is now moving to the final approval stage.`,
    extra: () => '',
  },
  'Approved': {
    color: '#10b981', icon: '🎉',
    headline: 'Rental Approved!',
    message: (b, ex) => `Your rental has been approved and confirmed! Please collect your equipment from the address below on your start date.`,
    extra: (b, ex) => ex?.pickupLocation ? `
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-left:4px solid #6366f1;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <div style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">📍 Pickup Location</div>
        <div style="font-size:14px;font-weight:700;color:${NAVY};">${resolveLocation(ex.pickupLocation)}</div>
      </div>` : '',
  },
  'Ready for Pickup': {
    color: '#6366f1', icon: '📦',
    headline: 'Equipment Ready for Pickup!',
    message: (b) => `Your equipment is packed and ready. Please visit our office on your booking start date with a valid ID.`,
    extra: (b, ex) => ex?.pickupLocation ? `
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-left:4px solid #6366f1;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <div style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">📍 Collect From</div>
        <div style="font-size:14px;font-weight:700;color:${NAVY};">${resolveLocation(ex.pickupLocation)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Bring a valid photo ID when collecting.</div>
      </div>` : '',
  },
  'Picked Up': {
    color: '#3b82f6', icon: '🎒',
    headline: 'Equipment Picked Up',
    message: (b) => `We've confirmed that you've collected the equipment. Enjoy your shoot! Remember to return it by the date below.`,
    extra: (b) => `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#1e40af;">📅 &nbsp;Return by: <strong>${fmtDate(b.endDate)} at ${fmtTime(b.endDate)}</strong></div>`,
  },
  'During Rental': {
    color: '#3b82f6', icon: '📷',
    headline: 'Rental Period Active',
    message: (b) => `Your rental is active. Hope you're having a great shoot! Please ensure the equipment is returned in the same condition by your return date.`,
    extra: (b) => `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#1e40af;">📅 &nbsp;Return by: <strong>${fmtDate(b.endDate)} at ${fmtTime(b.endDate)}</strong></div>`,
  },
  'Return Pending': {
    color: '#f97316', icon: '⏰',
    headline: 'Return Due Soon',
    message: (b) => `Your rental period is ending soon. Please return the equipment to our office on time to avoid late charges.`,
    extra: (b, ex) => `<div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#9a3412;">⚠️ &nbsp;Return deadline: <strong>${fmtDate(b.endDate)} at ${fmtTime(b.endDate)}</strong>. Late returns may incur extra charges.</div>`,
  },
  'Returned': {
    color: '#22c55e', icon: '✅',
    headline: 'Return Confirmed',
    message: (b) => `We've received your returned equipment. Thank you for returning it on time!`,
    extra: () => '',
  },
  'Closed': {
    color: '#22c55e', icon: '🏁',
    headline: 'Order Closed — Thank You!',
    message: (b) => `Your rental order has been successfully closed. We hope you had a great experience with Lensmen Rentals. See you again soon!`,
    extra: () => `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:20px 0;font-size:13px;color:#166534;text-align:center;">⭐ &nbsp;Love renting with us? Share your experience with fellow photographers!</div>`,
  },
  'Rejected': {
    color: '#ef4444', icon: '❌',
    headline: 'Rental Request Declined',
    message: (b) => `Unfortunately, we were unable to approve your rental request at this time.`,
    extra: (b, ex) => ex?.rejectionReason ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:10px;padding:14px 16px;margin:20px 0;">
        <div style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Reason</div>
        <div style="font-size:13px;color:#7f1d1d;">${ex.rejectionReason}</div>
      </div>
      <p style="font-size:13px;color:#6b7280;margin:16px 0 0;">You're welcome to submit a new request. If you have questions, contact us at <a href="mailto:support@lensmenrentals.com" style="color:${BRAND};text-decoration:none;font-weight:600;">support@lensmenrentals.com</a></p>` : '',
  },
}

exports.statusUpdate = (booking, status, extra = {}) => {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null

  const subject = `${cfg.headline} — #${booking._id?.toString().slice(-8).toUpperCase()}`
  const content = `
    <div style="margin-bottom:20px;">${statusBadge(status, cfg.color)}</div>

    <h2 style="margin:0 0 8px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">${cfg.headline}</h2>
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${booking.userName || 'Customer'}</strong>,</p>
    <p style="margin:0 0 0;font-size:14px;color:#374151;line-height:1.7;">${cfg.message(booking, extra)}</p>

    ${cfg.extra(booking, extra)}

    ${orderBox(booking)}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      ${infoRow('Order ID', `#${booking._id?.toString().slice(-8).toUpperCase()}`)}
      ${infoRow('Status', statusBadge(status, cfg.color))}
      ${infoRow('Start Date', `${fmtDate(booking.startDate)} ${fmtTime(booking.startDate)}`)}
      ${infoRow('Return Date', `${fmtDate(booking.endDate)} ${fmtTime(booking.endDate)}`, true)}
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      View your full order details in your dashboard under <strong>My Orders</strong>.
    </p>`

  return { subject, html: base(subject, cfg.color, cfg.icon, content) }
}

// ── KYC Approved / Rejected (from admin verifyKyc) ───────────────────────────
exports.kycApproved = (userName) => {
  const subject = 'KYC Verified — Identity Approved'
  const content = `
    <div style="margin-bottom:20px;">${statusBadge('KYC Approved', '#10b981')}</div>
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">Identity Verified! ✅</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${userName}</strong>, your identity documents have been reviewed and approved.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:12px;padding:20px;margin:0 0 24px;">
      <div style="font-size:32px;margin-bottom:8px;">🪪</div>
      <div style="font-size:15px;font-weight:700;color:#166534;margin-bottom:4px;">KYC Verification Complete</div>
      <div style="font-size:13px;color:#15803d;line-height:1.6;">Your account is now fully verified. You can place rental requests and enjoy faster approvals.</div>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
      Visit <strong>My Orders</strong> in your dashboard to browse and book equipment.
    </p>`

  return { subject, html: base(subject, '#10b981', '✅', content) }
}

exports.kycRejected = (userName, reason) => {
  const subject = 'KYC Verification — Action Required'
  const content = `
    <div style="margin-bottom:20px;">${statusBadge('KYC Rejected', '#ef4444')}</div>
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:900;color:${NAVY};letter-spacing:-0.02em;">Documents Need Re-submission</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:${NAVY};">${userName}</strong>, we were unable to verify your documents. Please review the reason below and re-upload.</p>

    ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:10px;padding:14px 16px;margin:0 0 20px;">
      <div style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Rejection Reason</div>
      <div style="font-size:13px;color:#7f1d1d;">${reason}</div>
    </div>` : ''}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:0 0 20px;font-size:13px;color:#92400e;">
      📋 &nbsp;Please ensure all 4 documents are clear, unblurred, and fully visible: Aadhaar Front, Aadhaar Back, PAN Front, PAN Back.
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Go to <strong>KYC Documents</strong> in your dashboard to re-upload.<br/>
      Questions? Email <a href="mailto:support@lensmenrentals.com" style="color:${BRAND};text-decoration:none;font-weight:600;">support@lensmenrentals.com</a>
    </p>`

  return { subject, html: base(subject, '#ef4444', '📋', content) }
}
