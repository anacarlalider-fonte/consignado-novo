import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { compare } from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthUser } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "ACTIVE", deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!user) throw new UnauthorizedException("Credenciais invalidas");

    const ok = await compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Credenciais invalidas");

    const permissions = user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code));
    const payload: AuthUser = { sub: user.id, tenantId: user.tenantId, email: user.email, permissions };

    const jwtSecret = this.config.get<string>("JWT_SECRET") ?? "change-me";
    const jwtExpiresIn = this.config.get<string>("JWT_EXPIRES_IN") ?? "15m";
    const jwtRefreshSecret = this.config.get<string>("JWT_REFRESH_SECRET") ?? "change-me-too";
    const jwtRefreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
    const refreshToken = jwt.sign(payload, jwtRefreshSecret, { expiresIn: jwtRefreshExpiresIn });

    return {
      user: { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, permissions },
      accessToken,
      refreshToken
    };
  }
}
