import { pool } from "../../db"

export type Booking = {
  id: number
  userId: number
  propertyId: number
  checkIn: string
  checkOut: string
  guests: number
  totalAmount: number
  status: string
  createdAt?: Date
  updatedAt?: Date
}

export type CreateBookingInput = {
  userId: number
  propertyId: number
  checkIn: string | Date
  checkOut: string | Date
  guests?: number
  totalAmount: number
  status?: string
}

export type BookingRow = {
  id: number | string
  user_id: number | string
  property_id: number | string
  check_in: string | Date
  check_out: string | Date
  guests: number | string
  total_amount: number | string
  status: string
  created_at?: Date | string | null
  updated_at?: Date | string | null
}

function formatDate(val: string | Date): string {
  if (val instanceof Date) {
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, "0")
    const day = String(val.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  if (typeof val === "string") {
    return val.split("T")[0]
  }
  return String(val)
}

function mapRowToBooking(row: BookingRow): Booking {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    propertyId: Number(row.property_id),
    checkIn: formatDate(row.check_in),
    checkOut: formatDate(row.check_out),
    guests: Number(row.guests),
    totalAmount: Number(row.total_amount),
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  }
}

export async function createBooking(
  data: CreateBookingInput,
): Promise<Booking> {
  const userId = data.userId
  const propertyId = data.propertyId
  const checkIn = data.checkIn
  const checkOut = data.checkOut
  const guests = data.guests ?? 1
  const totalAmount = data.totalAmount
  const status = data.status ?? "pending"

  const result = await pool.query<BookingRow>(
    `
      INSERT INTO bookings (
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        created_at,
        updated_at
    `,
    [userId, propertyId, checkIn, checkOut, guests, totalAmount, status],
  )

  return mapRowToBooking(result.rows[0])
}

export async function findAllBookings(): Promise<Booking[]> {
  const result = await pool.query<BookingRow>(`
    SELECT
      id,
      user_id,
      property_id,
      check_in,
      check_out,
      guests,
      total_amount,
      status,
      created_at,
      updated_at
    FROM bookings
    ORDER BY id ASC
  `)

  return result.rows.map(mapRowToBooking)
}

export async function findBookingById(
  id: number,
): Promise<Booking | null> {
  const result = await pool.query<BookingRow>(
    `
      SELECT
        id,
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        created_at,
        updated_at
      FROM bookings
      WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToBooking(result.rows[0])
}

export async function deleteBooking(id: number): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM bookings
      WHERE id = $1
    `,
    [id],
  )

  return (result.rowCount ?? 0) > 0
}

export async function findBookingsByUserId(
  userId: number,
): Promise<Booking[]> {
  const result = await pool.query<BookingRow>(
    `
      SELECT
        id,
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        created_at,
        updated_at
      FROM bookings
      WHERE user_id = $1
      ORDER BY id ASC
    `,
    [userId],
  )

  return result.rows.map(mapRowToBooking)
}

export async function deleteBookingForUser(
  id: number,
  userId: number,
): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM bookings
      WHERE id = $1 AND user_id = $2
    `,
    [id, userId],
  )

  return (result.rowCount ?? 0) > 0
}
