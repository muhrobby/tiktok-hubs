/**
 * Redirect Middleware
 * Redirects old store/account URLs to new unified page
 */
export default defineNuxtRouteMiddleware((to) => {
  const oldRoutes = ['/stores', '/accounts', '/tiktok-accounts'];
  
  if (oldRoutes.includes(to.path)) {
    return navigateTo('/tiktok-store-accounts', { redirectCode: 301 });
  }
});
