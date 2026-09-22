import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./custom.css";

// Injected at build time by `vite.define` in ../config.ts. Empty everywhere
// but the production deploy, which is what keeps local and fork builds out of
// the numbers — and lets Rollup drop the posthog-js chunk entirely from them.
declare const __POSTHOG_KEY__: string;

export default {
  extends: DefaultTheme,

  enhanceApp({ router }) {
    if (import.meta.env.SSR || !__POSTHOG_KEY__) return;

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(__POSTHOG_KEY__, {
        api_host: "https://us.i.posthog.com",

        // Cookieless, so the site needs no consent banner. The cost is real:
        // memory persistence resets on every full page load, so a returning
        // reader counts as a new person — traffic shape stays honest, unique
        // visitors read high. Autocapture stays on, though: knowing which
        // page precedes a click on the install command is the point of using
        // PostHog here rather than a bare pageview counter.
        persistence: "memory",
        person_profiles: "identified_only",
        disable_session_recording: true,

        // VitePress is a single-page app, so the library's own pageview
        // capture would only ever fire on the first load. The initial view is
        // captured below; every later one comes from the router hook.
        capture_pageview: false,
      });

      posthog.capture("$pageview");

      const previous = router.onAfterRouteChange;
      router.onAfterRouteChange = (to) => {
        previous?.(to);
        posthog.capture("$pageview");
      };
    });
  },
} satisfies Theme;
