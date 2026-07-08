import { describe, expect, test } from "bun:test";
import { BoosterRoleService } from "./boosterRoleService";
import type { BoosterRoleRecord, BoosterRoleUpdate } from "./drizzleBoosterRoleStore";
import type { RoleRepository } from "./discordRoleRepository";

class MemoryRoleStore {
  private records = new Map<string, BoosterRoleRecord>();

  async findByUser(guildId: string, userId: string): Promise<BoosterRoleRecord | null> {
    return this.records.get(`${guildId}:${userId}`) ?? null;
  }

  async findByGuild(guildId: string): Promise<BoosterRoleRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.guildId === guildId);
  }

  async create(record: BoosterRoleRecord): Promise<void> {
    this.records.set(`${record.guildId}:${record.userId}`, record);
  }

  async update(guildId: string, userId: string, changes: BoosterRoleUpdate): Promise<void> {
    const key = `${guildId}:${userId}`;
    const record = this.records.get(key);
    if (!record) return;
    this.records.set(key, { ...record, ...changes });
  }

  async delete(guildId: string, userId: string): Promise<void> {
    this.records.delete(`${guildId}:${userId}`);
  }
}

class FailingCreateRoleStore extends MemoryRoleStore {
  async create(): Promise<void> {
    throw new Error("Database insert failed");
  }
}

class FakeRoleRepository implements RoleRepository {
  roles = new Map<string, { id: string; name: string; color: string | null; colors?: { primaryColor: string; secondaryColor?: string; tertiaryColor?: string } | null; permissions: string[]; position: number; icon?: string | null }>();
  deletedRoleIds: string[] = [];
  assignedRoles: Array<{ userId: string; roleId: string }> = [];
  removedRoles: Array<{ userId: string; roleId: string }> = [];

  constructor(initialRoles = [{ id: "existing-vip", name: "VIP", permissions: [], position: 1, color: null }]) {
    for (const role of initialRoles) {
      this.roles.set(role.id, role);
    }
  }

  async listRoles() {
    return [...this.roles.values()];
  }

  async createRole(input: { name: string; color: string | null; colors?: { primaryColor: string; secondaryColor?: string; tertiaryColor?: string } | null; permissions: string[]; position: number }) {
    const id = `created-${this.roles.size + 1}`;
    this.roles.set(id, { id, name: input.name, color: input.color, colors: input.colors, permissions: input.permissions, position: input.position });
    return { id };
  }

  async updateRole(roleId: string, input: { name?: string; color?: string | null; colors?: { primaryColor: string; secondaryColor?: string; tertiaryColor?: string } | null; icon?: string | null }) {
    const role = this.roles.get(roleId);
    if (!role) throw new Error("Role does not exist");
    this.roles.set(roleId, { ...role, ...input });
  }

  getRole(roleId: string) {
    return this.roles.get(roleId) ?? null;
  }

  async assignRole(userId: string, roleId: string) {
    this.assignedRoles.push({ userId, roleId });
  }

  async removeRole(userId: string, roleId: string) {
    this.removedRoles.push({ userId, roleId });
  }

  async deleteRole(roleId: string) {
    this.deletedRoleIds.push(roleId);
    this.roles.delete(roleId);
  }
}

