import jwt, { JwtPayload } from "jsonwebtoken"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.trim() === "") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or empty.",
    )
  }
  return secret.trim()
}

export type AuthTokenPayload = JwtPayload & {
  userId: number
}

export function signAuthToken(userId: number): string {
  const secret = getJwtSecret()
  return jwt.sign({ userId }, secret, {
    algorithm: "HS256",
    expiresIn: "7d",
  })
}

export function verifyAuthToken(token: string): number {
  const secret = getJwtSecret()
  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"],
  })

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("userId" in decoded) ||
    typeof (decoded as AuthTokenPayload).userId !== "number"
  ) {
    throw new Error("Invalid token payload structure")
  }

  return (decoded as AuthTokenPayload).userId
}
