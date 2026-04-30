import { describe, it, expect } from 'vitest'
import { brl, slugify, normalizeCnpj, formatCnpj, initials } from '../../src/lib/format'

describe('brl', () => {
  it('formata centavos como BRL', () => {
    expect(brl(45000).replace(/\u00A0/g, ' ')).toMatch(/R\$\s?450,00/)
    expect(brl(0).replace(/\u00A0/g, ' ')).toMatch(/R\$\s?0,00/)
  })
  it('aceita null/undefined', () => {
    expect(brl(null)).toMatch(/0,00/)
    expect(brl(undefined)).toMatch(/0,00/)
  })
})

describe('slugify', () => {
  it('remove acentos e espaços', () => {
    expect(slugify('DVI Produções e Eventos')).toBe('dvi-producoes-e-eventos')
    expect(slugify('  Açaí ÉPICO  ')).toBe('acai-epico')
  })
  it('input vazio', () => {
    expect(slugify('')).toBe('')
  })
})

describe('normalizeCnpj', () => {
  it('remove pontuação', () => {
    expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190')
  })
})

describe('formatCnpj', () => {
  it('formata 14 dígitos', () => {
    expect(formatCnpj('12345678000190')).toBe('12.345.678/0001-90')
  })
  it('passa input inválido sem alterar', () => {
    expect(formatCnpj('123')).toBe('123')
  })
})

describe('initials', () => {
  it('uma palavra', () => {
    expect(initials('Victor')).toBe('VI')
  })
  it('duas+ palavras', () => {
    expect(initials('Victor Lima Ferreira')).toBe('VF')
  })
  it('undefined', () => {
    expect(initials(undefined)).toBe('?')
  })
})
