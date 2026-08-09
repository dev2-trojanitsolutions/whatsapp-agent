import { env } from "../config/env";
import { createLead } from "../db/repository";
import { sendTextMessage } from "./whatsapp";
import { Customer } from "../types";

export async function handOffToSales(
  conversationId: string,
  customer: Customer,
  interest: string,
  transcriptSummary: string
): Promise<void> {
  await createLead(conversationId, interest);

  const label = customer.name ? `${customer.name} (${customer.phone_e164})` : customer.phone_e164;

  await sendTextMessage(
    env.salesTestNumber,
    `New sales lead — Trojan Technologies\n` +
      `Customer: ${label}\n` +
      `Interest: ${interest}\n\n` +
      `${transcriptSummary}`
  );
}
