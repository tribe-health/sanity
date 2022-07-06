import React from 'react'
import {ArraySchemaType, Path} from '@sanity/types'
import {Subscription, Subject, defer, of, EMPTY, Observable, OperatorFunction} from 'rxjs'
import {concatMap, share, switchMap, tap} from 'rxjs/operators'
import {randomKey} from '@sanity/util/content'
import {createEditor} from 'slate'
import {debounce, isEqual, throttle} from 'lodash'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {RawType, Type} from '../types/schema'
import type {Patch} from '../types/patch'
import {
  EditorSelection,
  EditorChange,
  EditorChanges,
  EditableAPI,
  InvalidValueResolution,
  PatchObservable,
  PortableTextSlateEditor,
  EditableAPIDeleteOptions,
} from '../types/editor'
import {validateValue} from '../utils/validateValue'
import {debugWithName} from '../utils/debug'
import {toSlateValue} from '../utils/values'
import {KEY_TO_SLATE_ELEMENT, KEY_TO_VALUE_ELEMENT} from '../utils/weakMaps'
import {PortableTextEditorContext} from './hooks/usePortableTextEditor'
import {PortableTextEditorSelectionContext} from './hooks/usePortableTextEditorSelection'
import {PortableTextEditorValueContext} from './hooks/usePortableTextEditorValue'
import {withPortableText} from './withPortableText'

// Debounce time for flushing local patches (ms since user haven't produced a patch)
export const FLUSH_PATCHES_DEBOUNCE_MS = 1000

export const defaultKeyGenerator = () => randomKey(12)

const debug = debugWithName('component:PortableTextEditor')

export type PortableTextEditorProps = {
  incomingPatches$?: PatchObservable
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  readOnly?: boolean
  type: ArraySchemaType<PortableTextBlock> | RawType
  value?: PortableTextBlock[]
}

type State = {
  currentValue: PortableTextBlock[] | undefined | null
  hasPendingLocalPatches: boolean
  invalidValueResolution: InvalidValueResolution | null
  selection: EditorSelection // This state is only used to force the selection context to update.
}
export class PortableTextEditor extends React.Component<PortableTextEditorProps, State> {
  public change$: EditorChanges = new Subject()
  public keyGenerator: () => string
  public maxBlocks: number | undefined
  public portableTextFeatures: PortableTextFeatures
  public readOnly: boolean
  public slateInstance: PortableTextSlateEditor
  public type: ArraySchemaType<PortableTextBlock>

  private changeSubscription: Subscription
  private editable?: EditableAPI
  private incomingPatches$?: PatchObservable
  private pendingPatches: Patch[] = []
  private returnedPatches: Patch[] = []

  constructor(props: PortableTextEditorProps) {
    super(props)

    if (!props.type) {
      throw new Error('PortableTextEditor: missing "type" property')
    }

    // Test if we have a compiled schema type, if not, conveniently compile it
    this.type = props.type.hasOwnProperty('jsonType') ? props.type : compileType(props.type)
    // Indicate that we are loading
    this.change$.next({type: 'loading', isLoading: true})

    // Get the block types feature set (lookup table)
    this.portableTextFeatures = getPortableTextFeatures(this.type)

    // Setup keyGenerator (either from props, or default)
    this.keyGenerator = props.keyGenerator || defaultKeyGenerator

    let state: State = {
      invalidValueResolution: null,
      selection: null,
      hasPendingLocalPatches: false,
      currentValue: props.value || null,
    }

    // Setup processed incoming patches stream
    if (props.incomingPatches$) {
      // Buffer patches until we are no longer producing local patches
      this.incomingPatches$ = props.incomingPatches$
        .pipe(
          tap(
            ({
              patches,
            }: {
              patches: Patch[]
              snapshot: PortableTextBlock[] | undefined
              previousSnapshot: PortableTextBlock[] | undefined
            }) => {
              // Reset hasPendingLocalPatches when local patches are returned
              if (patches.some((p) => p.origin === 'local')) {
                this.setState({hasPendingLocalPatches: false})
              }
            }
          )
        )
        .pipe(
          bufferUntil(() => !this.state.hasPendingLocalPatches),
          concatMap((incoming) => {
            return incoming
          }),
          share()
        )
    }

    // Subscribe to editor events and set state for selection and pending patches
    this.changeSubscription = this.change$.subscribe((next: EditorChange): void => {
      const {onChange} = this.props
      switch (next.type) {
        case 'patch':
          this.pendingPatches.push(next.patch)
          this.setState({hasPendingLocalPatches: true}, () => this.flushDebounced())
          break
        case 'selection':
          onChange(next)
          this.setState({selection: next.selection})
          break
        default:
          onChange(next)
      }
    })

    // Validate the incoming value
    if (props.value) {
      const validation = validateValue(props.value, this.portableTextFeatures, this.keyGenerator)
      if (props.value && !validation.valid) {
        this.change$.next({type: 'loading', isLoading: false})
        this.change$.next({
          type: 'invalidValue',
          resolution: validation.resolution,
          value: props.value,
        })
        state = {...state, invalidValueResolution: validation.resolution}
      }
    }

    // Create state
    this.maxBlocks =
      typeof props.maxBlocks === 'undefined'
        ? undefined
        : parseInt(props.maxBlocks.toString(), 10) || undefined
    this.readOnly = props.readOnly || false
    this.state = state

    // Create the slate instance
    this.slateInstance = withPortableText(createEditor(), {
      change$: this.change$,
      incomingPatches$: this.incomingPatches$,
      keyGenerator: this.keyGenerator,
      maxBlocks: this.maxBlocks,
      portableTextFeatures: this.portableTextFeatures,
      readOnly: this.readOnly,
      syncValue: this.syncValue,
    })
    KEY_TO_VALUE_ELEMENT.set(this.slateInstance, {})
    KEY_TO_SLATE_ELEMENT.set(this.slateInstance, {})
  }

