import {Card, Popover, useGlobalKeyDown, useRootTheme, useTheme} from '@sanity/ui'
import React, {RefObject, useCallback, useRef, useState} from 'react'
import styled from 'styled-components'
import {OmnisearchPopover} from './OmnisearchPopover'
import {SearchContextProvider} from './state/SearchContext'
import {isEscape, isSearchHotKey} from './utils/search-hotkeys'
import {DummySearchInput} from './DummySearchInput'

interface OmnisearchFieldProps {
  // eslint-disable-next-line react/no-unused-prop-types
  portalElement?: HTMLDivElement | null
}

const ParentCard = styled(Card)`
  position: relative;
`

export function OmnisearchField(props: OmnisearchFieldProps) {
  const popoverEl = useRef<HTMLDivElement>(null)
  const dummyInputEl = useRef<HTMLInputElement>(null)
  const dummyInputWrapperEl = useRef<HTMLDivElement>(null)
  const [open, setOpened, setClosed] = useOpen()

  useSearchHotkeyListener(dummyInputEl, open, setOpened, setClosed)
  return (
    <SearchContextProvider>
      <Popover
        content={<OmnisearchPopover close={setClosed} />}
        padding={4}
        portal
        open={open}
        arrow={false}
        placement="left-start"
        ref={popoverEl}
        style={{position: 'relative'}}
      >
        <ParentCard border ref={dummyInputWrapperEl}>
          <DummySearchInput setOpened={setOpened} ref={dummyInputEl} />
        </ParentCard>
      </Popover>
    </SearchContextProvider>
  )
}

function useSearchHotkeyListener(
  dummyInputEl: RefObject<HTMLInputElement>,
  open: boolean,
  setOpened: () => void,
  setClosed: () => void
) {
  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isSearchHotKey(event)) {
        event.preventDefault()
        setOpened()
      }
      if (isEscape(event) && open) {
        setClosed()
        dummyInputEl.current?.focus()
      }
    },
    [dummyInputEl, setOpened, setClosed, open]
  )

  useGlobalKeyDown(handleGlobalKeyDown)
}

function useOpen() {
  const [open, setOpen] = useState(false)
  const setOpened = useCallback(() => setOpen(true), [setOpen])
  const setClosed = useCallback(() => setOpen(false), [setOpen])
  return [open, setOpened, setClosed] as [typeof open, typeof setOpened, typeof setClosed]
}
