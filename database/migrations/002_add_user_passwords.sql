-- ============================================
-- Chanshal Platform - User Password Migration
-- Migration: 002_add_user_passwords
-- ============================================

ALTER TABLE users
ADD COLUMN password_hash VARCHAR(255);
