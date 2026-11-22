/**
 * CMS configuration for coaches: only the training schedule.
 * If SCHEDULE_REPO is set (e.g. "club/sk-odra-raspored"), the schedule lives in that separate repository,
 * so a coach's GitHub token can be limited to it – a real permission boundary enforced by GitHub.
 * Without SCHEDULE_REPO it edits src/data/training.json in the site repository (convenience only).
 */
import type { APIContext } from 'astro';
import site from '../../../data/site.json';
import { trainingCollectionYaml } from '../../../lib/cms/training-config';
import { scheduleRepo } from '../config.yml';

export function GET({ site: siteUrl }: APIContext) {
  const separate = scheduleRepo();
  const repo = separate || process.env.GITHUB_REPOSITORY || site.repository;
  const branch = process.env.CMS_BRANCH || 'main';
  const authUrl = process.env.CMS_AUTH_URL;
  const url = new URL(import.meta.env.BASE_URL, siteUrl).href;
  const training = trainingCollectionYaml()
    // in the separate repository the file sits at the root
    .replace('file: src/data/training.json', separate ? 'file: training.json' : 'file: src/data/training.json');
  const yml = `# Generated at build time by src/pages/admin/trener/config.yml.ts
backend:
  name: github
  repo: ${repo}
  branch: ${branch}${authUrl ? `\n  base_url: ${authUrl}` : ''}
  # the "GitHub" button works only with the OAuth helper (CMS_AUTH_URL); without it, offer the token only
  auth_methods: ${authUrl ? '[oauth, token]' : '[token]'}
  commit_messages:
    update: "Raspored: izmjena ({{slug}})"

site_url: ${url}
display_url: ${url}
logo:
  src: ${url}favicon.svg
media_folder: public/images/uploads
public_folder: /images/uploads

collections:
  - name: data
    label: "Raspored treninga"
    editor: { preview: false }
    files:${training}
`;
  return new Response(yml, { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } });
}
