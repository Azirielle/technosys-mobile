// Plain label and colours for a shift's status (attendance_logs.status: active / pending_close / closed).
export type ShiftBadge = { label: string; color: string; bg: string };

export function shiftBadge(status: string | null | undefined, isDark: boolean): ShiftBadge {
  if (status === 'closed') {
    return { label: 'Done', color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' };
  }
  if (status === 'pending_close') {
    return { label: 'HR checking', color: '#B45309', bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB' };
  }
  return { label: 'Working', color: '#2563EB', bg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' };
}
