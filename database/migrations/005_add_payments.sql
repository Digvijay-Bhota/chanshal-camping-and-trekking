-- ============================================
-- Chanshal Platform - Payments Schema Migration
-- Migration: 005_add_payments
-- ============================================

-- 1. Add payment_status column to bookings table
ALTER TABLE bookings
ADD COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid';

-- 2. Create payments table
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(255) UNIQUE,
    provider_order_id VARCHAR(255),
    provider_signature VARCHAR(500),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'created',
    payment_method VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add indexes
CREATE INDEX idx_payments_booking_id
ON payments(booking_id);

CREATE INDEX idx_payments_provider_payment_id
ON payments(provider_payment_id);
