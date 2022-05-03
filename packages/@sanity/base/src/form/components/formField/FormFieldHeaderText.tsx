/* eslint-disable camelcase */

import {ValidationMarker} from '@sanity/types'
import {Box, Flex, Stack, Text} from '@sanity/ui'
import React, {memo} from 'react'
import {FormFieldValidationStatus} from './FormFieldValidationStatus'

export interface FormFieldHeaderTextProps {
  /**
   * @alpha
   */
  validation?: ValidationMarker[]
  description?: React.ReactNode
  /**
   * The unique ID used to target the actual input element
   */
  inputId?: string
  title?: React.ReactNode
}

const EMPTY_ARRAY: never[] = []

export const FormFieldHeaderText = memo(function FormFieldHeaderText(
  props: FormFieldHeaderTextProps
) {
  const {description, inputId, title, validation = EMPTY_ARRAY} = props
  const hasValidations = validation.length > 0

  return (
    <Stack space={2}>
      <Flex>
        <Text as="label" htmlFor={inputId} weight="semibold" size={1}>
          {title || <em>Untitled</em>}
        </Text>

        {hasValidations && (
          <Box marginLeft={2}>
            <FormFieldValidationStatus fontSize={1} validation={validation} />
          </Box>
        )}
      </Flex>

      {description && (
        <Text muted size={1}>
          {description}
        </Text>
      )}
    </Stack>
  )
})
