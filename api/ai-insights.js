// api/ai-insights.js
//
// Serverless proxy for the "Generate AI Insights" feature (Vercel Node.js function,
// auto-detected — zero config needed beyond this file living under /api).
//
// Why this file exists: the browser can NEVER be trusted with a real API key — anything
// shipped in client-side JS is visible to anyone who opens DevTools. This function is the
// only place the key is used, and it never appears in any response sent to the browser.
//
// Required environment variable (set in your hosting provider's dashboard, never committed):
//   ANTHROPIC_API_KEY   — your Anthropic API key, from https://console.anthropic.com
// Optional:
//   ANTHROPIC_MODEL     — defaults to 'claude-sonnet-5'
//
// Request body the client sends:  { summary: {...}, businessContext: {...} }
// Response:                       { text: "..." }  or  { error: "..." }

const MAX_BODY_BYTES = 80 * 1024; // ~80KB is generous for a stats summary; rejects abuse payloads
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TOKENS = 1000;

function buildPrompt(summary, businessContext) {
  const bc = businessContext && typeof businessContext === 'object' ? businessContext : {};
  const domain = (bc.domain === 'Other' ? bc.domainOther : bc.domain) || 'general business';
  const description = String(bc.description || '').slice(0, 1000);
  const expectations = String(bc.expectations || '').slice(0, 1000);

  return `You are a senior business/data analyst. A user uploaded a dataset with this context:
Business domain: ${domain}
What the file is about: ${description}
What they want from this report: ${expectations}

Here is a statistical summary of their dataset (aggregated only — no raw rows were sent):
${JSON.stringify(summary, null, 2)}

Write a concise, business-focused narrative (roughly 4-6 short sections) that:
- Directly addresses what they said they want to learn
- Interprets the key figures in plain business language appropriate for this domain
- Calls out the most important or surprising patterns
- Notes relevant caveats (e.g. correlation vs causation, small sample sizes) where appropriate
- Ends with 2-3 concrete recommended next steps or follow-up questions
Do not invent numbers that are not present in the summary above. Use short markdown headers (##) and bullet points where useful.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY environment variable. See README.md for setup.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be JSON.' });
    return;
  }

  const bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bodySize > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Request payload is too large.' });
    return;
  }

  const { summary, businessContext } = body;
  if (!summary || typeof summary !== 'object') {
    res.status(400).json({ error: 'Missing or invalid "summary" field.' });
    return;
  }

  const prompt = buildPrompt(summary, businessContext);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const message = (data && data.error && data.error.message) || `Anthropic API error (${upstream.status})`;
      const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      res.status(status).json({ error: message });
      return;
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (!text) {
      res.status(502).json({ error: 'Empty response from the AI service.' });
      return;
    }
    res.status(200).json({ text });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the AI service. Please try again.' });
  }
};
