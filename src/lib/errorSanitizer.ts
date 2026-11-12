/**
 * Mobile Client Error Sanitizer
 * Transforms internal Supabase, PostgREST, database, and network errors
 * into concise, human-friendly messages without exposing database tables,
 * internal schema names, or IT stack traces to mobile users.
 */

export function formatMobileError(
  err: unknown,
  defaultMessage: string = 'Unable to complete request. Please try again.'
): string {
  if (!err) return defaultMessage;

  const raw = typeof err === 'string' ? err : (err as any)?.message || String(err);
  const text = raw.toLowerCase();

  // 1. Database Unique Constraints / Duplicates
  if (
    text.includes('duplicate key') ||
    text.includes('violates unique constraint') ||
    text.includes('already exists') ||
    text.includes('23505')
  ) {
    if (text.includes('time_logs') || text.includes('punch') || text.includes('dtr')) {
      return 'An attendance punch for this session has already been recorded.';
    }
    if (text.includes('email') || text.includes('users_email')) {
      return 'An account with this email address is already registered.';
    }
    if (text.includes('phone') || text.includes('contact')) {
      return 'A profile with this contact number already exists.';
    }
    if (text.includes('leave') || text.includes('leaves')) {
      return 'A leave request for this date range has already been submitted.';
    }
    if (text.includes('schedule')) {
      return 'A dispatch schedule already exists for this slot.';
    }
    return 'This entry already exists in the system.';
  }

  // 2. Row-Level Security (RLS) & Access Permissions
  if (
    text.includes('row level security') ||
    text.includes('violates row-level security') ||
    text.includes('violates rls') ||
    text.includes('permission denied') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('42501')
  ) {
    return 'Permission denied. You do not have authorization to perform this action.';
  }

  // 3. Foreign Key / Referential Integrity
  if (
    text.includes('violates foreign key constraint') ||
    text.includes('foreign key violation') ||
    text.includes('is still referenced from table') ||
    text.includes('23503')
  ) {
    return 'This action cannot be completed because related active records still exist.';
  }

  // 4. Missing Required Fields
  if (
    text.includes('violates not-null constraint') ||
    text.includes('null value in column') ||
    text.includes('23502')
  ) {
    return 'Please fill in all required information before submitting.';
  }

  // 5. Authentication & Session Errors
  if (
    text.includes('jwt expired') ||
    text.includes('session expired') ||
    text.includes('token is expired') ||
    text.includes('invalid claim')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (
    text.includes('invalid_credentials') ||
    text.includes('invalid login credentials') ||
    text.includes('invalid email or password')
  ) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }

  // 6. Network & Connection Failures
  if (
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('network error') ||
    text.includes('unknownhostexception') ||
    text.includes('unable to resolve host') ||
    text.includes('timeout') ||
    text.includes('connection refused') ||
    text.includes('sockettimeout')
  ) {
    return 'Network connection problem. Please verify your internet connection and try again.';
  }

  // 7. General PostgREST / Database Syntax & Internal Errors
  if (
    text.includes('pgrst') ||
    text.includes('relation "') ||
    text.includes('table "') ||
    text.includes('column "') ||
    text.includes('syntax error at or near') ||
    text.includes('postgresql') ||
    text.includes('postgres') ||
    text.includes('database error') ||
    text.includes('database transaction failed') ||
    text.includes('500 internal')
  ) {
    return 'Unable to process your request right now. Please try again in a few moments.';
  }

  // 8. Return the raw message if it is clean and does not contain technical jargon
  return raw;
}
