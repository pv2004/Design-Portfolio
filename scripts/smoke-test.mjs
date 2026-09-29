import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projects } from '../src/data/projects.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const script = readFileSync(join(root, 'src/script.js'), 'utf8');
const css = readFileSync(join(root, 'src/style.css'), 'utf8');

const requiredAssets = [
  'asset/hero-stamp-photo.svg',
  'asset/videos/spiti_drone-poster.webp',
  'asset/videos/cinematic-story-poster.webp',
  'asset/videos/battery-info-poster.webp',
  'asset/videos/in-malaysia-poster.webp',
  // Chrome art that used to be hotlinked from a third-party portfolio repo and
  // now ships with the site.
  'asset/hero-arrow.svg',
  'asset/hero-stamp-base.png',
  'asset/sticky-note.png',
  'asset/social-instagram.svg',
  'asset/social-linkedin.svg',
  'asset/grass-footer.jpg',
  'asset/grass-footer-dark.png',
  'asset/beyond-pixels-icons/beyond-illustration-camera.png',
  'asset/beyond-pixels-icons/beyond-illustration-film-roll.png',
  'asset/beyond-pixels-icons/beyond-illustration-flower.png',
  'asset/beyond-pixels-icons/beyond-illustration-notebook.png',
];

// Fonts live in src/ so Vite fingerprints and emits them alongside the CSS;
// a url() into public/ would not survive a subpath build.
const requiredFonts = [
  'src/fonts/lazy_dog.ttf',
  'src/fonts/ExposureTrial-10.otf',
  'src/fonts/ExposureItalicTrial-10.otf',
];

const failures = [];
for (const asset of requiredAssets) {
  if (!existsSync(join(root, 'public', asset))) {
    failures.push(`Missing public asset: ${asset}`);
  }
}
for (const font of requiredFonts) {
  if (!existsSync(join(root, font))) {
    failures.push(`Missing bundled font: ${font}`);
  }
}

