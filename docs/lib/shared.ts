export const appName = 'Daltoon-UI';
export const appTagline = 'Advanced web panel for managing Xray-core servers';

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

// The Daltoon-UI product repository — used for the navbar GitHub link,
// build-time star/release stats, and install commands.
export const productRepo = {
  user: 'mdaltoon10',
  repo: 'D-UI',
  branch: 'main',
};

// Where these docs live in the Daltoon-UI monorepo — used for "Edit on GitHub" links.
export const gitConfig = {
  user: 'mdaltoon10',
  repo: 'D-UI',
  branch: 'main',
  docsDir: 'docs/content/docs',
};

export const productRepoUrl = `https://github.com/${productRepo.user}/${productRepo.repo}`;

// AI-generated interactive wiki of the Daltoon-UI codebase.
export const deepWikiUrl = `https://deepwiki.com/${productRepo.user}/${productRepo.repo}`;

// Official Daltoon-UI community channel on Telegram (announcements & support).
export const telegramChannel = 'mDaltoon';
export const telegramChannelUrl = `https://t.me/${telegramChannel}`;

// Support the developer — donation page with funding goals/targets.
export const donateUrl = 'https://www.buymeacoffee.com/mDaltoon';

// Public site origin, used for metadataBase / canonical URLs / OG images.
// Defaults to the production domain, so the env var is optional. Use `||` (not
// `??`) so an empty string — e.g. an unset `${{ vars.NEXT_PUBLIC_SITE_URL }}`
// in CI — also falls back instead of shipping a blank origin.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.daltoon.dev';
