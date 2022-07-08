import {useCallback, useEffect, useMemo, useState} from 'react'
import {concat, EMPTY, Observable, of, Subject, timer} from 'rxjs'
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  mergeMapTo,
  share,
  switchMap,
} from 'rxjs/operators'
import {useClient, useSchema} from '../hooks'
import {isNonNullable} from '../util'
import {createSearch} from './search'
import {SearchTerms, WeightedHit} from './weighted/types'

export interface DocumentSearchParams {
  options: Omit<SearchTerms, 'query'>
  query: string
}

export interface DocumentSearchResultsState {
  loading: boolean
  error: Error | null
  value: WeightedHit[]
}

const EMPTY_STATE: DocumentSearchResultsState = {
  loading: false,
  error: null,
  value: [],
}

const LOADING_STATE: DocumentSearchResultsState = {
  loading: true,
  error: null,
  value: [],
}

// This value is used to improve performance by minimizing the number
// of API requests, as well as improving the user experience by waiting
// to display the search results until the user has finished typing.
const DEBOUNCE_VALUE = 400

export function useDocumentSearch(): {
  state: DocumentSearchResultsState
  search: (params: SearchTerms) => void
} {
  const client = useClient()
  const schema = useSchema()
  const [state, setState] = useState<DocumentSearchResultsState>(EMPTY_STATE)
  const paramsSubject = useMemo(() => new Subject<SearchTerms>(), [])

  const runSearch = useMemo(() => createSearch(client, schema), [client, schema])

  const state$ = useMemo(
    () =>
      paramsSubject.asObservable().pipe(
        share(),
        distinctUntilChanged(),
        filter(isNonNullable),
        switchMap(
          (terms): Observable<DocumentSearchResultsState> =>
            terms.query || terms.types?.length
              ? concat(
                  of(LOADING_STATE),
                  timer(DEBOUNCE_VALUE).pipe(mergeMapTo(EMPTY)),
                  runSearch(terms.query, terms).pipe(
                    map((results) => ({loading: false, error: null, value: results})),
                    catchError((error) => {
                      return of({loading: false, error, value: []})
                    })
                  )
                )
              : of(EMPTY_STATE)
        )
      ),
    [paramsSubject, runSearch]
  )

  const search = useCallback(
    (params: SearchTerms) => {
      paramsSubject.next(params)
    },
    [paramsSubject]
  )

  useEffect(() => {
    const sub = state$.subscribe(setState)

    return () => {
      sub.unsubscribe()
    }
  }, [state$])

  return {state, search}
}

export function useDocumentSearchResults(props: SearchTerms): DocumentSearchResultsState {
  const {state, search} = useDocumentSearch()
  const {includeDrafts = false, limit = 1000, query, offset, types} = props

  useEffect(() => {
    search({query, includeDrafts, limit, types, offset})
  }, [includeDrafts, limit, query, types, offset, search])

  return state
}
