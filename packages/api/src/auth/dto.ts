/**
 * Auth DTOs — the shapes returned to API consumers for auth endpoints.
 */

export interface AuthUserDto {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
  readonly displayName: string | null;
}

export interface MeResponseDto {
  readonly user: AuthUserDto;
}
