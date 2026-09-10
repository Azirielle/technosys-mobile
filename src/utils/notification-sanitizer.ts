/**
 * Utility to sanitize raw markdown strings and extract structured metadata
 * for enterprise notifications and announcement cards.
 */

export interface ParsedNotification {
  category: string;
  categoryColor: string;
  categoryBgLight: string;
  categoryBgDark: string;
  title: string;
  summary: string;
  reviewer?: string;
  statusTag?: string;
  actionLabel?: string;
  actionType: 'chat' | 'dispatch' | 'announcement' | 'tool' | 'general';
}

export function sanitizeNotification(
  rawTitle: string,
  rawContent: string,
  rawType: 'hr' | 'help' | 'admin' | 'dispatch' | 'tool' = 'admin',
  ticketCategory?: string
): ParsedNotification {
  let content = (rawContent || '').trim();
  let title = rawTitle || 'System Notification';
  let category = ticketCategory || 'Update';
  let statusTag: string | undefined = undefined;
  let reviewer: string | undefined = undefined;
  let actionLabel: string | undefined = undefined;
  let actionType: 'chat' | 'dispatch' | 'announcement' | 'tool' | 'general' = 'general';

  // 1. Detect and parse Ticket Decision formats
  const isApproved = content.includes('[DECISION: APPROVED') || content.includes('TICKET APPROVED');
  const isRefused = content.includes('[DECISION: REFUSED') || content.includes('REQUEST REFUSED');

  if (isApproved) {
    statusTag = 'Approved';
    actionLabel = 'View Resolution';
    actionType = 'chat';
    category = ticketCategory || 'HR Ticket';
  } else if (isRefused) {
    statusTag = 'Refused';
    actionLabel = 'View Appeal';
    actionType = 'chat';
    category = ticketCategory || 'HR Ticket';
  } else if (rawType === 'hr' || rawType === 'help') {
    statusTag = 'Active';
    actionLabel = 'Open Ticket';
    actionType = 'chat';
    category = ticketCategory || 'HR Support';
  } else if (rawType === 'dispatch') {
    statusTag = 'New';
    actionLabel = 'View Dispatch';
    actionType = 'dispatch';
    category = 'Dispatch';
  } else if (rawType === 'tool') {
    statusTag = 'Equipment';
    actionLabel = 'View Inventory';
    actionType = 'tool';
    category = 'Tools';
  } else {
    actionLabel = 'Read More';
    actionType = 'announcement';
    category = 'Announcement';
  }

  // Extract Reviewer if present (e.g. **Reviewed By:** HR Staff)
  const reviewerMatch = content.match(/\*\*Reviewed By:\*\*\s*([^\n\r]+)/i);
  if (reviewerMatch) {
    reviewer = reviewerMatch[1].trim();
  }

  // Extract Resolution Notes if present
  const resolutionMatch = content.match(/\*\*Resolution Notes?:\*\*\s*([^\n\r*]+)/i);
  let summary = '';
  if (resolutionMatch) {
    summary = resolutionMatch[1].trim();
  } else {
    // Strip markdown formatting, emojis, and bracketed tags
    summary = content
      .replace(/\[DECISION:[^\]]+\]/gi, '')
      .replace(/\*\*\[[^\]]+\]\*\*/gi, '')
      .replace(/\*\*Resolution Notes?:\*\*/gi, '')
      .replace(/\*\*Reviewed By:\*\*[^\n\r]+/gi, '')
      .replace(/\*\*Decision Date:\*\*[^\n\r]+/gi, '')
      .replace(/\*\*Reason:\*\*/gi, '')
      .replace(/\*\*/g, '')
      .replace(/[🎉⚠️✅❌📌ℹ️]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Clean title
  title = title
    .replace(/\*\*/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  // Fallback summary if cleaned content became blank
  if (!summary) {
    if (isApproved) summary = 'HR has approved and completed your request.';
    else if (isRefused) summary = 'HR has reviewed and closed this ticket.';
    else summary = 'Tap to view details and updates.';
  }

  // Determine category color accents
  let categoryColor = '#3B82F6';
  let categoryBgLight = '#EFF6FF';
  let categoryBgDark = 'rgba(59, 130, 246, 0.2)';

  if (category.toLowerCase().includes('payroll')) {
    categoryColor = '#10B981';
    categoryBgLight = '#ECFDF5';
    categoryBgDark = 'rgba(16, 185, 129, 0.2)';
  } else if (category.toLowerCase().includes('dtr') || category.toLowerCase().includes('time')) {
    categoryColor = '#6366F1';
    categoryBgLight = '#EEF2FF';
    categoryBgDark = 'rgba(99, 102, 241, 0.2)';
  } else if (category.toLowerCase().includes('leave')) {
    categoryColor = '#F59E0B';
    categoryBgLight = '#FFFBEB';
    categoryBgDark = 'rgba(245, 158, 11, 0.2)';
  } else if (category.toLowerCase().includes('dispatch')) {
    categoryColor = '#3B82F6';
    categoryBgLight = '#EFF6FF';
    categoryBgDark = 'rgba(59, 130, 246, 0.2)';
  } else if (category.toLowerCase().includes('tool') || category.toLowerCase().includes('equipment')) {
    categoryColor = '#EC4899';
    categoryBgLight = '#FDF2F8';
    categoryBgDark = 'rgba(236, 72, 153, 0.2)';
  } else if (isRefused) {
    categoryColor = '#EF4444';
    categoryBgLight = '#FEF2F2';
    categoryBgDark = 'rgba(239, 68, 68, 0.2)';
  }

  return {
    category,
    categoryColor,
    categoryBgLight,
    categoryBgDark,
    title,
    summary,
    reviewer,
    statusTag,
    actionLabel,
    actionType,
  };
}

export function formatRelativeTime(dateInput: string | number | Date): string {
  if (!dateInput) return 'Just now';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
