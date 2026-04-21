/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Public-site pages are rendered with SSG + ISR. The pages-api app at
  // PAGES_API_URL is the source of truth; the fetch calls in app/[slug]/
  // page.tsx set their own revalidate windows.
  transpilePackages: ['@packages/blocks-ui', '@packages/blocks-contract'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
