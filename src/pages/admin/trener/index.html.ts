/**
 * /admin/trener/ – the same CMS, showing only the training schedule (for coaches).
 * Real permissions come from GitHub: see docs/CMS.md → "Uloge: administrator i trener".
 */
import site from '../../../data/site.json';
import { adminPage } from '../../../lib/cms/admin-page';

export function GET() {
  // the status badge follows the website build, which publishes schedule changes
  const repo = process.env.GITHUB_REPOSITORY || site.repository;
  const html = adminPage({ title: 'Raspored treninga – ŠK Odra', assets: '../', repo });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
