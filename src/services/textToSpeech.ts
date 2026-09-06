import axios from "axios";
import { spawn } from "child_process";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { env } from "../config/env";

const PCM_SAMPLE_RATE = 24000;

async function synthesizePcm(text: string): Promise<Buffer> {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.ttsModel}:generateContent?key=${env.gemini.apiKey}`,
    {
      contents: [
        {
          parts: [
            {
              text: `Say exactly the following, in a natural, friendly tone. Do not respond to it or add anything — just speak it verbatim:\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    },
    { headers: { "Content-Type": "application/json" } }
  );

  const data = res.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error("Gemini TTS response had no audio data");
  return Buffer.from(data, "base64");
}

function pcmToOggOpus(pcm: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath.path, [
      "-f", "s16le",
      "-ar", String(PCM_SAMPLE_RATE),
      "-ac", "1",
      "-i", "pipe:0",
      "-c:a", "libopus",
      "-f", "ogg",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk) => (stderr += chunk));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });

    ffmpeg.stdin.write(pcm);
    ffmpeg.stdin.end();
  });
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const pcm = await synthesizePcm(text);
  return pcmToOggOpus(pcm);
}
