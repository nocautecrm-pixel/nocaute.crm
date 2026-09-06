import {
  extractPotentialClientsReport,
  looksLikePotentialClientsReport,
} from "@/lib/customers/import-agent/pdf-potential-clients";
import type { ImportTemplate } from "@/lib/customers/import-agent/templates/types";
import { hasAll, hasAny } from "@/lib/customers/import-agent/templates/types";
import { parseCustomerGrid } from "@/lib/customers/parse-sheet";

/**
 * Excel/CSV “Clientes em potencial” (cardápio digital):
 * Nome do Cliente | Número Telefone | Número Whatsapp | Quantidade de Pedidos
 */
export const excelPotentialClientsTemplate: ImportTemplate = {
  id: "cardapio-excel-clientes-potencial",
  label: "Excel · Clientes em potencial",
  platforms: ["Cardápio digital (export Excel/CSV)", "Consulta gerada · clientes em potencial"],
  kinds: ["xlsx", "csv_text"],
  matchScore({ kind, headers, textSample, filename }) {
    if (kind !== "xlsx" && kind !== "csv_text") return 0;
    const name = (filename ?? "").toLowerCase();
    const sample = (textSample ?? "").toLowerCase();
    let score = 0;
    if (name.includes("potencial") || name.includes("clientes")) score += 2;
    if (sample.includes("clientes em potencial") || sample.includes("consulta gerada")) score += 4;
    if (!headers?.length) return score;
    if (hasAny(headers, ["nomedocliente", "nome"])) score += 3;
    if (hasAny(headers, ["whatsapp", "numerowhatsapp"])) score += 5;
    if (hasAny(headers, ["telefone", "numerotelefone"])) score += 4;
    if (hasAny(headers, ["quantidadedepedidos", "pedidos"])) score += 5;
    if (
      hasAny(headers, ["nomedocliente", "nome"]) &&
      hasAny(headers, ["whatsapp", "telefone"]) &&
      hasAny(headers, ["quantidadedepedidos", "pedidos"])
    ) {
      score += 10;
    }
    return score;
  },
  parseGrid: (grid) => parseCustomerGrid(grid),
};

/**
 * PDF “Relatório: Clientes em Potencial”:
 * Nome | Dias sem comprar | Total (R$) | Telefone (19) 9 9669-8105
 */
export const pdfPotentialClientsTemplate: ImportTemplate = {
  id: "cardapio-pdf-clientes-potencial",
  label: "PDF · Clientes em Potencial",
  platforms: ["Cardápio digital (relatório PDF)", "Relatório: Clientes em Potencial"],
  kinds: ["pdf"],
  matchScore({ kind, textSample }) {
    if (kind !== "pdf" || !textSample) return 0;
    if (!looksLikePotentialClientsReport(textSample)) return 0;
    let score = 20;
    const lower = textSample.toLowerCase();
    if (lower.includes("dias sem comprar")) score += 5;
    if (lower.includes("número de telefone") || lower.includes("numero de telefone")) score += 5;
    if (lower.includes("total de pedidos")) score += 3;
    return score;
  },
  parsePdfText: (text) => extractPotentialClientsReport(text),
};

/** Modelo Nocaute (CSV de exemplo). */
export const nocauteModeloTemplate: ImportTemplate = {
  id: "nocaute-modelo-csv",
  label: "CSV · modelo Nocaute",
  platforms: ["Nocaute CRM"],
  kinds: ["csv_text", "xlsx"],
  matchScore({ kind, headers }) {
    if (kind !== "csv_text" && kind !== "xlsx") return 0;
    if (!headers?.length) return 0;
    if (
      hasAll(headers, ["nome"]) &&
      hasAny(headers, ["whatsapp", "telefone"]) &&
      hasAny(headers, ["pedidos", "quantidadedepedidos"])
    ) {
      return hasAny(headers, ["diassempedir", "diassemcomprar", "dias"]) ? 12 : 8;
    }
    return 0;
  },
  parseGrid: (grid) => parseCustomerGrid(grid),
};

/**
 * Fallback genérico — qualquer planilha com telefone/nome.
 * Score baixo de propósito: só ganha se nenhum template específico casar.
 */
export const genericSpreadsheetTemplate: ImportTemplate = {
  id: "generico-planilha",
  label: "Planilha genérica",
  platforms: ["Qualquer CSV/Excel com telefone"],
  kinds: ["xlsx", "csv_text"],
  matchScore({ kind, headers }) {
    if (kind !== "xlsx" && kind !== "csv_text") return 0;
    if (!headers?.length) return 1;
    let score = 1;
    if (hasAny(headers, ["whatsapp", "telefone", "phone", "celular"])) score += 2;
    if (hasAny(headers, ["nome", "cliente", "name"])) score += 1;
    return score;
  },
  parseGrid: (grid) => parseCustomerGrid(grid),
};

/** PDF genérico (texto livre) — score baixo; o run.ts usa se templates PDF falharem. */
export const genericPdfTemplate: ImportTemplate = {
  id: "generico-pdf",
  label: "PDF genérico",
  platforms: ["PDF com lista de telefones"],
  kinds: ["pdf"],
  matchScore({ kind }) {
    return kind === "pdf" ? 1 : 0;
  },
};
