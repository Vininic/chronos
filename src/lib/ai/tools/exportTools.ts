import type { ScheduleData } from "@/lib/schedule/types";
import { exportToJSON, exportToXLSX, exportToICS } from "@/lib/schedule/export";
import { globalToolRegistry } from "./registry";

interface ExportParams {
  format: "json" | "xlsx" | "ics";
  filename?: string;
}

export function registerExportTools(getData: () => ScheduleData): void {
  globalToolRegistry.register<ExportParams, string>({
    name: "exportSchedule",
    description: "Export the current schedule in JSON, XLSX, or ICS format and trigger a download",
    category: "program",
    permission: "write",
    validate: (p) => {
      if (!p.format) return "format is required (json, xlsx, or ics)";
      if (!["json", "xlsx", "ics"].includes(p.format)) return "format must be json, xlsx, or ics";
      return null;
    },
    execute: (p) => {
      const data = getData();
      const filename = p.filename ?? `chronos-schedule.${p.format}`;
      const locale = "en";
      switch (p.format) {
        case "json":
          exportToJSON(data, filename);
          return `Exported schedule as JSON: ${filename}`;
        case "xlsx":
          exportToXLSX(data, filename, locale).then(() => {});
          return `Exporting schedule as XLSX: ${filename}`;
        case "ics":
          exportToICS(data, filename);
          return `Exported schedule as ICS: ${filename}`;
        default:
          throw new Error(`Unsupported format: ${p.format}`);
      }
    },
  });
}
