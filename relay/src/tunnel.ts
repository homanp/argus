import fs from "node:fs"
import { bin, install, Tunnel } from "cloudflared"

let activeTunnel: ReturnType<typeof Tunnel.quick> | null = null

async function ensureBinary() {
  if (!fs.existsSync(bin)) {
    console.log("Installing cloudflared binary (first run only)...")
    await install(bin)
    console.log("cloudflared binary installed.")
  }
}

async function startTunnel(port: number): Promise<string> {
  await ensureBinary()

  const tunnel = Tunnel.quick(`http://localhost:${port}`)
  activeTunnel = tunnel

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Tunnel failed to start within 30 seconds.")), 30_000)

    tunnel.once("url", (tunnelUrl: string) => {
      clearTimeout(timeout)
      resolve(tunnelUrl)
    })

    tunnel.once("exit", (code: number | null) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`cloudflared exited with code ${code}`))
      }
    })
  })

  return url
}

function stopTunnel() {
  if (activeTunnel) {
    activeTunnel.stop()
    activeTunnel = null
  }
}

export { startTunnel, stopTunnel }
