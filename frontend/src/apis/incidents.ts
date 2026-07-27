import { IncidentDto, IncidentDtoSchema } from "@/dtos/incidents";
import axios from "axios";
import { removeUndefinedFields } from "../lib/utils";

async function readIncidents(payload: {
  page: number;
  size: number;
  pattern?: string;
}): Promise<IncidentDto[]> {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/incidents/`;
  const response = await axios.get(url, {
    params: removeUndefinedFields(payload),
  });
  return response.data.map((res: unknown) => {
    const result = IncidentDtoSchema.safeParse(res);
    if (result.success) return result.data;
    else {
      console.log("invalid data: ", (res as any).id);
      console.log(result.error);
      return res;
    }
  });
}

function connectIncidentEvenSource({
  onopen,
  onmessage,
  onerror,
}: {
  onopen: ((this: EventSource, ev: Event) => any) | null;
  onmessage: ((this: EventSource, ev: MessageEvent<any>) => any) | null;
  onerror: ((this: EventSource, ev: Event) => any) | null;
}): EventSource {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/incidents/stream`;
  const eventSource = new EventSource(url);
  eventSource.onopen = onopen;
  eventSource.onmessage = onmessage;
  eventSource.onerror = onerror;
  return eventSource;
}

export const IncidentApi = {
  readIncidents,
  connectIncidentEvenSource,
};
