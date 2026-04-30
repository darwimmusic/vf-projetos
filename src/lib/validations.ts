import { z } from 'zod'

const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/

export const companySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, 'apenas minúsculas, números e hífen'),
  cnpj: z.string().regex(cnpjRegex, 'CNPJ inválido'),
  contactEmail: z.string().email('email inválido'),
  prazoNF: z.coerce.number().int().min(0).max(120).default(10),
})

export const userSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(120),
  role: z.enum(['admin', 'company_owner', 'company_member']),
  companyId: z.string().nullable(),
  tag: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
})

export const projetoSchema = z.object({
  companyId: z.string().min(1),
  nome: z.string().min(2).max(200),
  descricao: z.string().max(2000).default(''),
  oc: z.string().max(40).optional(),
  empresaFaturamento: z.string().min(2),
  cnpjFaturamento: z.string().regex(cnpjRegex),
  valor: z.coerce.number().int().min(0), // centavos
  local: z.string().max(200).optional(),
  observacoes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
})

export const rrtSchema = z.object({
  companyId: z.string().min(1),
  projetoId: z.string().optional(),
  numeroRRT: z.string().max(40).optional(),
  numeroNF: z.string().max(40).optional(),
  oc: z.string().max(40).optional(),
  empresaFaturamento: z.string().min(2),
  cnpjFaturamento: z.string().regex(cnpjRegex),
  contratante: z.string().min(2),
  cnpjContratante: z.string().regex(cnpjRegex).optional(),
  descricao: z.string().min(2).max(2000),
  evento: z.string().max(200).optional(),
  local: z.string().max(200).optional(),
  cep: z.string().optional(),
  enderecoCompleto: z.string().max(500).optional(),
  valorBruto: z.coerce.number().int().min(0), // centavos
  taxaCAU: z.coerce.number().int().min(0),
  boletoPorMim: z.boolean().default(false),
  observacoes: z.string().max(2000).optional(),
})

export const usernameEntrySchema = z.object({
  usernameKey: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9.-]+$/, 'apenas minúsculas, números, ponto e hífen'),
  email: z.string().email(),
  authMethod: z.enum(['password', 'magic_link']),
  active: z.boolean().default(true),
})

export type CompanyInput = z.infer<typeof companySchema>
export type UserInput = z.infer<typeof userSchema>
export type ProjetoInput = z.infer<typeof projetoSchema>
export type RRTInput = z.infer<typeof rrtSchema>
export type UsernameEntryInput = z.infer<typeof usernameEntrySchema>
