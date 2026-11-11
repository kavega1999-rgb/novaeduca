import { formatUserName } from "@/lib/text-utils";

export function canAddEmployees(profileRole: string | null | undefined, roles: string[]): boolean {
  return profileRole === "admin" && roles.includes("admin");
}

export function prepareAuthorizedEmployee(fullName: string, documentNumber: string) {
  const name = fullName.trim().replace(/\s+/g, " ");
  const document = documentNumber.trim();
  if (!name || !document) {
    throw new Error("Ingresa el nombre completo y el número de documento.");
  }
  return { full_name: formatUserName(name), document_number: document };
}