-- Optional per-account hourly private-reply cap. NULL means "use the default".
ALTER TABLE "InstagramAccount" ADD COLUMN IF NOT EXISTS "hourlyDmCap" INTEGER;
