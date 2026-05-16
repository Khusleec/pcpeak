/** Role names from core-api `roles` table (JWT /auth/me exposes `role`). */
/** `admin` is the project superuser: server treats it as full god-mode (see core-api auth middleware). */
export function isAdminRole(role) {
  return typeof role === 'string' && role.toLowerCase() === 'admin';
}

export function isModeratorRole(role) {
  return typeof role === 'string' && role.toLowerCase() === 'moderator';
}

export function isStaffRole(role) {
  return isAdminRole(role) || isModeratorRole(role);
}
