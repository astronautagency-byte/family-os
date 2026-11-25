import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=process.cwd();
const android=path.join(root,'src-tauri/gen/android');
const properties=process.env.FAMOS_ANDROID_KEYSTORE_PROPERTIES||path.join(os.homedir(),'.config/famos/android-signing.properties');
if(!fs.existsSync(properties))throw Error('Configure a private Android signing properties file before preparing a release.');
const gradlePath=path.join(android,'app/build.gradle.kts');
let gradle=fs.readFileSync(gradlePath,'utf8');
if(!gradle.includes('// FAMOS_PRIVATE_SIGNING')){
 gradle=gradle.replace('    buildTypes {',`    // FAMOS_PRIVATE_SIGNING: credentials stay outside the generated project.
    signingConfigs {
        create("release") {
            val privateFile = SigningFile(System.getenv("FAMOS_ANDROID_KEYSTORE_PROPERTIES") ?: (System.getProperty("user.home") + "/.config/famos/android-signing.properties"))
            val keys = Properties().apply { privateFile.inputStream().use { load(it) } }
            storeFile = SigningFile(keys.getProperty("storeFile"))
            storePassword = keys.getProperty("storePassword")
            keyAlias = keys.getProperty("keyAlias")
            keyPassword = keys.getProperty("keyPassword")
        }
    }
    buildTypes {`);
 gradle=gradle.replace('        getByName("release") {','        getByName("release") {\n            signingConfig = signingConfigs.getByName("release")');
 
}
// Gradle's `java` extension shadows the Java package inside Kotlin DSL.
if(!gradle.includes('import java.io.File as SigningFile'))gradle='import java.io.File as SigningFile\n'+gradle;
gradle=gradle.replaceAll('java.io.File(', 'SigningFile(');
fs.writeFileSync(gradlePath,gradle);
const manifestPath=path.join(android,'app/src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(manifestPath,'utf8');
for(const name of ['RECORD_AUDIO','MODIFY_AUDIO_SETTINGS','CAMERA','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION']){
 if(!manifest.includes(`android.permission.${name}"`))manifest=manifest.replace('    <!-- AndroidTV support -->',`    <uses-permission android:name="android.permission.${name}" />\n\n    <!-- AndroidTV support -->`);
}
for(const name of ['camera','microphone','location']){
 if(!manifest.includes(`android.hardware.${name}"`))manifest=manifest.replace('    <!-- AndroidTV support -->',`    <uses-feature android:name="android.hardware.${name}" android:required="false" />\n\n    <!-- AndroidTV support -->`);
}
if(!manifest.includes('android:allowBackup='))manifest=manifest.replace('    <application','    <application\n        android:allowBackup="false"\n        android:fullBackupContent="false"');
fs.writeFileSync(manifestPath,manifest);
fs.cpSync(path.join(root,'src-tauri/icons/android'),path.join(android,'app/src/main/res'),{recursive:true});
console.log('Prepared Android signing references, optional media/location permissions, disabled backups and FamOS icons. No signing credentials were printed.');
