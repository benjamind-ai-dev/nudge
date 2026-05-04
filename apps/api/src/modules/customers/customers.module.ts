import { Module } from "@nestjs/common";
import { CUSTOMER_REPOSITORY } from "./domain/customer.repository";
import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { CustomersController } from "./customers.controller";

@Module({
  controllers: [CustomersController],
  providers: [
    ListCustomersUseCase,
    UpdateCustomerUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  ],
})
export class CustomersModule {}
