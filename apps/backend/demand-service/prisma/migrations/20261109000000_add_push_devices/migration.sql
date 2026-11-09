CREATE TABLE "demand"."push_devices" (
    "token" TEXT NOT NULL,
    "keycloak_sub" TEXT NOT NULL,
    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "push_devices_keycloak_sub_idx" ON "demand"."push_devices"("keycloak_sub");
