-- ============================================
-- Chanshal Platform - Initial Database Schema
-- Migration: 001_initial_schema
-- ============================================

-- USERS
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROPERTIES
-- A property can later represent a camp, homestay, lodge, or hotel.
CREATE TABLE properties (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    property_type VARCHAR(50) NOT NULL,
    location VARCHAR(200) NOT NULL,
    price_per_night NUMERIC(10, 2) NOT NULL CHECK (price_per_night >= 0),
    rating NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BOOKINGS
CREATE TABLE bookings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    property_id BIGINT NOT NULL REFERENCES properties(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INTEGER NOT NULL DEFAULT 1 CHECK (guests > 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_booking_dates
        CHECK (check_out > check_in)
);

-- INDEXES
CREATE INDEX idx_properties_location
    ON properties(location);

CREATE INDEX idx_properties_type
    ON properties(property_type);

CREATE INDEX idx_bookings_user_id
    ON bookings(user_id);

CREATE INDEX idx_bookings_property_id
    ON bookings(property_id);

CREATE INDEX idx_bookings_dates
    ON bookings(check_in, check_out);
