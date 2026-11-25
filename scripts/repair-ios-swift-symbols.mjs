// Xcode 27 SwiftPM can internalize SwiftRs @_cdecl bridge symbols.
// Repair only the three exports referenced by swift-rs, before app signing.
import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve('src-tauri/target/aarch64-apple-ios/release/build');
if (!/^Xcode 27\./m.test(execFileSync('xcodebuild',['-version'],{encoding:'utf8'}))) throw Error('This repair is restricted to Xcode 27.');
const sysroot=execFileSync('rustc',['--print','sysroot'],{encoding:'utf8'}).trim();
const host=execFileSync('rustc',['-vV'],{encoding:'utf8'}).match(/^host: (.+)$/m)?.[1];
const objcopy=join(sysroot,'lib/rustlib',host,'bin/llvm-objcopy');
if (!existsSync(objcopy)) throw Error('Install the rustup llvm-tools component before repairing bridge exports.');
const symbols=['_release_object','_retain_object','_string_from_bytes'];
let repaired=0;
for (const name of readdirSync(root).filter(n=>n.startsWith('tauri-'))) {
 const archive=join(root,name,'out/swift-rs/Tauri/release/libTauri.a');
 if(!existsSync(archive))continue;
 const before=execFileSync('nm',[archive],{encoding:'utf8'});
 const local=symbols.filter(symbol=>new RegExp(`^\\S+ t ${symbol}$`,'m').test(before));
 if(!local.length)continue;
 execFileSync(objcopy,[...local.map(s=>`--globalize-symbol=${s}`),archive]);
 const after=execFileSync('nm',[archive],{encoding:'utf8'});
 for(const symbol of local)if(!new RegExp(`^\\S+ T ${symbol}$`,'m').test(after))throw Error(`Bridge export repair failed for ${symbol}.`);
 repaired++;
}
// Rust bundles the native objects into its rlib before the final app links.
// Repair that bundled copy too; changing libTauri.a alone is insufficient.
const deps=resolve('src-tauri/target/aarch64-apple-ios/release/deps');
for(const name of readdirSync(deps).filter(n=>/^libtauri-[a-f0-9]+\.rlib$/.test(n))) {
 const archive=join(deps,name);
 const members=execFileSync('ar',['-t',archive],{encoding:'utf8'}).split('\n');
 if(!members.includes('SwiftRs.o'))continue;
 const before=execFileSync('nm',[archive],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const local=symbols.filter(symbol=>new RegExp(`^\\S+ t ${symbol}$`,'m').test(before));
 if(!local.length)continue;
 const temporary=mkdtempSync(join(tmpdir(),'famos-swiftrs-'));
 try {
  const object=join(temporary,'SwiftRs.o');
  writeFileSync(object,execFileSync('ar',['-p',archive,'SwiftRs.o']));
  execFileSync(objcopy,[...local.map(s=>`--globalize-symbol=${s}`),object]);
  execFileSync('ar',['-r',archive,object]);
  execFileSync('ranlib',[archive]);
  const after=execFileSync('nm',[archive],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
  for(const symbol of local)if(!new RegExp(`^\\S+ T ${symbol}$`,'m').test(after))throw Error(`Bundled bridge repair failed for ${symbol}.`);
  repaired++;
 } finally { rmSync(temporary,{recursive:true,force:true}); }
}
if(!repaired)throw Error('No matching internalized bridge symbols found; do not apply a broader workaround.');
console.log(`Verified SwiftRs exports repaired in ${repaired} Tauri archive(s).`);
