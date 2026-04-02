/**
 * OpenClaude package script — creates distributable archives
 * for each compiled executable.
 *
 * Usage:
 *   bun run package           # Package current platform build
 *   bun run package:all       # Package all platform builds
 */

import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = pkg.version

interface PlatformConfig {
  name: string
  binary: string
  archive: string
}

const platforms: PlatformConfig[] = [
  { name: 'Windows (x64)', binary: 'openclaude-windows-x64.exe', archive: `openclaude-v${version}-windows-x64.zip` },
  { name: 'Linux (x64)', binary: 'openclaude-linux-x64', archive: `openclaude-v${version}-linux-x64.tar.gz` },
  { name: 'macOS (x64)', binary: 'openclaude-darwin-x64', archive: `openclaude-v${version}-macos-x64.tar.gz` },
  { name: 'macOS (ARM64)', binary: 'openclaude-darwin-arm64', archive: `openclaude-v${version}-macos-arm64.tar.gz` },
]

async function packagePlatform(platform: PlatformConfig) {
  const distPath = './dist'
  const binaryPath = join(distPath, platform.binary)
  
  if (!existsSync(binaryPath)) {
    console.log(`⚠️  Skipping ${platform.name} — binary not found: ${platform.binary}`)
    return
  }
  
  console.log(`\n📦 Packaging ${platform.name}...`)
  
  // Create staging directory
  const stagingDir = join(distPath, `staging-${platform.binary}`)
  if (!existsSync(stagingDir)) {
    mkdirSync(stagingDir, { recursive: true })
  }
  
  // Copy binary with standardized name
  const outputBinary = platform.binary.includes('windows') ? 'openclaude.exe' : 'openclaude'
  copyFileSync(binaryPath, join(stagingDir, outputBinary))
  
  // Copy README
  if (existsSync('./README.md')) {
    copyFileSync('./README.md', join(stagingDir, 'README.md'))
  }
  
  // Create LICENSE file
  writeFileSync(join(stagingDir, 'LICENSE'), `MIT License

Copyright (c) 2026 OpenClaude Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`)
  
  // Create archive
  const archivePath = join(distPath, platform.archive)
  
  if (platform.archive.endsWith('.zip')) {
    // Windows: use PowerShell Compress-Archive
    const proc = Bun.spawn([
      'powershell', '-Command',
      `Compress-Archive -Path "${stagingDir}/*" -DestinationPath "${archivePath}" -Force`
    ], { stdout: 'inherit', stderr: 'inherit' })
    await proc.exited
  } else {
    // Unix: use tar
    const proc = Bun.spawn([
      'tar', '-czf', archivePath, '-C', stagingDir, '.'
    ], { stdout: 'inherit', stderr: 'inherit' })
    await proc.exited
  }
  
  console.log(`✓ Created: ${platform.archive}`)
  
  // Clean up staging
  await $`rm -rf ${stagingDir}`
}

async function main() {
  const args = process.argv.slice(2)
  const packageAll = args.includes('--all') || args.includes('all')
  
  console.log(`🚀 OpenClaude Packager v${version}`)
  
  // Ensure dist directory exists
  if (!existsSync('./dist')) {
    mkdirSync('./dist')
  }
  
  if (packageAll) {
    console.log('\n📦 Packaging for all platforms...')
    for (const platform of platforms) {
      await packagePlatform(platform)
    }
    console.log('\n✅ All packages created in ./dist/')
  } else {
    // Auto-detect current platform
    const platform = process.platform
    const arch = process.arch
    
    let target: PlatformConfig | undefined
    if (platform === 'win32' && arch === 'x64') {
      target = platforms[0]
    } else if (platform === 'linux' && arch === 'x64') {
      target = platforms[1]
    } else if (platform === 'darwin' && arch === 'x64') {
      target = platforms[2]
    } else if (platform === 'darwin' && arch === 'arm64') {
      target = platforms[3]
    }
    
    if (target) {
      await packagePlatform(target)
    } else {
      console.log(`⚠️  Unsupported platform: ${platform} ${arch}`)
      console.log('Available binaries in dist/:')
      platforms.forEach(p => {
        if (existsSync(`./dist/${p.binary}`)) {
          console.log(`  ✓ ${p.binary}`)
        }
      })
    }
  }
}

main().catch(console.error)
