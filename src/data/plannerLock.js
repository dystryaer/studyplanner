export function acquirePlannerLock(userId) {
  if (!navigator.locks) {
    return Promise.reject(new Error('This browser cannot safely open an editable planner.'));
  }
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    navigator.locks.request(`studyplanner:${userId}`, { signal: controller.signal }, async () => {
      clearTimeout(timeout);
      await new Promise(release => resolve(release));
    }).catch(error => {
      clearTimeout(timeout);
      if (error.name === 'AbortError') resolve(null);
      else reject(error);
    });
  });
}
