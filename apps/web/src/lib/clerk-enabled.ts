/**
 * Clerk is optional. Without both keys the app runs open (local dev); in production,
 * lib/auth.ts then refuses every mutation instead of silently allowing them.
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is inlined at build time (Dockerfile ARG); CLERK_SECRET_KEY is runtime.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
