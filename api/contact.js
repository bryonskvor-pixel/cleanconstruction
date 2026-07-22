// ScopeWalk lead intake: every inquiry also lands in the field tool as a Lead
// (shows up in the app's "New leads" card). The pilot contractor id is public
// info (it's a path segment on a public endpoint), overridable via env.
const SCOPEWALK_INTAKE_URL =
  process.env.SCOPEWALK_INTAKE_URL ||
  'https://scopewalk.cleanconstructionllc.com/api/intake/6172267f-b742-4b70-a0b9-ee52d483aa8a';

// Site form types → ScopeWalk project taxonomy (kitchen | bath | basement |
// deck_patio | addition | general). Unmapped types fall through as general;
// the original wording is preserved in the intake notes either way.
const PROJECT_TYPE_MAP = {
  'addition': 'addition',
  'basement': 'basement',
  'ground-up': 'general',
  'concrete': 'general',
  'roofing': 'general',
  'retaining-wall': 'general',
  'other': 'general',
};

async function createScopewalkLead({ name, phone, email, project_type, message }) {
  const notes = [
    project_type ? `Website form type: ${project_type}` : null,
    message,
  ].filter(Boolean).join('\n');
  const res = await fetch(SCOPEWALK_INTAKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: name,
      phone,
      email: email || undefined,
      project_type_interest: PROJECT_TYPE_MAP[project_type] || 'general',
      intake_notes: notes || undefined,
    }),
  });
  if (!res.ok) throw new Error(`intake HTTP ${res.status}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, project_type, message, website } = req.body;

  if (website) return res.status(200).json({ ok: true });

  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Best-effort: a ScopeWalk outage must never block the inquiry email.
  const leadPromise = createScopewalkLead({ name, phone, email, project_type, message })
    .catch((err) => console.error('ScopeWalk intake error:', err));

  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Notify Brad
  const adminText = [
    `New project inquiry — cleanconstructionllc.com`,
    ``,
    `Name:         ${name}`,
    `Phone:        ${phone}`,
    `Email:        ${email || 'Not provided'}`,
    `Project type: ${project_type || 'Not specified'}`,
    ``,
    `Message:`,
    message,
  ].join('\n');

  const adminRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: 'Clean Construction <contact@cleanconstructionllc.com>',
      to: 'bryon@remodel.guide',
      reply_to: email || undefined,
      subject: `Project inquiry: ${project_type || 'General'} — ${name}`,
      text: adminText,
    }),
  });

  if (!adminRes.ok) {
    const err = await adminRes.text();
    console.error('Resend admin error:', err);
    await leadPromise; // the lead still counts even when the email fails
    return res.status(500).json({ error: 'Failed to send' });
  }

  // Confirmation to the person who submitted (only if they gave an email)
  if (email) {
    const confirmText = [
      `Hi ${name},`,
      ``,
      `Thanks for reaching out. Brad got your message and will be in touch soon.`,
      ``,
      `If it's urgent, call him directly at 440-315-4438. He picks up.`,
      ``,
      `— Clean Construction LLC`,
      `  Lagrange, Ohio`,
      `  cleanconstructionllc.com`,
    ].join('\n');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: 'Brad Skvor <brad@cleanconstructionllc.com>',
        to: email,
        subject: `Got it — Brad will be in touch`,
        text: confirmText,
      }),
    });
  }

  // Serverless: unfinished work is killed at response time, so the lead call
  // must settle before we return (errors were already caught above).
  await leadPromise;

  return res.status(200).json({ ok: true });
}
