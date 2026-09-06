import axios from "axios";
import { env } from "../config/env";

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`,
    {
      contents: [
        {
          parts: [
            {
              text: "Transcribe this audio message exactly as spoken, in its original language. Return only the transcription text, with no extra commentary.",
            },
            { inlineData: { mimeType, data: buffer.toString("base64") } },
          ],
        },
      ],
    },
    { headers: { "Content-Type": "application/json" } }
  );

  console.log(res,'this is the response from the gemini api');

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim();
}
