// Builds the Android app on this PC (no EAS queue), signed with the same key EAS uses, so it installs over EAS builds
// and Google Play accepts it. Needs Android Studio's SDK + Java 17, and credentials.json + credentials/android/keystore.jks
// (download once: npx eas-cli credentials -p android → credentials.json → Download). Both are git-ignored.
// Run from Mobile-side:  node scripts/build-android.mjs        (APK + Play .aab)
// Output: android/app/build/outputs/apk/release/app-release.apk and android/app/build/outputs/bundle/release/app-release.aab
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const creds = JSON.parse(readFileSync(resolve(root, 'credentials.json'), 'utf8')).android.keystore;
const store = resolve(root, creds.keystorePath);
if (!existsSync(store)) throw new Error(`Keystore not found: ${store}`);

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

// Fresh android/ folder from app.json (version, plugins, google-services.json)
run('npx', ['expo', 'prebuild', '-p', 'android', '--clean', '--no-install'], root);

// Android Studio's own way to sign a build from outside: these override the debug signing in the generated project
const sign = [
  `-Pandroid.injected.signing.store.file=${store}`,
  `-Pandroid.injected.signing.store.password=${creds.keystorePassword}`,
  `-Pandroid.injected.signing.key.alias=${creds.keyAlias}`,
  `-Pandroid.injected.signing.key.password=${creds.keyPassword}`,
];
try {
  run(resolve(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), ['assembleRelease', 'bundleRelease', ...sign], resolve(root, 'android'));
} catch {
  // Never let the error repeat the command line: it holds the key passwords
  console.error('\nThe Gradle build failed: the reason is in the lines above ("What went wrong").');
  process.exit(1);
}
console.log('\nAPK: android/app/build/outputs/apk/release/app-release.apk\nPlay: android/app/build/outputs/bundle/release/app-release.aab');
