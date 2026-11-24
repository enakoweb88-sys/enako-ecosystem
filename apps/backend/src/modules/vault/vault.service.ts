import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { escapeEmailText } from '../mail/notification-email';
import { decryptVault, encryptVault, vaultDigest } from './vault.crypto';
import { VaultConfigDto } from './vault.dto';

type Access = { sessionId: string; userId: string; codeHash: string | null; attempts: number; requestedAt: Date; expiresAt: Date; tokenHash: string | null; unlockedUntil: Date | null };
@Injectable()
export class VaultService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService, private readonly mail: MailService) {}

  settings() {
    const email = (this.config.get<string>('VAULT_OWNER_EMAIL') || '').trim().toLowerCase();
    const encoded = this.config.get<string>('VAULT_ENCRYPTION_KEY') || '';
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !/^[a-fA-F0-9]{64}$/.test(encoded)) {
      throw new ServiceUnavailableException('Passwords and Keys needs the owner email and encryption key configured by the administrator.');
    }
    return { email, key: Buffer.from(encoded, 'hex') };
  }
  async eligible(user: JwtUser) {
    const settings = this.settings();
    if (!user.sid) throw new ForbiddenException('Sign in again to access Passwords and Keys');
    const ownerId = this.config.get<string>('VAULT_OWNER_USER_ID');
    if (user.sub === ownerId || user.email.toLowerCase() === settings.email) return settings;
    const person = await this.db.user.findUnique({ where: { id: user.sub }, include: { department: true, role: true } });
    if (person?.role.name === 'CEO' && person.personalEmail?.trim().toLowerCase() === settings.email) return settings;
    if (!person || !/engineering|software|developer|technology/i.test(person.department?.name || '')) throw new ForbiddenException('Passwords and Keys is restricted to the owner and engineering team');
    return settings;
  }
  async audit(tx: Prisma.TransactionClient, user: JwtUser, action: string, entityId?: string) {
    await tx.auditLog.create({ data: { actorId: user.sub, action, entity: 'credential_vault', entityId } });
  }
  async requestCode(user: JwtUser) {
    const { key, email } = await this.eligible(user);
    const code = randomInt(100000, 1000000).toString();
    // Serialize mailbox requests across all backend instances. Cooldown survives failed delivery.
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('vault-email', 42))::text`;
      const previous = await tx.$queryRaw<Access[]>`SELECT * FROM vault_access ORDER BY "requestedAt" DESC LIMIT 1`;
      if (previous[0] && Date.now() - previous[0].requestedAt.getTime() < 60000) throw new HttpException('Wait one minute before requesting another code', 429);
      const hash = vaultDigest(key, `${user.sid}:${code}`);
      await tx.$executeRaw`INSERT INTO vault_access ("sessionId", "userId", "codeHash", "requestedAt", "expiresAt") VALUES (${user.sid!}, ${user.sub}, ${hash}, NOW(), NOW() + INTERVAL '5 minutes') ON CONFLICT ("sessionId") DO UPDATE SET "codeHash" = EXCLUDED."codeHash", attempts = 0, "requestedAt" = NOW(), "expiresAt" = EXCLUDED."expiresAt", "tokenHash" = NULL, "unlockedUntil" = NULL`;
      await this.audit(tx, user, 'VAULT_CODE_REQUESTED');
    });
    const sent = await this.mail.sendEmail({ to: email, exactRecipient: true, senderType: 'NOREPLY', subject: 'ENAKOOS Passwords and Keys verification', html: `<p>${escapeEmailText(user.email)} requested access to Passwords and Keys.</p><p>Your single-use code is <strong>${code}</strong>.</p><p>It expires in five minutes. Only share it if you approve this access request.</p>`, text: `Your ENAKOOS Passwords and Keys code is ${code}. Requested by ${user.email}. Expires in five minutes. Only share it if you approve this access request.`, actorId: user.sub });
    if (!sent.success) {
      await this.db.$executeRaw`UPDATE vault_access SET "codeHash" = NULL WHERE "sessionId" = ${user.sid!} AND "codeHash" = ${vaultDigest(key, `${user.sid}:${code}`)}`;
      throw new ServiceUnavailableException('The verification email could not be sent. Please retry in one minute.');
    }
    return { message: 'A verification code has been sent to the vault owner.', retryAfter: 60 };
  }
  async verify(user: JwtUser, code: string) {
    const { key } = await this.eligible(user);
    const token = randomBytes(32).toString('hex');
    const result = await this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Access[]>`SELECT * FROM vault_access WHERE "sessionId" = ${user.sid!} FOR UPDATE`;
      const access = rows[0];
      if (!access || !access.codeHash || access.expiresAt.getTime() <= Date.now() || access.attempts >= 5) return null;
      if (!timingSafeEqual(Buffer.from(access.codeHash, 'hex'), Buffer.from(vaultDigest(key, `${user.sid}:${code}`), 'hex'))) {
        await tx.$executeRaw`UPDATE vault_access SET attempts = attempts + 1 WHERE "sessionId" = ${user.sid!}`;
        await this.audit(tx, user, 'VAULT_CODE_REJECTED');
        return null;
      }
      const until = new Date(Date.now() + 10 * 60000);
      await tx.$executeRaw`UPDATE vault_access SET "codeHash" = NULL, "tokenHash" = ${vaultDigest(key, token)}, "unlockedUntil" = ${until} WHERE "sessionId" = ${user.sid!}`;
      await this.audit(tx, user, 'VAULT_UNLOCKED');
      return until;
    });
    if (!result) throw new ForbiddenException('Invalid, expired, or already-used code. Request a new code after the cooldown.');
    return { token, expiresAt: result.toISOString() };
  }
  async unlocked(user: JwtUser, token: string | undefined) {
    const settings = await this.eligible(user);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ForbiddenException('Authenticate to unlock Passwords and Keys');
    const found = await this.db.$queryRaw<Access[]>`SELECT * FROM vault_access WHERE "sessionId" = ${user.sid!} AND "userId" = ${user.sub} AND "tokenHash" = ${vaultDigest(settings.key, token)} AND "unlockedUntil" > NOW()`;
    if (!found.length) throw new ForbiddenException('Your vault access has expired. Authenticate again.');
    return settings;
  }
  async lock(user: JwtUser) {
    await this.db.$executeRaw`UPDATE vault_access SET "codeHash" = NULL, "tokenHash" = NULL, "unlockedUntil" = NULL WHERE "sessionId" = ${user.sid || ''} AND "userId" = ${user.sub}`;
    return { locked: true };
  }
  async platforms(user: JwtUser, token?: string) {
    await this.unlocked(user, token);
    return this.db.$queryRaw<Array<{ id: string; name: string }>>`SELECT id, name FROM vault_platforms ORDER BY lower(name)`;
  }
  async createPlatform(user: JwtUser, token: string | undefined, name: string) {
    await this.unlocked(user, token);
    name = name.trim();
    if (!name) throw new BadRequestException('Enter a platform name');
    return this.db.$transaction(async tx => {
      const id = randomUUID();
      const created = await tx.$executeRaw`INSERT INTO vault_platforms (id, name) VALUES (${id}, ${name}) ON CONFLICT DO NOTHING`;
      if (!created) throw new ConflictException('A platform with this name already exists');
      await this.audit(tx, user, 'VAULT_PLATFORM_CREATED', id);
      return { id, name };
    });
  }
  async read(user: JwtUser, token: string | undefined, platform: string, environment: string) {
    const { key } = await this.unlocked(user, token);
    if (!['production', 'staging', 'development'].includes(environment)) throw new BadRequestException('Invalid environment');
    return this.db.$transaction(async tx => {
      const exists = await tx.$queryRaw`SELECT id FROM vault_platforms WHERE id = ${platform}`;
      if (!(exists as unknown[]).length) throw new NotFoundException('Platform not found');
      const records = await tx.$queryRaw<Array<{ ciphertext: string; version: number }>>`SELECT ciphertext, version FROM vault_configs WHERE "platformId" = ${platform} AND environment = ${environment}`;
      await this.audit(tx, user, 'VAULT_CREDENTIALS_READ', platform);
      return records[0] ? { rows: decryptVault(key, `${platform}:${environment}`, records[0].ciphertext), version: records[0].version } : { rows: [], version: 0 };
    });
  }
  async save(user: JwtUser, token: string | undefined, platform: string, dto: VaultConfigDto) {
    const { key } = await this.unlocked(user, token);
    if (new Set(dto.rows.map(row => row.key)).size !== dto.rows.length) throw new BadRequestException('Each key must be unique');
    const ciphertext = encryptVault(key, `${platform}:${dto.environment}`, dto.rows);
    return this.db.$transaction(async tx => {
      const exists = await tx.$queryRaw`SELECT id FROM vault_platforms WHERE id = ${platform} FOR UPDATE`;
      if (!(exists as unknown[]).length) throw new NotFoundException('Platform not found');
      const saved = dto.version === 0
        ? await tx.$executeRaw`INSERT INTO vault_configs ("platformId", environment, ciphertext, version) VALUES (${platform}, ${dto.environment}, ${ciphertext}, 1) ON CONFLICT DO NOTHING`
        : await tx.$executeRaw`UPDATE vault_configs SET ciphertext = ${ciphertext}, version = version + 1 WHERE "platformId" = ${platform} AND environment = ${dto.environment} AND version = ${dto.version}`;
      if (!saved) throw new ConflictException('Credentials were changed elsewhere. Reopen the platform before saving.');
      await this.audit(tx, user, 'VAULT_CREDENTIALS_SAVED', platform);
      return { version: dto.version + 1 };
    });
  }
  async deletePlatform(user: JwtUser, token: string | undefined, id: string) {
    await this.unlocked(user, token);
    return this.db.$transaction(async tx => {
      const count = await tx.$executeRaw`DELETE FROM vault_platforms WHERE id = ${id}`;
      if (!count) throw new NotFoundException('Platform not found');
      await this.audit(tx, user, 'VAULT_PLATFORM_DELETED', id);
      return { deleted: true };
    });
  }
}
