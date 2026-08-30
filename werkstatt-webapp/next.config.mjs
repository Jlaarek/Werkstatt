/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Statischer Export: die App hat keine Server-Routen/API-Routen (Supabase
  // wird komplett client-seitig im Browser angesprochen), deshalb reicht ein
  // einfacher Ordner mit HTML/CSS/JS - das lässt sich auf Netlify (und quasi
  // jedem anderen Hosting) ohne Sonderkonfiguration zuverlässig ausliefern.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
