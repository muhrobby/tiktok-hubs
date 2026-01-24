/**
 * Composable untuk formatting helpers
 */

import { formatDistanceToNow, format } from 'date-fns'

export const useFormatters = () => {
  /**
   * Format number dengan thousands separator
   */
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('id-ID').format(value)
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return '-'
    }
  }

  /**
   * Format date to readable string
   */
  const formatDate = (dateString: string | null | undefined, formatStr: string = 'dd MMM yyyy HH:mm'): string => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), formatStr)
    } catch {
      return '-'
    }
  }

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      SUCCESS: 'green',
      RUNNING: 'blue',
      FAILED: 'red',
      SKIPPED: 'amber',
      connected: 'green',
      disconnected: 'red',
      pending: 'amber'
    }
    return statusMap[status] || 'gray'
  }

  return {
    formatNumber,
    formatRelativeTime,
    formatDate,
    getStatusColor
  }
}
