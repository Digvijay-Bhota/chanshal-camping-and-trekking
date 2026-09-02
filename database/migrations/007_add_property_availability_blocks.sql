-- Add property_availability_blocks table for admin-controlled closure dates.

CREATE TABLE property_availability_blocks (
  id BIGSERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT end_date_after_start_date CHECK (end_date > start_date)
);

CREATE INDEX idx_property_availability_blocks_property_id ON property_availability_blocks(property_id);
CREATE INDEX idx_property_availability_blocks_dates ON property_availability_blocks(property_id, start_date, end_date);
