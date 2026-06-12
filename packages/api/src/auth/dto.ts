/**
 * Auth DTOs — the shapes returned to API consumers for auth endpoints.
 */

export interface AuthUserDto {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
}

export interface MeResponseDto {
  readonly user: AuthUserDto;
}
