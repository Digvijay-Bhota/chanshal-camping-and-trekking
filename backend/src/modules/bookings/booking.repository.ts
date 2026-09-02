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
  paymentStatus: string
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
  payment_status: string
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
    paymentStatus: row.payment_status || "unpaid",
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
        status,
        payment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid')
      RETURNING
        id,
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        payment_status,
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
      payment_status,
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
        payment_status,
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
        payment_status,
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

export async function cancelBookingForUser(
  id: number,
  userId: number,
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE bookings
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND status != 'cancelled'
    `,
    [id, userId],
  )

  return (result.rowCount ?? 0) > 0
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

export async function findOverlappingBooking(
  propertyId: number,
  checkIn: string,
  checkOut: string,
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
        payment_status,
        created_at,
        updated_at
      FROM bookings
      WHERE property_id = $1
        AND status != 'cancelled'
        AND check_in < $3
        AND check_out > $2
      LIMIT 1
    `,
    [propertyId, checkIn, checkOut],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToBooking(result.rows[0])
}

export async function findRecentDuplicateBooking(
  userId: number,
  propertyId: number,
  checkIn: string,
  checkOut: string,
  guests: number,
  totalAmount: number,
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
        payment_status,
        created_at,
        updated_at
      FROM bookings
      WHERE user_id = $1
        AND property_id = $2
        AND check_in = $3
        AND check_out = $4
        AND guests = $5
        AND total_amount = $6
        AND status != 'cancelled'
        AND created_at >= NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `,
    [userId, propertyId, checkIn, checkOut, guests, totalAmount],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToBooking(result.rows[0])
}

export type CreateBookingTransactionInput = {
  userId: number
  propertyId: number
  phone: string
  checkIn: string
  checkOut: string
  guests: number
  days: number
}

export type CreateBookingTransactionResult =
  | { status: "success"; booking: Booking }
  | { status: "user_not_found" }
  | { status: "camp_not_found" }
  | { status: "overlap" }
  | { status: "capacity_unavailable" }
  | { status: "availability_blocked" }

export async function createBookingTransaction(
  input: CreateBookingTransactionInput,
): Promise<CreateBookingTransactionResult> {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // 1. Check user exists
    const userRes = await client.query(
      `
        SELECT id, phone
        FROM users
        WHERE id = $1
      `,
      [input.userId],
    )
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK")
      return { status: "user_not_found" }
    }
    const userRow = userRes.rows[0]

    // 2. Update user phone if needed
    const trimmedPhone = input.phone.trim()
    if (trimmedPhone && trimmedPhone !== userRow.phone) {
      await client.query(
        `
          UPDATE users
          SET phone = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [input.userId, trimmedPhone],
      )
    }

    // 3. Check property exists & lock property row to serialize concurrent booking attempts for this camp
    const propRes = await client.query(
      `
        SELECT id, price_per_night, capacity
        FROM properties
        WHERE id = $1
        FOR UPDATE
      `,
      [input.propertyId],
    )
    if (propRes.rows.length === 0) {
      await client.query("ROLLBACK")
      return { status: "camp_not_found" }
    }
    const pricePerNight = Number(propRes.rows[0].price_per_night)
    const capacity = Number(propRes.rows[0].capacity)

    // 3.5 Check Availability Blocks (Blackouts)
    const blockRes = await client.query(
      `
        SELECT 1
        FROM property_availability_blocks
        WHERE property_id = $1
          AND start_date < $3
          AND end_date > $2
        LIMIT 1
      `,
      [input.propertyId, input.checkIn, input.checkOut]
    )
    if (blockRes.rows.length > 0) {
      await client.query("ROLLBACK")
      return { status: "availability_blocked" }
    }

    // 4. Overlap & Capacity check
    const capacityRes = await client.query(
      `
        SELECT COALESCE(SUM(guests), 0) as booked_guests
        FROM bookings
        WHERE property_id = $1
          AND status != 'cancelled'
          AND check_in < $3
          AND check_out > $2
      `,
      [input.propertyId, input.checkIn, input.checkOut],
    )
    const bookedGuests = Number(capacityRes.rows[0].booked_guests)
    const availableCapacity = capacity - bookedGuests
    if (input.guests > availableCapacity) {
      await client.query("ROLLBACK")
      return { status: "capacity_unavailable" }
    }

    // 5. Booking INSERT
    const totalAmount = pricePerNight * input.guests * input.days

    const insertRes = await client.query<BookingRow>(
      `
        INSERT INTO bookings (
          user_id,
          property_id,
          check_in,
          check_out,
          guests,
          total_amount,
          status,
          payment_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid')
        RETURNING
          id,
          user_id,
          property_id,
          check_in,
          check_out,
          guests,
          total_amount,
          status,
          payment_status,
          created_at,
          updated_at
      `,
      [
        input.userId,
        input.propertyId,
        input.checkIn,
        input.checkOut,
        input.guests,
        totalAmount,
        "pending",
      ],
    )

    await client.query("COMMIT")
    return {
      status: "success",
      booking: mapRowToBooking(insertRes.rows[0]),
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export type AdminBooking = {
  id: number
  userId: number
  propertyId: number
  checkIn: string
  checkOut: string
  guests: number
  totalAmount: number
  status: string
  paymentStatus: string
  createdAt?: Date
  updatedAt?: Date
  user: {
    id: number
    name: string
    email: string | null
    phone: string | null
  }
  camp: {
    id: number
    name: string
    location: string
    price: number
    rating: number
    image: string | null
  }
}

export type AdminBookingRow = {
  id: number | string
  user_id: number | string
  property_id: number | string
  check_in: string | Date
  check_out: string | Date
  guests: number | string
  total_amount: number | string
  status: string
  payment_status: string
  created_at?: Date | string | null
  updated_at?: Date | string | null
  user_name: string
  user_email?: string | null
  user_phone?: string | null
  property_name: string
  property_location: string
  property_price: number | string
  property_rating: number | string
  property_image?: string | null
}

function mapRowToAdminBooking(row: AdminBookingRow): AdminBooking {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    propertyId: Number(row.property_id),
    checkIn: formatDate(row.check_in),
    checkOut: formatDate(row.check_out),
    guests: Number(row.guests),
    totalAmount: Number(row.total_amount),
    status: row.status,
    paymentStatus: row.payment_status || "unpaid",
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    user: {
      id: Number(row.user_id),
      name: row.user_name,
      email: row.user_email ?? null,
      phone: row.user_phone ?? null,
    },
    camp: {
      id: Number(row.property_id),
      name: row.property_name,
      location: row.property_location,
      price: Number(row.property_price),
      rating: Number(row.property_rating),
      image: row.property_image ?? null,
    },
  }
}

export async function findAllBookingsWithDetails(): Promise<AdminBooking[]> {
  const result = await pool.query<AdminBookingRow>(`
    SELECT
      b.id,
      b.user_id,
      b.property_id,
      b.check_in,
      b.check_out,
      b.guests,
      b.total_amount,
      b.status,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.name AS user_name,
      u.email AS user_email,
      u.phone AS user_phone,
      p.name AS property_name,
      p.location AS property_location,
      p.price_per_night AS property_price,
      p.rating AS property_rating,
      p.image_url AS property_image
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN properties p ON b.property_id = p.id
    ORDER BY b.id DESC
  `)

  return result.rows.map(mapRowToAdminBooking)
}

export async function updateBookingStatus(
  id: number,
  currentStatus: string,
  newStatus: string,
): Promise<Booking | null> {
  const result = await pool.query<BookingRow>(
    `
      UPDATE bookings
      SET status = $3,
          updated_at = NOW()
      WHERE id = $1
        AND status = $2
      RETURNING
        id,
        user_id,
        property_id,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        payment_status,
        created_at,
        updated_at
    `,
    [id, currentStatus, newStatus],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToBooking(result.rows[0])
}

