import { Body, Controller, Delete, Get, Headers, Module, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { VaultService } from './vault.service';
import { VaultCodeDto, VaultConfigDto, VaultPlatformDto } from './vault.dto';

@Controller('vault')
@UseGuards(JwtAuthGuard)
class VaultController {
  constructor(private readonly vault: VaultService) {}
  @Post('request-code') request(@CurrentUser() user: JwtUser) { return this.vault.requestCode(user); }
  @Post('verify') verify(@CurrentUser() user: JwtUser, @Body() dto: VaultCodeDto) { return this.vault.verify(user, dto.code); }
  @Post('lock') lock(@CurrentUser() user: JwtUser) { return this.vault.lock(user); }
  @Get('platforms') list(@CurrentUser() user: JwtUser, @Headers('x-vault-token') token?: string) { return this.vault.platforms(user, token); }
  @Post('platforms') create(@CurrentUser() user: JwtUser, @Headers('x-vault-token') token: string, @Body() dto: VaultPlatformDto) { return this.vault.createPlatform(user, token, dto.name); }
  @Delete('platforms/:id') remove(@CurrentUser() user: JwtUser, @Headers('x-vault-token') token: string, @Param('id') id: string) { return this.vault.deletePlatform(user, token, id); }
  @Get('platforms/:id/config') read(@CurrentUser() user: JwtUser, @Headers('x-vault-token') token: string, @Param('id') id: string, @Query('environment') environment: string) { return this.vault.read(user, token, id, environment); }
  @Put('platforms/:id/config') save(@CurrentUser() user: JwtUser, @Headers('x-vault-token') token: string, @Param('id') id: string, @Body() dto: VaultConfigDto) { return this.vault.save(user, token, id, dto); }
}
@Module({ controllers: [VaultController], providers: [VaultService] })
export class VaultModule {}
