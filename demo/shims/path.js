export const resolve = (...p) => p.filter(Boolean).join('/'), join = (...p) => p.filter(Boolean).join('/'), dirname = p => p.split('/').slice(0, -1).join('/') || '/';
export default { resolve, join, dirname };
