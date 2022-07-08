import React, {useCallback} from 'react'
import {MenuItem} from '@sanity/ui'
import {SearchItem} from '../SearchItem'
import {useRouter} from '../../../../../router'
import {getPublishedId} from '../../../../../util'
import {SearchHit} from '../../../../../search/weighted/types'

export interface SearchResultItemProps {
  hit: SearchHit
  onClick: () => void
}

export function SearchResultItem(props: SearchResultItemProps) {
  const {hit, onClick} = props
  const {navigateIntent} = useRouter()

  const handleResultClick = useCallback(() => {
    onClick()
    navigateIntent('edit', {
      id: getPublishedId(hit._id),
      type: hit._type,
    })
  }, [navigateIntent, hit, onClick])

  return (
    <MenuItem key={hit._id} onClick={handleResultClick} padding={1}>
      <SearchItem documentType={hit._type} key={hit._id} padding={2} documentId={hit._id || ''} />
    </MenuItem>
  )
}
