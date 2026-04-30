/**
 * Tipos canônicos VF-PROJETOS — gerados de docs/schemas/firestore-schema.md v1.1.
 * NÃO MODIFICAR sem atualizar o schema doc primeiro (drift = bug).
 */
import type { Timestamp } from 'firebase/firestore'

// ─────────────────────────────────────────────────────────────
// RBAC
// ─────────────────────────────────────────────────────────────
export type Role = 'admin' | 'company_owner' | 'company_member' | 'guest'

export type AuthMethod = 'password' | 'magic_link'

// ─────────────────────────────────────────────────────────────
// Companies
// ─────────────────────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  slug: string
  cnpj: string
  logoUrl?: string
  ownerId: string
  contactEmail: string
  prazoNF: number
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  membersCount?: number
  projetosAtivos?: number
  rrtsAtivas?: number
}

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────
export interface User {
  uid: string
  email: string
  displayName: string
  avatarUrl?: string
  role: Role
  companyId: string | null
  companyName?: string
  tag?: string
  active: boolean
  roleVersion: number // v1.1 — token watchdog
  createdAt: Timestamp
  lastLogin?: Timestamp
  emailNotifications: boolean
  invitedBy?: string
  acceptedInviteAt?: Timestamp
}

// AppUser = User + claims hidratadas em runtime
export interface AppUser extends User {
  claims: {
    role: Role
    companyId: string | null
    roleVersion: number
  }
}

