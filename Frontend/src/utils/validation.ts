const DNI_REGEX = /^\d{8}$/

export function isValidDni(dni: string): boolean {
  return DNI_REGEX.test(dni.replace(/\s/g, ''))
}
