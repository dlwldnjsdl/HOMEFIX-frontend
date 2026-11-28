const buildBase = document.getElementById('app')?.dataset.base || '/';
// The Docker bundle resolves its relative base from the requested mount path.
const appBase = buildBase === './' ? new URL('.', document.baseURI).pathname : buildBase;

export function appPath(path: string) {
    return appBase + path;
}
