-- Keep existing local demonstration records aligned with the public example labels.
UPDATE "device_types"
SET "name" = '設備' || "sortOrder"::text, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105',
  '11111111-1111-4111-8111-111111111106'
) AND "sortOrder" BETWEEN 1 AND 6 AND "name" <> '設備' || "sortOrder"::text;

UPDATE "devices" SET "type" = '設備1', "identifierRaw" = 'DEMO-DEVICE-001'
WHERE "serialRaw" = 'DEMO-SN-001' AND "caseId" IN
  (SELECT "id" FROM "customer_cases" WHERE "referenceCode" = 'DEMO-001');

UPDATE "devices" SET "type" = '設備2', "identifierRaw" = 'DEMO-DEVICE-002'
WHERE "serialRaw" = 'DEMO-SN-002' AND "caseId" IN
  (SELECT "id" FROM "customer_cases" WHERE "referenceCode" = 'DEMO-001');
