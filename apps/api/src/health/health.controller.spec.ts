import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PRISMA_CLIENT } from "../common/database/database.module";

const mockPrisma = {
  $queryRaw: jest.fn(),
};

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PRISMA_CLIENT, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should return healthy status when database is connected", async () => {
    const result = await controller.check();
    expect(result).toEqual({
      status: "ok",
      version: "0.0.1",
      checks: { database: "ok" },
    });
  });

  it("should return degraded status when database is down", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const result = await controller.check();
    expect(result).toEqual({
      status: "degraded",
      version: "0.0.1",
      checks: { database: "error" },
    });
  });
});
