// Public demo account for the one-tap login. Values come from build-time env
// (VITE_DEMO_EMAIL / VITE_DEMO_PASSWORD). When they are not set, the one-tap
// button is hidden and no demo credential is included in the browser bundle.
export const DEMO_EMAIL: string = import.meta.env.VITE_DEMO_EMAIL ?? "";
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? "";
export const DEMO_ENABLED = Boolean(DEMO_EMAIL && DEMO_PASSWORD);
