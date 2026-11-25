export const BRAND = {
  blue: '#1E3A8A',
  accentBlue: '#2563EB',
  yellow: '#FBBF24',
  green: '#10B981',
  red: '#EF4444',
};

export interface CompanyPolicy {
  id: string;
  title: string;
  category: 'legal' | 'field_ops' | 'hr_attendance' | 'inventory' | 'executive' | string;
  version: string;
  effective_date: string;
  target_audience: string;
  summary: string;
  content_markdown: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PolicyReaderModalProps {
  visible: boolean;
  policy: CompanyPolicy | null;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  onClose: () => void;
  onAcknowledge?: (policyId: string, version: string) => Promise<boolean>;
  readOnly?: boolean;
}

export interface CategoryMeta {
  label: string;
  icon: 'file-text' | 'shield' | 'clock' | 'tool' | 'award' | 'file';
  color: string;
  bg: string;
}

export function getCategoryMeta(cat: string, isDark: boolean): CategoryMeta {
  switch (cat) {
    case 'legal':
      return { label: 'App rules', icon: 'file-text', color: '#3B82F6', bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' };
    case 'field_ops':
      return { label: 'Safety', icon: 'shield', color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' };
    case 'hr_attendance':
      return { label: 'Attendance', icon: 'clock', color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' };
    case 'inventory':
      return { label: 'Tools', icon: 'tool', color: '#06B6D4', bg: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF' };
    case 'executive':
      return { label: 'Company rules', icon: 'award', color: '#8B5CF6', bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' };
    default:
      return { label: 'Policy', icon: 'file', color: '#64748B', bg: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F8FAFC' };
  }
}