// ─────────────────────────────────────────────────────────────
// Usernames lookup (v1.1 — público, B2 fix)
// ─────────────────────────────────────────────────────────────
export interface UsernameEntry {
  usernameKey: string
  email: string
  authMethod: AuthMethod
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─────────────────────────────────────────────────────────────
// Projetos
// ─────────────────────────────────────────────────────────────
export type ProjetoStatus =
  | 'BRIEFING'
  | 'EM_DESENVOLVIMENTO'
  | 'ENTREGUE'
  | 'PAGO'
  | 'CANCELADO'

export interface Endereco {
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export type BillingRef = `rrt:${string}` | `projeto:${string}`

export interface Projeto {
  id: string
  companyId: string
  companyName: string
  nome: string
  descricao: string
  oc?: string
  empresaFaturamento: string
  cnpjFaturamento: string
  valor: number // centavos — quando billingConsolidates tem itens, deve refletir total real da NF
  status: ProjetoStatus
  // Faturamento consolidado (v1.2)
  billingPrincipalId?: BillingRef // se setado, este projeto NÃO soma no financeiro
  billingConsolidates?: BillingRef[] // lista de itens cuja NF saiu deste projeto
  dataCriacao: Timestamp
  dataEntregaPrevista?: Timestamp
  dataEntrega?: Timestamp
  dataPagamento?: Timestamp
  chamadoId?: string
  local?: string
  endereco?: Endereco
  dataMontagem?: Timestamp
  dataEvento?: Timestamp
  dataDesmontagem?: Timestamp
  rrtIds: string[]
  tags?: string[]
  paymentAlertedAt?: Timestamp
  paymentAlertedBy?: string
  observacoes?: string
  createdBy: string
  updatedAt: Timestamp
}

// ─────────────────────────────────────────────────────────────
// RRTs
// ─────────────────────────────────────────────────────────────
export type RRTStatus =
  | 'PROVISORIA'
  | 'BOLETO_PAGO'
  | 'DEFINITIVA'
  | 'NF_EMITIDA'
  | 'PAGO'
  | 'CANCELADA'

export interface RRT {
  id: string
  companyId: string
  companyName: string
  projetoId?: string
  numeroRRT?: string
  numeroNF?: string
  oc?: string
  // Faturamento (v1.1 — renomeado de empresa/cnpj)
  empresaFaturamento: string
  cnpjFaturamento: string
  contratante: string
  cnpjContratante?: string
  descricao: string
  evento?: string
  local?: string
  cep?: string
  enderecoCompleto?: string
  // Valores (centavos)
  valorBruto: number
  taxaCAU: number
  valorLiquido: number
  valorCobradoCliente: number // v1.1 — calculado, nunca aceito do client
  // Faturamento consolidado (v1.2)
  billingPrincipalId?: BillingRef
  billingConsolidates?: BillingRef[]
  status: RRTStatus
  dataCriacao: Timestamp
  dataBoleto?: Timestamp
  dataDefinitiva?: Timestamp
  dataNF?: Timestamp
  dataPagamento?: Timestamp
  previsaoPagamento?: Timestamp
  vencimentoBoleto?: Timestamp
  boletoPorMim: boolean
  dataMontagem?: Timestamp
  dataEvento?: Timestamp
  dataDesmontagem?: Timestamp
  paymentAlertedAt?: Timestamp
  paymentAlertedBy?: string
  boletoAlertedAt?: Timestamp
  boletoAlertedBy?: string
  legacyId?: string
  observacoes?: string
  createdBy: string
  updatedAt: Timestamp
}

// ─────────────────────────────────────────────────────────────
// Chamados
// ─────────────────────────────────────────────────────────────
export type ChamadoStatus =
  | 'ABERTO'
  | 'EM_ANALISE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_CLIENTE'
  | 'FECHADO'
  | 'CONVERTIDO'

export type ChamadoTipo = 'novo_projeto' | 'duvida' | 'alteracao' | 'urgente' | 'outro'
export type ChamadoPrioridade = 'baixa' | 'media' | 'alta' | 'critica'

export interface Chamado {
  id: string
  companyId: string
  companyName: string
  openedBy: string
  openedByName: string
  assignedTo?: string
  titulo: string
  descricao: string
  tipo: ChamadoTipo
  prioridade: ChamadoPrioridade
  status: ChamadoStatus
  projetoIdGerado?: string
  rrtIdGerado?: string
  dataAbertura: Timestamp
  dataFechamento?: Timestamp
  ultimaInteracao: Timestamp
  qtdMensagens: number
  qtdAnexos: number
  prazoResposta?: Timestamp
}

export interface Mensagem {
  id: string
  authorId: string
  authorName: string
  authorRole: Role
  text: string
  timestamp: Timestamp
  anexoIds?: string[]
  edited?: boolean
  editedAt?: Timestamp
}

// ─────────────────────────────────────────────────────────────
// Anexos
// ─────────────────────────────────────────────────────────────
export type AnexoCategoria =
  | 'BOLETO'
  | 'PROVISORIA'
  | 'DEFINITIVA'
  | 'NF'
  | 'COMPROVANTE'
  | 'BRIEFING'
  | 'PROJETO'
  | 'PLANTA'
  | 'OUTRO'

export interface Anexo {
  id: string
  storagePath: string
  filename: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedByName: string
  uploadedAt: Timestamp
  categoria?: AnexoCategoria
  descricao?: string
  versaoAnterior?: string
  visibleToClient: boolean
}

// ─────────────────────────────────────────────────────────────
// Audit Log
// ─────────────────────────────────────────────────────────────
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_advance'
  | 'status_revert'
  | 'upload'
  | 'download'
  | 'delete_file'
  | 'login'
  | 'logout'
  | 'login_fail'
  | 'alert_payment'
  | 'confirm_payment'
  | 'open_ticket'
  | 'reply_ticket'
  | 'close_ticket'

export type AuditResourceType =
  | 'company'
  | 'user'
  | 'projeto'
  | 'rrt'
  | 'chamado'
  | 'anexo'
  | 'session'

export interface AuditLog {
  id: string
  timestamp: Timestamp
  actor: {
    uid: string
    email: string
    role: Role | 'system'
    displayName: string
    companyId: string | null
    companyName: string | null
  }
  action: AuditAction
  resource: {
    type: AuditResourceType
    id: string
    label: string
  }
  diff?: {
    before: Record<string, unknown>
    after: Record<string, unknown>
    fields: string[]
  }
  metadata?: {
    ip?: string
    userAgent?: string
    notes?: string
    onBehalfOf?: { companyId: string; companyName: string }
  }
}

// ─────────────────────────────────────────────────────────────
// Notificações
// ─────────────────────────────────────────────────────────────
export type NotificacaoType =
  | 'payment_alert'
  | 'payment_confirmed'
  | 'ticket_opened'
  | 'ticket_replied'
  | 'ticket_status_changed'
  | 'rrt_status_changed'
  | 'projeto_status_changed'
  | 'boleto_due_soon'
  | 'system'

export interface Notificacao {
  id: string
  recipientUid: string
  recipientRole: Role
  type: NotificacaoType
  title: string
  body: string
  link?: string
  read: boolean
  createdAt: Timestamp
  readAt?: Timestamp
  resource?: { type: string; id: string }
  actorName?: string
}

// ─────────────────────────────────────────────────────────────
// Public Lib
// ─────────────────────────────────────────────────────────────
export type PublicLibCategory =
  | 'CAU'
  | 'IDENTIDADE'
  | 'COMPROVANTE'
  | 'CONTRATO'
  | 'OUTRO'

export interface PublicLibItem {
  id: string
  storagePath: string
  filename: string
  title: string
  description?: string
  category: PublicLibCategory
  size: number
  mimeType: string
  uploadedBy: string
  uploadedAt: Timestamp
  active: boolean
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
export interface EmpresaFaturamento {
  nome: string
  cnpj: string
  prazoNF: number
}

export interface Config {
  taxaCAU: number
  prazoNFDefault: number
  empresasFaturamento: EmpresaFaturamento[]
  rrtValorBrutoDefault: number
  paymentReminderDaysBefore: number
  storageQuotaMB: number
  updatedAt: Timestamp
  updatedBy: string
}

// ─────────────────────────────────────────────────────────────
// RBAC types
// ─────────────────────────────────────────────────────────────
export type RBACResource =
  | 'company'
  | 'user'
  | 'projeto'
  | 'rrt'
  | 'chamado'
  | 'anexo'
  | 'public_lib'
  | 'audit_log'
  | 'dashboard'

export type RBACAction = 'create' | 'read' | 'update' | 'delete' | 'list'
