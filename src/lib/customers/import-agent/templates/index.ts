/**
 * Como acrescentar um cardápio digital / export novo
 * -------------------------------------------------
 * 1. Pedir ao lojista um CSV/Excel/PDF de exemplo (sem dados reais sensíveis, ou anonimizado).
 * 2. Em `catalog.ts`, criar um `ImportTemplate`:
 *    - id / label / platforms
 *    - kinds: xlsx | csv_text | pdf
 *    - matchScore: cabeçalhos ou frases típicas do ficheiro
 *    - parseGrid ou parsePdfText
 * 3. Registar em `IMPORT_TEMPLATES` (`registry.ts`).
 * 4. Testar importação; o preview deve mostrar o label do template.
 *
 * Templates atuais:
 * - Excel/CSV “Clientes em potencial” (Nome, Telefone, Whatsapp, Qtd Pedidos)
 * - PDF “Relatório: Clientes em Potencial”
 * - CSV modelo Nocaute
 * - Genérico (fallback)
 *
 * Não fazer scraping de bases reais na internet (LGPD).
 * Usar só exports oficiais / amostras de cabeçalho.
 */

export { listImportTemplates, matchImportTemplate, IMPORT_TEMPLATES } from "./registry";
export type { ImportTemplate, TemplateMatchInput } from "./types";
