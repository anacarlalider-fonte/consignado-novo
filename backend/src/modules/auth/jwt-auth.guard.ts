import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { AuthUser } from "./auth.types";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || typeof auth !== "string" || !auth.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token ausente");
    }

    const token = auth.slice("Bearer ".length);
    const secret = this.config.get<string>("JWT_SECRET") ?? "change-me";
    try {
      const payload = jwt.verify(token, secret) as AuthUser;
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token invalido");
    }
  }
}
