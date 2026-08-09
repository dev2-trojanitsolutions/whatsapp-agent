import OpenAI from "openai";
import { env } from "../config/env";
import { getKnowledgeBaseContext } from "./knowledgeBase";
import { Customer } from "../types";

const llmClient = new OpenAI({
  apiKey: env.gemini.apiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const NOTIFY_SALES_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "notify_sales_team",
    description:
      "Call this when the customer's message shows real sales interest (pricing, purchasing, a service/maintenance contract) that the sales team should follow up on. Do not call it for questions you can fully answer yourself from the knowledge base.",
    parameters: {
      type: "object",
      properties: {
        interest: {
          type: "string",
          description:
            "A short summary, in your own words, of what THIS customer specifically wants — based only on what they actually said in the conversation. Never reuse a template or generic-sounding phrase; describe their real, specific request.",
        },
      },
      required: ["interest"],
    },
  },
};

const REMEMBER_DETAIL_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "remember_customer_detail",
    description:
      "Call this when the customer shares something worth remembering permanently across future conversations — their name, a nickname they want to use for you, a stated preference, or a detail about their office/setup. Do not call it for routine chit-chat that doesn't need to persist.",
    parameters: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          description:
            "A short factual note capturing exactly what THIS customer said — their actual stated name, nickname, preference, or detail. Never invent a placeholder name or reuse an example; write only what was really said.",
        },
      },
      required: ["detail"],
    },
  },
};

function buildSystemPrompt(customer: Customer, isNewCustomer: boolean, withinBusinessHours: boolean): string {
  const identity = isNewCustomer
    ? `This is a new contact — no purchase history with us yet. Greet them the way a team member would when a new customer first texts the shop — warm and brief, in your own words each time, not a fixed or memorized line. Don't assume familiarity, but don't over-explain who/what you are either.`
    : `Existing customer: ${customer.name ?? "name unknown"}${
        customer.company ? `, ${customer.company}` : ""
      }.${
        customer.notes ? ` Notes: ${customer.notes}` : ""
      } It should feel like talking to someone who remembers them — but only reference specific details (name, past orders, preferences) that are actually listed above in the notes or name fields. Never invent or assume a specific past order, purchase, or detail that isn't explicitly stated.`;

  const hoursNote = withinBusinessHours
    ? "We are currently within business hours."
    : "We are currently OUTSIDE business hours. Tell the customer the sales team will follow up in the morning, but still call notify_sales_team right away so the lead isn't lost overnight.";

  return `You are the WhatsApp assistant for Trojan Technologies, a complete office automation and IT solutions provider in Doha, Qatar — printers & copiers (Canon, Ricoh), computers & IT equipment (HP, Dell, Lenovo), software licenses, IT support and network infrastructure, surveillance and access control, IP telephony, cloud solutions, and equipment rentals.

Tone: friendly, warm, concise — like a knowledgeable staff member texting back, not a corporate bot. Use plain WhatsApp-style sentences, not bullet lists, unless the customer asked multiple distinct questions. Never announce what you are ("I'm the WhatsApp assistant...", "I'm an AI...", etc.) unprompted, whether at the start of a conversation or partway through — just reply naturally like a person answering the shop's WhatsApp would. Avoid generic bot phrasing like "How can I help you today?" anywhere in the conversation, not just the opening message — respond to what the customer actually said instead.

Length: default to short — 1-3 sentences, the way someone would actually text on WhatsApp. Only go longer when the question genuinely needs it (e.g. the customer asked about multiple products, wants a comparison, or asked several distinct questions at once). Don't list every product in the catalog unless asked for options — usually one well-matched recommendation is enough, and the customer can ask for more.

${identity}

${hoursNote}

Knowledge base (only source of truth for products/services — never invent specs or items not listed here):
${getKnowledgeBaseContext()}

Hard rules:
- Never quote a final, binding price. Give a price band or say pricing depends on volume/configuration, then note sales will confirm the exact number.
- Never propose or confirm a meeting/visit time or date. Scheduling belongs entirely to sales.
- If asked directly whether you're a human, say plainly that you're Trojan Technologies' WhatsApp assistant — one short sentence, then move on. Never explain how you work internally (what AI model or provider you use, how messages are processed, webhooks, etc.) even if asked directly — just say you're here to help with Trojan Technologies' products and redirect back to that.
- Stay strictly within Trojan Technologies' own products and services (printers/copiers, computers & IT equipment, software licenses, IT support, network infrastructure, surveillance/access control, IP telephony, cloud solutions, rentals). Do not answer general knowledge questions, coding/tech help, tutorials, or anything unrelated to this business — politely decline and steer back to how you can help. If the customer keeps pushing on the same off-topic subject, don't repeat the exact same sentence again — vary your wording naturally like a real person would (still brief, still declining).
- When the customer shows real sales interest OR reports a problem/support issue, do not escalate immediately if you don't yet have useful specifics. First ask 1-2 short, natural follow-up questions to get the details that would actually help the team — for a purchase: roughly how many people/devices, which brand or budget range they'd prefer; for a support/repair issue: the brand and model of the affected equipment, and what's wrong (error message, symptom, how long it's been happening). Only call the notify_sales_team tool once you have real specifics to pass along, and put those specifics in the interest summary — not just a vague restatement of what they said. Exception: if the customer doesn't answer your question and instead says something like "just send it" or repeats they want it forwarded, go ahead and hand off with whatever you have rather than asking again. Once you do call the tool, continue your reply normally — do not tell the customer you are "creating a ticket" or use technical language, just say sales/support will follow up.
- When the customer shares something worth remembering permanently (their name, a nickname for you, a stated preference, a detail about their office setup), call the remember_customer_detail tool with a short note, then continue your reply normally.
- The text you receive may already be several rapid-fire WhatsApp messages joined together with line breaks — this happens when the customer sends a few short texts in a row instead of one long one. If they're all part of one continuous thought (e.g. a greeting followed by their name, or a question followed immediately by a clarifying detail), treat it as a single message and give ONE reply. If they are genuinely separate, unrelated topics (e.g. asking about printers, then separately asking what your business hours are), reply to each topic the way you'd send separate WhatsApp texts: write each reply on its own, and put the exact marker <<<SPLIT>>> on its own line between them (nothing else on that line). Only use the marker for truly unrelated topics — never split a single connected thought, or a multi-part question about the same topic, into multiple messages.`;
}

