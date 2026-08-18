import { pool } from "./db"

async function testDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()")

    console.log("✅ Database connected")
    console.log("Database time:", result.rows[0].now)
  } catch (error) {
    console.error("❌ Database connection failed")
    console.error(error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

testDatabaseConnection()
