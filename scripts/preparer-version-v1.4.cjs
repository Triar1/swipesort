// Updates the EXISTING Expo project. Does not replace its EAS identity or Android signing setup.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const appPath = path.join(root, 'app.json');
const packagePath = path.join(root, 'package.json');
if (!fs.existsSync(appPath) || !fs.existsSync(packagePath)) {
  console.error('ERREUR : lance BUILD-V1.4.cmd depuis ton dossier SwipeSort existant.');
  process.exit(1);
}
const doc = JSON.parse(fs.readFileSync(appPath, 'utf8'));
const expo = doc.expo;
if (!expo || expo.android?.package !== 'com.personal.swipesort') {
  console.error('ERREUR : identifiant Android different. Arret pour proteger l historique de tri.');
  process.exit(1);
}
if (!expo.extra?.eas?.projectId) {
  console.error('ERREUR : projet Expo EAS absent. Reprends le dossier d origine lie au compte Expo.');
  process.exit(1);
}
// Installable on top of V1.3: same application ID and higher build number.
expo.version = '1.4.0';
expo.android.versionCode = Math.max(5, Number(expo.android.versionCode || 1) + 1);
fs.writeFileSync(appPath, JSON.stringify(doc, null, 2) + '\n');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.version = '1.4.0';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('SwipeSort V1.4 | Android versionCode: ' + expo.android.versionCode);
console.log('Application Android: ' + expo.android.package);
console.log('Projet EAS conserve: ' + expo.extra.eas.projectId);
console.log('Applique le nouvel APK PAR-DESSUS la V1.3. Ne desinstalle pas l appli.');
