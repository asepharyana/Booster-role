export type ExistingRole = {
  id: string;
  name: string;
};

import { forbiddenRolePermissions } from "../config/permissions";
import { ValidationError, PermissionError } from "./errors";

export type ManagedRoleIdentity = {
  guildId: string;
  userId: string;
  roleId: string;
};

const forbiddenPermissions = new Set<string>(forbiddenRolePermissions);
const reservedRoleNames = new Set(["@everyone", "here", "everyone"]);

export function assertRoleNameIsAvailable(name: string, existingRoles: ExistingRole[]): void {
  const normalizedName = normalizeName(name);
  const hasUnmanagedRoleName = existingRoles.some((role) => normalizeName(role.name) === normalizedName);

  if (hasUnmanagedRoleName) {
    throw new ValidationError("Role name is already used by an existing server role");
  }
}

export function assertCanManageStoredRole(stored: ManagedRoleIdentity, requested: ManagedRoleIdentity): void {
  if (stored.guildId !== requested.guildId) {
    throw new PermissionError("Role is not bot-managed in this guild");
  }

  if (stored.userId !== requested.userId) {
    throw new PermissionError("Role is not owned by this user");
  }

  if (stored.roleId !== requested.roleId) {
    throw new PermissionError("Role is not bot-managed for this user");
  }
}

export function assertCosmeticPermissions(permissions: string[]): void {
  const hasDangerousPermission = permissions.some((permission) => forbiddenPermissions.has(permission));

  if (hasDangerousPermission) {
    throw new PermissionError("Booster roles must be cosmetic and cannot grant elevated permissions");
  }
}

export function assertRolePositionIsSafe(targetPosition: number, anchorPosition: number): void {
  if (targetPosition >= anchorPosition) {
    throw new PermissionError("Role position is not safe for a cosmetic booster role");
  }
}

export function validateRoleName(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length < 3 || trimmedName.length > 32) {
    throw new ValidationError("Role name must be 3-32 characters");
  }

  if (reservedRoleNames.has(normalizeName(trimmedName)) || trimmedName.includes("@")) {
    throw new ValidationError("Role name is not allowed");
  }

  return trimmedName;
}

export function normalizeHexColor(color: string): `#${string}` {
  const normalizedColor = color.trim().toUpperCase();

  if (!/^#[0-9A-F]{6}$/.test(normalizedColor)) {
    throw new ValidationError("Color must be a hex value like #AABBCC");
  }

  return normalizedColor as `#${string}`;
}

export function normalizeOptionalHexColor(color: string | null): `#${string}` | null {
  return color ? normalizeHexColor(color) : null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
