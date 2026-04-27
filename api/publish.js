export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { password, title, date, excerpt, content, draft, tags, editPath, editSha } = body;

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

        // Use existing path if editing, otherwise generate new filename
        let filename;
        if (editPath) {
            filename = editPath;
        } else {
            const slug = title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/(^-|-$)/g, '');
            const folder = draft ? 'drafts' : '_posts';
            filename = `${folder}/${date}-${slug}.md`;
        }

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedExcerpt = (excerpt || '').replace(/"/g, '\\"');

        // Build frontmatter
        const frontmatter = [
            '---',
            'layout: post',
            `title: "${escapedTitle}"`,
            `date: ${date}`,
            excerpt ? `excerpt: "${escapedExcerpt}"` : null,
        ];

        // Add tags
        if (tags && tags.length > 0) {
            frontmatter.push('tags:');
            tags.forEach(function(tag) {
                frontmatter.push(`  - ${tag.trim()}`);
            });
        }

        frontmatter.push('---');

        const fileContent = [...frontmatter.filter(function(l) { return l !== null; }), '', content, ''].join('\n');
        const base64Content = Buffer.from(fileContent).toString('base64');

        // Use provided sha for edits, otherwise check if file exists
        let sha = editSha || undefined;
        if (!sha) {
            try {
                const checkRes = await fetch(
                    `https://api.github.com/repos/${repo}/contents/${filename}`,
                    { headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' } }
                );
                if (checkRes.ok) {
                    const existing = await checkRes.json();
                    sha = existing.sha;
                }
            } catch (_) {}
        }

        const commitBody = {
            message: editPath ? `Update: ${title}` : (draft ? `Save draft: ${title}` : `Publish: ${title}`),
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

        const deployHook = process.env.VERCEL_DEPLOY_HOOK;
        if (deployHook && !draft) {
            try { await fetch(deployHook, { method: 'POST' }); } catch (_) {}
        }

        return res.status(200).json({ ok: true, path: filename });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