  componentWillUnmount() {
    this.flush()
    this.changeSubscription.unsubscribe()
    this.slateInstance.destroy()
  }

  componentDidUpdate(prevProps: PortableTextEditorProps) {
    if (this.props.readOnly !== prevProps.readOnly) {
      this.readOnly = this.props.readOnly || false
      this.slateInstance.readOnly = this.readOnly
    }
    if (this.props.maxBlocks !== prevProps.maxBlocks) {
      this.maxBlocks =
        typeof this.props.maxBlocks === 'undefined'
          ? undefined
          : parseInt(this.props.maxBlocks.toString(), 10) || undefined
      this.slateInstance.maxBlocks = this.maxBlocks
    }

    // Update the value if we are not subscribing to patches,
    // or if we do, then only when the current value is never set before (is null).
    if (
      (!this.props.incomingPatches$ && this.state.currentValue !== this.props.value) ||
      (this.props.incomingPatches$ &&
        this.state.currentValue === null &&
        this.props.value &&
        this.props.value !== prevProps.value)
    ) {
      this.syncValue()
    }

    // Validate again if value length has changed
    if (this.props.value && prevProps.value !== this.props.value) {
      debug('Validating')
      const validation = validateValue(
        this.props.value,
        this.portableTextFeatures,
        this.keyGenerator
      )
      if (!validation.valid) {
        this.change$.next({
          type: 'invalidValue',
          resolution: validation.resolution,
          value: this.props.value,
        })
        this.setState({invalidValueResolution: validation.resolution})
      }
    }
  }

  public setEditable = (editable: EditableAPI) => {
    this.editable = {...this.editable, ...editable}
    this.change$.next({type: 'value', value: this.state.currentValue || undefined})
    this.change$.next({type: 'ready'})
  }

  render() {
    if (this.state.invalidValueResolution) {
      return this.state.invalidValueResolution.description
    }
    return (
      <PortableTextEditorContext.Provider value={this}>
        <PortableTextEditorValueContext.Provider value={this.state.currentValue || undefined}>
          <PortableTextEditorSelectionContext.Provider value={this.state.selection}>
            {this.props.children}
          </PortableTextEditorSelectionContext.Provider>
        </PortableTextEditorValueContext.Provider>
      </PortableTextEditorContext.Provider>
    )
  }

  public syncValue: (callbackFn?: () => void) => void = (callbackFn) => {
    if (this.state.hasPendingLocalPatches) {
      debug('Not syncing value (has pending local patches)')
      retrySync(this.syncValue, callbackFn)
      return
    }
    if (this.state.currentValue !== this.props.value) {
      debug('Syncing value')
      const slateValueFromProps = toSlateValue(
        (this.props.value || []).length > 0
          ? this.props.value
          : [
              {
                _type: this.portableTextFeatures.types.block.name,
                _key: this.keyGenerator(),
                style: this.portableTextFeatures.styles[0].value,
                markDefs: [],
                children: [
                  {
                    _type: 'span',
                    _key: this.keyGenerator(),
                    text: '',
                    marks: [],
                  },
                ],
              },
            ],
        {portableTextFeatures: this.portableTextFeatures},
        KEY_TO_SLATE_ELEMENT.get(this.slateInstance)
      )
      if (slateValueFromProps) {
        const originalChildren = this.slateInstance.children
        slateValueFromProps.forEach((n, i) => {
          const existing = originalChildren[i]
          if (existing && !isEqual(n, existing)) {
            originalChildren.splice(i, 1, n)
          } else if (!existing) {
            originalChildren.push(n)
          }
        })
        if (originalChildren.length > slateValueFromProps.length) {
          originalChildren.splice(
            slateValueFromProps.length,
            this.slateInstance.children.length - slateValueFromProps.length
          )
        }
        this.slateInstance.children = originalChildren
      } else {
        this.slateInstance.children = slateValueFromProps
      }
      this.slateInstance.onChange()
      this.setState({currentValue: this.props.value}, callbackFn)
      return
    }
    debug('Not syncing value (is up to date)')
    if (callbackFn) callbackFn()
  }

