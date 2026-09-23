import { Model } from "mongoose";
import { Lead } from "../models/lead.model";
import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { Unit } from "../models/unit.model";

/** { published: 3, draft: 1, ... } con cero para los estados sin documentos. */
async function countByStatus(
  model: Model<any>,
  statuses: string[],
): Promise<Record<string, number>> {
  const rows = await model.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const result: Record<string, number> = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const r of rows) result[r._id] = r.count;
  return result;
}

export async function getDashboard() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [properties, projects, units, newLeads, totalLeads, last7d, recentLeads] =
    await Promise.all([
      countByStatus(Property, ["published", "draft", "sold", "hidden"]),
      countByStatus(Project, ["published", "draft", "sold-out", "hidden"]),
      countByStatus(Unit, ["available", "reserved", "sold"]),
      Lead.countDocuments({ status: "new" }),
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: weekAgo } }),
      Lead.find().select("-ip").sort({ createdAt: -1 }).limit(5).lean(),
    ]);
  return {
    properties,
    projects,
    units,
    leads: { new: newLeads, total: totalLeads, last7d },
    recentLeads,
  };
}
