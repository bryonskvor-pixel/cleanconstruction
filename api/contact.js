export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, project_type, message, website } = req.body;

  if (website) return res.status(200).json({ ok: true });

  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const text = [
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

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Clean Construction <contact@cleanconstructionllc.com>',
      to: 'bryon@remodel.guide',
      reply_to: email || undefined,
      subject: `Project inquiry: ${project_type || 'General'} — ${name}`,
      text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send' });
  }

  return res.status(200).json({ ok: true });
}
