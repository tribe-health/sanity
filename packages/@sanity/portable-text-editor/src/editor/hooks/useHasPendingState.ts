import {createContext, useContext} from 'react'

/**
 * A React context for sharing the editor's pending state.
 */

export const PortableTextEditorPendingStateContext = createContext<boolean>(false)

/**
 * Get the current editor object from the React context.
 */

export const usePortableTextEditorPendingState = () => {
  const hasPending = useContext(PortableTextEditorPendingStateContext)

  if (hasPending === undefined) {
    throw new Error(
      `The \`usePortableTextEditorPendingState\` hook must be used inside the <PortableTextEditor> component's context.`
    )
  }

  return hasPending
}
