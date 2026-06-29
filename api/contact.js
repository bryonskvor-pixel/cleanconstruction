export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, project_type, message, website } = req.body;

  if (website) return res.status(200).json({ ok: true });

  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

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
      from: 'Clean Construction <contact@remodel.guide>',
      to: 'bryon@remodel.guide',
      reply_to: email || undefined,
      subject: `Project inquiry: ${project_type || 'General'} — ${name}`,
      text: adminText,
    }),
  });

  if (!adminRes.ok) {
    const err = await adminRes.text();
    console.error('Resend admin error:', err);
    return res.status(500).json({ error: 'Failed to send' });
  }

  // Confirmation to the person who submitted (only if they gave an email)
  if (email) {
    const confirmText = [
      `Hi ${name},`,
      ``,
      `Thanks for reaching out. Brad got your message and will be in touch soon.`,
      ``,
      `If it's urgent, call him directly at 440-315-3348. He picks up.`,
      ``,
      `— Clean Construction LLC`,
      `  Lagrange, Ohio`,
      `  cleanconstructionllc.com`,
    ].join('\n');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: 'Clean Construction <contact@remodel.guide>',
        to: email,
        subject: `Got it — Brad will be in touch`,
        text: confirmText,
      }),
    });
  }

  return res.status(200).json({ ok: true });
}
