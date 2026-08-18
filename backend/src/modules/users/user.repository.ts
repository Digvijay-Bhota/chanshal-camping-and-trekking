import { pool } from "../../db"

export type User = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type CreateUserInput = {
  name: string
  phone?: string | null
  email?: string | null
}

export type UserRow = {
  id: number | string
  name: string
  phone?: string | null
  email?: string | null
  created_at?: Date | string | null
  updated_at?: Date | string | null
}

function mapRowToUser(row: UserRow): User {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone ?? null,
    email: row.email ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  }
}

export async function findUserById(id: number): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `
      SELECT
        id,
        name,
        phone,
        email,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToUser(result.rows[0])
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `
      SELECT
        id,
        name,
        phone,
        email,
        created_at,
        updated_at
      FROM users
      WHERE email = $1
    `,
    [email],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToUser(result.rows[0])
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `
      SELECT
        id,
        name,
        phone,
        email,
        created_at,
        updated_at
      FROM users
      WHERE phone = $1
    `,
    [phone],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToUser(result.rows[0])
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const name = input.name
  const phone = input.phone ?? null
  const email = input.email ?? null

  const result = await pool.query<UserRow>(
    `
      INSERT INTO users (
        name,
        phone,
        email
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        phone,
        email,
        created_at,
        updated_at
    `,
    [name, phone, email],
  )

  return mapRowToUser(result.rows[0])
}
