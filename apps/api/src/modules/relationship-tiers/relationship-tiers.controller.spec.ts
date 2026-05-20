import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { RelationshipTiersController } from "./relationship-tiers.controller";
import { ListTiersUseCase } from "./application/list-tiers.use-case";
import { CreateTierUseCase } from "./application/create-tier.use-case";
import { UpdateTierUseCase } from "./application/update-tier.use-case";
import { DeleteTierUseCase } from "./application/delete-tier.use-case";
import {
  CannotDeleteDefaultTierError,
  CannotDeleteTierWithActiveSequencesError,
  RelationshipTierNotFoundError,
  TierLimitReachedError,
  TierNameAlreadyExistsError,
} from "./domain/relationship-tier.errors";
import type { RelationshipTier } from "./domain/relationship-tier.entity";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { BusinessNotFoundError } from "../business/domain/business.errors";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const TIER_ID = "550e8400-e29b-41d4-a716-446655440010";
const SEQ_ID = "550e8400-e29b-41d4-a716-446655440020";
const FOREIGN_BIZ_ID = "550e8400-e29b-41d4-a716-446655440099";

const tier: RelationshipTier = {
  id: TIER_ID,
  businessId: BIZ_ID,
  sequenceId: null,
  sequenceName: null,
  name: "VIP",
  description: null,
  isDefault: false,
  sortOrder: 1,
  customerCount: 3,
  createdAt: new Date("2026-05-20T09:00:00Z"),
  updatedAt: new Date("2026-05-20T09:00:00Z"),
};

