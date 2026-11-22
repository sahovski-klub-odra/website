/**
 * /admin/ – Sveltia CMS (a Decap CMS–compatible, Git-based CMS).
 * Content is committed straight to the GitHub repository; GitHub Actions then rebuilds the site.
 * Sign-in: "Sign In with Token" using a GitHub fine-grained personal access token (no server needed),
 * or the GitHub button if an OAuth helper is configured (see docs/CMS.md).
 */
import site from '../../data/site.json';
import { adminPage } from '../../lib/cms/admin-page';

export function GET() {
  const repo = process.env.GITHUB_REPOSITORY || site.repository;
  const html = adminPage({ title: 'Uređivanje sadržaja – ŠK Odra', assets: '', repo });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
