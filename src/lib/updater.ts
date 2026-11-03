import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

import { isTauri } from '@/lib/api'

export type UpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'up-to-date'; version: string }
  | {
      status: 'available'
      version: string
      currentVersion: string
      notes?: string | null
      install: () => Promise<void>
    }
  | { status: 'error'; message: string }

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) return { status: 'unsupported' }

  try {
    const update = await check()
    if (!update) {
      return {
        status: 'up-to-date',
        version: await getPackageVersionFallback(),
      }
    }

    return {
      status: 'available',
      version: update.version,
      currentVersion: update.currentVersion,
      notes: update.body,
      install: async () => {
        await update.downloadAndInstall()
        await relaunch()
      },
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function getPackageVersionFallback(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return 'unknown'
  }
}
