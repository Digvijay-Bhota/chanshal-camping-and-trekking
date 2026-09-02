import { pool } from "../../db"

export type AvailabilityResult = {
  propertyId: number
  capacity: number
  bookedGuests: number
  availableCapacity: number
  available: boolean
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
        COALESCE(SUM(b.guests), 0) AS booked_guests
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
  const bookedGuests = Number(row.booked_guests)

  let availableCapacity = capacity - bookedGuests
  if (availableCapacity < 0) {
    availableCapacity = 0
  }

  return {
    propertyId: Number(row.property_id),
    capacity,
    bookedGuests,
    availableCapacity,
    available: availableCapacity > 0,
  }
}

export type AdminDailyAvailability = {
  date: string
  bookedGuests: number
  availableCapacity: number
  available: boolean
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
        COALESCE(SUM(b.guests), 0) AS booked_guests
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
    let availableCapacity = capacity - bookedGuests
    if (availableCapacity < 0) availableCapacity = 0

    return {
      date: row.date,
      bookedGuests,
      availableCapacity,
      available: availableCapacity > 0,
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
