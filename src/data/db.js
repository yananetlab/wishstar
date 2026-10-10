const DATABASE_NAME = 'wishstar'
const DATABASE_VERSION = 1
const WISHES_STORE = 'wishes'
const META_STORE = 'meta'

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve)
    transaction.addEventListener('abort', () => reject(transaction.error))
    transaction.addEventListener('error', () => reject(transaction.error))
  })
}

function openDatabase(name = DATABASE_NAME) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result

      if (!database.objectStoreNames.contains(WISHES_STORE)) {
        const wishes = database.createObjectStore(WISHES_STORE, {
          keyPath: 'id',
        })
        wishes.createIndex('date', 'date', { unique: true })
      }

      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    })

    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
    request.addEventListener('blocked', () =>
      reject(new Error('数据库升级被其他页面阻止，请关闭旧页面后重试')),
    )
  })
}

export function createRepository(name = DATABASE_NAME) {
  let databasePromise
  const database = () => {
    databasePromise ??= openDatabase(name)
    return databasePromise
  }

  return {
    async getAllWishes() {
      const db = await database()
      const transaction = db.transaction(WISHES_STORE, 'readonly')
      return requestResult(transaction.objectStore(WISHES_STORE).getAll())
    },

    async saveWish(wish) {
      const db = await database()
      const transaction = db.transaction(WISHES_STORE, 'readwrite')
      transaction.objectStore(WISHES_STORE).put(wish)
      await transactionDone(transaction)
      return wish
    },

    async deleteWish(id) {
      const db = await database()
      const transaction = db.transaction(WISHES_STORE, 'readwrite')
      transaction.objectStore(WISHES_STORE).delete(id)
      await transactionDone(transaction)
    },

    async replaceWishes(wishes) {
      const db = await database()
      const transaction = db.transaction(WISHES_STORE, 'readwrite')
      const store = transaction.objectStore(WISHES_STORE)
      store.clear()
      wishes.forEach((wish) => store.put(wish))
      await transactionDone(transaction)
    },

    async getMeta(key) {
      const db = await database()
      const transaction = db.transaction(META_STORE, 'readonly')
      const item = await requestResult(
        transaction.objectStore(META_STORE).get(key),
      )
      return item?.value
    },

    async setMeta(key, value) {
      const db = await database()
      const transaction = db.transaction(META_STORE, 'readwrite')
      transaction.objectStore(META_STORE).put({ key, value })
      await transactionDone(transaction)
    },

    async deleteMeta(key) {
      const db = await database()
      const transaction = db.transaction(META_STORE, 'readwrite')
      transaction.objectStore(META_STORE).delete(key)
      await transactionDone(transaction)
    },

    async clearAll() {
      const db = await database()
      const transaction = db.transaction(
        [WISHES_STORE, META_STORE],
        'readwrite',
      )
      transaction.objectStore(WISHES_STORE).clear()
      transaction.objectStore(META_STORE).clear()
      await transactionDone(transaction)
    },
  }
}

export const repository = createRepository()
