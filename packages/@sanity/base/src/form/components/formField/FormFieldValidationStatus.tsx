/* eslint-disable camelcase */

import {hues} from '@sanity/color'
import {ErrorOutlineIcon, InfoOutlineIcon, WarningOutlineIcon} from '@sanity/icons'
import {isValidationErrorMarker, isValidationWarningMarker, ValidationMarker} from '@sanity/types'
import {Box, Flex, Placement, Stack, Text, Tooltip} from '@sanity/ui'
import React, {useMemo} from 'react'

export interface FormFieldValidationStatusProps {
  /**
   * @alpha
   */
  validation?: ValidationMarker[]
  /**
   * @alpha
   */
  __unstable_showSummary?: boolean
  fontSize?: number | number
  placement?: Placement
  portal?: boolean
}

const EMPTY_ARRAY: never[] = []

const VALIDATION_COLORS: Record<'error' | 'warning' | 'info', string> = {
  error: hues.red[500].hex,
  warning: hues.yellow[500].hex,
  info: hues.blue[500].hex,
}

const VALIDATION_ICONS: Record<'error' | 'warning' | 'info', React.ReactElement> = {
  error: <ErrorOutlineIcon data-testid="input-validation-icon-error" />,
  warning: <WarningOutlineIcon data-testid="input-validation-icon-warning" />,
  info: <InfoOutlineIcon data-testid="input-validation-icon-info" />,
}

export function FormFieldValidationStatus(props: FormFieldValidationStatusProps) {
  const {
    validation = EMPTY_ARRAY,
    __unstable_showSummary: showSummary,
    fontSize,
    placement = 'top',
    portal,
  } = props

  const errors = validation.filter((v) => v.level === 'error')
  const warnings = validation.filter((v) => v.level === 'warning')
  const info = validation.filter((v) => v.level === 'info')

  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0
  const hasInfo = info.length > 0

  const statusIcon = useMemo(() => {
    if (hasErrors) return VALIDATION_ICONS.error
    if (hasWarnings) return VALIDATION_ICONS.warning
    if (hasInfo) return VALIDATION_ICONS.info
    return undefined
  }, [hasErrors, hasInfo, hasWarnings])

  const statusColor = useMemo(() => {
    if (hasErrors) return VALIDATION_COLORS.error
    if (hasWarnings) return VALIDATION_COLORS.warning
    if (hasInfo) return VALIDATION_COLORS.info
    return undefined
  }, [hasErrors, hasInfo, hasWarnings])

  return (
    <Tooltip
      content={
        <Stack padding={3} space={3}>
          {showSummary && <FormFieldValidationSummary validation={validation} />}

          {!showSummary && (
            <>
              {validation.map((item, itemIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <FormFieldValidationStatusItem item={item} key={itemIndex} />
              ))}
            </>
          )}
        </Stack>
      }
      portal={portal}
      placement={placement}
      fallbackPlacements={['bottom', 'right', 'left']}
    >
      <div>
        <Text muted size={fontSize} weight="semibold" style={{color: statusColor}}>
          {statusIcon}
        </Text>
      </div>
    </Tooltip>
  )
}

function FormFieldValidationStatusItem(props: {item: ValidationMarker}) {
  const {item} = props

  const statusIcon = useMemo(() => {
    if (item.level === 'error') return VALIDATION_ICONS.error
    if (item.level === 'warning') return VALIDATION_ICONS.warning
    if (item.level === 'info') return VALIDATION_ICONS.info
    return undefined
  }, [item])

  const statusColor = useMemo(() => {
    if (item.level === 'error') return VALIDATION_COLORS.error
    if (item.level === 'warning') return VALIDATION_COLORS.warning
    if (item.level === 'info') return VALIDATION_COLORS.info
    return undefined
  }, [item])

  return (
    <Flex>
      <Box marginRight={2}>
        <Text size={1} style={{color: statusColor}}>
          {statusIcon}
        </Text>
      </Box>
      <Box flex={1}>
        <Text muted size={1}>
          {item.item.message}
        </Text>
      </Box>
    </Flex>
  )
}

function FormFieldValidationSummary({validation}: {validation: ValidationMarker[]}) {
  const errorMarkers = validation.filter(isValidationErrorMarker)
  const warningMarkers = validation.filter(isValidationWarningMarker)
  const errorLen = errorMarkers.length
  const warningLen = warningMarkers.length

  const errorsStr = `error${errorLen === 1 ? '' : 's'}`
  const warningsStr = `warning${warningLen === 1 ? '' : 's'}`
  const errorText = errorLen && `${errorLen} ${errorsStr}`
  const warningText = warningLen && `${warningLen} ${warningsStr}`

  const hasErrors = errorLen > 0
  const hasWarnings = warningLen > 0
  const hasBoth = hasErrors && hasWarnings

  return (
    <Text muted size={1}>
      {errorText || ''}
      {hasBoth && <> and </>}
      {warningText || ''}
    </Text>
  )
}
