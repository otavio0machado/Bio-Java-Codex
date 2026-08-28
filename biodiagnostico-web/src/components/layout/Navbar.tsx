import {
  Beaker,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Thermometer,
  Users,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui'
import { cn } from '../../utils/cn'
import { ROLE_LABELS } from '../../lib/permissions'
import logoBio from '../../assets/logobio.png'

const areaNavItems = [
  { label: 'Bioquímica', href: '/qc?area=bioquimica', area: 'bioquimica', icon: Beaker },
  { label: 'Coagulação', href: '/qc?area=coagulacao', area: 'coagulacao', icon: Beaker },
  { label: 'Hematologia', href: '/qc?area=hematologia', area: 'hematologia', icon: Beaker },
  { label: 'Imunologia', href: '/qc?area=imunologia', area: 'imunologia', icon: Beaker },
  { label: 'Parasitologia', href: '/qc?area=parasitologia', area: 'parasitologia', icon: Beaker },
  { label: 'Microbiologia', href: '/qc?area=microbiologia', area: 'microbiologia', icon: Beaker },
  { label: 'Uroanálise', href: '/qc?area=uroanalise', area: 'uroanalise', icon: Beaker },
]

const managementNavItems = [
  { label: 'Reagentes', href: '/reagentes', area: null, icon: FlaskConical },
  { label: 'Manutenção', href: '/manutencao', area: null, icon: Wrench },
  { label: 'Temperatura', href: '/temperatura', area: null, icon: Thermometer },
  { label: 'Relatórios', href: '/relatorios', area: null, icon: FileText },
]

const baseNavItems = [
  { label: 'Dashboard', href: '/dashboard', area: null, icon: LayoutDashboard },
  ...managementNavItems,
  ...areaNavItems,
]

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownPath, setDropdownPath] = useState<string | null>(null)
  const [mobilePath, setMobilePath] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isDropdownOpen = dropdownPath === location.pathname
  const isMobileOpen = mobilePath === location.pathname
  const navItems = baseNavItems
  const adminMenuItems = user?.role === 'ADMIN'
    ? [
        { label: 'Usuários', href: '/admin', icon: Users },
        { label: 'Configuração', href: '/config', icon: Settings },
      ]
    : []
  const currentArea = new URLSearchParams(location.search).get('area') ?? 'bioquimica'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownPath(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const closeMenus = () => {
    setDropdownPath(null)
    setMobilePath(null)
  }

  const handleLogout = () => {
    closeMenus()
    logout()
  }

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10">
          <button
            type="button"
            className="flex shrink-0 items-center rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 mr-2 xl:mr-6"
            onClick={() => {
              closeMenus()
              navigate('/dashboard')
            }}
            aria-label="Ir para dashboard"
          >
            <img src={logoBio} alt="Biodiagnóstico" className="h-9 xl:h-10 w-auto" />
          </button>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 min-[1150px]:gap-1 xl:gap-1.5 2xl:gap-2 min-[1536px]:flex">
            {navItems.map((item, index) => {
              const isOnQc = location.pathname.startsWith('/qc')
              const isActive = item.area
                ? isOnQc && currentArea === item.area
                : location.pathname.startsWith(item.href) && !isOnQc
              const prev = navItems[index - 1]
              const isFirstArea = item.area && !prev?.area
              const isFirstAfterAreas = !item.area && prev?.area
              return (
                <div key={item.href} className="flex items-center">
                  {isFirstArea || isFirstAfterAreas ? (
                    <span aria-hidden="true" className="mx-1 min-[1150px]:mx-1.5 xl:mx-2.5 h-4 w-px bg-neutral-300 shrink-0" />
                  ) : null}
                  <NavLink
                    to={item.href}
                    onClick={closeMenus}
                    className={cn(
                      'border-b-2 py-5 px-1 min-[1150px]:px-1.5 xl:px-2 2xl:px-2 text-xs xl:text-[13px] 2xl:text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                      isActive
                        ? 'border-green-800 text-green-900 font-semibold'
                        : 'border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
                    )}
                  >
                    {item.label}
                  </NavLink>
                </div>
              )
            })}
          </nav>

          <div className="relative hidden shrink-0 items-center gap-3 min-[1536px]:flex ml-2 xl:ml-4" ref={dropdownRef}>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white p-1 pr-2.5 transition hover:border-neutral-300 hover:bg-neutral-50 shadow-sm"
              onClick={() =>
                setDropdownPath((value) => (value === location.pathname ? null : location.pathname))
              }
              aria-label="Abrir menu do usuário"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-800 text-xs font-semibold text-white">
                {initials ?? <User className="h-4 w-4" />}
              </span>
              <span className="hidden text-xs font-medium text-neutral-700 xl:inline-block max-w-[100px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
            {isDropdownOpen ? (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-3 shadow-elevated z-50">
                <div className="px-3 py-2">
                  <div className="font-semibold text-neutral-900">{user?.name}</div>
                  <div className="text-sm text-neutral-500">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
                </div>
                {adminMenuItems.length > 0 ? (
                  <>
                    <div className="my-2 border-t border-neutral-100" />
                    {adminMenuItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.href}
                          to={item.href}
                          onClick={closeMenus}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </NavLink>
                      )
                    })}
                  </>
                ) : null}
                <div className="my-2 border-t border-neutral-100" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="min-[1536px]:hidden"
            onClick={() => setMobilePath(location.pathname)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-[55] bg-black/40 min-[1536px]:hidden" onClick={closeMenus}>
          <aside
            className="ml-auto flex h-full w-72 flex-col bg-white p-5 shadow-2xl overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <img src={logoBio} alt="Biodiagnóstico" className="h-10 w-auto" />
                <div className="mt-1 text-sm text-neutral-500">{user?.name}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMenus} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="mt-6 space-y-1.5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isOnQc = location.pathname.startsWith('/qc')
                const active = item.area
                  ? isOnQc && currentArea === item.area
                  : location.pathname.startsWith(item.href) && !isOnQc
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={closeMenus}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition',
                      active ? 'bg-green-800 text-white' : 'text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>

            {adminMenuItems.length > 0 ? (
              <nav className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon
                  const active = location.pathname.startsWith(item.href)
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={closeMenus}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition',
                        active ? 'bg-green-800 text-white' : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  )
                })}
              </nav>
            ) : null}

            <div className="mt-auto pt-4 rounded-2xl bg-neutral-50 p-4">
              <div className="font-semibold text-neutral-900">{user?.name}</div>
              <div className="text-sm text-neutral-500">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
              <Button variant="danger" className="mt-4 w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
