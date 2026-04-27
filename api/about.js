export default async function handler(req, res) {
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;

    if (!githubToken || !repo) {
        return res.status(500).json({ error: 'Server configuration missing' });
    }

    try {
        const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};
        const password = body.password || req.headers['x-admin-password'];

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const filePath = 'index.md';
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const headers = {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        // GET - fetch current about content
        if (req.method === 'GET' || (req.method === 'POST' && body.action === 'get')) {
            const response = await fetch(apiUrl, { headers });
            if (!response.ok) {
                return res.status(500).json({ error: 'Failed to fetch about page' });
            }
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');

            // Strip frontmatter
            const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
            const aboutContent = match ? match[1].trim() : content;

            return res.status(200).json({ ok: true, content: aboutContent, sha: data.sha });
        }

        // PUT - update about content
        if (req.method === 'PUT' || (req.method === 'POST' && body.action === 'update')) {
            const { content, sha } = body;
            if (!content) {
                return res.status(400).json({ error: 'Missing content' });
            }

            const fileContent = `---\nlayout: home\n---\n\n${content}\n`;
            const base64Content = Buffer.from(fileContent).toString('base64');

            const updateBody = {
                message: 'Update about page',
                content: base64Content,
                branch: 'main'
            };
            if (sha) updateBody.sha = sha;

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(500).json({ error: 'Failed to update', details: error.message });
            }

            // Trigger Vercel redeploy
            const deployHook = process.env.VERCEL_DEPLOY_HOOK;
            if (deployHook) {
                try { await fetch(deployHook, { method: 'POST' }); } catch (_) {}
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
