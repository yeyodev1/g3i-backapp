import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";
import {
  LEAD_KINDS,
  LEAD_STATUSES,
  LeadKind,
  PROPERTY_TYPE_KEYS,
  propertyTypeLabel,
  SECTOR_KEYS,
  sectorLabel,
} from "../config/catalogs";
import { Lead } from "../models/lead.model";
import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { Unit } from "../models/unit.model";
import { pageParams, paginated } from "../utils/pagination";
import {
  assertObjectId,
  EMAIL_REGEX,
  objectIdOrNull,
  oneOf,
  str,
  textSearch,
} from "../utils/validate";
import { sendLead } from "./crm.service";
import { layout, sendEmail } from "./email.service";

const KIND_TITLES: Record<LeadKind, string> = {
  property: "Consulta por una propiedad",
  project: "Consulta por un proyecto",
  unit: "Consulta por una unidad",
  sell: "Quiere vender su propiedad",
  general: "Mensaje de contacto",
  "work-with-us": "Quiere trabajar con G3i",
  interested: "Nuevo interesado",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Link público al inmueble del lead, si lo hay. */
async function resolveLink(lead: any): Promise<{ link: string; label: string }> {
  const site = env.SITE_URL.replace(/\/+$/, "");
  if (lead.unit) {
    const unit = await Unit.findById(lead.unit).select("name project").lean();
    const project = unit ? await Project.findById(unit.project).select("slug title").lean() : null;
    if (unit && project) {
      return {
        link: `${site}/proyectos/${project.slug}/unidades/${unit._id}`,
        label: `${project.title} · ${unit.name}`,
      };
    }
  }
  if (lead.project) {
    const project = await Project.findById(lead.project).select("slug title").lean();
    if (project) return { link: `${site}/proyectos/${project.slug}`, label: project.title };
  }
  if (lead.property) {
    const property = await Property.findById(lead.property).select("slug title").lean();
    if (property) return { link: `${site}/propiedades/${property.slug}`, label: property.title };
  }
  return { link: "", label: "" };
}

function emailHtml(lead: any, link: string, label: string): string {
  const rows: [string, string][] = [
    ["Tipo", KIND_TITLES[lead.kind as LeadKind] || lead.kind],
    ["Nombre", lead.name],
    ["Teléfono", lead.phone],
    ["Correo", lead.email],
    ["Mensaje", lead.message],
    ["Código del inmueble", lead.refCode],
    ["Inmueble", label],
    ["Sector a vender", lead.sellSector ? sectorLabel(lead.sellSector) : ""],
    ["Tipo a vender", lead.sellPropertyType ? propertyTypeLabel(lead.sellPropertyType) : ""],
    ["Página de origen", lead.sourceUrl],
    [
      "Fecha",
      new Date(lead.createdAt || Date.now()).toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
      }),
    ],
  ];
  const table = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#71717a;vertical-align:top;white-space:nowrap">${k}</td>` +
        `<td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");
  const button = link
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Ver inmueble</a></p>`
    : "";
  const whatsapp = lead.phone
    ? `<p style="margin:12px 0 0;font-size:13px"><a href="https://wa.me/${escapeHtml(toWhatsapp(lead.phone))}">Responder por WhatsApp</a></p>`
    : "";
  return layout(
    KIND_TITLES[lead.kind as LeadKind] || "Nuevo formulario",
    `<table cellpadding="0" cellspacing="0" style="font-size:14px">${table}</table>${button}${whatsapp}`,
  );
}

/** 0995806119 → 593995806119 */
function toWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;
  return digits;
}

