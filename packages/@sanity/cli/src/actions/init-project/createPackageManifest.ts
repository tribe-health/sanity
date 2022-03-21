import sortObject from 'deep-sort-object'
import type {PackageJson, SanityJson} from '../../types'

const manifestPropOrder = [
  'name',
  'private',
  'version',
  'description',
  'main',
  'author',
  'license',
  'scripts',
  'keywords',
  'dependencies',
  'devDependencies',
]

export function createPackageManifest(
  data: Omit<PackageJson, 'version'> & {gitRemote?: string}
): string {
  const deps = data.dependencies ? {dependencies: sortObject(data.dependencies)} : {}
  const pkg = {
    ...getCommonManifest(data),

    main: 'package.json',
    keywords: ['sanity'],
    scripts: {
      start: 'sanity start',
      build: 'sanity build',
    },

    ...deps,
  }

  return serializeManifest(pkg)
}

function getCommonManifest(data: Omit<PackageJson, 'version'> & {gitRemote?: string}) {
  const pkg: PackageJson = {
    name: data.name,
    version: '1.0.0',
    description: data.description,
    author: data.author,
    license: data.license,
    devDependencies: {},
  }

  if (pkg.license === 'UNLICENSED') {
    pkg.private = true
  }

  if (data.gitRemote) {
    pkg.repository = {
      type: 'git',
      url: data.gitRemote,
    }
  }

  return pkg
}

function serializeManifest(src: PackageJson | SanityJson): string {
  const props = manifestPropOrder.concat(Object.keys(src))
  const ordered = props.reduce((target, prop) => {
    const source = src as any
    if (typeof source[prop] !== 'undefined' && typeof target[prop] === 'undefined') {
      target[prop] = source[prop]
    }

    return target
  }, {} as Record<string, any>)

  return `${JSON.stringify(ordered, null, 2)}\n`
}