export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { password, action, path } = body;

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;

        if (!githubToken || !repo) {
            return res.status(500).json({ error: 'Server configuration missing' });
        }

        const headers = {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        // List all posts
        if (action === 'list') {
            const response = await fetch(
                `https://api.github.com/repos/${repo}/contents/_posts`,
                { headers }
            );

            if (!response.ok) {
                return res.status(500).json({ error: 'Failed to list posts' });
            }

            const files = await response.json();
            const posts = files
                .filter(function(f) { return f.name.endsWith('.md'); })
                .map(function(f) {
                    // Parse filename: YYYY-MM-DD-title.md
                    var match = f.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
                    return {
                        name: f.name,
                        path: f.path,
                        sha: f.sha,
                        date: match ? match[1] : '',
                        slug: match ? match[2].replace(/-/g, ' ') : f.name
                    };
                })
                .sort(function(a, b) { return b.date.localeCompare(a.date); });

            return res.status(200).json({ ok: true, posts: posts });
        }

        // Get a single post
        if (action === 'get') {
            if (!path) {
                return res.status(400).json({ error: 'Missing path' });
            }

            const response = await fetch(
                `https://api.github.com/repos/${repo}/contents/${path}`,
                { headers }
            );

            if (!response.ok) {
                return res.status(500).json({ error: 'Failed to fetch post' });
            }

            const data = await response.json();
            const raw = Buffer.from(data.content, 'base64').toString('utf-8');

            // Parse frontmatter
            var frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            var frontmatter = {};
            var content = raw;

            if (frontmatterMatch) {
                var fm = frontmatterMatch[1];
                content = frontmatterMatch[2].trim();

                // Parse title
                var titleMatch = fm.match(/title:\s*"?([^"\n]+)"?/);
                if (titleMatch) frontmatter.title = titleMatch[1];

                // Parse date
                var dateMatch = fm.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) frontmatter.date = dateMatch[1];

                // Parse excerpt
                var excerptMatch = fm.match(/excerpt:\s*"?([^"\n]+)"?/);
                if (excerptMatch) frontmatter.excerpt = excerptMatch[1];

                // Parse tags
                var tagsMatch = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
                if (tagsMatch) {
                    frontmatter.tags = tagsMatch[1]
                        .split('\n')
                        .map(function(l) { return l.replace(/^\s+-\s+/, '').trim(); })
                        .filter(function(l) { return l.length > 0; });
                }

                // Parse categories as fallback for tags
                if (!frontmatter.tags) {
                    var catMatch = fm.match(/categories:\n((?:\s+-\s+.+\n?)*)/);
                    if (catMatch) {
                        frontmatter.tags = catMatch[1]
                            .split('\n')
                            .map(function(l) { return l.replace(/^\s+-\s+/, '').trim(); })
                            .filter(function(l) { return l.length > 0; });
                    }
                }
            }

            return res.status(200).json({
                ok: true,
                sha: data.sha,
                path: data.path,
                frontmatter: frontmatter,
                content: content
            });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request', details: err.message });
    }
}
