import { Module } from "@nestjs/common";
import { CUSTOMER_REPOSITORY } from "./domain/customer.repository";
import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { GetCustomerUseCase } from "./application/get-customer.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { AssignCustomerTierUseCase } from "./application/assign-customer-tier.use-case";
import { CustomersController } from "./customers.controller";

@Module({
  controllers: [CustomersController],
  providers: [
    ListCustomersUseCase,
    GetCustomerUseCase,
    UpdateCustomerUseCase,
    AssignCustomerTierUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  ],
})
export class CustomersModule {}