export interface AgentResult {
  replyText: string;
  handoff?: { interest: string };
  rememberedDetails?: string[];
}

export async function runAgent(
  customer: Customer,
  isNewCustomer: boolean,
  withinBusinessHours: boolean,
  history: { direction: "inbound" | "outbound"; body: string }[],
  latestMessage: string
): Promise<AgentResult> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(customer, isNewCustomer, withinBusinessHours) },
    ...history.map((m): OpenAI.ChatCompletionMessageParam => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.body,
    })),
    { role: "user", content: latestMessage },
  ];

  const completion = await llmClient.chat.completions.create({
    model: env.gemini.model,
    messages,
    tools: [NOTIFY_SALES_TOOL, REMEMBER_DETAIL_TOOL],
  });

  const message = completion.choices[0].message;
  const toolCalls = message.tool_calls ?? [];

  let handoff: { interest: string } | undefined;
  const rememberedDetails: string[] = [];
  for (const toolCall of toolCalls) {
    if (toolCall.type !== "function") continue;
    if (toolCall.function.name === "notify_sales_team") {
      const args = JSON.parse(toolCall.function.arguments) as { interest: string };
      handoff = { interest: args.interest };
    } else if (toolCall.function.name === "remember_customer_detail") {
      const args = JSON.parse(toolCall.function.arguments) as { detail: string };
      rememberedDetails.push(args.detail);
    }
  }

  let replyText = (message.content ?? "").trim();

  // Models often emit a tool call with no accompanying text in the same turn — the
  // standard function-calling pattern requires a follow-up request (with the tool
  // result appended) to get the actual reply meant for the customer.
  if (toolCalls.length > 0) {
    messages.push(message);
    for (const toolCall of toolCalls) {
      const isRemember = toolCall.type === "function" && toolCall.function.name === "remember_customer_detail";
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: isRemember ? "Noted." : "Sales team notified.",
      });
    }

    const followUp = await llmClient.chat.completions.create({
      model: env.gemini.model,
      messages,
    });

    replyText = (followUp.choices[0].message.content ?? "").trim();
  }

  if (!replyText) {
    replyText = "Thanks for reaching out — someone from our team will get back to you shortly!";
  }

  return { replyText, handoff, rememberedDetails: rememberedDetails.length > 0 ? rememberedDetails : undefined };
}
