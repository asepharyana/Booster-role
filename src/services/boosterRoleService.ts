import { assertBoostEligibility } from "../domain/boostEligibility";
import {
  assertRoleNameIsAvailable,
  assertCanManageStoredRole,
  assertCosmeticPermissions,
  assertRolePositionIsSafe,
  normalizeHexColor,
  normalizeOptionalHexColor,
  validateRoleName,
  type ManagedRoleIdentity
} from "../domain/roleGuards";
import { ValidationError, NotFoundError } from "../domain/errors";

import type { BoosterRoleRecord, BoosterRoleStore } from "./drizzleBoosterRoleStore";
import type { RoleRepository } from "./discordRoleRepository";

// Re-export for consumers that import from this module
export type { BoosterRoleRecord, BoosterRoleStore };
export type { RoleRepository } from "./discordRoleRepository";

export type RoleIcon = {
  contentType: string;
  size: number;
  dataUri: string;
};

export type BoosterRoleServiceOptions = {
  anchorPosition: number;
  maxIconBytes?: number;
  now?: () => number;
};

export class BoosterRoleService {
  private readonly now: () => number;

  constructor(
    private readonly store: BoosterRoleStore,
    private readonly roles: RoleRepository,
    private readonly options: BoosterRoleServiceOptions
  ) {
    this.now = options.now ?? Date.now;
  }

  async claimRole(input: {
    guildId: string;
    userId: string;
    name: string;
    color: string | null;
    color2?: string | null;
    icon?: RoleIcon | null;
    isBoosting: boolean;
  }): Promise<BoosterRoleRecord> {
    const { guildId, userId, isBoosting } = input;
    assertBoostEligibility({ isBoosting });

    const existingRecord = await this.store.findByUser(guildId, userId);
    if (existingRecord) {
      throw new ValidationError("User already has a booster role");
    }

    const name = validateRoleName(input.name);
    const color = normalizeOptionalHexColor(input.color);
    const color2 = normalizeOptionalHexColor(input.color2 ?? null);
    const colors = resolveGradientColors(color, color2);
    assertRoleNameIsAvailable(name, await this.roles.listRoles());
    assertCosmeticPermissions([]); // booster roles always start with no permissions

    const position = this.options.anchorPosition - 1;
    assertRolePositionIsSafe(position, this.options.anchorPosition);

    const role = await this.roles.createRole({ name, color, colors, permissions: [], position });
    let assigned = false;

    try {
      if (input.icon) {
        this.validateRoleIcon(input.icon);
        await this.roles.updateRole(role.id, { icon: input.icon.dataUri });
      }

      await this.roles.assignRole(userId, role.id);
      assigned = true;

      const timestamp = this.now();
      const record = {
        guildId,
        userId,
        roleId: role.id,
        name,
        color,
        color2,
        icon: input.icon?.dataUri ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await this.store.create(record);
      return record;
    } catch (error) {
      await this.rollbackClaim({ guildId, userId, roleId: role.id, assigned });
      throw error;
    }
  }

  async renameRole(input: { guildId: string; userId: string; name: string }): Promise<void> {
    const { guildId, userId } = input;
    const record = await this.getUserRecord(guildId, userId);
    assertCanManageStoredRole(this.identity(record), { guildId, userId, roleId: record.roleId });
    const name = validateRoleName(input.name);
    assertRoleNameIsAvailable(name, (await this.roles.listRoles()).filter((role) => role.id !== record.roleId));
    await this.roles.updateRole(record.roleId, { name });
    await this.store.update(guildId, userId, { name, updatedAt: this.now() });
  }

  async recolorRole(input: { guildId: string; userId: string; color: string; color2?: string | null }): Promise<void> {
    const { guildId, userId, color, color2 } = input;
    const record = await this.getUserRecord(guildId, userId);
    assertCanManageStoredRole(this.identity(record), { guildId, userId, roleId: record.roleId });
    const primaryColor = normalizeHexColor(color);
    const secondaryColor = normalizeOptionalHexColor(color2 ?? null);
    const colors = resolveGradientColors(primaryColor, secondaryColor);
    await this.roles.updateRole(record.roleId, { colors });
    await this.store.update(guildId, userId, { color: primaryColor, color2: secondaryColor, updatedAt: this.now() });
  }

  async setRoleIcon(input: { guildId: string; userId: string; icon: RoleIcon }): Promise<void> {
    const { guildId, userId, icon } = input;
    const record = await this.getUserRecord(guildId, userId);
    assertCanManageStoredRole(this.identity(record), { guildId, userId, roleId: record.roleId });
    this.validateRoleIcon(icon);
    await this.roles.updateRole(record.roleId, { icon: icon.dataUri });
    await this.store.update(guildId, userId, { icon: icon.dataUri, updatedAt: this.now() });
  }

  async deleteRole(input: { guildId: string; userId: string }): Promise<void> {
    const { guildId, userId } = input;
    const record = await this.getUserRecord(guildId, userId);
    assertCanManageStoredRole(this.identity(record), { guildId, userId, roleId: record.roleId });
    await this.roles.deleteRole(record.roleId);
    await this.store.delete(guildId, userId);
  }

  async removeRoleForLostBoost(input: { guildId: string; userId: string }): Promise<void> {
    const { guildId, userId } = input;
    const record = await this.store.findByUser(guildId, userId);
    if (!record) return;

    await this.roles.deleteRole(record.roleId);
    await this.store.delete(guildId, userId);
  }

  private async rollbackClaim(input: { guildId: string; userId: string; roleId: string; assigned: boolean }): Promise<void> {
    if (input.assigned) {
      await ignoreRollbackError(() => this.roles.removeRole(input.userId, input.roleId));
    }

    await ignoreRollbackError(() => this.roles.deleteRole(input.roleId));
    await ignoreRollbackError(() => this.store.delete(input.guildId, input.userId));
  }

  private validateRoleIcon(icon: RoleIcon): void {
    if (!icon.contentType.startsWith("image/")) {
      throw new ValidationError("Role icon must be an image");
    }

    if (icon.size > (this.options.maxIconBytes ?? 512_000)) {
      throw new ValidationError("Role icon is too large");
    }
  }

  private async getUserRecord(guildId: string, userId: string): Promise<BoosterRoleRecord> {
    const record = await this.store.findByUser(guildId, userId);
    if (!record) {
      throw new NotFoundError("No booster role found for this user");
    }
    return record;
  }

  private identity(record: BoosterRoleRecord): ManagedRoleIdentity {
    return { guildId: record.guildId, userId: record.userId, roleId: record.roleId };
  }
}

async function ignoreRollbackError(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
  }
}

function resolveGradientColors(color: string | null, color2: string | null): { primaryColor: string; secondaryColor?: string } | null {
  if (!color) return null;
  if (color2) {
    return { primaryColor: color, secondaryColor: color2 };
  }
  return { primaryColor: color };
}
