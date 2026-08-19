import "dotenv/config"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured")
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
})

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err)
})
