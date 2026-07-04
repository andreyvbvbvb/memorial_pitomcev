UPDATE "GiftPlacement" AS placement
SET
  "isActive" = false,
  "deactivatedAt" = NOW(),
  "deactivationReason" = 'admin_cleanup'
FROM "Pet" AS pet
JOIN "User" AS owner ON owner.id = pet."ownerId"
WHERE placement."petId" = pet.id
  AND LOWER(owner.email) = LOWER('andreyvbvbvb@gmail.com')
  AND placement."isActive" = true;

UPDATE "Memorial" AS memorial
SET
  "needsPreviewRefresh" = true,
  "updatedAt" = NOW()
FROM "Pet" AS pet
JOIN "User" AS owner ON owner.id = pet."ownerId"
WHERE memorial."petId" = pet.id
  AND LOWER(owner.email) = LOWER('andreyvbvbvb@gmail.com');
