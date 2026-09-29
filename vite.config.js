import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the built site portable when deployed under a domain root or a
  // subdirectory such as GitHub Pages.
  base: './',
  server: {
    port: 3000,
    watch: {
      // Project videos are large static files served straight from public/, so
      // there is nothing to hot-reload. Watching them used to crash the dev
      // server with EBUSY when a clip was still being copied into the folder and
      // the file was locked. Edit src/data/projects.js to pick up a new clip.
      ignored: [/[/\\]public[/\\]asset[/\\]videos[/\\]/],

      // Copying a photograph into public/asset/images/ used to kill the dev
      // server with the same EBUSY error. The failure happens when the watcher
      // registers a file that Windows still has open for writing, so
      // awaitWriteFinish does not help: it delays the change event but the
      // watch is already established by then. Polling compares stat() results
      // instead of holding an OS handle on each file, which cannot fail on a
      // locked file, and it keeps the rest of public/ watched.
      //
      // Watching public/ matters: Vite serves it through a directory listing it
      // captures at startup, so a newly added asset 404s into the SPA fallback
      // until the server restarts. The reload a new file triggers is what
      // refreshes that listing.
      usePolling: true,
      interval: 300,

      // Belt and braces for ordinary copies: hold an added file until its size
      // settles so a half-written image is never served.
      awaitWriteFinish: {
        stabilityThreshold: 400,
        pollInterval: 100,
      },
    },
  },
  preview: {
    port: 3000,
  },
});
