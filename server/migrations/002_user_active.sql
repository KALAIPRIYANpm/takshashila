-- Staff who leave are deactivated, not deleted: their reviews, payments and audit entries keep pointing at them.
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
