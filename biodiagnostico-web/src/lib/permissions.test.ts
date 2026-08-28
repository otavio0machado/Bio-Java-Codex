import { describe, expect, it } from 'vitest'
import {
  canDeleteReagents,
  canDownloadReports,
  canGenerateReports,
  canImportQc,
  canViewModule,
  canWriteMaintenance,
  canWriteQc,
  canWriteQcAreas,
  canWriteReagents,
  canWriteTemperature,
  expandImpliedPermissions,
  getEffectivePermissions,
  hasPermission,
  isReadOnly,
  normalizePermission,
} from './permissions'
import type { User } from '../types'

describe('Frontend RBAC & Permissions System', () => {
  describe('normalizePermission', () => {
    it('normaliza permissoes canonicas', () => {
      expect(normalizePermission('QC_WRITE')).toBe('QC_WRITE')
      expect(normalizePermission('REAGENTS_WRITE')).toBe('REAGENTS_WRITE')
      expect(normalizePermission('TEMPERATURE_VIEW')).toBe('TEMPERATURE_VIEW')
    })

    it('mapeia permissoes legadas e aliases', () => {
      expect(normalizePermission('REAGENT_WRITE')).toBe('REAGENTS_WRITE')
      expect(normalizePermission('DOWNLOAD')).toBe('REPORTS_DOWNLOAD')
      expect(normalizePermission('IMPORT')).toBe('QC_IMPORT')
    })

    it('retorna null para permissoes desconhecidas ou invalidas', () => {
      expect(normalizePermission('INVALID_PERMISSION')).toBeNull()
      expect(normalizePermission('')).toBeNull()
    })
  })

  describe('expandImpliedPermissions', () => {
    it('WRITE em modulo implica VIEW correspondente e DASHBOARD_VIEW', () => {
      const expanded = expandImpliedPermissions(['QC_WRITE'])
      expect(expanded.has('QC_WRITE')).toBe(true)
      expect(expanded.has('QC_VIEW')).toBe(true)
      expect(expanded.has('DASHBOARD_VIEW')).toBe(true)
      expect(expanded.has('REAGENTS_VIEW')).toBe(false)
    })

    it('REAGENTS_DELETE implica REAGENTS_VIEW e DASHBOARD_VIEW', () => {
      const expanded = expandImpliedPermissions(['REAGENTS_DELETE'])
      expect(expanded.has('REAGENTS_DELETE')).toBe(true)
      expect(expanded.has('REAGENTS_VIEW')).toBe(true)
      expect(expanded.has('DASHBOARD_VIEW')).toBe(true)
    })

    it('expande aliases legados com seguranca', () => {
      const expanded = expandImpliedPermissions(['DOWNLOAD', 'REAGENT_WRITE'])
      expect(expanded.has('REPORTS_DOWNLOAD')).toBe(true)
      expect(expanded.has('REPORTS_VIEW')).toBe(true)
      expect(expanded.has('REAGENTS_WRITE')).toBe(true)
      expect(expanded.has('REAGENTS_VIEW')).toBe(true)
      expect(expanded.has('DASHBOARD_VIEW')).toBe(true)
    })
  })

  describe('getEffectivePermissions', () => {
    it('ADMIN recebe todas as 16 permissoes canonicas', () => {
      const admin: User = {
        id: '1',
        username: 'admin',
        name: 'Admin',
        role: 'ADMIN',
        isActive: true,
        permissions: [],
      }
      const perms = getEffectivePermissions(admin)
      expect(perms.size).toBe(16)
      expect(perms.has('QC_WRITE')).toBe(true)
      expect(perms.has('REAGENTS_DELETE')).toBe(true)
      expect(perms.has('TEMPERATURE_WRITE')).toBe(true)
    })

    it('VIGILANCIA_SANITARIA recebe apenas visualizacoes e download', () => {
      const vig: User = {
        id: '2',
        username: 'vigilancia',
        name: 'Auditor Fiscal',
        role: 'VIGILANCIA_SANITARIA',
        isActive: true,
        permissions: [],
      }
      const perms = getEffectivePermissions(vig)
      expect(perms.has('DASHBOARD_VIEW')).toBe(true)
      expect(perms.has('QC_VIEW')).toBe(true)
      expect(perms.has('REAGENTS_VIEW')).toBe(true)
      expect(perms.has('REPORTS_DOWNLOAD')).toBe(true)
      expect(perms.has('QC_WRITE')).toBe(false)
      expect(perms.has('REAGENTS_WRITE')).toBe(false)
      expect(perms.has('TEMPERATURE_WRITE')).toBe(false)
    })

    it('VISUALIZADOR recebe apenas visualizacoes sem download', () => {
      const viewer: User = {
        id: '3',
        username: 'viewer',
        name: 'Visualizador',
        role: 'VISUALIZADOR',
        isActive: true,
        permissions: [],
      }
      const perms = getEffectivePermissions(viewer)
      expect(perms.has('DASHBOARD_VIEW')).toBe(true)
      expect(perms.has('QC_VIEW')).toBe(true)
      expect(perms.has('REPORTS_DOWNLOAD')).toBe(false)
      expect(perms.has('QC_WRITE')).toBe(false)
    })

    it('FUNCIONARIO tem permissoes expandidas conforme configuracao', () => {
      const func: User = {
        id: '4',
        username: 'func.qc',
        name: 'Operador CQ',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: ['QC_WRITE', 'REPORTS_DOWNLOAD'],
      }
      const perms = getEffectivePermissions(func)
      expect(perms.has('QC_WRITE')).toBe(true)
      expect(perms.has('QC_VIEW')).toBe(true)
      expect(perms.has('REPORTS_DOWNLOAD')).toBe(true)
      expect(perms.has('REPORTS_VIEW')).toBe(true)
      expect(perms.has('REAGENTS_WRITE')).toBe(false)
      expect(perms.has('TEMPERATURE_WRITE')).toBe(false)
    })

    it('usuario inativo nao possui permissoes efetivas', () => {
      const inactive: User = {
        id: '5',
        username: 'inactive',
        name: 'Inativo',
        role: 'ADMIN',
        isActive: false,
        permissions: [],
      }
      expect(getEffectivePermissions(inactive).size).toBe(0)
    })
  })

  describe('Module & Domain Access Helpers', () => {
    it('canViewModule reflete apenas os modulos permitidos', () => {
      const func: User = {
        id: '6',
        username: 'func.reagents',
        name: 'Almoxarife',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: ['REAGENTS_WRITE'],
      }

      expect(canViewModule(func, 'REAGENTS')).toBe(true)
      expect(canViewModule(func, 'DASHBOARD')).toBe(true)
      expect(canViewModule(func, 'QC')).toBe(false)
      expect(canViewModule(func, 'TEMPERATURE')).toBe(false)
      expect(canViewModule(func, 'MAINTENANCE')).toBe(false)
    })

    it('desacoplamento estrito de Temperatura em relacao a CQ e Manutencao', () => {
      const funcQcOnly: User = {
        id: '7',
        username: 'func.qc.only',
        name: 'CQ Only',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: ['QC_WRITE', 'MAINTENANCE_WRITE'],
      }

      expect(canWriteQc(funcQcOnly)).toBe(true)
      expect(canWriteMaintenance(funcQcOnly)).toBe(true)
      expect(canWriteTemperature(funcQcOnly)).toBe(false)
      expect(canViewModule(funcQcOnly, 'TEMPERATURE')).toBe(false)
    })

    it('valida funcoes de permissao para reagentes, relatorios e importacao', () => {
      const fullFunc: User = {
        id: '8',
        username: 'full.func',
        name: 'Full Func',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: [
          'QC_AREAS_WRITE',
          'QC_IMPORT',
          'REAGENTS_WRITE',
          'REAGENTS_DELETE',
          'REPORTS_GENERATE',
          'REPORTS_DOWNLOAD',
        ],
      }

      expect(hasPermission(fullFunc, 'QC_AREAS_WRITE')).toBe(true)
      expect(canWriteQcAreas(fullFunc)).toBe(true)
      expect(canImportQc(fullFunc)).toBe(true)
      expect(canWriteReagents(fullFunc)).toBe(true)
      expect(canDeleteReagents(fullFunc)).toBe(true)
      expect(canGenerateReports(fullFunc)).toBe(true)
      expect(canDownloadReports(fullFunc)).toBe(true)
    })

    it('isReadOnly identifica perfis somente-leitura', () => {
      expect(isReadOnly({ role: 'VISUALIZADOR' } as User)).toBe(true)
      expect(isReadOnly({ role: 'VIGILANCIA_SANITARIA' } as User)).toBe(true)
      expect(isReadOnly({ role: 'ADMIN' } as User)).toBe(false)
      expect(isReadOnly({ role: 'FUNCIONARIO' } as User)).toBe(false)
    })
  })
})
