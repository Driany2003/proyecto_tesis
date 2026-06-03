import { useEffect, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

interface PermissionChange {
  role: string
  section: string
  enabled: boolean
  timestamp: string
}

export function usePermissionWebSocket(userRole: string | undefined) {
  const [needsReload, setNeedsReload] = useState(false)

  useEffect(() => {
    if (!userRole) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${import.meta.env.VITE_API_BASE_URL || '/api'}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/permissions/${userRole.toLowerCase()}`, (msg) => {
          try {
            const change: PermissionChange = JSON.parse(msg.body)
            if (change.role?.toLowerCase() === userRole.toLowerCase()) {
              setNeedsReload(true)
            }
          } catch {}
        })
      },
    })

    client.activate()

    return () => {
      client.deactivate()
    }
  }, [userRole])

  return { needsReload, dismissReload: () => setNeedsReload(false) }
}
