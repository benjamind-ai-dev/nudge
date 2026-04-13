import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { ZodError } from "zod";

function mockArgumentsHost(response: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: response.status.mockReturnThis(),
        json: response.json,
      }),
      getRequest: () => ({ method: "POST", url: "/v1/test" }),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock doesn't need full ArgumentsHost interface
  } as any;
}

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it("handles HttpException", () => {
    const exception = new NotFoundException("Invoice not found");
    filter.catch(exception, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: "Not Found",
        message: "Invoice not found",
      }),
    );
  });

  it("handles BadRequestException with custom response object", () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: "Validation Error",
      message: "Request validation failed",
      details: { email: ["Invalid email"] },
    });
    filter.catch(exception, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        details: { email: ["Invalid email"] },
      }),
    );
  });

  it("handles ZodError as 400", () => {
    const error = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["email"],
        message: "Expected string, received number",
      },
    ]);
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: "Validation Error",
      }),
    );
  });

  it("handles Prisma P2002 (unique constraint) as 409", () => {
    const error = Object.assign(new Error("Unique constraint"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      meta: { target: ["email"] },
    });
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: "Conflict",
      }),
    );
  });

  it("handles Prisma P2025 (not found) as 404", () => {
    const error = Object.assign(new Error("Record not found"), {
      name: "PrismaClientKnownRequestError",
      code: "P2025",
    });
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: "Not Found",
      }),
    );
  });

  it("handles Prisma P2003 (foreign key) as 400", () => {
    const error = Object.assign(new Error("Foreign key constraint"), {
      name: "PrismaClientKnownRequestError",
      code: "P2003",
    });
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("handles Prisma P2024 (timeout) as 408", () => {
    const error = Object.assign(new Error("Timeout"), {
      name: "PrismaClientKnownRequestError",
      code: "P2024",
    });
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(408);
  });

  it("handles unknown errors as 500 without leaking stack", () => {
    const error = new Error("Something unexpected");
    filter.catch(error, mockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      }),
    );
  });
});