function validate(body: Record<string, any>) {
  const kind = body.kind ? oneOf(body.kind, LEAD_KINDS, "tipo de formulario") : "general";
  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  const email = str(body.email, 200).toLowerCase();

  if (!name) throw new CustomError("Escribe tu nombre", 400);
  if (!phone || phone.replace(/\D/g, "").length < 7)
    throw new CustomError("Escribe un teléfono válido", 400);
  if (email && !EMAIL_REGEX.test(email)) throw new CustomError("El correo no es válido", 400);

  const data: Record<string, unknown> = {
    kind,
    name,
    phone,
    email,
    message: str(body.message, 5000),
    refCode: str(body.refCode, 40),
    sourceUrl: str(body.sourceUrl, 1000),
    property: objectIdOrNull(body.property),
    project: objectIdOrNull(body.project),
    unit: objectIdOrNull(body.unit),
    sellSector: "",
    sellPropertyType: "",
  };

  if (kind === "sell") {
    const sector = str(body.sellSector, 50);
    const type = str(body.sellPropertyType, 50);
    if (!sector) throw new CustomError("Indica el sector de tu propiedad", 400);
    if (!type) throw new CustomError("Indica el tipo de tu propiedad", 400);
    // Se acepta "otro" y sectores fuera del catálogo: el vendedor puede estar en cualquier parte.
    data.sellSector = SECTOR_KEYS.includes(sector) ? sector : sector.slice(0, 50);
    data.sellPropertyType = (PROPERTY_TYPE_KEYS as string[]).includes(type)
      ? type
      : type.slice(0, 50);
  }
  return data;
}

async function dispatch(leadId: string, options: { notify: boolean }) {
  const lead = await Lead.findById(leadId).lean();
  if (!lead) return null;
  const { link, label } = await resolveLink(lead);

  if (options.notify) {
    if (env.NOTIFY_EMAIL) {
      const subject = `${KIND_TITLES[lead.kind] || "Nuevo formulario"}: ${lead.name}${lead.refCode ? ` (${lead.refCode})` : ""}`;
      await sendEmail(env.NOTIFY_EMAIL, subject, emailHtml(lead, link, label));
    } else {
      console.warn("[lead] NOTIFY_EMAIL no definida — no se avisó por correo");
    }
  }

  const crm = await sendLead({
    _id: lead._id,
    kind: lead.kind,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    refCode: lead.refCode,
    sourceUrl: lead.sourceUrl,
    sellSector: lead.sellSector,
    sellPropertyType: lead.sellPropertyType,
    link,
    createdAt: lead.createdAt,
  });
  return Lead.findByIdAndUpdate(leadId, { $set: { crm } }, { new: true }).lean();
}

export async function create(body: Record<string, any>, ip: string): Promise<{ ok: true }> {
  // Honeypot: un humano nunca ve ese campo. Al bot se le responde igual que a todos.
  if (str(body?.website)) return { ok: true };

  const data = validate(body ?? {});
  const lead = await Lead.create({ ...data, ip, crm: { status: "pending" } });

  try {
    await dispatch(String(lead._id), { notify: true });
  } catch (error) {
    // El lead ya está guardado: cualquier falla de aviso se reintenta desde el admin.
    console.error("[lead] falló el aviso o el CRM:", error);
  }
  return { ok: true };
}

// ─── Admin ────────────────────────────────────────────────────────────

export async function adminList(query: Record<string, any>) {
  const params = pageParams(query, 20);
  const filter: Record<string, any> = {};
  if (query.kind && (LEAD_KINDS as readonly string[]).includes(query.kind))
    filter.kind = query.kind;
  if (query.status && (LEAD_STATUSES as readonly string[]).includes(query.status))
    filter.status = query.status;
  if (query.crm) filter["crm.status"] = str(query.crm, 20);
  const search = textSearch(query.q, ["name", "email", "phone", "refCode"]);
  if (search) Object.assign(filter, search);

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .select("-ip")
      .populate("property", "title slug code")
      .populate("project", "title slug")
      .populate("unit", "name")
      .sort({ createdAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  return paginated(items, total, params);
}

export async function setStatus(id: string, status: unknown) {
  assertObjectId(id, "Identificador de formulario inválido");
  const value = oneOf(status, LEAD_STATUSES, "estado");
  const doc = await Lead.findByIdAndUpdate(id, { $set: { status: value } }, { new: true })
    .select("-ip")
    .lean();
  if (!doc) throw new CustomError("Formulario no encontrado", 404);
  return doc;
}

export async function retryCrm(id: string) {
  assertObjectId(id, "Identificador de formulario inválido");
  if (!(await Lead.exists({ _id: id }))) throw new CustomError("Formulario no encontrado", 404);
  const doc = await dispatch(id, { notify: false });
  const { ip: _ip, ...rest } = (doc ?? {}) as Record<string, any>;
  return rest;
}

export async function remove(id: string) {
  assertObjectId(id, "Identificador de formulario inválido");
  const doc = await Lead.findByIdAndDelete(id).lean();
  if (!doc) throw new CustomError("Formulario no encontrado", 404);
  return { ok: true };
}
