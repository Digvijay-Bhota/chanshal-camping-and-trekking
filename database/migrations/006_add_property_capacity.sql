-- Add guest capacity for availability management.
ALTER TABLE properties
ADD COLUMN capacity INTEGER NOT NULL DEFAULT 10
CHECK (capacity > 0);

CREATE INDEX idx_properties_capacity
ON properties(capacity);
