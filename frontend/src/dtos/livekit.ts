import z from "zod";

export const LiveKitFallbackSessionSchema = z.object({
  room_name: z.string(),
  livekit_url: z.string(),
  token: z.string(),
});

export type LiveKitFallbackSession = z.infer<
  typeof LiveKitFallbackSessionSchema
>;
