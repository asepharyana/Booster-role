import type { ColorResolvable, Guild, Role } from "discord.js";
import type { RoleRepository } from "./boosterRoleService";

export class DiscordRoleRepository implements RoleRepository {
  constructor(private readonly guild: Guild, private readonly anchorRoleId: string | null) {}

  async listRoles() {
    await this.guild.roles.fetch();
    return this.guild.roles.cache.map((role) => ({ id: role.id, name: role.name }));
  }

  async createRole(input: { name: string; color: string | null; permissions: string[]; position: number }): Promise<{ id: string }> {
    const role = await this.guild.roles.create({
      name: input.name,
      colors: toDiscordColors(input.color),
      permissions: 0n
    });

    await role.setPosition(await this.resolvePosition(input.position));
    return { id: role.id };
  }

  async updateRole(roleId: string, input: { name?: string; color?: string | null; icon?: string | null }): Promise<void> {
    const role = await this.fetchRole(roleId);
    await role.edit({
      name: input.name,
      colors: input.color === undefined ? undefined : toDiscordColors(input.color),
      icon: input.icon === undefined ? undefined : input.icon
    });
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const member = await this.guild.members.fetch(userId);
    await member.roles.add(roleId);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.fetchRole(roleId);
    await role.delete();
  }

  private async resolvePosition(fallbackPosition: number): Promise<number> {
    if (!this.anchorRoleId) return fallbackPosition;

    const anchor = await this.fetchRole(this.anchorRoleId);
    return Math.max(anchor.position - 1, 1);
  }

  private async fetchRole(roleId: string): Promise<Role> {
    const role = await this.guild.roles.fetch(roleId);
    if (!role) throw new Error("Discord role not found");
    return role;
  }
}

function toDiscordColors(color: string | null): { primaryColor: ColorResolvable } | undefined {
  return color === null ? undefined : { primaryColor: color as ColorResolvable };
}
