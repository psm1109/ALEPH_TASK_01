import { randomUUID } from 'node:crypto';
import { getSql } from './db.js';

export async function saveChallenge(type, challenge, userID = null) {
  const sql = getSql();
  const ceremonyId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await sql`DELETE FROM webauthn_challenges WHERE expires_at <= now()`;
  await sql`
    INSERT INTO webauthn_challenges (
      ceremony_id, ceremony_type, challenge, webauthn_user_id, expires_at
    ) VALUES (
      ${ceremonyId}, ${type}, ${challenge}, ${userID ? Buffer.from(userID) : null}, ${expiresAt}
    )
  `;

  return ceremonyId;
}

export async function consumeChallenge(ceremonyId, type) {
  if (typeof ceremonyId !== 'string') return null;
  const sql = getSql();
  const rows = await sql`
    DELETE FROM webauthn_challenges
    WHERE ceremony_id = ${ceremonyId}
      AND ceremony_type = ${type}
      AND expires_at > now()
    RETURNING challenge, webauthn_user_id
  `;
  return rows[0] || null;
}
