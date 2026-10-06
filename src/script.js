import { projectBySlug } from './data/projects.js';

/* ==========================================================================
 * script.js — Vineeth portfolio (single-page home).
 *
 * Faithful port of the reference home page behaviour:
 *   preloader, navbar + mobile overlay + theme toggle, footer injection,
 *   custom cursor, lazy backgrounds, work-wall parallax, 3D museum ticker,
 *   footer grass animation overlay (canvas), dappled-light shimmer, and
 *   section scrollspy.
 * ========================================================================== */

(() => {
    'use strict';

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    /* Every asset the footer injects lives in public/asset/ and is referenced
       relatively, so the site works unchanged from a subpath. */
    const THEME_STORAGE_KEY = 'portfolio-theme';
    const LOADER_SEEN_KEY = 'portfolio-loader-seen';
    const ASSET = (p) => `asset/${p}`;

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const reducedMotion = () =>
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = () =>
        window.matchMedia && window.matchMedia('(pointer: fine)').matches;

    const onReady = (fn) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    };

    const escapeHTML = (value) =>
        String(value || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));

    /* -----------------------------------------------------------------------
       Theme (light/dark) — persisted, boots from the class set by the inline
       script in index.html to avoid a flash.
       ----------------------------------------------------------------------- */
    const isNight = () => document.body.classList.contains('night-mode');

    function getCurrentThemeName() {
        return isNight() ? 'dark' : 'light';
    }

    function applyStoredTheme() {
        let theme = 'light';
        
        // Check URL parameters first for cross-site syncing
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('theme')) {
            theme = urlParams.get('theme');
            try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
            // Clean up the URL so the parameter disappears after loading
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            try { theme = localStorage.getItem(THEME_STORAGE_KEY) || 'light'; } catch { /* ignore */ }
        }
        
        document.body.classList.toggle('night-mode', theme === 'dark');
        syncThemeToggles();
    }

    function syncThemeToggles() {
        const night = isNight();
        $$('[data-theme-toggle]').forEach((btn) => {
            btn.setAttribute('aria-checked', String(night));
            btn.setAttribute('aria-label', night ? 'Switch to light mode' : 'Switch to dark mode');
        });

        // Keep the Code/Art toggle links updated with the current theme
        $$('.portfolio-toggle__btn:not(.is-active)').forEach(btn => {
            const baseUrl = btn.getAttribute('data-base-url') || btn.href.split('?')[0];
            if (!btn.hasAttribute('data-base-url')) btn.setAttribute('data-base-url', baseUrl);
            btn.href = `${baseUrl}?theme=${night ? 'dark' : 'light'}`;
        });
    }

    function bindThemeToggle() {
        $$('[data-theme-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const night = !isNight();
                document.body.classList.toggle('night-mode', night);
                try { localStorage.setItem(THEME_STORAGE_KEY, night ? 'dark' : 'light'); } catch { /* ignore */ }
                syncThemeToggles();
            });
        });
    }

    /* -----------------------------------------------------------------------
       Preloader — hides once the page has settled (or on a repeat visit).
       ----------------------------------------------------------------------- */
    function initLoader() {
        const body = document.body;
        const loader = $('#portfolio-loader');
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            if (loader) {
                loader.classList.add('portfolio-loader--done');
                loader.setAttribute('aria-busy', 'false');
                loader.setAttribute('aria-hidden', 'true');
            }
            body.classList.add('hero-in');
            const releaseScrollLock = () => body.classList.remove('portfolio-loader-active');
            if (reducedMotion()) releaseScrollLock();
            else window.setTimeout(releaseScrollLock, 380);
            try { sessionStorage.setItem(LOADER_SEEN_KEY, '1'); } catch { /* ignore */ }
        };

        let repeatVisit = false;
        try { repeatVisit = !!sessionStorage.getItem(LOADER_SEEN_KEY); } catch { /* ignore */ }

        if (repeatVisit || reducedMotion()) {
            finish();
            return;
        }

        const minDelay = 1800;
        let settled = false;
        const t0 = Date.now();
        const settle = () => {
            if (settled) return;
            settled = true;
            const wait = Math.max(0, minDelay - (Date.now() - t0));
            setTimeout(finish, wait);
        };
        if (document.readyState === 'complete') settle();
        else window.addEventListener('load', settle, { once: true });
        setTimeout(finish, minDelay + 2200); // module-level hard failsafe
    }

    /* -----------------------------------------------------------------------
       Lazy loading — [data-lazy-bg] backgrounds and img[data-src] swaps.
       ----------------------------------------------------------------------- */
    let lazyObserver = null;

    function ensureLazyObserver() {
        if (lazyObserver || typeof IntersectionObserver !== 'function') return;
        lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                if (el.hasAttribute('data-lazy-bg')) applyLazyBg(el);
                else if (el.hasAttribute('data-src')) applyLazyImg(el);
                lazyObserver.unobserve(el);
            });
        }, { rootMargin: '320px 0px', threshold: 0.01 });
    }

    function escapeCssUrl(url) {
        return String(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function applyLazyBg(el) {
        const url = el.getAttribute('data-lazy-bg');
        if (!url || el.dataset.lazyLoaded === 'true') return;
        el.style.backgroundImage = `url('${escapeCssUrl(url)}')`;
        el.dataset.lazyLoaded = 'true';
    }

    function applyLazyImg(el) {
        const src = el.getAttribute('data-src');
        if (!src || el.dataset.lazyLoaded === 'true') return;
        el.src = src;
        el.removeAttribute('data-src');
        el.dataset.lazyLoaded = 'true';
    }

    function scanLazy(root) {
        const scope = root && root.querySelectorAll ? root : document;
        ensureLazyObserver();
        scope.querySelectorAll('[data-lazy-bg]:not([data-lazy-loaded])').forEach((el) => {
            if (lazyObserver) lazyObserver.observe(el);
            else applyLazyBg(el);
        });
        scope.querySelectorAll('img[data-src]:not([data-lazy-loaded])').forEach((el) => {
            if (lazyObserver) lazyObserver.observe(el);
            else applyLazyImg(el);
        });
    }

    /* -----------------------------------------------------------------------
       Navbar + mobile overlay + resume modal (injected, like the reference).
       ----------------------------------------------------------------------- */
    const headerMount = $('[data-site-header]');

    if (headerMount) {
        const V_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23FF6B00'/%3E%3Ctext x='32' y='43' font-family='Georgia,serif' font-size='30' font-weight='700' fill='white' text-anchor='middle'%3EV%3C/text%3E%3C/svg%3E";

        headerMount.innerHTML = `
            <header class="navbar">
                <div class="navbar__pill">
                    <a href="#" class="navbar__logo" aria-label="Go to homepage">
                        <img src="${V_LOGO}" alt="Vineeth" class="logo-img">
                    </a>

                    <nav class="nav-tray" aria-label="Primary navigation">
                        <a href="#work" class="nav-item" data-nav-anchor="work">work</a>
                        <a href="#beyond" class="nav-item" data-nav-anchor="beyond">beyond</a>
                        <a href="#" class="nav-item nav-item--resume" data-resume-trigger aria-haspopup="dialog" aria-controls="resume-modal" aria-expanded="false">about me</a>
                        <a href="#contact" class="nav-item" data-nav-anchor="contact">contact</a>
                        
                        <div class="portfolio-toggle">
                            <a href="https://portfolio-site-pink-tau-19.vercel.app/" class="portfolio-toggle__btn" data-base-url="https://portfolio-site-pink-tau-19.vercel.app/" data-tooltip="View Engineering Portfolio">Code</a>
                            <a href="#" class="portfolio-toggle__btn is-active" data-tooltip="You are here">Art</a>
                        </div>
                        
                        <button type="button" class="theme-toggle" data-theme-toggle role="switch" aria-checked="false" aria-label="Switch to dark mode">
                            <span class="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM11 1.5a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zm0 19a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zM1.5 11a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zm21 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zM4.22 4.22a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 1 1-1.41 1.42L4.22 5.64a1 1 0 0 1 0-1.42zm13.73 13.73a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 0 1-1.41 1.42l-1.42-1.41a1 1 0 0 1 0-1.42zM4.22 19.78a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0zm13.73-13.73a1 1 0 0 1 0-1.42l1.41-1.41a1 1 0 0 1 1.42 1.41l-1.42 1.42a1 1 0 0 1-1.41 0z"/>
                                </svg>
                            </span>
                            <span class="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                            </span>
                        </button>
                    </nav>

                    <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-overlay">
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                    </button>
                </div>

                <nav class="mobile-nav-overlay" id="mobile-nav-overlay" aria-label="Mobile navigation" aria-hidden="true" inert>
                    <div class="mobile-nav-overlay__header">
                        <div class="portfolio-toggle">
                            <a href="https://portfolio-site-pink-tau-19.vercel.app/" class="portfolio-toggle__btn" data-base-url="https://portfolio-site-pink-tau-19.vercel.app/" data-tooltip="View Engineering Portfolio">Code</a>
                            <a href="#" class="portfolio-toggle__btn is-active" data-tooltip="You are here">Art</a>
                        </div>
                        <button type="button" class="theme-toggle mobile-nav-overlay__theme-toggle" data-theme-toggle role="switch" aria-checked="false" aria-label="Switch to dark mode">
                            <span class="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM11 1.5a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zm0 19a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zM1.5 11a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zm21 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zM4.22 4.22a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 1 1-1.41 1.42L4.22 5.64a1 1 0 0 1 0-1.42zm13.73 13.73a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 0 1-1.41 1.42l-1.42-1.41a1 1 0 0 1 0-1.42zM4.22 19.78a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0zm13.73-13.73a1 1 0 0 1 0-1.42l1.41-1.41a1 1 0 0 1 1.42 1.41l-1.42 1.42a1 1 0 0 1-1.41 0z"/>
                                </svg>
                            </span>
                            <span class="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                            </span>
                        </button>
                        <button type="button" class="mobile-nav-overlay__close" id="mobile-nav-close" aria-label="Close menu">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <a href="#work" class="nav-item" data-nav-anchor="work">work</a>
                    <a href="#beyond" class="nav-item" data-nav-anchor="beyond">beyond</a>
                    <a href="#" class="nav-item nav-item--resume" data-resume-trigger aria-haspopup="dialog" aria-controls="resume-modal" aria-expanded="false">about me</a>
                    <a href="#contact" class="nav-item" data-nav-anchor="contact">contact</a>
                </nav>
            </header>
            <div class="resume-modal" id="resume-modal" aria-hidden="true" inert>
                <div class="resume-modal__backdrop" data-resume-close></div>
                <section class="resume-modal__panel" role="dialog" aria-modal="true" aria-label="About & resume" tabindex="-1">
                    <div class="resume-modal__actions">
                        <a href="mailto:harivineeth51@gmail.com" class="resume-modal__icon-btn" aria-label="Say hello by email">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path d="M2 4.5h14v9H2zM2 5l7 5 7-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </a>
                        <button type="button" class="resume-modal__icon-btn resume-modal__close" data-resume-close aria-label="Close about & resume">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="resume-modal__preview">
                        <div class="resume-summary">
                            <h2 class="resume-summary__name">Pabolu Vineeth</h2>
                            <p class="resume-summary__role">Creative Video Editor · Photographer · Content Creator</p>

                            <div class="resume-summary__block">
                                <h3 class="resume-summary__block-title">Snapshot</h3>
                                <ul class="resume-summary__list">
                                    <li>IG reel hit 1M+ views — proof the hook works</li>
                                    <li>20+ campus events covered for DSA Media Club</li>
                                    <li>Runs a personal content page with a clear visual identity</li>
                                </ul>
                            </div>

                            <div class="resume-summary__block">
                                <h3 class="resume-summary__block-title">Tools of the trade</h3>
                                <div class="resume-summary__tags" data-tools-from-work-strip></div>
                            </div>

                            <div class="resume-summary__block">
                                <h3 class="resume-summary__block-title">Education</h3>
                                <ul class="resume-summary__list">
                                    <li>B.Tech CSE, SRM Institute of Science &amp; Technology (2022–2026) — CGPA 8.55/10</li>
                                </ul>
                            </div>

                            <div class="resume-summary__block">
                                <h3 class="resume-summary__block-title">Experience</h3>
                                <ul class="resume-summary__list">
                                    <li>
                                        <span class="resume-summary__job">Freelance Videographer, Photographer &amp; Editor</span>
                                        <span class="resume-summary__meta">Video &amp; photo editing, branding and event coverage · 2022 – present</span>
                                    </li>
                                    <li>
                                        <span class="resume-summary__job">Video Editor Intern</span>
                                        <span class="resume-summary__meta">Rasieupdigital, Hyderabad · Jul 2026 – Aug 2026</span>
                                    </li>
                                </ul>
                            </div>

                            <div class="resume-summary__block">
                                <h3 class="resume-summary__block-title">What I'm great at</h3>
                                <ul class="resume-summary__list">
                                    <li>Cinematic editing &amp; color grading</li>
                                    <li>Beat-sync cuts &amp; high-retention Reels</li>
                                    <li>DSLR / mirrorless photo &amp; video capture</li>
                                </ul>
                            </div>

                            <div class="resume-summary__contact">
                                <a class="resume-summary__btn" href="asset/resume/vineeth_videoediting.pdf" target="_blank" download>Download Resume</a>
                                <a class="resume-summary__btn resume-summary__btn--ghost" href="https://drive.google.com/drive/folders/12JtAqFJH5mRcI_e_NMV_anU28ijZhUmj?usp=drive_link" target="_blank" rel="noopener noreferrer">More Work Samples</a>
                                <a class="resume-summary__btn resume-summary__btn--ghost" href="mailto:harivineeth51@gmail.com">Say hello</a>
                                <a class="resume-summary__btn resume-summary__btn--ghost" href="https://instagram.com/vineeth.fps" target="_blank" rel="noopener noreferrer">@vineeth.fps</a>
                                <a class="resume-summary__btn resume-summary__btn--ghost" href="https://www.linkedin.com/in/pabolu-vineeth-129b4626b/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                            </div>
                        </div>
                    </div>
                </section>
            </div>


        `;

        syncThemeToggles();
        bindThemeToggle();
        bindMobileMenu();
        bindResumeModal();
        bindScrollSpy();
    }

    function bindMobileMenu() {
        const btn = $('#mobile-menu-btn');
        const overlay = $('#mobile-nav-overlay');
        const closeBtn = $('#mobile-nav-close');
        if (!btn || !overlay) return;

        const backgroundRegions = [$('main'), $('.navbar__pill')].filter(Boolean);
        let isOpen = false;
        const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const setOpen = (open, { restoreFocus = true } = {}) => {
            isOpen = open;
            btn.classList.toggle('active', open);
            overlay.classList.toggle('active', open);
            overlay.inert = !open;
            overlay.setAttribute('aria-hidden', String(!open));
            document.body.classList.toggle('mobile-nav-open', open);
            backgroundRegions.forEach((region) => { region.inert = open; });
            btn.setAttribute('aria-expanded', String(open));
            btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            document.documentElement.style.overflow = open ? 'hidden' : '';

            if (open) {
                window.requestAnimationFrame(() => {
                    (closeBtn || overlay.querySelector(focusableSelector))?.focus();
                });
            } else if (restoreFocus) {
                btn.focus();
            }
        };

        btn.addEventListener('click', () => setOpen(!isOpen));
        closeBtn?.addEventListener('click', () => setOpen(false));
        overlay.querySelectorAll('.nav-item').forEach((link) => {
            link.addEventListener('click', () => setOpen(false, { restoreFocus: false }));
        });

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const focusable = $$(focusableSelector, overlay).filter((el) => el.getClientRects().length);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) setOpen(false);
        });
    }

    function bindResumeModal() {
        const modal = $('#resume-modal');
        if (!modal) return;

        // The work-wall tool strip in index.html is the single source of truth
        // for the toolkit. Mirror it into the resume so the two can never drift
        // apart and a visitor sees the same list whether or not they open this.
        const toolSource = $$('.projects-tools__tag');
        const toolTarget = $('[data-tools-from-work-strip]', modal);
        if (toolSource.length && toolTarget) {
            toolTarget.replaceChildren(
                ...toolSource.map((tag) => {
                    const clone = document.createElement('span');
                    clone.className = 'resume-summary__tag';
                    clone.textContent = tag.textContent.trim();
                    return clone;
                })
            );
        }

        const triggers = $$('[data-resume-trigger]');
        const backgroundRegions = [$('main'), $('.navbar__pill')].filter(Boolean);
        const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        let isOpen = false;
        let lastFocused = null;

        const isRendered = (el) => Boolean(
            el?.isConnected &&
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== 'hidden'
        );
        const isVisible = (el) => {
            if (!isRendered(el)) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
        };

        const setOpen = (open, { restoreFocus = true } = {}) => {
            isOpen = open;
            modal.classList.toggle('is-open', open);
            modal.inert = !open;
            modal.setAttribute('aria-hidden', String(!open));
            document.body.classList.toggle('resume-modal-open', open);
            triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', String(open)));
            backgroundRegions.forEach((region) => { region.inert = open; });

            if (open) {
                lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        $('#resume-modal .resume-modal__close')?.focus();
                    });
                });
            } else if (restoreFocus) {
                window.requestAnimationFrame(() => {
                    const fallback = [
                        lastFocused,
                        ...triggers,
                        $('#mobile-menu-btn')
                    ].find(isVisible);
                    fallback?.focus();
                });
            }
        };

        triggers.forEach((el) => {
            el.setAttribute('aria-expanded', 'false');
            el.addEventListener('click', (e) => {
                e.preventDefault();
                setOpen(true);
            });
        });
        $$('[data-resume-close]').forEach((el) => {
            el.addEventListener('click', () => setOpen(false));
        });

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || !isOpen) return;
            const focusable = $$(focusableSelector, modal).filter(isRendered);
            if (!focusable.length) {
                e.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) setOpen(false);
        });
    }

        function bindScrollSpy() {
        if (typeof IntersectionObserver !== 'function') return;
        const map = {
            work: '#work',
            beyond: '#beyond',
            contact: '#contact'
        };
        const anchors = $$('[data-nav-anchor]');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = entry.target.id;
                if (!entry.isIntersecting) return;
                anchors.forEach((a) => {
                    const active = a.getAttribute('data-nav-anchor') === id;
                    a.classList.toggle('is-active', active);
                    if (active) a.setAttribute('aria-current', 'page');
                    else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-40% 0px -55% 0px' });
        Object.values(map).forEach((sel) => {
            const el = $(sel);
            if (el) observer.observe(el);
        });
    }

    /* -----------------------------------------------------------------------
       Footer (injected) — sticky note, CTA, socials, grass scene.
       ----------------------------------------------------------------------- */
    const footerMount = $('[data-site-footer]');
    if (footerMount) {
        footerMount.innerHTML = `
            <footer class="site-footer" id="contact">
                <div class="container">
                    <section class="footer-cta-shell" aria-labelledby="footer-heading">
                        <div class="footer-sticker-stack" aria-hidden="true">
                            <div class="sticker-shadow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="499" height="498" viewBox="0 0 499 498" fill="none">
                                  <g filter="url(#filter0_f_1192_10582)">
                                    <path d="M70 301.905L224.53 70L428.409 427.65L172.976 427.649L70 301.905Z" fill="#595959" fill-opacity="0.15"/>
                                  </g>
                                  <defs>
                                    <filter id="filter0_f_1192_10582" x="0" y="0" width="498.409" height="497.65" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                                      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                                      <feGaussianBlur stdDeviation="35" result="effect1_foregroundBlur_1192_10582"/>
                                    </filter>
                                  </defs>
                                </svg>
                            </div>
                            <img data-src="${ASSET('sticky-note.png')}" alt="Sticky Note" class="sticker-image" width="307" height="307" decoding="async" fetchpriority="low">
                        </div>

                        <h2 class="footer-cta-title" id="footer-heading">amaze amaze amaze?<br>let’s catchup soon</h2>
                        <p class="footer-cta-subtitle">Drop me a ‘Hi’ and I’ll get back</p>
                    </section>

                    <div class="footer-meta">
                        <div class="footer-meta-socials">
                            <a href="https://www.instagram.com/vineeth.fps/" class="footer-meta-social" aria-label="Instagram (opens in a new tab)" target="_blank" rel="noopener noreferrer">
                                <img src="${ASSET('social-instagram.svg')}" alt="" width="32" height="32">
                            </a>
                            <a href="https://www.linkedin.com/in/pabolu-vineeth-129b4626b/" class="footer-meta-social" aria-label="LinkedIn (opens in a new tab)" target="_blank" rel="noopener noreferrer">
                                <img src="${ASSET('social-linkedin.svg')}" alt="" width="32" height="32">
                            </a>
                            <a href="mailto:harivineeth51@gmail.com" class="footer-meta-social" aria-label="Email me">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--fill-0, #726653)" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 2-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/></svg>
                            </a>
                            <a href="https://drive.google.com/drive/folders/12JtAqFJH5mRcI_e_NMV_anU28ijZhUmj?usp=drive_link" class="footer-meta-social" aria-label="More Work Samples on Google Drive" target="_blank" rel="noopener noreferrer">
                                <img src="${ASSET('social-drive.svg')}" alt="Google Drive" width="32" height="32">
                            </a>
                        </div>
                    </div>

                    <figure class="footer-grass-scene" aria-hidden="true" data-footer-grass-scene>
                        <img
                            class="footer-grass-scene__base footer-grass-scene__base--light"
                            data-src="${ASSET('grass-footer.jpg')}"
                            alt=""
                            width="1440"
                            height="400"
                            decoding="async"
                            fetchpriority="low"
                        >
                        <img
                            class="footer-grass-scene__base footer-grass-scene__base--dark"
                            data-src="${ASSET('grass-footer-dark.png')}"
                            alt=""
                            width="1440"
                            height="400"
                            decoding="async"
                            fetchpriority="low"
                        >
                        <canvas id="footer-grass-canvas" class="footer-grass-scene__overlay" data-footer-grass data-current-theme="${getCurrentThemeName()}"></canvas>
                        <p class="footer-meta-copy">
                            Made with a camera, lots of chai &amp; dangerously late nights <span aria-hidden="true">🌙</span>
                        </p>
                    </figure>

                </div>
            </footer>
        `;
        scanLazy(footerMount);
        initFooterGrassAnimation();
    }

    /* -----------------------------------------------------------------------
       Footer grass animation overlay — swaying foreground blades + a little
       camera-bot driving across the bottom edge. Theme-aware (day/night).
       ----------------------------------------------------------------------- */
    function initFooterGrassAnimation() {
        if (window.__footerGrassStarted) return;
        window.__footerGrassStarted = true;

        const scene = $('[data-footer-grass-scene]');
        const canvas = $('#footer-grass-canvas');
        if (!scene || !canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let W = 0;
        let H = 0;
        let DPR = 1;
        let running = false;
        let raf = 0;
        let t = 0;
        let blades = [];

        const palette = () => (document.body.classList.contains('night-mode')
            ? {
                bladeA: 'rgba(140, 168, 210, 0.92)',
                bladeB: 'rgba(98, 122, 176, 0.95)',
                glow: 'rgba(150, 220, 255, 0.5)'
            }
            : {
                bladeA: 'rgba(104, 184, 56, 0.95)',
                bladeB: 'rgba(58, 150, 40, 0.98)',
                glow: 'rgba(255, 255, 255, 0.6)'
            });

        function resize() {
            const rect = scene.getBoundingClientRect();
            DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            W = Math.max(1, Math.round(rect.width * DPR));
            H = Math.max(1, Math.round(rect.height * DPR));
            canvas.width = W;
            canvas.height = H;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            buildBlades();
        }

        function buildBlades() {
            const count = Math.min(Math.round(W / DPR / 15), 170);
            blades = [];
            for (let i = 0; i < count; i++) {
                blades.push({
                    x: (i + (Math.random() * 2 - 1) * 0.7) / count,
                    h: 0.5 + Math.random() * 0.62,
                    sway: 0.7 + Math.random() * 1.7,
                    phase: Math.random() * Math.PI * 2,
                    lean: (Math.random() - 0.5) * 0.5,
                    w: 1.1 + Math.random() * 2.2
                });
            }
        }

        function drawBlade(b, p) {
            const w = W / DPR;
            const h = H / DPR;
            const baseY = h * 0.985;
            const x = b.x * w;
            const height = b.h * (h * 0.34);
            const sway = Math.sin(t * b.sway * 1.8 + b.phase) * (w * 0.03);
            const tipX = x + sway + b.lean * height * 0.4;
            const halfW = Math.max(0.6, b.w);

            ctx.beginPath();
            ctx.moveTo(x - halfW, baseY);
            ctx.quadraticCurveTo(x + sway * 0.5, baseY - height * 0.6, tipX, baseY - height);
            ctx.quadraticCurveTo(x + sway * 0.55, baseY - height * 0.6, x + halfW, baseY);
            ctx.closePath();
            ctx.fillStyle = ((b.x * 13) % 2 < 1) ? p.bladeA : p.bladeB;
            ctx.fill();
        }

        function robotX() {
            const w = W / DPR;
            const span = w + 240;
            const progress = (t * 0.035) % 1;
            return progress * span - 200;
        }

        function drawRobotAt(px) {
            const w = W / DPR;
            const h = H / DPR;
            const scale = Math.max(0.7, Math.min(1.3, w / 700));
            const ground = h * 0.985;
            const bob = Math.sin(t * 4) * 3;
            const tilt = Math.sin(t * 4 * 0.6) * 0.05;
            const x = px;
            const y = ground - 50 * scale + bob;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(tilt);
            ctx.scale(scale, scale);

            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.beginPath();
            ctx.ellipse(0, 48, 36, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // wheels
            ctx.fillStyle = 'rgba(45,45,50,0.9)';
            [-25, 25].forEach((wx) => {
                ctx.beginPath();
                ctx.arc(wx, 42, 10, 0, Math.PI * 2);
                ctx.fill();
            });

            // body (off-white)
            const grad = ctx.createLinearGradient(0, -40, 0, 32);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#d6d2cc');
            ctx.fillStyle = grad;
            roundRect(ctx, -32, -40, 64, 74, 15);
            ctx.fill();

            // soft rim/outline so it reads on pale grass
            ctx.strokeStyle = 'rgba(30,30,30,0.15)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            roundRect(ctx, -32, -40, 64, 74, 15);
            ctx.stroke();

            // screen (dark, for contrast)
            ctx.fillStyle = '#22242b';
            roundRect(ctx, -21, -29, 42, 27, 9);
            ctx.fill();

            // eyes (off-white)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-7, -16, 5, 0, Math.PI * 2);
            ctx.arc(7, -16, 5, 0, Math.PI * 2);
            ctx.fill();

            // antenna
            ctx.strokeStyle = 'rgba(60,60,65,0.55)';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(0, -40);
            ctx.lineTo(0, -52);
            ctx.stroke();
            ctx.fillStyle = '#e8e4de';
            ctx.beginPath();
            ctx.arc(0, -55, 4.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        function roundRect(c, x, y, w, h, r) {
            c.beginPath();
            c.moveTo(x + r, y);
            c.arcTo(x + w, y, x + w, y + h, r);
            c.arcTo(x + w, y + h, x, y + h, r);
            c.arcTo(x, y + h, x, y, r);
            c.arcTo(x, y, x + w, y, r);
            c.closePath();
        }

        function drawFrame() {
            const w = W / DPR;
            const h = H / DPR;
            const p = palette();
            ctx.clearRect(0, 0, w, h);

            // Partition ALL blades by x so every blade is drawn exactly once
            // (the old two-slice split could silently skip blades near x=0.5).
            const left = [];
            const right = [];
            for (let i = 0; i < blades.length; i++) {
                if (blades[i].x < 0.5) left.push(blades[i]);
                else right.push(blades[i]);
            }
            left.forEach((b) => drawBlade(b, p));
            drawRobotAt(robotX());
            right.forEach((b) => drawBlade(b, p));
        }

        function tick() {
            raf = 0;
            if (!running) return;
            t += 0.016;
            drawFrame();
            raf = requestAnimationFrame(tick);
        }

        function start() {
            if (running) return;
            running = true;
            resize();
            raf = requestAnimationFrame(tick);
        }

        function stop() {
            running = false;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
        }

        if (reducedMotion()) {
            // Static fallback: draw one frame (blades + robot) so the grass
            // scene never appears empty/missing even when motion is disabled.
            resize();
            drawFrame();
            let wasNight = document.body.classList.contains('night-mode');
            if (typeof MutationObserver === 'function') {
                const themeObserver = new MutationObserver(() => {
                    const isNight = document.body.classList.contains('night-mode');
                    if (isNight === wasNight) return;
                    wasNight = isNight;
                    drawFrame();
                });
                themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
            return;
        }

        if (typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) start();
                    else stop();
                });
            }, { rootMargin: '200px 0px' });
            io.observe(scene);
        } else {
            start();
            return;
        }

        window.addEventListener('resize', resize, { passive: true });
        start();
    }

    /* -----------------------------------------------------------------------
       Custom cursor (dot + tooltip label) — fine pointers only.
       ----------------------------------------------------------------------- */
    function initCursor() {
        if (!finePointer() || reducedMotion()) return;

        document.body.classList.add('has-custom-cursor');
        const cursorLabel = document.createElement('div');
        cursorLabel.id = 'custom-cursor-label';
        cursorLabel.setAttribute('aria-hidden', 'true');
        document.body.appendChild(cursorLabel);

        const cursorDot = document.createElement('div');
        cursorDot.classList.add('cursor-dot');
        document.body.appendChild(cursorDot);

        let dotX = 0;
        let dotY = 0;
        let labelX = 0;
        let labelY = 0;
        let cursorRaf = 0;
        let tooltipTimer = null;

        function paint() {
            cursorRaf = 0;
            cursorDot.style.left = dotX + 'px';
            cursorDot.style.top = dotY + 'px';
            if (cursorLabel.style.opacity !== '0' && isLabelVisible()) {
                cursorLabel.style.left = labelX + 'px';
                cursorLabel.style.top = labelY + 'px';
            }
        }

        function requestPaint() {
            if (cursorRaf) return;
            cursorRaf = requestAnimationFrame(paint);
        }

        function setLabelContent(card) {
            const title = card.getAttribute('data-title');
            const desc = card.getAttribute('data-desc');
            if (!title) return false;
            cursorLabel.classList.remove('has-description');
            cursorLabel.innerHTML = `
                <span class="cursor-label__title">${escapeHTML(title)}</span>
                ${desc ? `<span class="cursor-label__desc">${escapeHTML(desc)}</span>` : ''}
            `;
            return true;
        }

        function showLabel() {
            cursorLabel.classList.add('is-expanded');
            cursorLabel.classList.remove('is-collapsing');
            cursorLabel.style.left = labelX + 'px';
            cursorLabel.style.top = labelY + 'px';
        }

        function hideLabel() {
            cursorLabel.classList.remove('is-expanded');
            cursorLabel.classList.add('is-collapsing');
        }

        function isLabelVisible() {
            return !!(cursorLabel.dataset.visible === 'true');
        }

        document.addEventListener('mousemove', (e) => {
            cursorDot.classList.add('is-ready');
            dotX = e.clientX;
            dotY = e.clientY;
            labelX = e.clientX;
            labelY = e.clientY;
            requestPaint();
        });

        $$('a, button, [role="button"], input, textarea, select').forEach((el) => {
            el.addEventListener('mouseenter', () => cursorDot.classList.add('cursor-dot--hover'));
            el.addEventListener('mouseleave', () => cursorDot.classList.remove('cursor-dot--hover'));
        });

        $$('.hero-v2__tag').forEach((el) => {
            el.addEventListener('mouseenter', () => cursorDot.classList.add('cursor-dot--hover', 'cursor-dot--blue'));
            el.addEventListener('mouseleave', () => cursorDot.classList.remove('cursor-dot--hover', 'cursor-dot--blue'));
        });

        $$('#work-wall .work-card').forEach((card) => {
            card.addEventListener('mouseenter', () => {
                cursorDot.classList.add('cursor-dot--hover');
                if (!setLabelContent(card)) return;
                tooltipTimer = setTimeout(() => {
                    cursorLabel.dataset.visible = 'true';
                    showLabel();
                    requestPaint();
                }, 260);
            });
            card.addEventListener('mouseleave', () => {
                cursorDot.classList.remove('cursor-dot--hover');
                clearTimeout(tooltipTimer);
                if (cursorLabel.dataset.visible === 'true') {
                    cursorLabel.dataset.visible = 'false';
                    hideLabel();
                    requestPaint();
                }
            });
        });
    }

    /* -----------------------------------------------------------------------
       Project videos — muted hover previews plus a native dialog player.
       Cards without a `video` entry keep their poster-image/external-link
       behaviour, so the page never requests a missing media file.
       ----------------------------------------------------------------------- */
    function initProjectVideos(cards) {
        const dialog = $('#project-player');
        if (!dialog || typeof dialog.showModal !== 'function') return;

        const video = $('#project-player-video');
        const title = $('#project-player-title');
        const description = $('#project-player-description');
        const projectLink = $('#project-player-link');
        const closeButton = $('[data-player-close]', dialog);
        if (!video || !title || !description || !projectLink || !closeButton) return;

        const canPreview = finePointer() && !reducedMotion();
        let activeCard = null;

        const pausePreview = (card) => {
            if (!card) return;
            const preview = $('.work-card__video', card);
            preview?.pause();
            card.classList.remove('is-previewing');
        };

        const closePlayer = () => {
            if (dialog.open) dialog.close();
        };

        const media = $('.project-player__media', dialog);
        const panel = $('.project-player__panel', dialog);
        const header = $('.project-player__header', dialog);
        const footer = $('.project-player__footer', dialog);

        // The player has to size the video area itself. CSS cannot do it reliably
        // here for three reasons:
        //   1. The header/footer height depends on how their text wraps, which
        //      changes with the dialog width.
        //   2. The panel is capped with max-height rather than a given height, so
        //      a flex child has no definite height to resolve `max-height: 100%`
        //      against - a tall clip used to overflow and get cropped.
        //   3. `margin-inline: auto` cancels flex stretch, so a media box whose
        //      only child is absolutely positioned collapsed to zero width.
        // So measure the leftover space and size the box to the clip's real ratio.
        // A 9:16 reel then fills the player edge to edge: no bars, nothing cropped,
        // controls always reachable.
        const fitMedia = (pass = 0) => {
            if (!dialog.open || !media) return;

            const cap = parseFloat(getComputedStyle(panel).maxHeight);
            const viewportH = Number.isFinite(cap) ? cap : window.innerHeight - 32;
            const chrome = (header?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0);
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const ratio = vw && vh ? vw / vh : 16 / 9;
            const portrait = dialog.dataset.orientation === 'portrait';
            const widest = Math.min(portrait ? 560 : 1040, window.innerWidth - 32);
            const narrowest = Math.min(340, widest);

            // Narrow the panel to hug the clip. Re-run once, because narrowing it
            // can rewrap the title/footer and change the height actually left.
            let byHeight = viewportH - chrome;
            let wanted = byHeight * ratio;
            if (wanted > widest) wanted = widest;
            dialog.style.width = `${Math.round(Math.min(Math.max(wanted + 2, narrowest), widest))}px`;
            if (pass === 0) {
                fitMedia(1);
                return;
            }

            const maxBoxW = Math.max(120, panel.clientWidth - 2);
            let boxH = viewportH - chrome;
            let boxW = boxH * ratio;
            if (boxW > maxBoxW) {
                boxW = maxBoxW;
                boxH = boxW / ratio;
            }
            media.style.width = `${Math.round(boxW)}px`;
            media.style.height = `${Math.round(Math.max(120, boxH))}px`;
        };

        const openPlayer = (card, project) => {
            pausePreview(activeCard);
            activeCard = card;

            title.textContent = project.title;
            description.textContent = project.description;
            projectLink.href = project.externalUrl;
            dialog.dataset.orientation = project.orientation || 'landscape';

            video.poster = project.poster;
            video.src = project.video;
            video.load();
            document.body.classList.add('project-player-open');
            if (!dialog.open) dialog.showModal();
            fitMedia();

            const playback = video.play();
            if (playback) playback.catch(() => { /* Controls remain available if autoplay is blocked. */ });
        };

        // The clip's real ratio is only known once metadata arrives, so re-fit
        // then. Otherwise the box falls back to 16:9 and a vertical reel gets bars.
        video.addEventListener('loadedmetadata', () => {
            fitMedia();
        });

        window.addEventListener('resize', () => {
            fitMedia();
        });

        closeButton.addEventListener('click', closePlayer);
        // Native <dialog> closes on Escape by firing `cancel` first. Handling it
        // explicitly keeps the teardown identical for Escape, the close button
        // and a backdrop click, instead of relying on implicit browser defaults.
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            closePlayer();
        });
        dialog.addEventListener('close', () => {
            if (media) {
                media.style.width = '';
                media.style.height = '';
            }
            dialog.style.width = '';
            video.pause();
            video.removeAttribute('src');
            video.removeAttribute('poster');
            video.load();
            document.body.classList.remove('project-player-open');
            // Return focus to the card that opened the player, otherwise it stays
            // stranded on the now-detached <video> and keyboard users lose their place.
            const trigger = activeCard;
            activeCard = null;
            if (trigger) {
                const target = $('a[href], button', trigger) || trigger;
                target.focus({ preventScroll: true });
            }
        });
        dialog.addEventListener('click', (event) => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            const outside = event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom;
            if (outside) closePlayer();
        });

        cards.forEach((card) => {
            const project = projectBySlug.get(card.dataset.project);
            if (!project?.video) return;

            // The click handler below opens the player, so this anchor's own
            // href only surfaces on middle-click, ctrl-click and as the no-JS
            // fallback. When it does surface it must not point somewhere
            // different from the player's "Open project" button, so take it
            // from the same field rather than duplicating it in the markup.
            if (project.externalUrl) card.href = project.externalUrl;

            const preview = document.createElement('video');
            preview.className = 'work-card__video';
            preview.muted = true;
            preview.loop = true;
            preview.playsInline = true;
            preview.preload = 'none';
            preview.poster = project.poster;
            preview.setAttribute('aria-hidden', 'true');
            preview.tabIndex = -1;
            card.prepend(preview);

            const playBadge = document.createElement('span');
            playBadge.className = 'work-card__play';
            playBadge.setAttribute('aria-hidden', 'true');
            playBadge.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M9 7.5 16 12l-7 4.5v-9Z" fill="currentColor" />
                </svg>
            `;
            card.append(playBadge);

            card.dataset.hasVideo = 'true';
            card.setAttribute('aria-haspopup', 'dialog');

            const loadPreview = () => {
                if (preview.dataset.loaded === 'true') return;
                preview.src = project.video;
                preview.dataset.loaded = 'true';
                preview.load();
            };
            const playPreview = () => {
                if (!canPreview) return;
                loadPreview();
                card.classList.add('is-previewing');
                const playback = preview.play();
                if (playback) {
                    playback.catch(() => card.classList.remove('is-previewing'));
                }
            };
            const stopPreview = () => {
                preview.pause();
                card.classList.remove('is-previewing');
            };

            preview.addEventListener('playing', () => card.classList.add('is-previewing'));
            preview.addEventListener('error', () => stopPreview());
            if (canPreview) {
                card.addEventListener('pointerenter', (event) => {
                    if (event.pointerType === 'mouse') playPreview();
                });
                card.addEventListener('pointerleave', stopPreview);
            }

            card.addEventListener('click', (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openPlayer(card, project);
            });
        });
    }

    /* -----------------------------------------------------------------------
       Work wall — parallax + project video/external-link behaviour.
       ----------------------------------------------------------------------- */
    function initWorkWall() {
        const cards = $$('#work-wall a.work-card[href]');
        if (!cards.length) return;
        initProjectVideos(cards);
        if (reducedMotion() || typeof IntersectionObserver !== 'function') return;

        cards.forEach((card) => {
            const factor = parseFloat(card.getAttribute('data-parallax')) || 0;
            const content = card.querySelector('.card-content');
            if (!content) return;
            const rec = { factor, content, target: 0, current: 0, raf: 0, inView: false };

            const paint = () => {
                content.style.transform = `scale(1.02) translateY(${rec.current.toFixed(2)}px)`;
            };
            const step = () => {
                rec.raf = 0;
                const delta = rec.target - rec.current;
                if (Math.abs(delta) < 0.05) {
                    rec.current = rec.target;
                    paint();
                    return;
                }
                rec.current += delta * 0.14;
                paint();
                rec.raf = requestAnimationFrame(step);
            };
            const schedule = () => {
                if (!rec.raf) rec.raf = requestAnimationFrame(step);
            };
            const update = (centerDist) => {
                const strength = Math.abs(rec.factor) * 620;
                rec.target = rec.inView
                    ? Math.max(-strength, Math.min(strength, -centerDist * rec.factor))
                    : 0;
                schedule();
            };

            rec.inView = true;
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    rec.inView = entry.isIntersecting;
                    if (!rec.inView) {
                        rec.target = 0;
                        schedule();
                        return;
                    }
                    const rect = entry.target.getBoundingClientRect();
                    const vh = window.innerHeight || 1;
                    update((rect.top + rect.height / 2 - vh / 2) / vh);
                });
            }, { rootMargin: '120px 0px', threshold: [0, 0.35, 0.7, 1] });
            io.observe(card);
            card._workParallax = { update, io };
        });

        let scrollRaf = 0;
        const updateVisibleCards = () => {
            scrollRaf = 0;
            const vh = window.innerHeight || 1;
            cards.forEach((card) => {
                const parallax = card._workParallax;
                if (!parallax) return;
                const rect = card.getBoundingClientRect();
                parallax.update((rect.top + rect.height / 2 - vh / 2) / vh);
            });
        };
        window.addEventListener('scroll', () => {
            if (!scrollRaf) scrollRaf = requestAnimationFrame(updateVisibleCards);
        }, { passive: true });
    }

    /* -----------------------------------------------------------------------
       Museum — 3D gallery folds + vertical ticker (same contract as the
       reference: three .fold-content rows scrolling in lockstep).
       ----------------------------------------------------------------------- */
    /* Photographs for the rotating "beyond the pixels" gallery, in display
       order. Any number works: the loop span is derived from this list's
       length, and each entry is repeated once so the scroll wraps seamlessly.

       These live in public/asset/images/ and are already sized down to 1400px
       wide. Do not drop 24-megapixel originals in here: each frame is shown at
       roughly 288x206 CSS pixels, and eight full-size phone photos would add
       ~28 MB to the download for no visible gain. Keep the whole set under
       about 1.5 MB. Resized copies of the originals are kept outside public/ in
       _originals/photos/. */
    const MUSEUM_FRAMES = [
        'asset/images/photo-01.jpg',
        'asset/images/photo-02.jpg',
        'asset/images/photo-03.jpg',
        'asset/images/photo-04.jpg',
        'asset/images/photo-05.jpg',
        'asset/images/photo-06.jpg',
        'asset/images/photo-07.jpg',
        'asset/images/photo-08.jpg',
    ];

    function initMuseumGallery() {
        const containers = [$('#content-top'), $('#content-center'), $('#content-bottom')];
        if (containers.some((c) => !c)) return;

        // Eager, not lazy. These columns are long and clipped, so a lazy
        // IntersectionObserver never sees most of the frames; the ones that did
        // resolve popped in blank as the ticker scrolled them into view. With a
        // small fixed set the whole gallery is ~1 MB, so just load it up front
        // and never show an empty frame.
        const images = [...MUSEUM_FRAMES, ...MUSEUM_FRAMES];
        containers.forEach((container) => {
            container.innerHTML = '';
            images.forEach((src) => {
                const div = document.createElement('div');
                div.className = 'ticker-image-wrapper';
                div.innerHTML = `<img src="${src}" alt="" decoding="async" fetchpriority="low">`;
                container.appendChild(div);
            });
        });

        if (reducedMotion()) {
            return; // static frames stay put
        }

        let yPos = 0;
        const scrollSpeed = 1.05;
        let tickerInView = true;
        let tickerRaf = 0;

        const getItemSpan = () => {
            const first = containers[1].firstElementChild;
            if (!first) return 0;
            const styles = window.getComputedStyle(containers[1]);
            const gap = parseFloat(styles.rowGap || styles.gap || '0');
            return first.getBoundingClientRect().height + (gap || 0);
        };

        const getLoopSpan = () => {
            const itemSpan = getItemSpan();
            return itemSpan ? itemSpan * MUSEUM_FRAMES.length : 0;
        };

        const wrapLoop = () => {
            const loopSpan = getLoopSpan();
            if (!loopSpan) return;
            while (yPos <= -loopSpan) yPos += loopSpan;
        };

        const tick = () => {
            tickerRaf = 0;
            if (!tickerInView) return;
            yPos -= scrollSpeed;
            wrapLoop();
            containers.forEach((c) => c.style.transform = `translate3d(0, ${yPos}px, 0)`);
            tickerRaf = requestAnimationFrame(tick);
        };

        const stage = $('.beyond-pixels-stage');
        if (stage && typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    tickerInView = entry.isIntersecting;
                    if (tickerInView && !tickerRaf) tickerRaf = requestAnimationFrame(tick);
                    else if (!tickerInView && tickerRaf) {
                        cancelAnimationFrame(tickerRaf);
                        tickerRaf = 0;
                    }
                });
            }, { rootMargin: '160px 0px' });
            io.observe(stage);
        } else {
            tickerRaf = requestAnimationFrame(tick);
        }

        window.addEventListener('resize', () => {
            wrapLoop();
            containers.forEach((c) => c.style.transform = `translate3d(0, ${yPos}px, 0)`);
        }, { passive: true });

        setTimeout(() => {
            if (!tickerRaf && tickerInView) tickerRaf = requestAnimationFrame(tick);
        }, 500);
    }

    function initMuseumFloat() {
        const wrapper = $('#stage-wrapper');
        if (!wrapper || reducedMotion() || !finePointer()) return;

        let raf = 0;
        let px = 0;
        let py = 0;
        let tx = 0;
        let ty = 0;
        let inView = false;

        document.addEventListener('mousemove', (e) => {
            const vh = window.innerHeight || 1;
            const vw = window.innerWidth || 1;
            tx = (e.clientX / vw - 0.5) * 2;
            ty = (e.clientY / vh - 0.5) * 2;
        }, { passive: true });

        function loop() {
            raf = 0;
            if (!inView) return;
            px += (tx - px) * 0.05;
            py += (ty - py) * 0.05;
            wrapper.style.transform =
                `rotateX(${(py * -4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
            raf = requestAnimationFrame(loop);
        }

        if (typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    inView = entry.isIntersecting;
                    if (inView && !raf) raf = requestAnimationFrame(loop);
                    else if (!inView && raf) {
                        cancelAnimationFrame(raf);
                        raf = 0;
                    }
                });
            }, { rootMargin: '200px 0px' });
            io.observe(wrapper);
        } else {
            inView = true;
            raf = requestAnimationFrame(loop);
        }
    }

    /* -----------------------------------------------------------------------
       Dappled-light shimmer on the hero canvas (decorative fallback shader).
       ----------------------------------------------------------------------- */
    function initDappledLight() {
        const canvas = $('#hero-dappled-canvas');
        if (!canvas || reducedMotion()) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const host = $('.hero-v2__dappled');
        if (!host) return;

        let W = 0;
        let H = 0;
        let DPR = 1;
        let raf = 0;
        let t = 0;
        let inView = false;

        const blobs = Array.from({ length: 6 }, (_, i) => ({
            x: (i * 0.31 + 0.08) % 1,
            y: 0.25 + ((i * 37) % 50) / 100,
            r: 90 + ((i * 53) % 130),
            speed: 0.12 + ((i * 17) % 30) / 100,
            phase: i * 1.7,
            alpha: 0.05 + ((i * 13) % 22) / 100
        }));

        function resize() {
            const rect = host.getBoundingClientRect();
            DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            W = Math.max(1, Math.round(rect.width * DPR));
            H = Math.max(1, Math.round(rect.height * DPR));
            canvas.width = W;
            canvas.height = H;
        }

        function tick() {
            raf = 0;
            if (!inView) return;
            t += 0.012;
            ctx.clearRect(0, 0, W, H);
            if (document.body.classList.contains('night-mode')) {
                ctx.globalCompositeOperation = 'overlay';
            } else {
                ctx.globalCompositeOperation = 'soft-light';
            }
            blobs.forEach((b) => {
                const x = (b.x + Math.sin(t * b.speed + b.phase) * 0.12) * W;
                const y = (b.y + Math.cos(t * b.speed * 0.8 + b.phase) * 0.1) * H;
                const r = b.r * DPR * (1 + Math.sin(t * 0.5 + b.phase) * 0.12);
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const warm = document.body.classList.contains('night-mode');
                g.addColorStop(0, warm ? 'rgba(160,200,255,0.55)' : 'rgba(255,214,150,0.5)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalCompositeOperation = 'source-over';
            raf = requestAnimationFrame(tick);
        }

        function start() {
            if (raf) return;
            resize();
            raf = requestAnimationFrame(tick);
        }

        function stop() {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
        }

        if (typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    inView = entry.isIntersecting;
                    if (inView) start();
                    else stop();
                });
            }, { rootMargin: '0px' });
            io.observe(host);
        } else {
            inView = true;
            start();
        }
        window.addEventListener('resize', resize, { passive: true });
    }

    /* -----------------------------------------------------------------------
       Reveal-on-scroll helper for containers flagged with [data-reveal].
       ----------------------------------------------------------------------- */
    function initReveals() {
        const els = $$('[data-reveal]');
        if (!els.length) return;
        if (reducedMotion() || typeof IntersectionObserver !== 'function') {
            els.forEach((el) => el.classList.add('is-inview'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-inview');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '40px 0px', threshold: 0.15 });
        els.forEach((el) => io.observe(el));
    }

    /* -----------------------------------------------------------------------
       Boot
       ----------------------------------------------------------------------- */
    function boot() {
        applyStoredTheme();
        initLoader();
        initCursor();
        initWorkWall();
        initMuseumGallery();
        initMuseumFloat();
        initFooterGrassAnimation();
        initDappledLight();
        initReveals();
        scanLazy(document);
    }

    onReady(boot);

    // Scan lazily-injected nodes (footer + anything appended later).
    if (typeof MutationObserver === 'function') {
        const mo = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches('[data-lazy-bg],[data-src]')) {
                        if (lazyObserver) lazyObserver.observe(node);
                        else if (node.hasAttribute('data-lazy-bg')) applyLazyBg(node);
                        else applyLazyImg(node);
                    }
                    if (node.querySelectorAll) scanLazy(node);
                });
            });
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.PortfolioHome = {
        getCurrentThemeName,
        applyStoredTheme,
        scanLazy
    };
})();