  // Data storing
  private flush = () => {
    const {onChange} = this.props
    const finalPatches = [...this.pendingPatches]
    if (finalPatches.length > 0) {
      debug('Flushing', finalPatches)
      finalPatches.forEach((p) => {
        this.returnedPatches.push(p)
      })
      onChange({type: 'mutation', patches: finalPatches})
      this.pendingPatches = []
    }
  }
  private flushDebounced = debounce(this.flush, FLUSH_PATCHES_DEBOUNCE_MS, {
    leading: false,
    trailing: true,
  })

  // Static API methods
  static activeAnnotations = (editor: PortableTextEditor): PortableTextBlock[] => {
    return editor && editor.editable ? editor.editable.activeAnnotations() : []
  }
  static addAnnotation = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: unknown}
  ): {spanPath: Path; markDefPath: Path} | undefined => editor.editable?.addAnnotation(type, value)
  static blur = (editor: PortableTextEditor): void => {
    debug('Host blurred')
    editor.editable?.blur()
  }
  static delete = (
    editor: PortableTextEditor,
    selection: EditorSelection,
    options?: EditableAPIDeleteOptions
  ) => editor.editable?.delete(selection, options)
  static findDOMNode = (
    editor: PortableTextEditor,
    element: PortableTextBlock | PortableTextChild
  ) => {
    // eslint-disable-next-line react/no-find-dom-node
    return editor.editable?.findDOMNode(element)
  }
  static findByPath = (editor: PortableTextEditor, path: Path) => {
    return editor.editable?.findByPath(path) || []
  }
  static focus = (editor: PortableTextEditor): void => {
    debug('Host requesting focus')
    editor.editable?.focus()
  }
  static focusBlock = (editor: PortableTextEditor) => {
    return editor.editable?.focusBlock()
  }
  static focusChild = (editor: PortableTextEditor): PortableTextChild | undefined => {
    return editor.editable?.focusChild()
  }
  static getPortableTextFeatures = (editor: PortableTextEditor) => {
    return editor.portableTextFeatures
  }
  static getSelection = (editor: PortableTextEditor) => {
    return editor.editable ? editor.editable.getSelection() : null
  }
  static getValue = (editor: PortableTextEditor) => {
    return editor.editable?.getValue()
  }
  static hasBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    return editor.editable?.hasBlockStyle(blockStyle)
  }
  static hasListStyle = (editor: PortableTextEditor, listStyle: string) => {
    return editor.editable?.hasListStyle(listStyle)
  }
  static isCollapsedSelection = (editor: PortableTextEditor) =>
    editor.editable?.isCollapsedSelection()
  static isExpandedSelection = (editor: PortableTextEditor) =>
    editor.editable?.isExpandedSelection()
  static isMarkActive = (editor: PortableTextEditor, mark: string) =>
    editor.editable?.isMarkActive(mark)
  static insertChild = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: unknown}
  ): Path | undefined => {
    debug(`Host inserting child`)
    return editor.editable?.insertChild(type, value)
  }
  static insertBlock = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: unknown}
  ): Path | undefined => {
    return editor.editable?.insertBlock(type, value)
  }
  static isVoid = (editor: PortableTextEditor, element: PortableTextBlock | PortableTextChild) => {
    return editor.editable?.isVoid(element)
  }
  static isObjectPath = (editor: PortableTextEditor, path: Path): boolean => {
    if (!path || !Array.isArray(path)) return false
    const isChildObjectEditPath = path.length > 3 && path[1] === 'children'
    const isBlockObjectEditPath = path.length > 1 && path[1] !== 'children'
    return isBlockObjectEditPath || isChildObjectEditPath
  }
  static marks = (editor: PortableTextEditor) => {
    return editor.editable?.marks()
  }
  static select = (editor: PortableTextEditor, selection: EditorSelection | null) => {
    debug(`Host setting selection`, selection)
    editor.editable?.select(selection)
  }
  static removeAnnotation = (editor: PortableTextEditor, type: Type) =>
    editor.editable?.removeAnnotation(type)
  static toggleBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    debug(`Host is toggling block style`)
    return editor.editable?.toggleBlockStyle(blockStyle)
  }
  static toggleList = (editor: PortableTextEditor, listStyle: string): void => {
    return editor.editable?.toggleList(listStyle)
  }
  static toggleMark = (editor: PortableTextEditor, mark: string): void => {
    debug(`Host toggling mark`, mark)
    editor.editable?.toggleMark(mark)
  }
}

const retrySync = throttle((syncFn, callbackFn) => syncFn(callbackFn), 100)

function bufferUntil<T>(emitWhen: (currentBuffer: T[]) => boolean): OperatorFunction<T, T[]> {
  return (source: Observable<T>) =>
    defer(() => {
      let buffer: T[] = [] // custom buffer
      return source.pipe(
        tap((v) => buffer.push(v)), // add values to buffer
        switchMap(() => (emitWhen(buffer) ? of(buffer) : EMPTY)), // emit the buffer when the condition is met
        tap(() => (buffer = [])) // clear the buffer
      )
    })
}
