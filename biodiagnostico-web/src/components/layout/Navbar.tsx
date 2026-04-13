import { Beaker, LayoutDashboard, LogOut, Menu, Users, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui'
import { cn } from '../../utils/cn'
import { ROLE_LABELS } from '../../lib/permissions'

const baseNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Controle de Qualidade', href: '/qc', icon: Beaker },
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
  const navItems = user?.role === 'ADMIN'
    ? [...baseNavItems, { label: 'Usuários', href: '/admin', icon: Users }]
    : baseNavItems

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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="text-left"
            onClick={() => {
              closeMenus()
              navigate('/dashboard')
            }}
            aria-label="Ir para dashboard"
          >
            <div className="text-lg font-bold text-green-800">Biodiagnóstico</div>
            <div className="text-xs text-neutral-500">Controle de Qualidade</div>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={closeMenus}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 py-5 text-sm font-medium transition',
                    isActive
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex" ref={dropdownRef}>
            <button
              type="button"
              className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-3 py-2 transition hover:border-neutral-300"
              onClick={() =>
                setDropdownPath((value) => (value === location.pathname ? null : location.pathname))
              }
              aria-label="Abrir menu do usuário"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-800 text-sm font-semibold text-white">
                {initials ?? <User className="h-4 w-4" />}
              </span>
            </button>
            {isDropdownOpen ? (
              <div className="absolute right-8 top-14 w-64 rounded-2xl border border-neutral-200 bg-white p-3 shadow-elevated">
                <div className="px-3 py-2">
                  <div className="font-semibold text-neutral-900">{user?.name}</div>
                  <div className="text-sm text-neutral-500">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
                </div>
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
            className="md:hidden"
            onClick={() => setMobilePath(location.pathname)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-[55] bg-black/40 md:hidden" onClick={closeMenus}>
          <aside
            className="ml-auto flex h-full w-72 flex-col bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-green-800">Biodiagnóstico</div>
                <div className="text-sm text-neutral-500">{user?.name}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMenus} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="mt-8 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname.startsWith(item.href)
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={closeMenus}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                      active ? 'bg-green-800 text-white' : 'text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>

            <div className="mt-auto rounded-2xl bg-neutral-50 p-4">
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
