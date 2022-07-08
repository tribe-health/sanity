import {Button, Flex, Spinner, Stack, Text} from '@sanity/ui'
import React, {useCallback, useEffect, useState, useRef} from 'react'
import {useDocumentSearch} from '../../../../../search'
import {useSchema} from '../../../../../hooks'
import {SearchTerms} from '../../../../../search/weighted/types'
import {useSearchDispatch, useSearchState} from './state/SearchContext'
import {addSearchTerm, getRecentSearchTerms} from './local-storage/search-store'
import {RecentSearchItem} from './RecentSearchItem'
import {showNoResults, showRecentSearches, showResults} from './state/search-selectors'
import {SearchResultItem} from './SearchResultItem'
import {TypeNames} from './TypeNames'

interface SearchResultsProps {
  onResultClick: () => void
  onRecentSearchClick: () => void
}

const SEARCH_LIMIT = 5

export function SearchResults(props: SearchResultsProps) {
  const {onResultClick, onRecentSearchClick} = props

  const {state, dispatch, loadMore} = useSyncedSearch()
  const {terms, result} = state
  const {hits, loading, error} = result

  const schema = useSchema()
  const [recentSearches, setResentSearches] = useState(() => getRecentSearchTerms(schema))

  const handleResultClick = useCallback(() => {
    addSearchTerm(terms)
    setResentSearches(getRecentSearchTerms(schema))
    onResultClick()
  }, [onResultClick, terms])

  const handleRecentSearchClick = useCallback(
    (searchTerms: SearchTerms) => {
      // announce states
      // no results
      // maybe not results
      //announce naviagion to recent search

      // LOOK INTO sanity ui hover focus issue
      dispatch({type: 'SET_TERMS', terms: searchTerms})
      addSearchTerm(searchTerms)
      setResentSearches(getRecentSearchTerms(schema))
      onRecentSearchClick()
    },
    [dispatch, onRecentSearchClick]
  )

  return (
    <Stack
      flex={1}
      style={{maxHeight: 'calc(100vh - 100px)'}}
      overflow={!loading && hits.length ? 'auto' : undefined}
    >
      {showNoResults(state) && (
        <Flex justify="center" padding={3}>
          <Text>
            No results for <strong>"{terms.query}"</strong> in <TypeNames types={terms.types} />
          </Text>
        </Flex>
      )}

      {showResults(state) && (
        <Flex justify="center" padding={3}>
          <Text>
            Showing results for <strong>"{terms.query}"</strong> in{' '}
            <TypeNames types={terms.types} />
          </Text>
        </Flex>
      )}

      {showResults(state) && (
        <>
          {hits.map((hit) => (
            <SearchResultItem key={hit.hit._id} hit={hit.hit} onClick={handleResultClick} />
          ))}
          {!loading && (
            <Button text="More" onClick={loadMore} mode="ghost" title="Load more search results" />
          )}
        </>
      )}

      {showRecentSearches(state) &&
        recentSearches?.map((recentSearch) => (
          <RecentSearchItem
            key={recentSearch.__recentTimestamp}
            value={recentSearch}
            onClick={handleRecentSearchClick}
          />
        ))}

      {loading && (
        <Flex justify="center" padding={3}>
          <Spinner />
        </Flex>
      )}
    </Stack>
  )
}

function useSyncedSearch() {
  const state = useSearchState()
  const dispatch = useSearchDispatch()
  const initialRender = useRef(true)
  const {terms, result} = state

  const {state: syncState, search} = useDocumentSearch()

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      // dont run this hook on mount, as we want to retain current state
      return
    }
    dispatch({
      type: 'UPDATE_SEARCH_RESULT',
      result: {
        hits: [],
        loading: true,
        error: null,
      },
    })
    search({
      ...terms,
      limit: SEARCH_LIMIT,
      offset: 0,
    })
  }, [terms, dispatch, search])

  useEffect(() => {
    if (syncState.value.length) {
      dispatch({
        type: 'APPEND_HITS',
        hits: syncState.value,
      })
    }
  }, [syncState.value, dispatch])

  useEffect(() => {
    dispatch({
      type: 'UPDATE_SEARCH_RESULT',
      result: {
        loading: syncState.loading,
        error: syncState.error,
      },
    })
  }, [syncState.error, syncState.loading, dispatch])

  const loadMore = useCallback(() => {
    if (!state.result.loading) {
      search({
        ...terms,
        limit: SEARCH_LIMIT,
        offset: result.hits.length,
      })
    }
  }, [search, terms, result.hits.length, result.loading])

  return {state, dispatch, loadMore}
}
