import { runCustomerImportAgent } from "@/lib/customers/import-agent/run";
import type { ImportAgentResult } from "@/lib/customers/import-agent/types";

/** Entrada única: o agent escolhe o melhor leitor para o ficheiro. */
export async function parseCustomerImportFile(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): Promise<ImportAgentResult> {
  return runCustomerImportAgent(input);
}
