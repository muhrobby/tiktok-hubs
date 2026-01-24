/**
 * Global middleware that runs on every navigation
 * Initializes auth state and handles token refresh
 *
 * This ensures:
 * 1. Auth state is initialized on first load
 * 2. Tokens are refreshed when needed
 * 3. Public pages (like login) are accessible without auth
 */

const PUBLIC_ROUTES = ["/login", "/unauthorized"];

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip on server side
  if (import.meta.server) return;

  const { isAuthenticated, isLoading, initAuth, refreshToken, fetchUser } = useAuth();

  // Initialize auth state on first navigation (or if still loading)
  if (isLoading.value) {
    await initAuth();
  }

  // If going to login page and already authenticated, redirect to home
  if (to.path === "/login" && isAuthenticated.value) {
    const redirect = to.query.redirect as string | undefined;
    return navigateTo(redirect || "/");
  }

  // For public routes, no further checks needed
  if (PUBLIC_ROUTES.includes(to.path)) {
    return;
  }

  // For protected routes, try to refresh token if not authenticated
  // This handles the case where the access token expired but refresh token is still valid
  if (!isAuthenticated.value) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Token refreshed successfully, fetch user data
      await fetchUser();
    }
  }

  // Note: The actual auth check for protected routes is handled by the named 'auth' middleware
  // This global middleware just ensures state is initialized
});
