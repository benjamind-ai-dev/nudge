import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should return health status with ok and version", () => {
    const result = controller.check();
    expect(result).toEqual({ status: "ok", version: "0.0.1" });
  });

  it("should have status ok", () => {
    const result = controller.check();
    expect(result.status).toBe("ok");
  });
});
