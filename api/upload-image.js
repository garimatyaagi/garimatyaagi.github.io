export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { password, filename, content } = body;

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!filename || !content) {
            return res.status(400).json({ error: 'Missing filename or content' });
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;

        if (!githubToken || !repo) {
            return res.status(500).json({ error: 'Server configuration missing' });
        }

        const filePath = `assets/uploads/${filename}`;

        const response = await fetch(
            `https://api.github.com/repos/${repo}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `Upload image: ${filename}`,
                    content: content,
                    branch: 'main'
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            return res.status(500).json({ error: 'Failed to upload', details: error.message });
        }

        // Return both URLs: raw GitHub (works immediately) and relative (works after rebuild)
        const rawUrl = `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
        const relativeUrl = `/${filePath}`;

        return res.status(200).json({ ok: true, url: rawUrl, relativeUrl: relativeUrl });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
