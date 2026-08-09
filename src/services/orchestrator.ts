import {
  findOrCreateCustomer,
  findOrCreateConversation,
  isHumanTakeover,
  saveMessage,
  recentMessages,
  appendCustomerNote,
} from "../db/repository";
import { isWithinBusinessHours } from "./businessHours";
import { runAgent } from "./llm";
import { handOffToSales } from "./salesHandoff";
import { sendTextMessage } from "./whatsapp";

export async function handleBatchedTurn(fromPhone: string, batchedMessages: string[]): Promise<void> {
  const { customer, isNew } = await findOrCreateCustomer(fromPhone);
  const conversation = await findOrCreateConversation(customer.id);

  if (await isHumanTakeover(conversation.id)) {
    // A team member owns this conversation directly — the bot stays silent.
    for (const text of batchedMessages) {
      await saveMessage(conversation.id, "inbound", text);
    }
    return;
  }

  const combinedText = batchedMessages.join("\n");
  await saveMessage(conversation.id, "inbound", combinedText);

  const history = await recentMessages(conversation.id, 40);
  const withinHours = isWithinBusinessHours();

  const { replyText, handoff, rememberedDetails } = await runAgent(customer, isNew, withinHours, history, combinedText);

  if (rememberedDetails) {
    try {
      for (const detail of rememberedDetails) {
        await appendCustomerNote(customer.id, detail);
      }
    } catch (err) {
      // Not remembering a detail shouldn't block the reply either.
      console.error(`Failed to save customer note for ${customer.id}:`, err);
    }
  }

  if (handoff) {
    try {
      await handOffToSales(
        conversation.id,
        customer,
        handoff.interest,
        history
          .slice(-6)
          .map((m) => `${m.direction === "inbound" ? "Customer" : "Bot"}: ${m.body}`)
          .join("\n")
      );
    } catch (err) {
      // The customer's reply must still go out even if the internal sales notification fails.
      console.error(`Failed to hand off lead for conversation ${conversation.id}:`, err);
    }
  }

  const replyParts = replyText
    .split("<<<SPLIT>>>")
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = 0; i < replyParts.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await saveMessage(conversation.id, "outbound", replyParts[i]);
    await sendTextMessage(fromPhone, replyParts[i]);
  }
}
