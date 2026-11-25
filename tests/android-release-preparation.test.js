import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const prepare=path.resolve('scripts/prepare-android-release.mjs');
test('regenerated Android release retains permissions and private signing references without duplicating patches',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'famos-android-prep-'));
 try{
  const android=path.join(temp,'src-tauri/gen/android/app');fs.mkdirSync(path.join(android,'src/main'),{recursive:true});fs.mkdirSync(path.join(temp,'src-tauri/icons/android/mipmap-hdpi'),{recursive:true});fs.writeFileSync(path.join(temp,'src-tauri/icons/android/mipmap-hdpi/ic_launcher.png'),'synthetic icon');
  const gradle=path.join(android,'build.gradle.kts');fs.writeFileSync(gradle,'import java.util.Properties\nandroid {\n    buildTypes {\n        getByName("release") {\n        }\n    }\n}\n');
  const manifest=path.join(android,'src/main/AndroidManifest.xml');fs.writeFileSync(manifest,'<manifest>\n    <!-- AndroidTV support -->\n    <application>\n    </application>\n</manifest>');
  const properties=path.join(temp,'private.properties');fs.writeFileSync(properties,'synthetic-only');
  for(let i=0;i<2;i++)assert.equal(spawnSync(process.execPath,[prepare],{cwd:temp,env:{...process.env,FAMOS_ANDROID_KEYSTORE_PROPERTIES:properties},encoding:'utf8'}).status,0);
  const g=fs.readFileSync(gradle,'utf8'),m=fs.readFileSync(manifest,'utf8');assert.equal(g.match(/FAMOS_PRIVATE_SIGNING/g).length,1);assert.match(g,/System.getenv\("FAMOS_ANDROID_KEYSTORE_PROPERTIES"\)/);assert.doesNotMatch(g,/synthetic-only/);assert.equal(m.match(/android.permission.RECORD_AUDIO/g).length,1);assert.match(m,/android:allowBackup="false"/);assert.match(m,/android.hardware.microphone" android:required="false"/);assert.match(m,/android.hardware.camera.autofocus" android:required="false"/);assert.match(m,/android.hardware.location.gps" android:required="false"/);assert.match(m,/android.hardware.location.network" android:required="false"/);assert.ok(fs.existsSync(path.join(android,'src/main/res/mipmap-hdpi/ic_launcher.png')));
  assert.notEqual(spawnSync(process.execPath,[prepare],{cwd:temp,env:{...process.env,FAMOS_ANDROID_KEYSTORE_PROPERTIES:path.join(temp,'missing')},encoding:'utf8'}).status,0);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
