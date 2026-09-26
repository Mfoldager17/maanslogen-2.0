import type { MediaAsset, User as UserDto } from '@maanslogen/contracts';
import { toMediaAssetDto, type MediaAssetRow } from '../media/media.mapper';

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  avatar?: MediaAssetRow | null;
  _count?: { reviews: number };
}

export function toUserDto(row: UserRow): UserDto {
  const avatar: MediaAsset | null = row.avatar ? toMediaAssetDto(row.avatar) : null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    active: row.active,
    avatar,
    reviewCount: row._count?.reviews,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
