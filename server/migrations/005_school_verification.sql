-- New schools are verified by a field executive or manager before their requests can move ahead.
-- Schools that existed before this change start as 'pending' too: nobody has checked them yet.
ALTER TABLE schools
  ADD COLUMN verification TEXT NOT NULL DEFAULT 'pending' CHECK (verification IN ('pending', 'verified', 'rejected')),
  ADD COLUMN verification_note TEXT,
  ADD COLUMN verification_checks JSONB,            -- what the verifier confirmed, e.g. {"udise": true, "met_headmaster": true}
  ADD COLUMN verified_by INTEGER REFERENCES users(id),
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN registered_by INTEGER REFERENCES users(id);   -- staff member who registered the school on its behalf; NULL if self-registered
CREATE INDEX idx_schools_verification ON schools (verification);
