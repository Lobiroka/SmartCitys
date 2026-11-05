ALTER TABLE "demand"."cidadaos"
    DROP COLUMN "usuario_id",
    ADD COLUMN "keycloak_sub" TEXT NOT NULL;

ALTER TABLE "demand"."gestores"
    DROP COLUMN "usuario_id",
    ADD COLUMN "keycloak_sub" TEXT NOT NULL;

CREATE UNIQUE INDEX "cidadaos_keycloak_sub_key"
    ON "demand"."cidadaos" ("keycloak_sub");

CREATE UNIQUE INDEX "gestores_keycloak_sub_key"
    ON "demand"."gestores" ("keycloak_sub");