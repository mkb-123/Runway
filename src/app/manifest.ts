import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath =
  process.env.NODE_ENV === "production" && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}`
    : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Runway",
    short_name: "Runway",
    description: "UK household net worth tracker and financial planner.",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: `${basePath}/icons/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
