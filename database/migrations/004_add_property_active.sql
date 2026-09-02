-- ============================================
-- Chanshal Platform - Property Active Flag Migration
-- Migration: 004_add_property_active
-- ============================================

ALTER TABLE properties
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
