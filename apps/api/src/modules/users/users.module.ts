import { Module } from "@nestjs/common";
import { USER_REPOSITORY } from "./domain/user.repository";
import { PrismaUserRepository } from "./infrastructure/prisma-user.repository";
import { ListUsersUseCase } from "./application/list-users.use-case";
import { UpdateUserRoleUseCase } from "./application/update-user-role.use-case";
import { DeleteUserUseCase } from "./application/delete-user.use-case";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [
    ListUsersUseCase,
    UpdateUserRoleUseCase,
    DeleteUserUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class UsersModule {}
