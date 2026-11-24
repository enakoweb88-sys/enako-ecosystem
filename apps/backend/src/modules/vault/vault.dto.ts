import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class VaultCodeDto {
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
export class VaultPlatformDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
}
export class VaultRowDto {
  @IsString() @Matches(/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/) key!: string;
  @IsString() @MaxLength(16384) value!: string;
}
export class VaultConfigDto {
  @IsIn(['production', 'staging', 'development']) environment!: string;
  @IsInt() @Min(0) version!: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => VaultRowDto) rows!: VaultRowDto[];
}
