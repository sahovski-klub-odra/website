import { buildSearchIndex } from '../lib/search-index';
export async function GET() {
  return new Response(JSON.stringify(await buildSearchIndex('hr')), { headers: { 'Content-Type': 'application/json' } });
}
