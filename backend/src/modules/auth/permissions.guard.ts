import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { AuthUser } from "./auth.types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const userPerms = req.user?.permissions ?? [];
    const allowed = required.every((perm) => userPerms.includes(perm));
    if (!allowed) throw new ForbiddenException("Sem permissao");
    return true;
  }
}
