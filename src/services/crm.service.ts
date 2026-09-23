import axios from "axios";
import { env } from "../config/env";

/**
 * Envío de leads al CRM. Proveedores:
 * - CRM_PROVIDER=kommo → API v4 de Kommo (lead + contacto + nota).
 * - CRM_WEBHOOK_URL    → POST JSON genérico (Make, Zapier, n8n...).
 * Si no hay nada configurado el lead queda "skipped". Nunca lanza.
 */

export interface CrmLead {
  _id: unknown;
  kind: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  refCode: string;
  sourceUrl: string;
  sellSector?: string;
  sellPropertyType?: string;
  link?: string;
  createdAt?: Date;
}

export interface CrmResult {
  status: "sent" | "failed" | "skipped";
  error: string;
  externalId: string;
  sentAt: Date | null;
}

const TIMEOUT_MS = 10000;

const KIND_LABELS: Record<string, string> = {
  property: "Propiedad",
  project: "Proyecto",
  unit: "Unidad",
  sell: "Vender propiedad",
  general: "Contacto",
  "work-with-us": "Trabaja con nosotros",
  interested: "Interesado",
};

function isKommoConfigured(): boolean {
  return (
    env.CRM_PROVIDER.toLowerCase() === "kommo" && !!env.KOMMO_SUBDOMAIN && !!env.KOMMO_ACCESS_TOKEN
  );
}

function noteText(lead: CrmLead): string {
  return [
    lead.message && `Mensaje: ${lead.message}`,
    lead.refCode && `Código: ${lead.refCode}`,
    lead.sellSector && `Sector a vender: ${lead.sellSector}`,
    lead.sellPropertyType && `Tipo a vender: ${lead.sellPropertyType}`,
    lead.link && `Inmueble: ${lead.link}`,
    lead.sourceUrl && `Origen: ${lead.sourceUrl}`,
    lead.email && `Correo: ${lead.email}`,
    lead.phone && `Teléfono: ${lead.phone}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendToKommo(lead: CrmLead): Promise<string> {
  const base = `https://${env.KOMMO_SUBDOMAIN}.kommo.com/api/v4`;
  const headers = {
    Authorization: `Bearer ${env.KOMMO_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };

  const customFields: unknown[] = [];
  if (lead.phone) {
    customFields.push({ field_code: "PHONE", values: [{ value: lead.phone, enum_code: "WORK" }] });
  }
  if (lead.email) {
    customFields.push({ field_code: "EMAIL", values: [{ value: lead.email, enum_code: "WORK" }] });
  }

  const payload: Record<string, unknown> = {
    name: `${KIND_LABELS[lead.kind] || lead.kind} - ${lead.refCode || lead.name}`,
    _embedded: {
      contacts: [{ first_name: lead.name, custom_fields_values: customFields }],
    },
  };
  const pipelineId = Number(env.KOMMO_PIPELINE_ID);
  if (pipelineId) payload.pipeline_id = pipelineId;

  const { data } = await axios.post(`${base}/leads/complex`, [payload], {
    headers,
    timeout: TIMEOUT_MS,
  });
  const leadId = Array.isArray(data) ? data[0]?.id : data?._embedded?.leads?.[0]?.id;
  if (!leadId) throw new Error("Kommo no devolvió el id del lead");

  const text = noteText(lead);
  if (text) {
    try {
      await axios.post(
        `${base}/leads/${leadId}/notes`,
        [{ note_type: "common", params: { text } }],
        { headers, timeout: TIMEOUT_MS },
      );
    } catch (error) {
      // El lead ya existe en Kommo; perder la nota no justifica marcarlo como fallido.
      console.error("[crm] Kommo aceptó el lead pero no la nota:", describe(error));
    }
  }
  return String(leadId);
}

async function sendToWebhook(lead: CrmLead): Promise<string> {
  const { data } = await axios.post(
    env.CRM_WEBHOOK_URL,
    { source: "g3i-web", lead },
    { timeout: TIMEOUT_MS },
  );
  return String(data?.id ?? "");
}

function describe(error: any): string {
  const detail = error?.response?.data ? JSON.stringify(error.response.data).slice(0, 400) : "";
  return (
    [error?.response?.status, error?.message, detail].filter(Boolean).join(" · ") ||
    "Error desconocido"
  );
}

export function isCrmConfigured(): boolean {
  return isKommoConfigured() || !!env.CRM_WEBHOOK_URL;
}

export async function sendLead(lead: CrmLead): Promise<CrmResult> {
  if (!isCrmConfigured()) {
    return { status: "skipped", error: "", externalId: "", sentAt: null };
  }
  try {
    const externalId = isKommoConfigured() ? await sendToKommo(lead) : await sendToWebhook(lead);
    return { status: "sent", error: "", externalId, sentAt: new Date() };
  } catch (error) {
    const message = describe(error);
    console.error("[crm] no se pudo enviar el lead:", message);
    return { status: "failed", error: message.slice(0, 500), externalId: "", sentAt: null };
  }
}
