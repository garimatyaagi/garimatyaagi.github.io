# Letters by G – Author Guide

Use this to add posts quickly and keep the site tidy.

## Write a post (fast path)
- Create `_posts/YYYY-MM-DD-title.md` (use today’s date).
- Paste the template, fill in title/date/categories/excerpt, and write.
- Tag with `favorite` to surface it on the homepage list.
  - Favorites block shows: publish date, title (linked), and your excerpt.

```markdown
---
layout: post
title: My Post Title
date: 2025-01-01
categories: [topic1, topic2]
tags: [favorite]        # optional, shows on homepage favorites block
excerpt: "1–2 sentence summary for the homepage list."
---
```

### Writing tips
- Markdown only: headings (`##`), lists, links, quotes.
- First paragraph should hook; keep paragraphs short.
- Link internally with `[text]({{ "/path" | relative_url }})`.

## What the site does
- **Homepage (`index.md`, layout: home):** shows your intro text plus a “favorites” list of posts tagged `favorite` (date, title, excerpt).
- **Essays page (`essays.md`, layout: essays):** lists all posts with title and month/year; header nav toggles between “essays” and “about me”.
- **Individual posts (layout: post):** title, date, body.
- **RSS:** footer links to `/feed.xml`.
- **Social links:** X and LinkedIn pulled from `_config.yml` (`twitter_username`, `linkedin_username`).

## Edit the chrome
- `_includes/header.html`: nav labels/links.
- `_includes/footer.html`: RSS text and social links.
- `_config.yml`: title, description, author, social handles, domain settings.
- `assets/css/style.css`: colors, fonts, spacing.

## Preview locally
```bash
bundle exec jekyll serve
```
Visit `http://localhost:4000`; saves trigger live reload.

## Publish
GitHub Pages builds automatically from `main`.
```bash
git add .
git commit -m "Post: my-title"
git push origin main
```

## Troubleshooting
- Site not updating: check GitHub Pages/Actions build status; wait ~1 minute.
- Local build issues: `bundle update` then `bundle exec jekyll serve`.
- Custom domain: ensure `CNAME` has your domain and DNS points to GitHub Pages.
