CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_contact
  ON waitlist (date, time, client_phone);
