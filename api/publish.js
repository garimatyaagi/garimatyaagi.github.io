export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { password, title, date, excerpt, content, draft } = body;

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!title || !date || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;

        if (!githubToken || !repo) {
            return res.status(500).json({ error: 'Server configuration missing' });
        }

        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');

        const folder = draft ? 'drafts' : '_posts';
        const filename = `${folder}/${date}-${slug}.md`;

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedExcerpt = (excerpt || '').replace(/"/g, '\\"');

        const fileContent = [
            '---',
            'layout: post',
            `title: "${escapedTitle}"`,
            `date: ${date}`,
            excerpt ? `excerpt: "${escapedExcerpt}"` : null,
            '---',
            '',
            content,
            ''
        ].filter(line => line !== null).join('\n');

        const base64Content = Buffer.from(fileContent).toString('base64');

        // Check if file already exists (for updates)
        let sha;
        try {
            const checkRes = await fetch(
                `https://api.github.com/repos/${repo}/contents/${filename}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (checkRes.ok) {
                const existing = await checkRes.json();
                sha = existing.sha;
            }
        } catch (_) {
            // File doesn't exist, that's fine
        }

        // Create or update file
        const commitBody = {
            message: draft ? `Save draft: ${title}` : `Publish: ${title}`,
            content: base64Content,
            branch: 'main'
        };
        if (sha) commitBody.sha = sha;

        const response = await fetch(
            `https://api.github.com/repos/${repo}/contents/${filename}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(commitBody)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            return res.status(500).json({ error: 'Failed to commit', details: error.message });
        }

        // Trigger Vercel redeploy via deploy hook if configured
        const deployHook = process.env.VERCEL_DEPLOY_HOOK;
        if (deployHook && !draft) {
            try {
                await fetch(deployHook, { method: 'POST' });
            } catch (_) {
                // Non-critical if deploy hook fails
            }
        }

        return res.status(200).json({ ok: true, slug, path: filename });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
