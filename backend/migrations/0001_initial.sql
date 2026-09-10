PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  duration INTEGER NOT NULL CHECK (duration BETWEEN 5 AND 480),
  price REAL NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  service_name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointment_slots (
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  PRIMARY KEY (date, slot)
);

CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  start TEXT,
  end TEXT,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  service TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  service TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(date);
CREATE INDEX IF NOT EXISTS idx_waitlist_date ON waitlist(date);

INSERT OR IGNORE INTO services (id, name, duration, price, category, active) VALUES
  (1, 'Corte tradicional', 40, 45, 'Cabelo', 1),
  (2, 'Corte degradê', 50, 55, 'Cabelo', 1),
  (3, 'Barba completa', 35, 45, 'Barba', 1),
  (4, 'Corte + barba', 75, 89, 'Combo', 1),
  (5, 'Pezinho / acabamento', 15, 25, 'Acabamento', 1),
  (6, 'Sobrancelha', 10, 18, 'Acabamento', 1);
