import {Editor} from 'slate'
import {createOperationToPatches} from '../utils/operationToPatches'
import {createEditorOptions} from '../types/options'
import {PortableTextSlateEditor} from '../types/editor'
import {
  createWithObjectKeys,
  createWithPortableTextMarkModel,
  createWithPortableTextSelections,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks,
  createWithPortableTextLists,
  createWithUndoRedo,
  createWithPortableTextBlockStyle,
  createWithUtils,
} from './plugins'

export const withPortableText = <T extends Editor>(
  editor: T,
  options: createEditorOptions
): PortableTextSlateEditor => {
  const e = editor as T & PortableTextSlateEditor
  e.maxBlocks = options.maxBlocks || -1
  e.readOnly = options.readOnly || false
  const {portableTextFeatures, keyGenerator, change$, incomingPatches$, syncValue} = options
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withSchemaTypes = createWithSchemaTypes(portableTextFeatures)
  const [withPatches, withPatchesCleanupFunction] = options.readOnly
    ? []
    : createWithPatches(
        operationToPatches,
        change$,
        portableTextFeatures,
        syncValue,
        incomingPatches$
      )
  const withMaxBlocks = createWithMaxBlocks()
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const [withUndoRedo, withUndoRedoCleanupFunction] = options.readOnly
    ? []
    : createWithUndoRedo(incomingPatches$)
  const withPortableTextMarkModel = createWithPortableTextMarkModel(
    portableTextFeatures,
    keyGenerator
  )
  const withPortableTextBlockStyle = createWithPortableTextBlockStyle(portableTextFeatures, change$)
  const withUtils = createWithUtils({keyGenerator, portableTextFeatures})
  const withPortableTextSelections = createWithPortableTextSelections(change$, portableTextFeatures)
  e.destroy = () => {
    if (withPatchesCleanupFunction) {
      withPatchesCleanupFunction()
    }
    if (withUndoRedoCleanupFunction) {
      withUndoRedoCleanupFunction()
    }
  }
  const minimal = withSchemaTypes(
    withObjectKeys(
      withPortableTextMarkModel(withPortableTextBlockStyle(withUtils(withPortableTextLists(e))))
    )
  )
  const full =
    (withUndoRedo &&
      withPatches &&
      withSchemaTypes(
        withObjectKeys(
          withPortableTextMarkModel(
            withPortableTextBlockStyle(
              withPortableTextLists(
                withUtils(withMaxBlocks(withUndoRedo(withPatches(withPortableTextSelections(e)))))
              )
            )
          )
        )
      )) ||
    e
  // Ordering is important here, selection dealing last, data manipulation in the middle and core model stuff first.
  return options.readOnly ? minimal : full
}
