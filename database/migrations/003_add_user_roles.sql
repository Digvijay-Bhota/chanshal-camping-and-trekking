-- ============================================
-- Chanshal Platform - User Role Migration
-- Migration: 003_add_user_roles
-- ============================================

ALTER TABLE users
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'customer';
