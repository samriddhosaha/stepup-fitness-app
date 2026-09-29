import { db } from './schema'
import { EXERCISE_LIBRARY } from './exerciseLibrary'

export async function ensureExerciseLibrarySeeded(): Promise<void> {
  const count = await db.exercises.count()
  if (count === 0) {
    await db.exercises.bulkAdd(EXERCISE_LIBRARY)
  }
}
