/**
 * Project content for the work wall.
 *
 * Add a file under public/asset/videos/ and set `video` to that public path,
 * e.g. 'asset/videos/my-clip.mp4`. Set `orientation` to 'portrait' for vertical
 * clips (9:16) so the player sizes itself to the footage instead of boxing it.
 * A project with no `video` keeps its poster image and external link, so the
 * page never requests a missing file.
 */
export const projects = [
  {
    slug: 'cinematic-travel',
    title: 'Cinematic Travel Films',
    description: 'Aerial shots captured & graded on the go',
    poster: 'asset/videos/spiti_drone-poster.webp',
    video: 'asset/videos/spiti_drone.mp4',
    orientation: 'landscape',
    externalUrl: 'https://www.instagram.com/p/DP4QCWCk2Zb/',
    parallax: 0.05,
  },
  {
    slug: 'tech-content',
    title: 'Tech Content Production',
    description: 'Product & gadget edits for tech page',
    poster: 'asset/videos/battery-info-poster.webp',
    video: 'asset/videos/battery-info.mp4',
    orientation: 'portrait',
    externalUrl: 'https://www.instagram.com/p/DYChDmtu8vF/',
    parallax: -0.08,
  },
  {
    slug: 'cinematic-short-film',
    title: 'Cinematic Short Films',
    description: 'Story-led edits built around one beat',
    poster: 'asset/videos/cinematic-story-poster.webp',
    video: 'asset/videos/cinematic-story.mov',
    orientation: 'landscape',
    externalUrl: 'https://www.instagram.com/p/DLSYhWsSru6/',
    parallax: 0.1,
  },
  {
    slug: 'city-film-style',
    title: 'City Film-Style Edits',
    description: 'Malaysia, shot vertical in a filmic style',
    poster: 'asset/videos/in-malaysia-poster.webp',
    video: 'asset/videos/in-malaysia.mp4',
    orientation: 'portrait',
    externalUrl: 'https://www.instagram.com/p/C9FdlfKSyBo/',
    parallax: -0.03,
  },
];

export const projectBySlug = new Map(projects.map((project) => [project.slug, project]));
