export const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";
