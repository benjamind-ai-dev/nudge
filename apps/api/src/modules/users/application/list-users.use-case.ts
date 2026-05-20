import { Inject, Injectable } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import type { UserListItem } from "../domain/user.entity";

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  async execute(accountId: string): Promise<UserListItem[]> {
    return this.users.findManyByAccount(accountId);
  }
}
