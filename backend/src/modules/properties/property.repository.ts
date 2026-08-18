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
}

export async function findAllProperties(): Promise<Property[]> {
  const result = await pool.query(`
    SELECT
      id,
      name,
      description,
      property_type,
      location,
      price_per_night,
      rating,
      image_url
    FROM properties
    ORDER BY id ASC
  `)

  return result.rows.map(row => ({
    id: Number(row.id),
    name: row.name,
    description: row.description,
    propertyType: row.property_type,
    location: row.location,
    pricePerNight: Number(row.price_per_night),
    rating: Number(row.rating),
    imageUrl: row.image_url,
  }))
}

export async function findPropertyById(
  id: number,
): Promise<Property | null> {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        description,
        property_type,
        location,
        price_per_night,
        rating,
        image_url
      FROM properties
      WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]

  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    propertyType: row.property_type,
    location: row.location,
    pricePerNight: Number(row.price_per_night),
    rating: Number(row.rating),
    imageUrl: row.image_url,
  }
}