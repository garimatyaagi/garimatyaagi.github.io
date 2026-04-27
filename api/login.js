export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const password = body && body.password;

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
