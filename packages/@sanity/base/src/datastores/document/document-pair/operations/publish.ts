import {omit} from 'lodash'
import {isReference} from '@sanity/types'
import {versionedClient} from '../../../../client/versionedClient'
import {OperationArgs} from '../../types'

import {isLiveEditEnabled} from '../utils/isLiveEditEnabled'

function strengthenOnPublish(obj: unknown) {
  if (isReference(obj)) {
    if (obj._strengthenOnPublish) {
      return omit(
        obj,
        ['_strengthenOnPublish'].concat(obj._strengthenOnPublish.weak ? [] : ['_weak'])
      )
    }
    return obj
  }
  if (typeof obj !== 'object' || !obj) return obj
  if (Array.isArray(obj)) return obj.map(strengthenOnPublish)
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, strengthenOnPublish(value)] as const)
  )
}

export const publish = {
  disabled: ({typeName, snapshots}: OperationArgs) => {
    if (isLiveEditEnabled(typeName)) {
      return 'LIVE_EDIT_ENABLED'
    }
    if (!snapshots.draft) {
      return snapshots.published ? 'ALREADY_PUBLISHED' : 'NO_CHANGES'
    }
    return false
  },
  execute: ({idPair, snapshots}: OperationArgs) => {
    const tx = versionedClient.transaction()

    const value = strengthenOnPublish(omit(snapshots.draft, '_updatedAt'))

    if (snapshots.published) {
      // If it exists already, we only want to update it if the revision on the remote server
      // matches what our local state thinks it's at
      tx.patch(idPair.publishedId, {
        // Hack until other mutations support revision locking
        unset: ['_revision_lock_pseudo_field_'],
        ifRevisionID: snapshots.published._rev,
      })

      tx.createOrReplace({
        ...value,
        _id: idPair.publishedId,
        _type: snapshots.draft._type,
      })
    } else {
      // If the document has not been published, we want to create it - if it suddenly exists
      // before being created, we don't want to overwrite if, instead we want to yield an error
      tx.create({
        ...value,
        _id: idPair.publishedId,
        _type: snapshots.draft._type,
      })
    }

    tx.delete(idPair.draftId)

    return tx.commit({tag: 'document.publish'})
  },
}
