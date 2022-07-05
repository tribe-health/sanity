import {Editor, Transforms, Node, Element, Path as SlatePath, Descendant} from 'slate'
import * as DMP from 'diff-match-patch'
import {Path, KeyedSegment, PathSegment} from '@sanity/types'
import type {Patch, InsertPatch, UnsetPatch, SetPatch, DiffMatchPatch} from '../types/patch'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import {toSlateValue} from './values'
import {debugWithName} from './debug'
import {KEY_TO_SLATE_ELEMENT} from './weakMaps'
import {isEqual} from 'lodash'

const debug = debugWithName('operationToPatches')

// eslint-disable-next-line new-cap
const dmp = new DMP.diff_match_patch()

export function createPatchToOperations(
  portableTextFeatures: PortableTextFeatures
): (
  editor: Editor,
  patch: Patch,
  snapshot: PortableTextBlock[] | undefined,
  previousSnapshot: PortableTextBlock[] | undefined
) => boolean {
  function insertPatch(editor: Editor, patch: InsertPatch) {
    if (patch.path.length === 1) {
      const {items, position} = patch
      const blocksToInsert = toSlateValue(
        items as PortableTextBlock[],
        {portableTextFeatures},
        KEY_TO_SLATE_ELEMENT.get(editor)
      ) as unknown as Node[]
      const posKey = findLastKey(patch.path)
      const index = editor.children.findIndex((node, indx) => {
        return posKey ? node._key === posKey : indx === patch.path[0]
      })
      const normalizedIdx = position === 'after' ? index + 1 : index
      debug(`Inserting blocks at path [${normalizedIdx}]`)
      Transforms.insertNodes(editor, blocksToInsert, {at: [normalizedIdx]})
      debug('editor.children', JSON.stringify(editor.children, null, 2))
      return true
    }
    const {items, position} = patch
    const posKey = findLastKey(patch.path)
    const blockIndex = editor.children.findIndex((node, indx) => {
      return posKey ? node._key === posKey : indx === patch.path[0]
    })
    const block: PortableTextBlock | undefined =
      editor.children && blockIndex > -1 ? editor.children[blockIndex] : undefined
    const childIndex =
      block &&
      block.children.findIndex((node: PortableTextChild, indx: number) => {
        return isKeyedSegment(patch.path[2])
          ? node._key === patch.path[2]._key
          : indx === patch.path[2]
      })
    const childrenToInsert =
      block &&
      (toSlateValue(
        [{...block, children: items as PortableTextChild[]}],
        {portableTextFeatures},
        KEY_TO_SLATE_ELEMENT.get(editor)
      ) as unknown as Node[])

    const normalizedIdx = position === 'after' ? childIndex + 1 : childIndex
    const targetPath = [blockIndex, normalizedIdx]
    debug(`Inserting children at path ${targetPath}`)
    Transforms.insertNodes(editor, childrenToInsert[0].children, {at: targetPath})
    debug('editor.children', JSON.stringify(editor.children, null, 2))

    return true
  }

  function setPatch(editor: Editor, patch: SetPatch) {
    const blockIndex = editor.children.findIndex((node, indx) => {
      return isKeyedSegment(patch.path[0])
        ? node._key === patch.path[0]._key
        : indx === patch.path[0]
    })
    const block: PortableTextBlock | undefined =
      blockIndex > -1 ? editor.children[blockIndex] : undefined
    const childIndex =
      block &&
      block.children.findIndex((node: PortableTextChild, indx: number) => {
        return isKeyedSegment(patch.path[2])
          ? node._key === patch.path[2]._key
          : indx === patch.path[2]
      })
    let value: any = patch.value
    const targetPath: SlatePath = childIndex > -1 ? [blockIndex, childIndex] : [blockIndex]
    if (typeof patch.path[3] === 'string') {
      value = {}
      value[patch.path[3]] = patch.value
    }
    debug(`Setting nodes at ${JSON.stringify(patch.path)} - ${JSON.stringify(targetPath)}`)
    debug('value to set', JSON.stringify(value, null, 2))
    debug('block.children', JSON.stringify(editor.children, null, 2))
    if (targetPath.length === 1) {
      const {children, ...rest} = value
      editor.apply({
        type: 'set_node',
        path: targetPath,
        properties: {},
        newProperties: rest,
      })
      block?.children.forEach((c, cIndex) => {
        editor.apply({
          type: 'remove_node',
          path: targetPath.concat(cIndex),
          node: c,
        })
      })
      children.forEach((c, cIndex) => {
        editor.apply({
          type: 'insert_node',
          path: targetPath.concat(cIndex),
          node: c,
        })
      })
    } else if (value.text) {
      debug('Selection', JSON.stringify(editor.selection, null, 2))
      const oldSel = editor.selection && {...editor.selection}
      editor.apply({
        type: 'remove_text',
        path: targetPath,
        offset: 0,
        text: block?.children[childIndex].text,
      })
      editor.apply({
        type: 'insert_text',
        path: targetPath,
        offset: 0,
        text: value.text,
      })
      if (oldSel && isEqual(oldSel.focus.path, targetPath)) {
        Transforms.select(editor, oldSel)
      } else if (
        editor.selection &&
        editor.selection.focus.path[0] === blockIndex &&
        typeof patch.path[3] === 'string'
      ) {
        const newOffset = typeof patch.value === 'string' ? patch.value.length : 0
        const point = {path: targetPath, offset: newOffset}
        Transforms.select(editor, {focus: point, anchor: point})
        debug('Adjusted selection', JSON.stringify(editor.selection, null, 2))
      }
    } else {
      editor.apply({
        type: 'set_node',
        path: targetPath,
        properties: {},
        newProperties: value,
      })
    }
    debug('editor.children', JSON.stringify(editor.children, null, 2))
    return true
  }

  function diffMatchPatch(editor: Editor, patch: DiffMatchPatch) {
    const blockKey = findLastKey([patch.path[0]])
    const blockIndex = editor.children.findIndex((node, indx) => {
      return blockKey ? node._key === blockKey : indx === patch.path[0]
    })
    const block = editor.children[blockIndex] as Element
    const childKey = findLastKey([patch.path[2]])
    const childIndex = block.children.findIndex((node, indx) => {
      return childKey ? node._key === childKey : indx === patch.path[0]
    })
    debug('DiffMatchPatch', JSON.stringify(patch, null, 2))
    const parsed = dmp.patch_fromText(patch.value)[0]
    if (parsed) {
      let testString = ''
      for (const diff of parsed.diffs) {
        // eslint-disable-next-line max-depth
        if (diff[0] === 0) {
          testString += diff[1]
        } else {
          break
        }
      }
      // This thing is exotic but actually works!
      const isBeforeUserSelection =
        editor.selection &&
        parsed.start1 !== null &&
        parsed.start1 + testString.length <= editor.selection.focus.offset &&
        parsed.start1 + testString.length <= editor.selection.anchor.offset

      const distance = parsed.length2 - parsed.length1
      debug(JSON.stringify(parsed, null, 2))
      let text
      if (parsed.diffs[1]) {
        text = parsed.diffs[1][1]
      } else {
        text = parsed.diffs[0][1]
      }
      const slatePath = [blockIndex, childIndex]
      const point = {path: slatePath, offset: (parsed.start1 || 0) + parsed.length1}
      if (distance >= 0) {
        editor.apply({
          type: 'insert_text',
          path: point.path,
          offset: point.offset,
          text,
        })
      } else {
        editor.apply({
          type: 'remove_text',
          path: point.path,
          offset: point.offset - text.length,
          text,
        })
      }
      // debug(
      //   `Adjusting selection for diffMatchPatch on same line ${JSON.stringify(
      //     {
      //       parsed,
      //       distance,
      //       isBeforeUserSelection,
      //       isRemove: parsed.diffs.some((diff) => diff[0] === -1),
      //       testString,
      //       textPath,
      //       text,
      //       editor,
      //     },
      //     null,
      //     2
      //   )}`
      // )
    }
    return true
  }

  function unsetPatch(editor: Editor, patch: UnsetPatch) {
    // Deal with patches unsetting the whole field
    if (patch.path.length === 0) {
      debug(`Removing everything`)
      editor.children = []
      return true
    }
    if (patch.path.length === 1) {
      const lastKey = findLastKey(patch.path)
      const index = editor.children.findIndex((node, indx) =>
        lastKey ? node._key === lastKey : indx === patch.path[0]
      )
      if (index > -1) {
        if (editor.selection && editor.selection.focus.path[0] === index) {
          const point = {path: [editor.selection.focus.path[0] - 1], offset: 0}
          Transforms.select(editor, {focus: point, anchor: point})
          Transforms.move(editor, {unit: 'line'})
          debug('Adjusted selection', JSON.stringify(editor.selection, null, 2))
        }
        Transforms.removeNodes(editor, {at: [index]})
        debug(`Removing block at path [${index}]`)
      }
      return true
    }
    debug('Selection', JSON.stringify(editor.selection, null, 2))
    const oldSel = editor.selection && {...editor.selection}
    const blockIndex = editor.children.findIndex((node, indx) => {
      return isKeyedSegment(patch.path[0])
        ? node._key === patch.path[0]._key
        : indx === patch.path[0]
    })
    const block: PortableTextBlock | undefined =
      blockIndex > -1 ? editor.children[blockIndex] : undefined
    const childIndex =
      block &&
      block.children.findIndex((node: PortableTextChild, indx: number) => {
        return isKeyedSegment(patch.path[2])
          ? node._key === patch.path[2]._key
          : indx === patch.path[2]
      })
    debug(`Removing child at path [${[blockIndex, childIndex]}]`)
    if (oldSel && oldSel.focus.path[0] === blockIndex && childIndex <= oldSel.focus.path[1]) {
      oldSel.focus = {...oldSel.focus}
      oldSel.focus.path = [oldSel.focus.path[0], oldSel.focus.path[1] - 1]
      oldSel.anchor = {...oldSel.anchor}
      oldSel.anchor.path = [oldSel.anchor.path[0], oldSel.anchor.path[1] - 1]
      Transforms.select(editor, oldSel)
    }
    Transforms.removeNodes(editor, {at: [blockIndex, childIndex]})
    debug('editor.children', JSON.stringify(editor.children, null, 2))
    debug('Adjusted selection', JSON.stringify(editor.selection, null, 2))
    return true
  }

  return function (
    editor: Editor,
    patch: Patch,
    snapshot: PortableTextBlock[] | undefined,
    previousSnapshot: PortableTextBlock[] | undefined
  ): boolean {
    debug('patch', JSON.stringify(patch, null, 2))
    switch (patch.type) {
      case 'insert':
        return !!insertPatch(editor, patch)
      case 'unset':
        return !!unsetPatch(editor, patch)
      case 'set':
        return !!setPatch(editor, patch)
      case 'diffMatchPatch':
        return !!diffMatchPatch(editor, patch)
      default:
        debug('Unhandled patch', patch.type)
    }
    return false
  }
}

function isKeyedSegment(segment: PathSegment): segment is KeyedSegment {
  return typeof segment === 'object' && '_key' in segment
}

// Helper function to find the last part of a patch path that has a known key
function findLastKey(path: Path) {
  let key: string | null = null

  path
    .concat('')
    .reverse()
    .forEach((part) => {
      if (isKeyedSegment(part)) {
        key = part._key
      }
    })

  return key
}
