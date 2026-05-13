/** Role names from core-api `roles` table (JWT /auth/me exposes `role`). */
export function isAdminRole(role) {
  return typeof role === 'string' && role.toLowerCase() === 'admin';
}

export function isModeratorRole(role) {
  return typeof role === 'string' && role.toLowerCase() === 'moderator';
}

export function isStaffRole(role) {
  return isAdminRole(role) || isModeratorRole(role);
}
