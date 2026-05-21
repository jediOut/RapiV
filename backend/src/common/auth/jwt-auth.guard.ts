import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { UsersService } from "../../modules/users/users.service";
import type { UserRole } from "../../modules/users/user.entity";
import { IS_PUBLIC_KEY } from "./public.decorator";

export type AuthenticatedUser = {
  sub: string;
  email: string;
  roles: UserRole[];
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = this.jwtService.verify<AuthenticatedUser>(token);
      const user = await this.usersService.findById(payload.sub);
      request.user = {
        sub: user.id,
        email: user.email,
        roles: user.roles
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
