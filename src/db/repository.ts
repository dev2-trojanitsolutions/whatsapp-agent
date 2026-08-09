import { pool } from "./pool";
import { Customer, Conversation } from "../types";

export async function findOrCreateCustomer(phoneE164: string): Promise<{ customer: Customer; isNew: boolean }> {
  const existing = await pool.query<Customer>(
    "SELECT * FROM customers WHERE phone_e164 = $1",
    [phoneE164]
  );
  if (existing.rows[0]) {
    return { customer: existing.rows[0], isNew: false };
  }

  const created = await pool.query<Customer>(
    `INSERT INTO customers (phone_e164, status) VALUES ($1, 'prospect') RETURNING *`,
    [phoneE164]
  );
  return { customer: created.rows[0], isNew: true };
}

export async function findOrCreateConversation(customerId: string): Promise<Conversation> {
  const existing = await pool.query<Conversation>(
    "SELECT * FROM conversations WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1",
    [customerId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await pool.query<Conversation>(
    "INSERT INTO conversations (customer_id) VALUES ($1) RETURNING *",
    [customerId]
  );
  return created.rows[0];
}

export async function isHumanTakeover(conversationId: string): Promise<boolean> {
  const result = await pool.query<{ human_takeover: boolean }>(
    "SELECT human_takeover FROM conversations WHERE id = $1",
    [conversationId]
  );
  return result.rows[0]?.human_takeover ?? false;
}

export async function saveMessage(
  conversationId: string,
  direction: "inbound" | "outbound",
  body: string
): Promise<void> {
  await pool.query(
    "INSERT INTO messages (conversation_id, direction, body) VALUES ($1, $2, $3)",
    [conversationId, direction, body]
  );
  await pool.query("UPDATE conversations SET updated_at = now() WHERE id = $1", [conversationId]);
}

export async function createLead(conversationId: string, interest: string): Promise<void> {
  await pool.query(
    "INSERT INTO leads (conversation_id, interest) VALUES ($1, $2)",
    [conversationId, interest]
  );
}

export async function appendCustomerNote(customerId: string, note: string): Promise<void> {
  await pool.query(
    "UPDATE customers SET notes = COALESCE(notes || E'\n', '') || $2 WHERE id = $1",
    [customerId, note]
  );
}

export async function recentMessages(conversationId: string, limit = 40) {
  const result = await pool.query<{ direction: "inbound" | "outbound"; body: string }>(
    `SELECT direction, body FROM (
       SELECT direction, body, sent_at FROM messages WHERE conversation_id = $1 ORDER BY sent_at DESC LIMIT $2
     ) recent ORDER BY sent_at ASC`,
    [conversationId, limit]
  );
  return result.rows;
}
