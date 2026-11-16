// Turns a profile's role and level into the job title people use ("Senior technician", "Helper").
type ProfileLike = { role?: string | null; technician_level?: string | null } | null | undefined;

export function jobTitle(profile: ProfileLike): string {
  if (!profile) return '';
  const level = profile.technician_level || profile.role;
  if (level === 'senior') return 'Senior technician';
  if (level === 'helper') return 'Helper';
  if (level === 'technician') return 'Technician';
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : '';
}
