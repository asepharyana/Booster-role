# Booster Role Bot

Discord bot untuk memberi role custom kosmetik ke user yang sedang boost server. Role dibuat oleh bot, tidak boleh mengambil role yang sudah ada, dan otomatis dihapus saat user tidak lagi eligible.

## Tech stack

- Bun + TypeScript
- discord.js
- PostgreSQL via Drizzle ORM
- Bun test runner

## Prasyarat

- Bun terinstall
- Bot Discord dengan token dari Developer Portal
- Test guild/server Discord
- Bot punya permission `Manage Roles`
- Posisi role bot harus lebih tinggi dari role custom yang akan dibuat

## Setup

```bash
bun install
cp .env.example .env
```

Isi `.env`:

```env
DISCORD_TOKEN=token_bot_discord
DISCORD_CLIENT_ID=client_id_aplikasi_discord
DISCORD_GUILD_ID=id_server_discord
DATABASE_URL=postgresql://asephs:***@100.121.180.82:6432/boost
BOOSTER_ROLE_ANCHOR_ROLE_ID=id_role_pembatas_opsional
BOOSTER_ELIGIBILITY_ROLE_ID=1206431347925852162
LOG_LEVEL=info
```

`BOOSTER_ROLE_ANCHOR_ROLE_ID` dipakai sebagai batas posisi role. Role booster custom harus berada di bawah role ini agar tetap kosmetik dan tidak menyentuh role staff/admin.

## Database

Generate dan jalankan migration setelah schema siap:

```bash
bun run db:generate
bun run db:migrate
```

Pastikan `DATABASE_URL` mengarah ke database PostgreSQL external (pool PgBouncer imrnes `100.121.180.82:6432`) sebelum menjalankan migration.

## Menjalankan bot

```bash
bun run dev
```

Saat startup, bot otomatis register slash command ke guild dari `DISCORD_GUILD_ID`, lalu menangani interaction command. Pastikan bot di-invite dengan scope `applications.commands`.

## Testing

```bash
bun test
bun test src/domain/roleGuards.test.ts
bun run typecheck
bun run lint
```

## Keamanan role

Bot ini dirancang supaya aman dari abuse:

- User tidak bisa claim role Discord yang sudah ada.
- Claim selalu membuat role baru yang dikelola bot.
- Rename, recolor, dan delete hanya berlaku untuk role yang tercatat di database sebagai milik user tersebut.
- Role custom dibuat dengan permission kosong.
- Icon/logo role opsional hanya bisa dipasang ke role bot-managed milik user tersebut.
- Attachment icon harus berupa image dan dibatasi ukuran agar tidak disalahgunakan.
- Permission berbahaya seperti `Administrator`, `ManageRoles`, `ManageChannels`, `BanMembers`, `KickMembers`, `MentionEveryone`, `ManageGuild`, dan `ManageWebhooks` ditolak.
- Jika user tidak punya role booster eligibility dari `BOOSTER_ELIGIBILITY_ROLE_ID`, claim ditolak.

## Slash command target

Command utama yang disiapkan:

- `/booster-role claim name color icon` - claim role custom baru, dengan icon opsional.
- `/booster-role rename name` - rename role milik sendiri.
- `/booster-role recolor color` - ubah warna role milik sendiri.
- `/booster-role icon image` - pasang atau ganti logo/icon role milik sendiri.
- `/booster-role delete` - hapus role milik sendiri.
- `/booster-role admin-delete user` - admin dengan permission `Administrator` bisa hapus role custom user lain. User target bisa claim lagi jika masih eligible.

## Catatan eligibility boost

Untuk sekarang, user eligible jika punya role dari `BOOSTER_ELIGIBILITY_ROLE_ID`. Jika role ini hilang dari user, role bot-managed miliknya akan dihapus lewat event `guildMemberUpdate`.
