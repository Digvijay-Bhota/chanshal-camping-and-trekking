import { pool } from "../../db"

export type Property = {
  id: number
  name: string
  description: string | null
  propertyType: string
  location: string
  pricePerNight: number
  rating: number
  imageUrl: string | null
  isActive: boolean
  capacity: number
}

export type PropertyRow = {
  id: number | string
  name: string
  description: string | null
  property_type: string
  location: string
  price_per_night: number | string
  rating: number | string
  image_url: string | null
  is_active: boolean
  capacity: number | string
}

function mapRowToProperty(row: PropertyRow): Property {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    propertyType: row.property_type,
    location: row.location,
    pricePerNight: Number(row.price_per_night),
    rating: Number(row.rating),
    imageUrl: row.image_url,
    isActive: Boolean(row.is_active),
    capacity: Number(row.capacity),
  }
}

export async function findAllProperties(): Promise<Property[]> {
  const result = await pool.query<PropertyRow>(`
    SELECT
      id,
      name,
      description,
      property_type,
      location,
      price_per_night,
      rating,
      image_url,
      is_active,
      capacity
    FROM properties
    WHERE is_active = TRUE
    ORDER BY id ASC
  `)

  return result.rows.map(mapRowToProperty)
}

export async function findPropertyById(
  id: number,
): Promise<Property | null> {
  const result = await pool.query<PropertyRow>(
    `
      SELECT
        id,
        name,
        description,
        property_type,
        location,
        price_per_night,
        rating,
        image_url,
        is_active,
        capacity
      FROM properties
      WHERE id = $1
        AND is_active = TRUE
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToProperty(result.rows[0])
}

export async function findAllPropertiesForAdmin(): Promise<Property[]> {
  const result = await pool.query<PropertyRow>(`
    SELECT
      id,
      name,
      description,
      property_type,
      location,
      price_per_night,
      rating,
      image_url,
      is_active,
      capacity
    FROM properties
    ORDER BY id ASC
  `)

  return result.rows.map(mapRowToProperty)
}

export type CreatePropertyInput = {
  name: string
  description?: string | null
  propertyType: string
  location: string
  pricePerNight: number
  rating?: number
  imageUrl?: string | null
  capacity?: number
}

export async function createProperty(
  input: CreatePropertyInput,
): Promise<Property> {
  const name = input.name
  const description = input.description ?? null
  const propertyType = input.propertyType
  const location = input.location
  const pricePerNight = input.pricePerNight
  const rating = input.rating ?? 0
  const imageUrl = input.imageUrl ?? null
  const capacity = input.capacity ?? 10

  const result = await pool.query<PropertyRow>(
    `
      INSERT INTO properties (
        name,
        description,
        property_type,
        location,
        price_per_night,
        rating,
        image_url,
        capacity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        name,
        description,
        property_type,
        location,
        price_per_night,
        rating,
        image_url,
        is_active,
        capacity
    `,
    [name, description, propertyType, location, pricePerNight, rating, imageUrl, capacity],
  )

  return mapRowToProperty(result.rows[0])
}

export type UpdatePropertyInput = {
  name?: string
  description?: string | null
  propertyType?: string
  location?: string
  pricePerNight?: number
  rating?: number
  imageUrl?: string | null
  capacity?: number
}

export async function updateProperty(
  id: number,
  input: UpdatePropertyInput,
): Promise<Property | null> {
  const updates: string[] = []
  const values: (string | number | boolean | null)[] = []
  let paramIndex = 1

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(input.name)
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(input.description)
  }

  if (input.propertyType !== undefined) {
    updates.push(`property_type = $${paramIndex++}`)
    values.push(input.propertyType)
  }

  if (input.location !== undefined) {
    updates.push(`location = $${paramIndex++}`)
    values.push(input.location)
  }

  if (input.pricePerNight !== undefined) {
    updates.push(`price_per_night = $${paramIndex++}`)
    values.push(input.pricePerNight)
  }

  if (input.rating !== undefined) {
    updates.push(`rating = $${paramIndex++}`)
    values.push(input.rating)
  }

  if (input.imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    values.push(input.imageUrl)
  }

  if (input.capacity !== undefined) {
    updates.push(`capacity = $${paramIndex++}`)
    values.push(input.capacity)
  }

  if (updates.length === 0) {
    const res = await pool.query<PropertyRow>(
      `SELECT id, name, description, property_type, location, price_per_night, rating, image_url, is_active, capacity FROM properties WHERE id = $1`,
      [id],
    )
    return res.rows.length > 0 ? mapRowToProperty(res.rows[0]) : null
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)
  const idParamIndex = paramIndex

  const query = `
    UPDATE properties
    SET ${updates.join(", ")}
    WHERE id = $${idParamIndex}
    RETURNING
      id,
      name,
      description,
      property_type,
      location,
      price_per_night,
      rating,
      image_url,
      is_active,
      capacity
  `

  const result = await pool.query<PropertyRow>(query, values)

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToProperty(result.rows[0])
}

export async function setPropertyActive(
  id: number,
  isActive: boolean,
): Promise<Property | null> {
  const result = await pool.query<PropertyRow>(
    `
      UPDATE properties
      SET is_active = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        description,
        property_type,
        location,
        price_per_night,
        rating,
        image_url,
        is_active,
        capacity
    `,
    [id, isActive],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToProperty(result.rows[0])
}