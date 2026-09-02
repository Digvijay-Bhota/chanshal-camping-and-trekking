import { pool } from "../../db"

export type AvailabilityResult = {
  propertyId: number
  capacity: number
  bookedGuests: number
  availableCapacity: number
  available: boolean
  blocked: boolean
  blockReason: string | null
}

export async function checkPropertyAvailability(
  propertyId: number,
  checkIn: string,
  checkOut: string,
): Promise<AvailabilityResult | null> {
  const result = await pool.query(
    `
      SELECT
        p.id AS property_id,
        p.capacity,
        COALESCE(SUM(b.guests), 0) AS booked_guests,
        (
          SELECT reason FROM property_availability_blocks pab
          WHERE pab.property_id = p.id
            AND pab.start_date < $2
            AND pab.end_date > $1
          ORDER BY pab.id ASC
          LIMIT 1
        ) AS block_reason,
        EXISTS (
          SELECT 1 FROM property_availability_blocks pab
          WHERE pab.property_id = p.id
            AND pab.start_date < $2
            AND pab.end_date > $1
        ) AS is_blocked
      FROM properties p
      LEFT JOIN bookings b ON b.property_id = p.id
        AND b.status != 'cancelled'
        AND b.check_in < $2
        AND b.check_out > $1
      WHERE p.id = $3
        AND p.is_active = TRUE
      GROUP BY p.id, p.capacity
    `,
    [checkIn, checkOut, propertyId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  const capacity = Number(row.capacity)
  const isBlocked = Boolean(row.is_blocked)
  const blockReason = row.block_reason || null
  const bookedGuests = isBlocked ? 0 : Number(row.booked_guests)

  let availableCapacity = capacity - bookedGuests
  if (availableCapacity < 0) {
    availableCapacity = 0
  }

  if (isBlocked) {
    availableCapacity = 0
  }

  return {
    propertyId: Number(row.property_id),
    capacity,
    bookedGuests: Number(row.booked_guests), // Preserve actual booked guests count if needed, but wait: instruction says "If overlap exists: return availability with: availableCapacity = 0, available = false, blocked = true, blockReason = reason".
    availableCapacity,
    available: !isBlocked && availableCapacity > 0,
    blocked: isBlocked,
    blockReason,
  }
}

export type AdminDailyAvailability = {
  date: string
  bookedGuests: number
  availableCapacity: number
  available: boolean
  blocked: boolean
  blockReason: string | null
}

export type AdminAvailabilityResult = {
  propertyId: number
  capacity: number
  startDate: string
  endDate: string
  days: AdminDailyAvailability[]
}

export async function getAdminPropertyAvailability(
  propertyId: number,
  startDate: string,
  endDate: string,
): Promise<AdminAvailabilityResult | null> {
  // Verify property exists (including inactive for admin)
  const propRes = await pool.query(
    `SELECT id, capacity FROM properties WHERE id = $1`,
    [propertyId]
  )

  if (propRes.rows.length === 0) {
    return null
  }

  const capacity = Number(propRes.rows[0].capacity)

  const result = await pool.query(
    `
      SELECT
        TO_CHAR(d.date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(b.guests), 0) AS booked_guests,
        (
          SELECT reason FROM property_availability_blocks pab
          WHERE pab.property_id = $1
            AND pab.start_date <= d.date
            AND pab.end_date > d.date
          ORDER BY pab.id ASC
          LIMIT 1
        ) AS block_reason,
        EXISTS (
          SELECT 1 FROM property_availability_blocks pab
          WHERE pab.property_id = $1
            AND pab.start_date <= d.date
            AND pab.end_date > d.date
        ) AS is_blocked
      FROM generate_series($2::date, $3::date, '1 day'::interval) AS d(date)
      LEFT JOIN bookings b
        ON b.property_id = $1
        AND b.status != 'cancelled'
        AND b.check_in <= d.date
        AND b.check_out > d.date
      GROUP BY d.date
      ORDER BY d.date
    `,
    [propertyId, startDate, endDate]
  )

  const days: AdminDailyAvailability[] = result.rows.map(row => {
    const bookedGuests = Number(row.booked_guests)
    const isBlocked = Boolean(row.is_blocked)
    const blockReason = row.block_reason || null
    let availableCapacity = capacity - bookedGuests

    if (availableCapacity < 0) availableCapacity = 0
    if (isBlocked) availableCapacity = 0

    return {
      date: row.date,
      bookedGuests, // Preserve actual booked guests for admin visibility
      availableCapacity,
      available: !isBlocked && availableCapacity > 0,
      blocked: isBlocked,
      blockReason,
    }
  })

  return {
    propertyId,
    capacity,
    startDate,
    endDate,
    days,
  }
}

export type AvailabilityBlock = {
  id: number
  propertyId: number
  startDate: string
  endDate: string
  reason: string | null
  createdBy: number
  createdAt: Date
  updatedAt: Date
}

export async function getPropertyAvailabilityBlocks(propertyId: number): Promise<AvailabilityBlock[]> {
  const result = await pool.query(
    `SELECT
       id,
       property_id,
       TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
       TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
       reason,
       created_by,
       created_at,
       updated_at
     FROM property_availability_blocks
     WHERE property_id = $1
     ORDER BY start_date ASC`,
    [propertyId]
  )

  return result.rows.map(row => ({
    id: Number(row.id),
    propertyId: Number(row.property_id),
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdBy: Number(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }))
}

export async function createPropertyAvailabilityBlock(
  propertyId: number,
  startDate: string,
  endDate: string,
  reason: string | null,
  createdBy: number
): Promise<AvailabilityBlock> {
  const result = await pool.query(
    `INSERT INTO property_availability_blocks (property_id, start_date, end_date, reason, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       property_id,
       TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
       TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
       reason,
       created_by,
       created_at,
       updated_at`,
    [propertyId, startDate, endDate, reason, createdBy]
  )

  const row = result.rows[0]
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdBy: Number(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export async function deletePropertyAvailabilityBlock(blockId: number, propertyId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM property_availability_blocks WHERE id = $1 AND property_id = $2`,
    [blockId, propertyId]
  )
  return (result.rowCount ?? 0) > 0
}