// The gallery photo list lives in src/script.js so it stays a single source of
// truth: read it back out of the source rather than duplicating the filenames
// here, which is how a photo gets renamed and silently 404s on a live deploy.
const museumBlock = script.match(/const MUSEUM_FRAMES = \[([\s\S]*?)\];/);
if (!museumBlock) {
  failures.push('Could not find the MUSEUM_FRAMES list in src/script.js.');
} else {
  const frames = [...museumBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (frames.length === 0) {
    failures.push('MUSEUM_FRAMES is empty; the gallery ticker would have no photos to show.');
  }
  for (const frame of frames) {
    if (/^https?:\/\//.test(frame)) {
      failures.push(`Gallery photo must be local, not remote: ${frame}`);
    } else if (!existsSync(join(root, 'public', frame))) {
      failures.push(`Missing gallery photo: ${frame}`);
    } else {
      // Each frame renders into a 20vw x 32vh window, so anything much past
      // 1400px on the long edge is weight a visitor downloads for no visible
      // gain. Catching it here stops a phone original reaching production.
      const kb = statSync(join(root, 'public', frame)).size / 1024;
      if (kb > 400) {
        failures.push(`Gallery photo is ${Math.round(kb)} KB, expected under 400 KB: ${frame} (resize to 1400px wide)`);
      }
    }
  }
}

// Nothing may reach a third-party asset host again. Borrowing fonts or artwork
// from someone else's portfolio repo breaks if they delete it, exposes their
// name in view-source, and raises licensing questions.
for (const [label, source] of [['index.html', html], ['src/script.js', script], ['src/style.css', css]]) {
  if (/cdn\.jsdelivr\.net|Aaditxn13/i.test(source)) {
    failures.push(`${label} still references the third-party asset host. All media must be local.`);
  }
}

const projectSlugs = new Set();
for (const project of projects) {
  if (projectSlugs.has(project.slug)) failures.push(`Duplicate project slug: ${project.slug}`);
  projectSlugs.add(project.slug);

  if (!html.includes(`data-project="${project.slug}"`)) {
    failures.push(`Project card is missing data-project="${project.slug}".`);
  }
  if (project.video && !/^https?:\/\//.test(project.video) && !existsSync(join(root, 'public', project.video))) {
    failures.push(`Missing local video for ${project.slug}: ${project.video}`);
  }
}

const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  // Placeholder tokens like __SITE_URL__ are reported by the dedicated
  // absolute-URL check below, not as missing files on disk.
  .filter((value) => !/^(?:https?:|mailto:|#|data:)/.test(value) && !/^__[A-Z_]+__/.test(value));

for (const reference of localReferences) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const sourcePath = join(root, cleanReference);
  const publicPath = join(root, 'public', cleanReference.replace(/^\//, ''));
  if (!existsSync(sourcePath) && !existsSync(publicPath)) {
    failures.push(`Broken local reference in index.html: ${reference}`);
  }
}

// The only remote assets left are the Google Fonts stylesheet. Everything else
// ships from this repo, so the check is now just Google Fonts plus any project
// poster pointed at an absolute URL (e.g. a CDN-hosted clip).
const remoteUrls = [
  ...html.matchAll(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\/[^'")\s]+/g),
  ...css.matchAll(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\/[^'")\s']+/g),
  ...projects.map((project) => project.poster),
]
  .map((match) => match[0].replace(/[)'"`]+$/, ''))
  .filter((url) => /\/.+/.test(url) && !/googleapis\.com$/.test(url));

for (const url of [...new Set(remoteUrls)]) {
  let description;
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!response.ok) {
      // Some hosts refuse HEAD; fall back to a ranged GET to be sure.
      response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-0' } });
    }
    if (response.ok) continue;
    description = `HTTP ${response.status}`;
  } catch (error) {
    description = error?.message || 'unreachable';
  }
  failures.push(`Broken remote asset (${description}): ${url}`);
}

if (script.includes("`/asset/gallery/") || script.includes("`/asset/images/")) {
  failures.push('Museum assets must use relative paths so subdirectory deployments work.');
}

// The share image must be an absolute URL. Facebook, WhatsApp and Instagram
// silently drop a relative og:image, so the share card renders blank with no
// error anywhere. Fail loudly until the real origin is filled in.
if (html.includes('__SITE_URL__')) {
  failures.push(
    'index.html still contains the __SITE_URL__ placeholder. Replace every ' +
      'occurrence with your live origin (no trailing slash), e.g. ' +
      'https://vineeth.github.io/portfolio — otherwise the social share ' +
      'preview has no image.'
  );
}

// Verify the tags exist at all and agree with each other, so a later edit
// cannot quietly drop the canonical or leave og:image pointing elsewhere.
const ogImage = (html.match(/<meta property="og:image"\s+content="([^"]*)"/) || [])[1];
const canonical = (html.match(/<link rel="canonical"\s+href="([^"]*)"/) || [])[1];
if (!ogImage) failures.push('index.html is missing an og:image meta tag.');
if (!canonical) failures.push('index.html is missing a canonical link.');
if (!/<meta name="twitter:card"/.test(html)) failures.push('index.html is missing a twitter:card meta tag.');
if (ogImage && canonical && !ogImage.startsWith(canonical.replace(/\/$/, ''))) {
  failures.push(`og:image (${ogImage}) is not under the canonical origin (${canonical}).`);
}
if (ogImage && !/^https:\/\//.test(ogImage)) {
  failures.push(`og:image must be an absolute https URL, got: ${ogImage}`);
}
// The image must actually be in the deploy payload at the path the tag claims.
// A GitHub Pages project site is served from /<repo>/, so the origin root is
// not the site root: match the og:image path to public/ by its longest existing
// suffix rather than assuming a leading-slash mapping.
if (ogImage && /^https?:\/\//.test(ogImage)) {
  const segments = new URL(ogImage).pathname.split('/').filter(Boolean);
  let resolvedTo = null;
  for (let start = 0; start < segments.length && !resolvedTo; start++) {
    const candidate = join(root, 'public', ...segments.slice(start));
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      resolvedTo = segments.slice(start).join('/');
    }
  }
  if (!resolvedTo) {
    failures.push(`og:image points at ${new URL(ogImage).pathname}, which does not match any file in public/.`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Smoke test passed: ${requiredAssets.length} local assets, ${projects.length} projects, ${localReferences.length} HTML references and ${new Set(remoteUrls).size} remote assets verified.`);