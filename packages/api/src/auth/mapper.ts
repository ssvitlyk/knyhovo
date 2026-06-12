import type { AuthUserDto } from './dto.js';

interface UserRow {
  id: string;
  email: string;
  createdAt: Date;
}

/**
 * Map a Prisma User row to the public-facing AuthUserDto.
 */
export function toAuthUserDto(user: UserRow): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
