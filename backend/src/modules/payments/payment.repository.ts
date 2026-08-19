import { pool } from "../../db"

export type Payment = {
  id: number
  bookingId: number
  userId: number
  provider: string
  providerPaymentId: string | null
  providerOrderId: string | null
  providerSignature: string | null
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  errorMessage: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type PaymentRow = {
  id: number | string
  booking_id: number | string
  user_id: number | string
  provider: string
  provider_payment_id: string | null
  provider_order_id: string | null
  provider_signature: string | null
  amount: number | string
  currency: string
  status: string
  payment_method: string | null
  error_message: string | null
  created_at?: Date | string | null
  updated_at?: Date | string | null
}

function mapRowToPayment(row: PaymentRow): Payment {
  return {
    id: Number(row.id),
    bookingId: Number(row.booking_id),
    userId: Number(row.user_id),
    provider: row.provider,
    providerPaymentId: row.provider_payment_id ?? null,
    providerOrderId: row.provider_order_id ?? null,
    providerSignature: row.provider_signature ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method ?? null,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  }
}

export type CreatePaymentInput = {
  bookingId: number
  userId: number
  provider: string
  providerOrderId?: string | null
  providerPaymentId?: string | null
  providerSignature?: string | null
  amount: number
  currency?: string
  status?: string
  paymentMethod?: string | null
  errorMessage?: string | null
}

export async function createPaymentRecord(
  input: CreatePaymentInput,
): Promise<Payment> {
  const bookingId = input.bookingId
  const userId = input.userId
  const provider = input.provider
  const providerOrderId = input.providerOrderId ?? null
  const providerPaymentId = input.providerPaymentId ?? null
  const providerSignature = input.providerSignature ?? null
  const amount = input.amount
  const currency = input.currency ?? "INR"
  const status = input.status ?? "created"
  const paymentMethod = input.paymentMethod ?? null
  const errorMessage = input.errorMessage ?? null

  const result = await pool.query<PaymentRow>(
    `
      INSERT INTO payments (
        booking_id,
        user_id,
        provider,
        provider_order_id,
        provider_payment_id,
        provider_signature,
        amount,
        currency,
        status,
        payment_method,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        booking_id,
        user_id,
        provider,
        provider_payment_id,
        provider_order_id,
        provider_signature,
        amount,
        currency,
        status,
        payment_method,
        error_message,
        created_at,
        updated_at
    `,
    [
      bookingId,
      userId,
      provider,
      providerOrderId,
      providerPaymentId,
      providerSignature,
      amount,
      currency,
      status,
      paymentMethod,
      errorMessage,
    ],
  )

  return mapRowToPayment(result.rows[0])
}

export async function findPaymentByOrderId(
  orderId: string,
): Promise<Payment | null> {
  const result = await pool.query<PaymentRow>(
    `
      SELECT
        id,
        booking_id,
        user_id,
        provider,
        provider_payment_id,
        provider_order_id,
        provider_signature,
        amount,
        currency,
        status,
        payment_method,
        error_message,
        created_at,
        updated_at
      FROM payments
      WHERE provider_order_id = $1
    `,
    [orderId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToPayment(result.rows[0])
}

export type UpdatePaymentInput = {
  status?: string
  providerPaymentId?: string | null
  providerSignature?: string | null
  paymentMethod?: string | null
  errorMessage?: string | null
}

export async function updatePaymentRecord(
  id: number,
  input: UpdatePaymentInput,
): Promise<Payment | null> {
  const updates: string[] = []
  const values: (string | number | null)[] = []
  let paramIndex = 1

  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`)
    values.push(input.status)
  }

  if (input.providerPaymentId !== undefined) {
    updates.push(`provider_payment_id = $${paramIndex++}`)
    values.push(input.providerPaymentId)
  }

  if (input.providerSignature !== undefined) {
    updates.push(`provider_signature = $${paramIndex++}`)
    values.push(input.providerSignature)
  }

  if (input.paymentMethod !== undefined) {
    updates.push(`payment_method = $${paramIndex++}`)
    values.push(input.paymentMethod)
  }

  if (input.errorMessage !== undefined) {
    updates.push(`error_message = $${paramIndex++}`)
    values.push(input.errorMessage)
  }

  if (updates.length === 0) {
    const res = await pool.query<PaymentRow>(
      `
        SELECT
          id,
          booking_id,
          user_id,
          provider,
          provider_payment_id,
          provider_order_id,
          provider_signature,
          amount,
          currency,
          status,
          payment_method,
          error_message,
          created_at,
          updated_at
        FROM payments
        WHERE id = $1
      `,
      [id],
    )
    return res.rows.length > 0 ? mapRowToPayment(res.rows[0]) : null
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)
  const idParamIndex = paramIndex

  const query = `
    UPDATE payments
    SET ${updates.join(", ")}
    WHERE id = $${idParamIndex}
    RETURNING
      id,
      booking_id,
      user_id,
      provider,
      provider_payment_id,
      provider_order_id,
      provider_signature,
      amount,
      currency,
      status,
      payment_method,
      error_message,
      created_at,
      updated_at
  `

  const result = await pool.query<PaymentRow>(query, values)

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToPayment(result.rows[0])
}

export async function capturePaymentAndConfirmBooking(
  paymentId: number,
  bookingId: number,
  providerPaymentId: string,
  providerSignature: string,
): Promise<{ payment: Payment; bookingPaymentStatus: string; bookingStatus: string }> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const paymentRes = await client.query<PaymentRow>(
      `
        UPDATE payments
        SET status = 'captured',
            provider_payment_id = $2,
            provider_signature = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          booking_id,
          user_id,
          provider,
          provider_payment_id,
          provider_order_id,
          provider_signature,
          amount,
          currency,
          status,
          payment_method,
          error_message,
          created_at,
          updated_at
      `,
      [paymentId, providerPaymentId, providerSignature],
    )

    await client.query(
      `
        UPDATE bookings
        SET payment_status = 'paid',
            status = 'confirmed',
            updated_at = NOW()
        WHERE id = $1
      `,
      [bookingId],
    )

    await client.query("COMMIT")

    return {
      payment: mapRowToPayment(paymentRes.rows[0]),
      bookingPaymentStatus: "paid",
      bookingStatus: "confirmed",
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function markPaymentFailed(
  paymentId: number,
  errorMessage: string | null,
): Promise<Payment | null> {
  const result = await pool.query<PaymentRow>(
    `
      UPDATE payments
      SET status = 'failed',
          error_message = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        booking_id,
        user_id,
        provider,
        provider_payment_id,
        provider_order_id,
        provider_signature,
        amount,
        currency,
        status,
        payment_method,
        error_message,
        created_at,
        updated_at
    `,
    [paymentId, errorMessage],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToPayment(result.rows[0])
}