describe("RelationshipTiersController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let createUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let deleteUseCase: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    createUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [RelationshipTiersController],
      providers: [
        { provide: ListTiersUseCase, useValue: listUseCase },
        { provide: CreateTierUseCase, useValue: createUseCase },
        { provide: UpdateTierUseCase, useValue: updateUseCase },
        { provide: DeleteTierUseCase, useValue: deleteUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
        req.auth = () => ({ userId: "test-account-id" });
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/relationship-tiers", () => {
    it("returns 200 with tiers including customerCount", async () => {
      listUseCase.execute.mockResolvedValue([tier]);

      const res = await request(app.getHttpServer())
        .get("/v1/relationship-tiers")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(TIER_ID);
      expect(res.body.data[0].customerCount).toBe(3);
      expect(listUseCase.execute).toHaveBeenCalledWith(BIZ_ID);
    });

    it("returns 400 when businessId missing", async () => {
      await request(app.getHttpServer()).get("/v1/relationship-tiers").expect(400);
    });

    it("returns 400 when businessId not a UUID", async () => {
      await request(app.getHttpServer())
        .get("/v1/relationship-tiers")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });
  });

  describe("POST /v1/relationship-tiers", () => {
    it("returns 201 with the new tier", async () => {
      createUseCase.execute.mockResolvedValue(tier);

      const res = await request(app.getHttpServer())
        .post("/v1/relationship-tiers")
        .send({ businessId: BIZ_ID, name: "VIP" })
        .expect(201);

      expect(res.body.data.id).toBe(TIER_ID);
      expect(createUseCase.execute).toHaveBeenCalledWith(BIZ_ID, {
        name: "VIP",
        description: undefined,
      });
    });

    it("returns 400 when name missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/relationship-tiers")
        .send({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 400 on TierNameAlreadyExistsError", async () => {
      createUseCase.execute.mockRejectedValue(
        new TierNameAlreadyExistsError("VIP", BIZ_ID),
      );
      await request(app.getHttpServer())
        .post("/v1/relationship-tiers")
        .send({ businessId: BIZ_ID, name: "VIP" })
        .expect(400);
    });

    it("returns 400 on TierLimitReachedError", async () => {
      createUseCase.execute.mockRejectedValue(new TierLimitReachedError(BIZ_ID, 10));
      await request(app.getHttpServer())
        .post("/v1/relationship-tiers")
        .send({ businessId: BIZ_ID, name: "Eleventh" })
        .expect(400);
    });
  });

  describe("PATCH /v1/relationship-tiers/:id", () => {
    it("returns 200 with the updated tier", async () => {
      updateUseCase.execute.mockResolvedValue({ ...tier, isDefault: true });

      const res = await request(app.getHttpServer())
        .patch(`/v1/relationship-tiers/${TIER_ID}`)
        .send({ businessId: BIZ_ID, isDefault: true })
        .expect(200);

      expect(res.body.data.isDefault).toBe(true);
      expect(updateUseCase.execute).toHaveBeenCalledWith(TIER_ID, BIZ_ID, {
        name: undefined,
        description: undefined,
        sequenceId: undefined,
        isDefault: true,
        sortOrder: undefined,
      });
    });

    it("returns 200 when assigning a sequenceId", async () => {
      updateUseCase.execute.mockResolvedValue({
        ...tier,
        sequenceId: SEQ_ID,
        sequenceName: "Standard Follow-Up",
      });

      await request(app.getHttpServer())
        .patch(`/v1/relationship-tiers/${TIER_ID}`)
        .send({ businessId: BIZ_ID, sequenceId: SEQ_ID })
        .expect(200);

      expect(updateUseCase.execute).toHaveBeenCalledWith(
        TIER_ID,
        BIZ_ID,
        expect.objectContaining({ sequenceId: SEQ_ID }),
      );
    });

    it("returns 404 on RelationshipTierNotFoundError", async () => {
      updateUseCase.execute.mockRejectedValue(new RelationshipTierNotFoundError(TIER_ID));
      await request(app.getHttpServer())
        .patch(`/v1/relationship-tiers/${TIER_ID}`)
        .send({ businessId: BIZ_ID, name: "VIP" })
        .expect(404);
    });

    it("returns 400 on TierNameAlreadyExistsError", async () => {
      updateUseCase.execute.mockRejectedValue(
        new TierNameAlreadyExistsError("VIP", BIZ_ID),
      );
      await request(app.getHttpServer())
        .patch(`/v1/relationship-tiers/${TIER_ID}`)
        .send({ businessId: BIZ_ID, name: "VIP" })
        .expect(400);
    });

    it("returns 400 when sortOrder is negative", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/relationship-tiers/${TIER_ID}`)
        .send({ businessId: BIZ_ID, sortOrder: -1 })
        .expect(400);
    });
  });

  describe("DELETE /v1/relationship-tiers/:id", () => {
    it("returns 204 on success", async () => {
      deleteUseCase.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/v1/relationship-tiers/${TIER_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(204);

      expect(deleteUseCase.execute).toHaveBeenCalledWith(TIER_ID, BIZ_ID);
    });

    it("returns 400 on CannotDeleteDefaultTierError", async () => {
      deleteUseCase.execute.mockRejectedValue(new CannotDeleteDefaultTierError(TIER_ID));
      await request(app.getHttpServer())
        .delete(`/v1/relationship-tiers/${TIER_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 400 on CannotDeleteTierWithActiveSequencesError", async () => {
      deleteUseCase.execute.mockRejectedValue(
        new CannotDeleteTierWithActiveSequencesError(TIER_ID),
      );
      await request(app.getHttpServer())
        .delete(`/v1/relationship-tiers/${TIER_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 404 on RelationshipTierNotFoundError", async () => {
      deleteUseCase.execute.mockRejectedValue(new RelationshipTierNotFoundError(TIER_ID));
      await request(app.getHttpServer())
        .delete(`/v1/relationship-tiers/${TIER_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .delete(`/v1/relationship-tiers/${TIER_ID}`)
        .expect(400);
    });
  });

  describe("cross-account authorization", () => {
    it("GET /v1/relationship-tiers returns 404 when businessId belongs to a different account", async () => {
      businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
        new BusinessNotFoundError(FOREIGN_BIZ_ID),
      );

      await request(app.getHttpServer())
        .get("/v1/relationship-tiers")
        .query({ businessId: FOREIGN_BIZ_ID })
        .expect(404);

      expect(listUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
