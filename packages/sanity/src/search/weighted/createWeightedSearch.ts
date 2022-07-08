/* eslint-disable import/prefer-default-export */
import type {SanityClient} from '@sanity/client'
import type {ObjectSchemaType} from '@sanity/types'
import type {Observable} from 'rxjs'
import {compact, toLower, flatten, uniq, flow, sortBy, union} from 'lodash'
import {map, tap} from 'rxjs/operators'
import {joinPath} from '../../util/searchUtils'
import {tokenize} from '../common/tokenize'
import {removeDupes} from '../../util/draftUtils'
import {applyWeights} from './applyWeights'
import {
  WeightedHit,
  WeightedSearchOptions,
  SearchOptions,
  SearchPath,
  SearchHit,
  SearchSpec,
  SearchTerms,
} from './types'

type ObjectSchema = {
  name: string
  // eslint-disable-next-line camelcase
  __experimental_search?: ObjectSchemaType['__experimental_search']
}

const combinePaths = flow([flatten, union, compact])

const toGroqParams = (terms: string[]): Record<string, string> => {
  const params: Record<string, string> = {}
  return terms.reduce((acc, term, i) => {
    acc[`t${i}`] = `${term}*` // "t" is short for term
    return acc
  }, params)
}

const pathWithMapper = ({mapWith, path}: SearchPath): string =>
  mapWith ? `${mapWith}(${path})` : path

export function createWeightedSearch(
  types: ObjectSchema[],
  client: SanityClient,
  options: WeightedSearchOptions = {}
): (query: string, opts?: Omit<SearchTerms, 'query'>) => Observable<WeightedHit[]> {
  if (!types) {
    throw new Error('missing types')
  }

  const {filter, params, tag} = options

  // this is the actual search function that takes the search string and returns the hits
  return function search(queryString: string, searchOpts: SearchOptions = {types: []}) {
    const searchTerms = {query: queryString, ...searchOpts}
    const searchSpec: SearchSpec[] = searchTerms.types.map((type) => ({
      typeName: type.name,
      paths: type.__experimental_search?.map((config) => ({
        weight: config.weight,
        path: joinPath(config.path),
        mapWith: config.mapWith,
      })),
    }))

    const combinedSearchPaths = combinePaths(
      searchSpec.map((configForType) => configForType.paths?.map((opt) => pathWithMapper(opt)))
    )

    const selections = searchSpec.map((spec) => {
      const constraint = `_type == "${spec.typeName}" => `
      const selection = `{ ${spec.paths?.map((cfg, i) => `"w${i}": ${pathWithMapper(cfg)}`)} }`
      return `${constraint}${selection}`
    })

    const terms = uniq(compact(tokenize(toLower(searchTerms.query))))
    const constraints = terms
      .map((term, i) => combinedSearchPaths.map((joinedPath: any) => `${joinedPath} match $t${i}`))
      .filter((constraint) => constraint.length > 0)

    const filters = [
      '_type in $__types',
      searchOpts.includeDrafts === false && `!(_id in path('drafts.**'))`,
      ...constraints.map((constraint) => `(${constraint.join('||')})`),
      filter ? `(${filter})` : '',
    ].filter(Boolean)

    const selection = selections.length > 0 ? `...select(${selections.join(',\n')})` : ''
    const query = `*[${filters.join('&&')}][$__offset...$__limit]{_type, _id, ${selection}}`

    const offset = searchTerms.offset ?? 0
    const limit = (searchTerms.limit ?? searchOpts.limit ?? 1000) + offset
    return client.observable
      .fetch(
        query,
        {
          ...toGroqParams(terms),
          __types: searchSpec.map((spec) => spec.typeName),
          __limit: limit,
          __offset: offset,
          ...(params || {}),
        },
        {tag}
      )
      .pipe(
        options.unique ? map(removeDupes) : tap(),
        map((hits: SearchHit[]) => applyWeights(searchSpec, hits, terms)),
        map((hits) => sortBy(hits, (hit) => -hit.score))
      )
  }
}
