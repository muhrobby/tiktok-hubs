/**
 * Health check endpoint untuk Docker health monitoring
 */
export default defineEventHandler(() => {
  return {
    status: 'ok',
    service: 'frontend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }
})
