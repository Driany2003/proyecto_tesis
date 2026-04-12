import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getUsers, createUser, updateUser } from '@/api/users'
import type { CreateUserInput, UpdateUserInput } from '@/api/users'
import { ROLES, ROLE_KEYS, ROLE_LABELS, roleLabel } from '@/constants/roles'
import type { User } from '@/types/user'
import { IconUserPlus, IconUsers } from '@/components/icons/SidebarIcons'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'

const createSchema = z.object({
  name: z.string().min(1, 'Nombre obligatorio'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(ROLE_KEYS as unknown as [string, ...string[]]),
})

type CreateFormValues = z.infer<typeof createSchema>

export function UserManagementPage() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      updateUser(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingId(null)
    },
  })

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: ROLE_KEYS[0],
    },
  })

  const handleCreate = (data: CreateFormValues) => {
    createMutation.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
    })
  }

  const handleToggleActive = (u: User) => {
    updateMutation.mutate({
      id: u.id,
      input: { active: !u.active },
    })
  }

  const handleEditRole = (u: User, newRole: string) => {
    updateMutation.mutate({
      id: u.id,
      input: { role: newRole },
    })
    setEditingId(null)
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !search.trim() ||
      u.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      u.email.toLowerCase().includes(search.toLowerCase().trim())
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div>
      <PageHeader
        title="Gestión de usuarios"
        subtitle={
          filteredUsers.length === users.length
            ? `${users.length} usuario${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''}`
            : `${filteredUsers.length} de ${users.length} usuario${users.length !== 1 ? 's' : ''}`
        }
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-600"
          >
            <IconUserPlus className="h-5 w-5" />
            Nuevo usuario
          </button>
        }
      />

      <SectionDivider label="Filtros" />
      <SectionCard
        title="Buscar usuarios"
        description="Refine por nombre, correo o rol para encontrar al usuario"
        icon={<IconUsers className="h-5 w-5" />}
        className="mb-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label className="form-label mb-1.5 block">Búsqueda</label>
            <input
              type="search"
              placeholder="Nombre o correo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base"
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <label className="form-label mb-1.5 block">Rol</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-base"
            >
              <option value="">Todos los roles</option>
              {ROLE_KEYS.map((k) => (
                <option key={k} value={ROLES[k]}>
                  {ROLE_LABELS[ROLES[k]]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear usuario"
        subtitle="Complete los datos para dar de alta un nuevo usuario en el sistema."
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={createForm.handleSubmit(handleCreate)}
          className="p-4 sm:p-5"
        >
          <div className="space-y-4">
            <div className="form-field">
              <label className="form-label">Nombre completo</label>
              <input
                placeholder="Ej. Juan Pérez"
                className="input-base"
                {...createForm.register('name')}
              />
              {createForm.formState.errors.name && (
                <p className="form-error">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="form-field">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                className="input-base"
                {...createForm.register('email')}
              />
              {createForm.formState.errors.email && (
                <p className="form-error">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="form-field">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="input-base"
                {...createForm.register('password')}
              />
              {createForm.formState.errors.password && (
                <p className="form-error">{createForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="form-field">
              <label className="form-label">Rol</label>
              <select className="input-base" {...createForm.register('role')}>
                {ROLE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ROLE_LABELS[ROLES[k]]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-slate-600">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {createMutation.isPending ? 'Creando…' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <SectionDivider label="Lista de usuarios" />
      {isLoading ? (
        <SectionCardSimple>
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando…</p>
        </SectionCardSimple>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-600 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="h-12 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Correo
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      Todavía no hay registros.
                    </td>
                  </tr>
                ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3.5 align-middle font-medium text-slate-800 dark:text-slate-100">{u.name}</td>
                    <td className="px-4 py-3.5 align-middle text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="px-4 py-3.5 align-middle text-slate-600 dark:text-slate-300">
                      {editingId === u.id ? (
                        <select
                          className="input-base"
                          defaultValue={u.role}
                          onChange={(e) => handleEditRole(u, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                        >
                          {ROLE_KEYS.map((k) => (
                            <option key={k} value={ROLES[k]}>
                              {ROLE_LABELS[ROLES[k]]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer text-sky-600 transition-colors hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
                          onClick={() => setEditingId(u.id)}
                        >
                          {roleLabel(u.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.active
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