describe("BoosterRoleService", () => {
  test("eligible user claims one new cosmetic managed role", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository();
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });

    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "My Role", color: "#aabbcc", isBoosting: true });

    expect(claimed.roleId).toBe("created-2");
    expect(roles.roles.get(claimed.roleId)?.permissions).toEqual([]);
    expect(roles.roles.get(claimed.roleId)?.position).toBe(9);
    expect(roles.assignedRoles).toEqual([{ userId: "user", roleId: claimed.roleId }]);
    expect(await store.findByUser("guild", "user")).toEqual(claimed);
  });

  test("rejects claiming an existing unmanaged role name", async () => {
    const service = new BoosterRoleService(new MemoryRoleStore(), new FakeRoleRepository(), { anchorPosition: 10 });

    await expect(service.claimRole({ guildId: "guild", userId: "user", name: "vip", color: null, isBoosting: true })).rejects.toThrow("already used");
  });

  test("rejects duplicate claims instead of creating another role", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository();
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });

    await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await expect(service.claimRole({ guildId: "guild", userId: "user", name: "Second Role", color: null, isBoosting: true })).rejects.toThrow("already has a booster role");
  });

  test("renames only the stored role owned by the user", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.renameRole({ guildId: "guild", userId: "user", name: "Renamed" });

    expect(roles.roles.get(claimed.roleId)?.name).toBe("Renamed");
    expect(await store.findByUser("guild", "user")).toEqual(expect.objectContaining({ name: "Renamed" }));
    await expect(service.renameRole({ guildId: "guild", userId: "attacker", name: "Stolen" })).rejects.toThrow("No booster role found");
  });

  test("sets icon only on the stored role owned by the user", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.setRoleIcon({ guildId: "guild", userId: "user", icon: { contentType: "image/png", size: 128_000, dataUri: "data:image/png;base64,abc" } });

    expect(roles.roles.get(claimed.roleId)?.icon).toBe("data:image/png;base64,abc");
    expect(await store.findByUser("guild", "user")).toEqual(expect.objectContaining({ icon: "data:image/png;base64,abc" }));
    await expect(service.setRoleIcon({ guildId: "guild", userId: "attacker", icon: { contentType: "image/png", size: 128_000, dataUri: "data:image/png;base64,abc" } })).rejects.toThrow("No booster role found");
  });

  test("rejects oversized or non-image role icons", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10, maxIconBytes: 256_000 });
    await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await expect(service.setRoleIcon({ guildId: "guild", userId: "user", icon: { contentType: "text/html", size: 100, dataUri: "data:text/html;base64,abc" } })).rejects.toThrow("Role icon must be an image");
    await expect(service.setRoleIcon({ guildId: "guild", userId: "user", icon: { contentType: "image/png", size: 256_001, dataUri: "data:image/png;base64,abc" } })).rejects.toThrow("Role icon is too large");
  });

  test("removes managed role when eligibility is lost", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.removeRoleForLostBoost({ guildId: "guild", userId: "user" });

    expect(roles.deletedRoleIds).toEqual([claimed.roleId]);
    expect(await store.findByUser("guild", "user")).toBeNull();
  });

  test("rolls back created and assigned role when storing claim fails", async () => {
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(new FailingCreateRoleStore(), roles, { anchorPosition: 10 });

    await expect(service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true })).rejects.toThrow("Database insert failed");

    expect(roles.assignedRoles).toEqual([{ userId: "user", roleId: "created-1" }]);
    expect(roles.removedRoles).toEqual([{ userId: "user", roleId: "created-1" }]);
    expect(roles.deletedRoleIds).toEqual(["created-1"]);
    expect(roles.roles.has("created-1")).toBe(false);
  });

  test("recolors only the stored role owned by the user", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.recolorRole({ guildId: "guild", userId: "user", color: "#FF0000" });

    const updated = roles.getRole(claimed.roleId);
    expect(updated).not.toBeNull();
    expect(updated!.colors).toEqual({ primaryColor: "#FF0000" });
    expect(await store.findByUser("guild", "user")).toEqual(expect.objectContaining({ color: "#FF0000", color2: null }));

    // Other user cannot recolor
    await expect(service.recolorRole({ guildId: "guild", userId: "attacker", color: "#00FF00" })).rejects.toThrow("No booster role found");
  });

  test("recolors role with gradient colors (primary + secondary)", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.recolorRole({ guildId: "guild", userId: "user", color: "#FF0000", color2: "#0000FF" });

    const updated = roles.getRole(claimed.roleId);
    expect(updated).not.toBeNull();
    expect(updated!.colors).toEqual({ primaryColor: "#FF0000", secondaryColor: "#0000FF" });
    expect(await store.findByUser("guild", "user")).toEqual(expect.objectContaining({ color: "#FF0000", color2: "#0000FF" }));
  });

  test("deletes the stored role owned by the user", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    const claimed = await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await service.deleteRole({ guildId: "guild", userId: "user" });

    expect(roles.deletedRoleIds).toEqual([claimed.roleId]);
    expect(roles.roles.has(claimed.roleId)).toBe(false);
    expect(await store.findByUser("guild", "user")).toBeNull();
  });

  test("rejects delete by non-owner user", async () => {
    const store = new MemoryRoleStore();
    const roles = new FakeRoleRepository([]);
    const service = new BoosterRoleService(store, roles, { anchorPosition: 10 });
    await service.claimRole({ guildId: "guild", userId: "user", name: "First Role", color: null, isBoosting: true });

    await expect(service.deleteRole({ guildId: "guild", userId: "attacker" })).rejects.toThrow("No booster role found");
  });
});
