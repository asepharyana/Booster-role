import { assertBoostEligibility } from "../domain/boostEligibility";
import {
  assertRoleNameIsAvailable,
  assertRolePositionIsSafe,
  normalizeHexColor,
  validateRoleName,
  type ExistingRole
} from "../domain/roleGuards";

export type BoosterRoleRecord = {
  guildId: string;
  userId: string;
  roleId: string;
  name: string;
  color: string | null;
  createdAt: number;
  updatedAt: number;
};

export type BoosterRoleStore = {
  findByUser(guildId: string, userId: string): Promise<BoosterRoleRecord | null>;
  create(record: BoosterRoleRecord): Promise<void>;
  delete(guildId: string, userId: string): Promise<void>;
};

export type RoleRepository = {
  listRoles(): Promise<ExistingRole[]>;
  createRole(input: { name: string; color: string | null; permissions: string[]; position: number }): Promise<{ id: string }>;
  updateRole(roleId: string, input: { name?: string; color?: string | null; icon?: string | null }): Promise<void>;
  deleteRole(roleId: string): Promise<void>;
};

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
    verifiedBoostCount: number | null;
  }): Promise<BoosterRoleRecord> {
    const { guildId, userId, verifiedBoostCount } = input;
    assertBoostEligibility({ verifiedBoostCount });

    const existingRecord = await this.store.findByUser(guildId, userId);
    if (existingRecord) {
      throw new Error("User already has a booster role");
    }

    const name = validateRoleName(input.name);
    const color = input.color ? normalizeHexColor(input.color) : null;
    assertRoleNameIsAvailable(name, await this.roles.listRoles());

    const position = this.options.anchorPosition - 1;
    assertRolePositionIsSafe(position, this.options.anchorPosition);

    const role = await this.roles.createRole({ name, color, permissions: [], position });
    const timestamp = this.now();
    const record = {
      guildId,
      userId,
      roleId: role.id,
      name,
      color,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.store.create(record);
    return record;
  }

  async renameRole(input: { guildId: string; userId: string; name: string }): Promise<void> {
    const { guildId, userId } = input;
    const record = await this.getUserRecord(guildId, userId);
    const name = validateRoleName(input.name);
    assertRoleNameIsAvailable(name, (await this.roles.listRoles()).filter((role) => role.id !== record.roleId));
    await this.roles.updateRole(record.roleId, { name });
  }

  async recolorRole(input: { guildId: string; userId: string; color: string }): Promise<void> {
    const { guildId, userId, color } = input;
    const record = await this.getUserRecord(guildId, userId);
    await this.roles.updateRole(record.roleId, { color: normalizeHexColor(color) });
  }

  async setRoleIcon(input: { guildId: string; userId: string; icon: RoleIcon }): Promise<void> {
    const { guildId, userId, icon } = input;
    const record = await this.getUserRecord(guildId, userId);
    this.validateRoleIcon(icon);
    await this.roles.updateRole(record.roleId, { icon: icon.dataUri });
  }

  async deleteRole(input: { guildId: string; userId: string }): Promise<void> {
    const { guildId, userId } = input;
    const record = await this.getUserRecord(guildId, userId);
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

  private validateRoleIcon(icon: RoleIcon): void {
    if (!icon.contentType.startsWith("image/")) {
      throw new Error("Role icon must be an image");
    }

    if (icon.size > (this.options.maxIconBytes ?? 512_000)) {
      throw new Error("Role icon is too large");
    }
  }

  private async getUserRecord(guildId: string, userId: string): Promise<BoosterRoleRecord> {
    const record = await this.store.findByUser(guildId, userId);
    if (!record) {
      throw new Error("No booster role found for this user");
    }
    return record;
  }
}
