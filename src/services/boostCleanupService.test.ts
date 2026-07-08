import { describe, expect, test } from "bun:test";
import { startBoostCleanup } from "./boostCleanupService";
import type { BoosterRoleRecord, BoosterRoleUpdate } from "./drizzleBoosterRoleStore";
import type { RoleRepository } from "./discordRoleRepository";

class MemoryStore {
  private records = new Map<string, BoosterRoleRecord>();

  async findByUser(guildId: string, userId: string): Promise<BoosterRoleRecord | null> {
    return this.records.get(`${guildId}:${userId}`) ?? null;
  }

  async findByGuild(guildId: string): Promise<BoosterRoleRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.guildId === guildId);
  }

  async create(record: BoosterRoleRecord) {
    this.records.set(`${record.guildId}:${record.userId}`, record);
  }

  async update(guildId: string, userId: string, changes: BoosterRoleUpdate) {
    const key = `${guildId}:${userId}`;
    const record = this.records.get(key);
    if (!record) return;
    this.records.set(key, { ...record, ...changes });
  }

  async delete(guildId: string, userId: string) {
    this.records.delete(`${guildId}:${userId}`);
  }
}

class SpyRoleRepository implements RoleRepository {
  listRolesCalls = 0;
  deleteRoleCalls: string[] = [];
  assignRoleCalls: Array<{ userId: string; roleId: string }> = [];
  removeRoleCalls: Array<{ userId: string; roleId: string }> = [];
  updateRoleCalls: Array<{ roleId: string; input: Record<string, unknown> }> = [];

  async listRoles() {
    this.listRolesCalls++;
    return [];
  }

  async createRole() {
    return { id: "spy-created-1" };
  }

  async updateRole(roleId: string, input: Record<string, unknown>) {
    this.updateRoleCalls.push({ roleId, input });
  }

  async assignRole(userId: string, roleId: string) {
    this.assignRoleCalls.push({ userId, roleId });
  }

  async removeRole(userId: string, roleId: string) {
    this.removeRoleCalls.push({ userId, roleId });
  }

  async deleteRole(roleId: string) {
    this.deleteRoleCalls.push(roleId);
  }
}

class FakeClient {
  guilds = {
    cache: new Map<string, FakeGuild>()
  };
}

class FakeGuild {
  id: string;
  members: { cache: Map<string, FakeMember>; fetch: () => Promise<void> };

  constructor(id: string, members: FakeMember[] = []) {
    this.id = id;
    this.members = {
      cache: new Map(members.map((m) => [m.id, m])),
      fetch: async () => {},
    };
  }
}

class FakeMember {
  id: string;
  roles: { cache: Map<string, { id: string }> };

  constructor(id: string, roleIds: string[] = []) {
    this.id = id;
    this.roles = { cache: new Map(roleIds.map((rid) => [rid, { id: rid }])) };
  }
}

describe("startBoostCleanup", () => {
  test("cleans up records for members who left the guild", async () => {
    const store = new MemoryStore();
    const roles = new SpyRoleRepository();
    const client = new FakeClient() as any;
    const guild = new FakeGuild("guild-1");
    client.guilds.cache.set("guild-1", guild);

    await store.create({ guildId: "guild-1", userId: "left-user", roleId: "role-left", name: "Left Role", color: null, color2: null, icon: null, createdAt: 1, updatedAt: 1 });

    // Trigger one cleanup cycle
    const { stop } = startBoostCleanup(client, store, () => roles, {
      intervalMs: 60_000,
      boosterEligibilityRoleId: "booster-role-id",
      anchorRoleId: null,
    });
    // Wait a tick for async runCleanup
    await new Promise(r => setTimeout(r, 10));
    stop();

    expect(roles.deleteRoleCalls).toEqual(["role-left"]);
    expect(await store.findByUser("guild-1", "left-user")).toBeNull();
  });

  test("cleans up records for members who lost booster role", async () => {
    const store = new MemoryStore();
    const roles = new SpyRoleRepository();
    const client = new FakeClient() as any;
    const member = new FakeMember("stale-user", ["some-other-role"]);
    const guild = new FakeGuild("guild-1", [member]);
    client.guilds.cache.set("guild-1", guild);

    await store.create({ guildId: "guild-1", userId: "stale-user", roleId: "role-stale", name: "Stale Role", color: null, color2: null, icon: null, createdAt: 1, updatedAt: 1 });

    const { stop } = startBoostCleanup(client, store, () => roles, {
      intervalMs: 60_000,
      boosterEligibilityRoleId: "booster-role-id",
      anchorRoleId: null,
    });
    await new Promise(r => setTimeout(r, 10));
    stop();

    expect(roles.deleteRoleCalls).toEqual(["role-stale"]);
    expect(await store.findByUser("guild-1", "stale-user")).toBeNull();
  });

  test("keeps records for members who still have booster role", async () => {
    const store = new MemoryStore();
    const roles = new SpyRoleRepository();
    const client = new FakeClient() as any;
    const member = new FakeMember("active-user", ["booster-role-id"]);
    const guild = new FakeGuild("guild-1", [member]);
    client.guilds.cache.set("guild-1", guild);

    await store.create({ guildId: "guild-1", userId: "active-user", roleId: "role-active", name: "Active Role", color: null, color2: null, icon: null, createdAt: 1, updatedAt: 1 });

    const { stop } = startBoostCleanup(client, store, () => roles, {
      intervalMs: 60_000,
      boosterEligibilityRoleId: "booster-role-id",
      anchorRoleId: null,
    });
    await new Promise(r => setTimeout(r, 10));
    stop();

    expect(roles.deleteRoleCalls).toEqual([]);
    expect(await store.findByUser("guild-1", "active-user")).not.toBeNull();
  });

  test("handles guild without records gracefully", async () => {
    const store = new MemoryStore();
    const roles = new SpyRoleRepository();
    const client = new FakeClient() as any;
    const guild = new FakeGuild("guild-empty");
    client.guilds.cache.set("guild-empty", guild);

    const { stop } = startBoostCleanup(client, store, () => roles, {
      intervalMs: 60_000,
      boosterEligibilityRoleId: "booster-role-id",
      anchorRoleId: null,
    });
    await new Promise(r => setTimeout(r, 10));
    stop();

    expect(roles.deleteRoleCalls).toEqual([]);
  });
});
